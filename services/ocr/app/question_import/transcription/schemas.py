import json
import re
from typing import Any

from pydantic import BaseModel, Field

from ..models.content import ContentBlock, TableBlock
from ..models.document import DocumentPage, TextLine
from ..models.geometry import PageRegion, SourceRegion
from ..models.question import (
    FigureCandidate,
    QuestionAnswer,
    QuestionOption,
    QuestionType,
    TrueFalseStatement,
)


class TranscriptionContext(BaseModel):
    document_id: str
    question_number: str
    section_type: QuestionType
    pages: list[DocumentPage]
    source_regions: list[PageRegion] = []
    lines: list[TextLine]


class TranscriptionResult(BaseModel):
    detected_type: QuestionType = "unknown"
    stem: list[ContentBlock] = []
    options: list[QuestionOption] = []
    statements: list[TrueFalseStatement] = []
    answer: QuestionAnswer | None = None
    solution: list[ContentBlock] = []
    figures: list[FigureCandidate] = []
    confidence: float = Field(default=0.5, ge=0, le=1)
    warnings: list[str] = []


def _normalize_inline(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    result = dict(value)
    if result.get("type") not in {"text", "math_inline"}:
        result["type"] = "math_inline" if "latex" in result else "text"
    if result["type"] == "math_inline" and not isinstance(result.get("latex"), str):
        return None
    if result["type"] == "text" and not isinstance(result.get("text"), str):
        return None
    return result


def _normalize_block(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    result = dict(value)
    block_type = result.get("type")
    if block_type not in {"paragraph", "math_block", "figure", "table", "line_break"}:
        if "children" in result:
            block_type = "paragraph"
        elif "latex" in result:
            block_type = "math_block"
        elif "rows" in result:
            block_type = "table"
        elif "asset_id" in result:
            block_type = "figure"
        else:
            return None
        result["type"] = block_type
    # The model cannot infer trustworthy PDF coordinates for textual provenance.
    # It is attached from the deterministic question region after validation.
    result.pop("source", None)
    if block_type == "paragraph":
        result["children"] = [
            item
            for child in result.get("children", [])
            if (item := _normalize_inline(child)) is not None
        ]
        if not result["children"]:
            return None
    elif block_type == "math_block" and not isinstance(result.get("latex"), str):
        return None
    elif block_type == "figure" and not isinstance(result.get("asset_id"), str):
        # Vision returns new visual regions through `figures`; only the pipeline
        # may create figure content blocks after storing their crops.
        return None
    elif block_type == "table":
        rows = []
        for row in result.get("rows", []):
            if not isinstance(row, list):
                continue
            cells = []
            for cell in row:
                if not isinstance(cell, dict):
                    continue
                cells.append(
                    {
                        "content": [
                            item
                            for block in cell.get("content", [])
                            if (item := _normalize_block(block)) is not None
                        ]
                    }
                )
            if cells:
                rows.append(cells)
        result["rows"] = rows
        if not rows:
            return None
    return result


def normalize_transcription_json(payload: str | bytes) -> TranscriptionResult:
    raw = json.loads(payload)
    if not isinstance(raw, dict):
        raise TypeError("vision transcription must be a JSON object")
    result = dict(raw)
    for field in ("stem", "solution"):
        result[field] = [
            item
            for block in result.get(field, [])
            if (item := _normalize_block(block)) is not None
        ]
    for field in ("options", "statements"):
        normalized_items = []
        for value in result.get(field, []):
            if not isinstance(value, dict):
                continue
            item = dict(value)
            item["content"] = [
                block
                for raw_block in item.get("content", [])
                if (block := _normalize_block(raw_block)) is not None
            ]
            normalized_items.append(item)
        result[field] = normalized_items
    answer = result.get("answer")
    if isinstance(answer, dict) and isinstance(answer.get("value"), str):
        answer = dict(answer)
        answer.pop("source", None)
        if answer.get("type") not in {"choice", "short"}:
            answer["type"] = (
                "choice"
                if result.get("detected_type") == "multiple_choice"
                and answer["value"].strip().upper() in {"A", "B", "C", "D", "E"}
                else "short"
            )
        result["answer"] = answer
    elif answer is not None:
        result["answer"] = None
    return TranscriptionResult.model_validate(result)


def attach_region_provenance(
    result: TranscriptionResult, context: TranscriptionContext
) -> None:
    if not context.source_regions:
        return
    region = context.source_regions[0]
    source = SourceRegion(
        document_id=context.document_id, page=region.page, bbox=region.bbox
    )

    def attach(blocks: list[ContentBlock]) -> None:
        for block in blocks:
            if hasattr(block, "source") and block.source is None:
                block.source = source.model_copy(deep=True)
            if isinstance(block, TableBlock):
                for row in block.rows:
                    for cell in row:
                        attach(cell.content)

    attach(result.stem)
    attach(result.solution)
    for option in result.options:
        attach(option.content)
    for statement in result.statements:
        attach(statement.content)
    if result.answer is not None and result.answer.source is None:
        result.answer.source = source.model_copy(deep=True)


def enforce_explicit_answer_evidence(
    result: TranscriptionResult, context: TranscriptionContext
) -> None:
    """Reject model-solved answers unless the source visibly labels an answer."""
    source_text = "\n".join(line.text for line in context.lines)
    explicit_choice = re.search(
        r"(?i)(?:đáp\s*án|chọn|vậy\s+chọn)\s*(?:là|:|\.)?\s*[A-E]\b",
        source_text,
    )
    explicit_short = re.search(
        r"(?i)(?:đáp\s*án|kết\s*quả|trả\s*lời)\s*(?:là|:|\.)\s*\S+",
        source_text,
    )
    if result.answer is not None:
        has_evidence = (
            explicit_choice
            if result.detected_type == "multiple_choice"
            else explicit_short
        )
        if not has_evidence:
            result.answer = None
            result.warnings.append("vision_answer_rejected_no_explicit_evidence")

    explicit_true_false = re.search(
        r"(?i)\b[a-d]\s*(?:là|:)\s*(?:đúng|sai)\b|(?:đáp\s*án[^\n]*[DĐS](?:\s*[,;|]?\s*[DĐS]){3})",
        source_text,
    )
    if not explicit_true_false:
        rejected = False
        for statement in result.statements:
            if statement.answer is not None:
                statement.answer = None
                rejected = True
        if rejected:
            result.warnings.append("vision_answer_rejected_no_explicit_evidence")
    result.warnings = list(dict.fromkeys(result.warnings))
