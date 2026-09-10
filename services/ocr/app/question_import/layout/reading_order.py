from ..models.document import DocumentPage, TextLine


def lines_in_reading_order(page: DocumentPage) -> list[TextLine]:
    """Stable geometric order for predominantly single-column exam pages."""
    tolerance = max(2.0, page.height * 0.003)
    return sorted(
        page.lines,
        key=lambda line: (round(line.bbox.y0 / tolerance), line.bbox.x0, line.bbox.y0),
    )
