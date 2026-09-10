from __future__ import annotations

import asyncio
import hashlib
import mimetypes
import os
import re
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from PIL import Image

from ..models.result import AssetRecord


class AssetStorage(Protocol):
    async def save(
        self,
        file: bytes,
        *,
        document_id: str,
        kind: str,
        extension: str,
        name: str | None = None,
        page: int | None = None,
    ) -> AssetRecord: ...


class RecordingAssetStorage:
    """Per-import recorder that keeps the pipeline independent of storage internals."""

    def __init__(self, delegate: AssetStorage):
        self.delegate = delegate
        self.records: list[AssetRecord] = []

    async def save(self, file: bytes, **kwargs) -> AssetRecord:
        record = await self.delegate.save(file, **kwargs)
        self.records.append(record)
        return record


class LocalAssetStorage:
    """Local, atomic implementation whose object keys map cleanly to S3/R2 later."""

    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(
        self,
        file: bytes,
        *,
        document_id: str,
        kind: str,
        extension: str,
        name: str | None = None,
        page: int | None = None,
    ) -> AssetRecord:
        document_id = self._safe_segment(document_id)
        kind = self._safe_segment(kind)
        extension = extension.lower().lstrip(".")
        if not re.fullmatch(r"[a-z0-9]{1,10}", extension):
            raise ValueError("invalid asset extension")
        stem = self._safe_segment(name) if name else uuid4().hex
        object_key = f"{document_id}/{kind}/{stem}.{extension}"
        destination = (self.root / object_key).resolve()
        if self.root not in destination.parents:
            raise ValueError("asset path escapes storage root")

        await asyncio.to_thread(self._atomic_write, destination, file)
        width, height = await asyncio.to_thread(self._image_dimensions, destination)
        digest = hashlib.sha256(object_key.encode() + b"\0" + file).hexdigest()[:16]
        record = AssetRecord(
            id=f"asset_{digest}",
            document_id=document_id,
            kind=kind,
            object_key=object_key,
            path=str(destination),
            public_url=f"/api/question-import/assets/{object_key}",
            mime_type=mimetypes.guess_type(destination.name)[0]
            or "application/octet-stream",
            width=width,
            height=height,
            page=page,
        )
        return record

    @staticmethod
    def _safe_segment(value: str | None) -> str:
        clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", value or "").strip("-_")
        if not clean or clean in {".", ".."}:
            raise ValueError("invalid asset path segment")
        return clean[:120]

    @staticmethod
    def _atomic_write(destination: Path, data: bytes) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")
        try:
            with temporary.open("xb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)

    @staticmethod
    def _image_dimensions(path: Path) -> tuple[int | None, int | None]:
        try:
            with Image.open(path) as image:
                return image.size
        except (OSError, ValueError):
            return None, None
