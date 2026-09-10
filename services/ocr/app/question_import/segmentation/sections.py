from __future__ import annotations

import re

from ..layout.reading_order import lines_in_reading_order
from ..layout.repeated_regions import is_ignored, normalized_text
from ..models.document import DocumentPage
from ..models.geometry import PageRegion
from ..models.question import ExamSection, QuestionType

SECTION_PATTERN = re.compile(r"^\s*ph[aầ]n\s+(i{1,3}|[123])\b", re.IGNORECASE)


def _section_number(token: str) -> int | None:
    return {"i": 1, "ii": 2, "iii": 3, "1": 1, "2": 2, "3": 3}.get(token.casefold())


def _type_from_text(text: str, section_number: int | None) -> QuestionType:
    plain = normalized_text(text, mask_numbers=False)
    if "dung sai" in plain:
        return "true_false"
    if "tra loi ngan" in plain:
        return "short_answer"
    if "nhieu phuong an" in plain or "trac nghiem" in plain:
        return "multiple_choice"
    return {1: "multiple_choice", 2: "true_false", 3: "short_answer"}.get(
        section_number, "unknown"
    )


def _declared_count(text: str) -> int | None:
    plain = normalized_text(text, mask_numbers=False)
    match = re.search(r"cau\s*1\s*(?:den|toi|-)\s*cau\s*(\d+)", plain)
    return int(match.group(1)) if match else None


def detect_sections(
    pages: list[DocumentPage], ignored: list[PageRegion]
) -> list[ExamSection]:
    sections: list[ExamSection] = []
    for page in pages:
        lines = lines_in_reading_order(page)
        for index, line in enumerate(lines):
            if is_ignored(page.number, line.bbox, ignored):
                continue
            match = SECTION_PATTERN.match(line.text)
            if not match:
                continue
            following = " ".join(item.text for item in lines[index : index + 3])
            number = _section_number(match.group(1))
            detected_type = _type_from_text(following, number)
            confidence = 0.98 if detected_type != "unknown" else 0.75
            sections.append(
                ExamSection(
                    id=f"section_{len(sections) + 1}",
                    index=len(sections) + 1,
                    label=line.text.strip(),
                    detected_type=detected_type,
                    page=page.number,
                    bbox=line.bbox,
                    start_anchor=line.text.strip(),
                    confidence=confidence,
                    declared_count=_declared_count(following),
                )
            )
    return sections
