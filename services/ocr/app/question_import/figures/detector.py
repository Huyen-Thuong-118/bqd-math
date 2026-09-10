from __future__ import annotations

from ..models.document import DocumentPage
from ..models.geometry import QuestionRegion
from ..models.question import FigureCandidate


def embedded_figure_candidates(
    region: QuestionRegion, pages: list[DocumentPage]
) -> list[FigureCandidate]:
    """High-precision candidates only. Vector drawings remain in the lossless snapshot."""
    page_by_number = {page.number: page for page in pages}
    candidates: list[FigureCandidate] = []
    for page_region in region.regions:
        page = page_by_number[page_region.page]
        for image in page.embedded_images:
            page_fraction = image.bbox.area / (page.width * page.height)
            width_fraction = image.bbox.width / page.width
            if (
                image.bbox.intersects(page_region.bbox)
                and 0.002 < page_fraction < 0.6
                and width_fraction < 0.75
            ):
                candidates.append(
                    FigureCandidate(page=page.number, bbox=image.bbox, confidence=0.9)
                )
    return candidates
