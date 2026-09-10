from __future__ import annotations

import io

import pymupdf
from PIL import Image

from ..models.document import (
    DocumentPage,
    IngestedDocument,
    PageImageObject,
    TextLine,
    TextRegion,
    TextSpan,
)
from ..models.geometry import BoundingBox
from ..storage.assets import AssetStorage


class PdfIngestor:
    def __init__(self, *, dpi: int = 200, max_pages: int = 300):
        if not 180 <= dpi <= 300:
            raise ValueError("render DPI must be between 180 and 300")
        self.dpi = dpi
        self.max_pages = max_pages

    async def ingest(
        self,
        data: bytes,
        *,
        filename: str,
        document_id: str,
        original_asset_id: str,
        storage: AssetStorage,
    ) -> IngestedDocument:
        if not data.startswith(b"%PDF-"):
            raise ValueError("file is not a PDF")
        try:
            document = pymupdf.open(stream=data, filetype="pdf")
        except Exception as error:
            raise ValueError(f"cannot open PDF: {error}") from error
        try:
            if document.needs_pass:
                raise ValueError("password-protected PDFs are not supported")
            if len(document) == 0 or len(document) > self.max_pages:
                raise ValueError(
                    f"PDF page count must be between 1 and {self.max_pages}"
                )
            pages: list[DocumentPage] = []
            scale = self.dpi / 72.0
            for page_index, page in enumerate(document):
                page_number = page_index + 1
                expected_pixels = page.rect.width * page.rect.height * scale * scale
                if expected_pixels <= 0 or expected_pixels > 50_000_000:
                    raise ValueError(f"PDF page {page_number} has unsafe dimensions")
                pixmap = page.get_pixmap(
                    matrix=pymupdf.Matrix(scale, scale), alpha=False
                )
                rendered = Image.frombytes(
                    "RGB", (pixmap.width, pixmap.height), pixmap.samples
                )
                output = io.BytesIO()
                rendered.save(output, format="WEBP", quality=95, method=6)
                image_bytes = output.getvalue()
                image_asset = await storage.save(
                    image_bytes,
                    document_id=document_id,
                    kind="pages",
                    extension="webp",
                    name=f"page_{page_number:03d}",
                    page=page_number,
                )
                regions = self._text_regions(page)
                images = self._embedded_images(page)
                visible_chars = sum(
                    len(line.text) for region in regions for line in region.lines
                )
                pages.append(
                    DocumentPage(
                        number=page_number,
                        width=float(page.rect.width),
                        height=float(page.rect.height),
                        pixel_width=pixmap.width,
                        pixel_height=pixmap.height,
                        text_regions=regions,
                        embedded_images=images,
                        rendered_path=image_asset.path,
                        rendered_asset_id=image_asset.id,
                        requires_visual_transcription=visible_chars < 40,
                    )
                )
            return IngestedDocument(
                id=document_id,
                filename=filename,
                original_asset_id=original_asset_id,
                pages=pages,
            )
        finally:
            document.close()

    @staticmethod
    def _bbox(value) -> BoundingBox:
        return BoundingBox(
            x0=float(value[0]),
            y0=float(value[1]),
            x1=float(value[2]),
            y1=float(value[3]),
        )

    def _text_regions(self, page) -> list[TextRegion]:
        result: list[TextRegion] = []
        raw = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT)
        for block in raw.get("blocks", []):
            if block.get("type") != 0:
                continue
            lines: list[TextLine] = []
            for raw_line in block.get("lines", []):
                spans = [
                    TextSpan(
                        text=str(span.get("text", "")),
                        bbox=self._bbox(span["bbox"]),
                        font_size=float(span["size"])
                        if span.get("size") is not None
                        else None,
                        font_name=str(span["font"]) if span.get("font") else None,
                        flags=int(span["flags"])
                        if span.get("flags") is not None
                        else None,
                    )
                    for span in raw_line.get("spans", [])
                    if span.get("bbox") and span.get("text")
                ]
                if spans:
                    lines.append(
                        TextLine(spans=spans, bbox=self._bbox(raw_line["bbox"]))
                    )
            if lines:
                result.append(TextRegion(lines=lines, bbox=self._bbox(block["bbox"])))
        return result

    def _embedded_images(self, page) -> list[PageImageObject]:
        result: list[PageImageObject] = []
        try:
            for image in page.get_image_info(xrefs=True):
                bbox = image.get("bbox")
                if bbox:
                    result.append(
                        PageImageObject(
                            bbox=self._bbox(bbox), xref=image.get("xref") or None
                        )
                    )
        except (RuntimeError, ValueError):
            pass
        return result
