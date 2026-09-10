from __future__ import annotations

from ..models.content import (
    ContentBlock,
    InlineMathNode,
    MathBlock,
    ParagraphBlock,
    TableBlock,
)
from ..models.question import ChoiceAnswer, Question, ShortAnswer


def _math_values(blocks: list[ContentBlock]):
    for block in blocks:
        if isinstance(block, MathBlock):
            yield block.latex
        elif isinstance(block, ParagraphBlock):
            for child in block.children:
                if isinstance(child, InlineMathNode):
                    yield child.latex
        elif isinstance(block, TableBlock):
            for row in block.rows:
                for cell in row:
                    yield from _math_values(cell.content)


def _invalid_latex(value: str) -> bool:
    if not value.strip() or "```" in value:
        return True
    if value.count("{") != value.count("}"):
        return True
    return value.count(r"\left") != value.count(r"\right")


def validate_question(question: Question) -> Question:
    warnings = list(question.warnings)
    if question.type == "multiple_choice":
        keys = [option.key for option in question.options]
        if len(keys) < 2:
            warnings.append("option_boundary_uncertain")
        if len(keys) != len(set(keys)):
            warnings.append("option_boundary_uncertain")
        if (
            isinstance(question.answer, ChoiceAnswer)
            and question.answer.value not in keys
        ):
            warnings.append("answer_conflict")
    elif question.type == "true_false":
        keys = [statement.key for statement in question.statements]
        if len(keys) != len(set(keys)):
            warnings.append("true_false_column_uncertain")
    elif question.type == "short_answer" and question.options:
        warnings.append("option_boundary_uncertain")

    blocks = question.stem + question.solution
    blocks.extend(block for option in question.options for block in option.content)
    blocks.extend(
        block for statement in question.statements for block in statement.content
    )
    if any(_invalid_latex(value) for value in _math_values(blocks)):
        warnings.append("invalid_latex")
    if isinstance(question.answer, ShortAnswer) and _invalid_latex(
        question.answer.value
    ):
        warnings.append("invalid_answer_latex")
    question.warnings = list(dict.fromkeys(warnings))
    return question


def expected_count_warnings(sections, questions) -> list[str]:
    warnings: list[str] = []
    for section in sections:
        found = sum(question.section_id == section.id for question in questions)
        expected = section.declared_count or {
            "multiple_choice": 12,
            "true_false": 4,
            "short_answer": 6,
        }.get(section.detected_type)
        if expected is not None and found != expected:
            warnings.append(
                f"unexpected_question_count:{section.id}:expected_around_{expected}:found_{found}"
            )
    return warnings
