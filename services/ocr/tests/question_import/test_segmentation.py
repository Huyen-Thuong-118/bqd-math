from app.question_import.layout.repeated_regions import detect_repeated_regions
from app.question_import.models.document import (
    DocumentPage,
    TextLine,
    TextRegion,
    TextSpan,
)
from app.question_import.models.geometry import BoundingBox
from app.question_import.segmentation.questions import (
    build_question_regions,
    detect_question_anchors,
)
from app.question_import.segmentation.sections import detect_sections


def line(text: str, y: float) -> TextLine:
    bbox = BoundingBox(x0=40, y0=y, x1=550, y1=y + 12)
    return TextLine(spans=[TextSpan(text=text, bbox=bbox, font_size=11)], bbox=bbox)


def page(number: int, lines: list[TextLine]) -> DocumentPage:
    region_box = lines[0].bbox
    for item in lines[1:]:
        region_box = region_box.union(item.bbox)
    return DocumentPage(
        number=number,
        width=612,
        height=792,
        pixel_width=1224,
        pixel_height=1584,
        text_regions=[TextRegion(lines=lines, bbox=region_box)],
        embedded_images=[],
        rendered_path=f"page-{number}.webp",
        rendered_asset_id=f"page-{number}",
    )


def test_filters_repeated_footer_and_segments_multi_page_question():
    pages = [
        page(
            1,
            [
                line("PHẦN I. Câu trắc nghiệm nhiều phương án", 80),
                line("Câu 1. Cho hàm số", 650),
                line("Biên soạn và tuyển chọn - 1", 770),
            ],
        ),
        page(
            2,
            [
                line("A. 1    B. 2    C. 3    D. 4", 40),
                line("Câu 2: Câu tiếp theo", 180),
                line("Biên soạn và tuyển chọn - 2", 770),
            ],
        ),
    ]
    ignored = detect_repeated_regions(pages)
    assert len(ignored) == 2
    sections = detect_sections(pages, ignored)
    assert sections[0].detected_type == "multiple_choice"
    anchors = detect_question_anchors(pages, sections, ignored)
    assert [item.number for item in anchors] == ["1", "2"]
    regions = build_question_regions(pages, anchors, sections, ignored)
    assert [item.page for item in regions[0].regions] == [1, 2]
    assert regions[0].regions[1].bbox.y1 == anchors[1].bbox.y0


def test_detects_true_false_descriptor_with_vietnamese_d_bar():
    pages = [
        page(1, [line("Phần II: Câu trắc nghiệm đúng sai. Từ câu 1 đến câu 4", 80)])
    ]
    section = detect_sections(pages, [])[0]
    assert section.detected_type == "true_false"
    assert section.declared_count == 4
