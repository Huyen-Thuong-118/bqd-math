from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ..layout.page_layout import page_content_box
from ..layout.reading_order import lines_in_reading_order
from ..layout.repeated_regions import is_ignored
from ..models.document import DocumentPage
from ..models.geometry import BoundingBox, PageRegion, QuestionRegion
from ..models.question import ExamSection

QUESTION_PATTERN = re.compile(r"^\s*C[aâ]u\s+(\d+)\s*([.:)])?", re.IGNORECASE)


class QuestionAnchor(BaseModel):
    page: int
    bbox: BoundingBox
    number: str
    text: str
    section_id: str | None = None
    confidence: float = Field(ge=0, le=1)


def _position(page: int, y: float) -> tuple[int, float]:
    return page, y


def detect_question_anchors(
    pages: list[DocumentPage], sections: list[ExamSection], ignored: list[PageRegion]
) -> list[QuestionAnchor]:
    ordered_sections = sorted(
        sections, key=lambda item: _position(item.page, item.bbox.y0)
    )
    anchors: list[QuestionAnchor] = []
    for page in pages:
        for line in lines_in_reading_order(page):
            if is_ignored(page.number, line.bbox, ignored):
                continue
            match = QUESTION_PATTERN.match(line.text)
            if not match:
                continue
            current_section = next(
                (
                    section
                    for section in reversed(ordered_sections)
                    if _position(section.page, section.bbox.y0)
                    <= _position(page.number, line.bbox.y0)
                ),
                None,
            )
            punctuation = match.group(2)
            anchors.append(
                QuestionAnchor(
                    page=page.number,
                    bbox=line.bbox,
                    number=match.group(1),
                    text=line.text,
                    section_id=current_section.id if current_section else None,
                    confidence=0.99 if punctuation == "." else 0.88,
                )
            )
    return anchors


def build_question_regions(
    pages: list[DocumentPage],
    anchors: list[QuestionAnchor],
    sections: list[ExamSection],
    ignored: list[PageRegion],
) -> list[QuestionRegion]:
    page_by_number = {page.number: page for page in pages}
    boundaries = sorted(
        [(anchor.page, anchor.bbox.y0, "question", anchor) for anchor in anchors]
        + [(section.page, section.bbox.y0, "section", section) for section in sections],
        key=lambda item: (item[0], item[1], item[2]),
    )
    regions: list[QuestionRegion] = []
    for anchor in anchors:
        start = _position(anchor.page, anchor.bbox.y0)
        following = next(
            (
                boundary
                for boundary in boundaries
                if _position(boundary[0], boundary[1]) > start
                and not (
                    boundary[2] == "section" and boundary[3].id == anchor.section_id
                )
            ),
            None,
        )
        end_page = following[0] if following else pages[-1].number
        end_y = following[1] if following else page_by_number[end_page].height
        page_regions: list[PageRegion] = []
        for page_number in range(anchor.page, end_page + 1):
            page = page_by_number[page_number]
            content = page_content_box(page, ignored)
            y0 = anchor.bbox.y0 if page_number == anchor.page else content.y0
            y1 = end_y if page_number == end_page else content.y1
            if y1 <= y0:
                continue
            page_regions.append(
                PageRegion(
                    page=page_number,
                    bbox=BoundingBox(
                        x0=0, y0=max(0, y0 - 2), x1=page.width, y1=min(page.height, y1)
                    ),
                )
            )
        confidence = anchor.confidence
        if len(page_regions) > 1:
            confidence = min(confidence, 0.92)
        regions.append(
            QuestionRegion(
                number=anchor.number,
                section_id=anchor.section_id,
                regions=page_regions,
                confidence=confidence,
            )
        )
    return regions
