from __future__ import annotations

import asyncio
import io
import shutil
import tempfile
import zipfile
from pathlib import Path


class DocxIngestor:
    """Converts DOCX to a rendered PDF so all later stages share one source of truth."""

    async def to_pdf(self, data: bytes, filename: str) -> bytes:
        self._validate_package(data)
        executable = shutil.which("libreoffice") or shutil.which("soffice")
        if not executable:
            raise ValueError("DOCX import requires LibreOffice")
        with tempfile.TemporaryDirectory(prefix="question-import-") as directory:
            root = Path(directory)
            source = root / "source.docx"
            source.write_bytes(data)
            profile = root / "libreoffice-profile"
            process = await asyncio.create_subprocess_exec(
                executable,
                f"-env:UserInstallation={profile.as_uri()}",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(root),
                str(source),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=60
                )
            except TimeoutError as error:
                process.kill()
                await process.communicate()
                raise ValueError("DOCX rendering timed out") from error
            output = root / "source.pdf"
            if process.returncode != 0 or not output.exists():
                detail = (stderr or stdout).decode(errors="replace").strip()
                raise ValueError(
                    f"cannot render DOCX: {detail or 'LibreOffice failed'}"
                )
            return output.read_bytes()

    @staticmethod
    def _validate_package(data: bytes) -> None:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                names = {entry.filename for entry in entries}
                if (
                    "[Content_Types].xml" not in names
                    or "word/document.xml" not in names
                ):
                    raise ValueError("file is not a Word DOCX package")
                if len(entries) > 5000:
                    raise ValueError("DOCX contains too many package entries")
                if sum(entry.file_size for entry in entries) > 250 * 1024 * 1024:
                    raise ValueError("DOCX expanded content is too large")
                if any(
                    Path(entry.filename).is_absolute()
                    or ".." in Path(entry.filename).parts
                    for entry in entries
                ):
                    raise ValueError("DOCX contains an unsafe package path")
        except zipfile.BadZipFile as error:
            raise ValueError("DOCX package is corrupt") from error
