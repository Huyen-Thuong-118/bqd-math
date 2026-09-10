from __future__ import annotations

import math
import re
import unicodedata
from collections import defaultdict

from ..models.document import DocumentPage
from ..models.geometry import PageRegion
from .reading_order import lines_in_reading_order


def normalized_text(value: str, *, mask_numbers: bool = True) -> str:
    value = unicodedata.normalize("NFD", value.casefold())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = value.replace("đ", "d")
    if mask_numbers:
        value = re.sub(r"\d+", "#", value)
    return re.sub(r"\W+", " ", value, flags=re.UNICODE).strip()


def detect_repeated_regions(
    pages: list[DocumentPage], threshold: float = 0.5
) -> list[PageRegion]:
    if len(pages) < 2:
        return []
    occurrences: dict[str, list[tuple[int, object]]] = defaultdict(list)
    for page in pages:
        for line in lines_in_reading_order(page):
            in_edge = (
                line.bbox.y1 <= page.height * 0.14 or line.bbox.y0 >= page.height * 0.86
            )
            key = normalized_text(line.text)
            if in_edge and key and (len(key) >= 3 or key == "#"):
                occurrences[key].append((page.number, line))

    minimum = max(2, math.ceil(len(pages) * threshold))
    repeated: list[PageRegion] = []
    for matches in occurrences.values():
        if len({page for page, _ in matches}) < minimum:
            continue
        repeated.extend(PageRegion(page=page, bbox=line.bbox) for page, line in matches)
    return repeated


def is_ignored(page: int, bbox, ignored: list[PageRegion]) -> bool:
    return any(item.page == page and item.bbox.intersects(bbox) for item in ignored)
