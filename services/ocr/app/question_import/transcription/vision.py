from __future__ import annotations

import asyncio
import base64
import json
import urllib.request
from pathlib import Path

from ..models.geometry import BoundingBox
from .prompts import SYSTEM_PROMPT
from .schemas import (
    TranscriptionContext,
    TranscriptionResult,
    attach_region_provenance,
    enforce_explicit_answer_evidence,
    normalize_transcription_json,
)


def map_normalized_figure_boxes(
    result: TranscriptionResult, context: TranscriptionContext
) -> None:
    page_by_number = {page.number: page for page in context.pages}
    region_by_number = {region.page: region for region in context.source_regions}
    for figure in result.figures:
        page = page_by_number.get(figure.page)
        if not page:
            raise ValueError(f"vision returned figure on unknown page {figure.page}")
        region = region_by_number.get(figure.page)
        if not region:
            raise ValueError(
                f"vision returned figure outside question region on page {figure.page}"
            )
        local = BoundingBox.from_normalized(
            figure.bbox, region.bbox.width, region.bbox.height
        )
        figure.bbox = BoundingBox(
            x0=region.bbox.x0 + local.x0,
            y0=region.bbox.y0 + local.y0,
            x1=region.bbox.x0 + local.x1,
            y1=region.bbox.y0 + local.y1,
        )


class HttpVisionTranscriber:
    """Provider-neutral adapter for a separately deployed multimodal transcription service."""

    def __init__(self, endpoint: str, *, timeout: float = 180):
        if not endpoint.startswith(("http://", "https://")):
            raise ValueError("vision endpoint must be HTTP(S)")
        self.endpoint = endpoint
        self.timeout = timeout

    async def transcribe(
        self, source_images: list[str], context: TranscriptionContext
    ) -> TranscriptionResult:
        images = []
        for index, path in enumerate(source_images):
            data = await asyncio.to_thread(Path(path).read_bytes)
            images.append(
                {
                    "page_order": index + 1,
                    "source_page": context.pages[index].number,
                    "mime_type": "image/webp",
                    "data": base64.b64encode(data).decode(),
                }
            )
        body = json.dumps(
            {
                "prompt": SYSTEM_PROMPT,
                "schema": TranscriptionResult.model_json_schema(),
                "context": {
                    "document_id": context.document_id,
                    "question_number": context.question_number,
                    "section_type": context.section_type,
                },
                "images": images,
            }
        ).encode()

        def request() -> bytes:
            call = urllib.request.Request(
                self.endpoint,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(call, timeout=self.timeout) as response:
                return response.read()

        payload = await asyncio.to_thread(request)
        result = normalize_transcription_json(payload)
        map_normalized_figure_boxes(result, context)
        attach_region_provenance(result, context)
        enforce_explicit_answer_evidence(result, context)
        return result
