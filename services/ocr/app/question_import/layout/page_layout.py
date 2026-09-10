from __future__ import annotations

from ..models.document import DocumentPage, TextLine
from ..models.geometry import BoundingBox, PageRegion


def line_overlaps_region(
    line: TextLine, region: PageRegion, page: DocumentPage
) -> bool:
    return region.page == page.number and line.bbox.intersects(region.bbox)


def page_content_box(page: DocumentPage, ignored: list[PageRegion]) -> BoundingBox:
    lines = [
        line
        for line in page.lines
        if line.text
        and not any(
            item.page == page.number and item.bbox.intersects(line.bbox)
            for item in ignored
        )
    ]
    if not lines:
        return BoundingBox(x0=0, y0=0, x1=page.width, y1=page.height)
    box = lines[0].bbox
    for line in lines[1:]:
        box = box.union(line.bbox)
    return box.expand(4, max_width=page.width, max_height=page.height)
