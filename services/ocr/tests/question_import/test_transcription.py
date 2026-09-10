import pytest
from app.question_import.models.document import (
    DocumentPage,
    TextLine,
    TextRegion,
    TextSpan,
)
from app.question_import.models.geometry import BoundingBox, PageRegion
from app.question_import.models.question import FigureCandidate
from app.question_import.transcription.base import ExtractedTextTranscriber
from app.question_import.transcription.schemas import (
    TranscriptionContext,
    TranscriptionResult,
    attach_region_provenance,
    enforce_explicit_answer_evidence,
    normalize_transcription_json,
)
from app.question_import.transcription.vision import map_normalized_figure_boxes


def make_context(values: list[str], question_type="multiple_choice"):
    lines = []
    for index, value in enumerate(values):
        bbox = BoundingBox(x0=20, y0=20 + index * 20, x1=580, y1=35 + index * 20)
        lines.append(TextLine(spans=[TextSpan(text=value, bbox=bbox)], bbox=bbox))
    page = DocumentPage(
        number=1,
        width=612,
        height=792,
        pixel_width=1224,
        pixel_height=1584,
        text_regions=[
            TextRegion(
                lines=lines,
                bbox=BoundingBox(x0=20, y0=20, x1=580, y1=35 + len(lines) * 20),
            )
        ],
        embedded_images=[],
        rendered_path="unused.webp",
        rendered_asset_id="page",
    )
    return TranscriptionContext(
        document_id="doc",
        question_number="1",
        section_type=question_type,
        pages=[page],
        lines=lines,
    )


@pytest.mark.asyncio
async def test_parses_options_in_one_visual_row_without_inventing_answer():
    context = make_context(["Câu 1. Chọn giá trị đúng", "A. 1    B. 2    C. 3    D. 4"])
    result = await ExtractedTextTranscriber().transcribe([], context)
    assert [option.key for option in result.options] == ["A", "B", "C", "D"]
    assert result.answer is None
    assert "answer_not_found" in result.warnings


@pytest.mark.asyncio
async def test_extracts_only_explicit_answer_and_separates_solution():
    context = make_context(
        [
            "Câu 1. Chọn giá trị đúng",
            "A. 1 B. 2 C. 3 D. 4",
            "Lời giải.",
            "Ta có ...",
            "Vậy chọn C.",
        ],
    )
    result = await ExtractedTextTranscriber().transcribe([], context)
    assert result.answer and result.answer.value == "C"
    assert len(result.solution) == 2


@pytest.mark.asyncio
async def test_does_not_guess_true_false_x_columns_from_text_order():
    context = make_context(
        ["Câu 1. Phát biểu Đúng Sai", "a) Mệnh đề một X", "b) Mệnh đề hai X"],
        "true_false",
    )
    result = await ExtractedTextTranscriber().transcribe([], context)
    assert [statement.answer for statement in result.statements] == [None, None]
    assert "answer_not_found" in result.warnings


def test_maps_normalized_vision_box_through_question_crop_to_pdf_coordinates():
    context = make_context(["Câu 1. Nội dung"])
    context.source_regions = [
        PageRegion(
            page=1,
            bbox=BoundingBox(x0=0, y0=200, x1=612, y1=600),
        )
    ]
    result = TranscriptionResult(
        figures=[
            FigureCandidate(
                page=1,
                bbox=BoundingBox(x0=250, y0=250, x1=750, y1=750),
                confidence=0.9,
            )
        ]
    )
    map_normalized_figure_boxes(result, context)
    assert result.figures[0].bbox.model_dump() == {
        "x0": 153.0,
        "y0": 300.0,
        "x1": 459.0,
        "y1": 500.0,
    }


def test_normalizes_provider_json_and_preserves_latex_answer_and_provenance():
    context = make_context(["Câu 1. Nội dung"], "short_answer")
    context.source_regions = [
        PageRegion(page=1, bbox=BoundingBox(x0=20, y0=20, x1=580, y1=200))
    ]
    result = normalize_transcription_json(
        """{
          "detected_type": "short_answer",
          "stem": [{"children": [
            {"text": "Tính "}, {"latex": "\\\\int_0^1 x^2\\\\,dx"}
          ]}],
          "answer": {"value": "\\\\frac{1}{3}"},
          "confidence": 0.95
        }"""
    )
    attach_region_provenance(result, context)
    assert result.stem[0].type == "paragraph"
    assert result.stem[0].children[1].type == "math_inline"
    assert result.stem[0].children[1].latex == r"\int_0^1 x^2\,dx"
    assert result.answer and result.answer.type == "short"
    assert result.answer.value == r"\frac{1}{3}"
    assert result.answer.source and result.answer.source.page == 1


def test_rejects_a_model_answer_when_the_source_has_no_explicit_answer():
    context = make_context(["Câu 1. Chọn khẳng định đúng", "A. 1 B. 2 C. 3 D. 4"])
    result = normalize_transcription_json(
        '{"detected_type":"multiple_choice","stem":[{"children":[{"text":"Chọn khẳng định đúng"}]}],"answer":{"value":"C"}}'
    )
    enforce_explicit_answer_evidence(result, context)
    assert result.answer is None
    assert "vision_answer_rejected_no_explicit_evidence" in result.warnings


def test_keeps_a_vision_answer_when_the_source_labels_it_explicitly():
    context = make_context(["Câu 1. Nội dung", "Lời giải. Vậy chọn C."])
    result = normalize_transcription_json(
        '{"detected_type":"multiple_choice","stem":[{"children":[{"text":"Nội dung"}]}],"answer":{"value":"C"}}'
    )
    enforce_explicit_answer_evidence(result, context)
    assert result.answer and result.answer.value == "C"
