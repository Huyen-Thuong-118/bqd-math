from __future__ import annotations

import asyncio
from typing import Protocol

import pytesseract
from PIL import Image
from pytesseract import Output

from ..models.document import DocumentPage, TextLine, TextSpan
from ..models.geometry import BoundingBox


class OcrEngine(Protocol):
    async def extract_lines(self, page: DocumentPage) -> list[TextLine]: ...


class TesseractStructuralOcr:
    """OCR only for locating anchors on scans; its output is never canonical math."""

    async def extract_lines(self, page: DocumentPage) -> list[TextLine]:
        def recognize():
            with Image.open(page.rendered_path) as image:
                try:
                    return pytesseract.image_to_data(
                        image, lang="vie+eng", output_type=Output.DICT
                    )
                except pytesseract.TesseractError:
                    return pytesseract.image_to_data(
                        image, lang="eng", output_type=Output.DICT
                    )

        data = await asyncio.to_thread(recognize)
        grouped: dict[tuple[int, int, int], list[int]] = {}
        for index, text in enumerate(data["text"]):
            if not text.strip() or float(data["conf"][index]) < 20:
                continue
            key = (
                data["block_num"][index],
                data["par_num"][index],
                data["line_num"][index],
            )
            grouped.setdefault(key, []).append(index)

        lines: list[TextLine] = []
        x_scale = page.width / page.pixel_width
        y_scale = page.height / page.pixel_height
        for indexes in grouped.values():
            spans: list[TextSpan] = []
            for index in indexes:
                x0 = data["left"][index] * x_scale
                y0 = data["top"][index] * y_scale
                x1 = (data["left"][index] + data["width"][index]) * x_scale
                y1 = (data["top"][index] + data["height"][index]) * y_scale
                spans.append(
                    TextSpan(
                        text=data["text"][index] + " ",
                        bbox=BoundingBox(x0=x0, y0=y0, x1=x1, y1=y1),
                    )
                )
            if spans:
                box = spans[0].bbox
                for span in spans[1:]:
                    box = box.union(span.bbox)
                lines.append(TextLine(spans=spans, bbox=box))
        return lines
