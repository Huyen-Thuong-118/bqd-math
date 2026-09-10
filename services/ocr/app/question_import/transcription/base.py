from __future__ import annotations

import re
from typing import Protocol

from ..models.content import ParagraphBlock, TextNode
from ..models.geometry import SourceRegion
from ..models.question import QuestionOption, ShortAnswer, TrueFalseStatement
from ..segmentation.questions import QUESTION_PATTERN
from ..segmentation.solutions import is_solution_start, strip_solution_marker
from .schemas import TranscriptionContext, TranscriptionResult

OPTION_PATTERN = re.compile(r"(?:^|\s)([A-E])\s*[.)]\s*")
STATEMENT_PATTERN = re.compile(r"(?:^|\s)([a-e])\s*[.)]\s*")
CHOICE_ANSWER_PATTERN = re.compile(
    r"(?:chọn\s+(?:đáp\s+án\s+)?|đáp\s+án\s*[:.]?\s*)([A-E])\b", re.IGNORECASE
)
SHORT_ANSWER_PATTERN = re.compile(r"đáp\s+án\s*[:.]\s*([^\n]{1,50})", re.IGNORECASE)
TRUE_FALSE_SUMMARY_PATTERN = re.compile(
    r"\b([a-d])\s*(?:là|:)??\s*(đúng|sai)\b", re.IGNORECASE
)


class QuestionTranscriber(Protocol):
    async def transcribe(
        self, source_images: list[str], context: TranscriptionContext
    ) -> TranscriptionResult: ...


def _source(context: TranscriptionContext, line) -> SourceRegion:
    page = next(
        page
        for page in context.pages
        if any(existing == line for existing in page.lines)
    )
    return SourceRegion(
        document_id=context.document_id, page=page.number, bbox=line.bbox
    )


def _paragraph(text: str, source: SourceRegion | None = None) -> ParagraphBlock:
    return ParagraphBlock(
        type="paragraph", children=[TextNode(type="text", text=text)], source=source
    )


def _segments(pattern: re.Pattern[str], text: str) -> list[tuple[str, str]]:
    matches = list(pattern.finditer(text))
    return [
        (
            match.group(1),
            text[
                match.end() : matches[index + 1].start()
                if index + 1 < len(matches)
                else len(text)
            ].strip(),
        )
        for index, match in enumerate(matches)
    ]


class ExtractedTextTranscriber:
    """Conservative fallback: useful prose structure, never canonicalizes broken math."""

    async def transcribe(
        self, source_images: list[str], context: TranscriptionContext
    ) -> TranscriptionResult:
        stem: list = []
        solution: list = []
        options: dict[str, QuestionOption] = {}
        statements: dict[str, TrueFalseStatement] = {}
        warnings = ["visual_transcription_required"]
        in_solution = False
        raw_lines: list[str] = []

        for index, line in enumerate(context.lines):
            text = line.text.strip()
            if not text:
                continue
            raw_lines.append(text)
            source = _source(context, line)
            if index == 0:
                text = QUESTION_PATTERN.sub("", text, count=1).strip()
                if not text:
                    continue
            if is_solution_start(text):
                in_solution = True
                text = strip_solution_marker(text)
                if not text:
                    continue
            target = solution if in_solution else stem
            option_parts = _segments(OPTION_PATTERN, text) if not in_solution else []
            statement_parts = (
                _segments(STATEMENT_PATTERN, text) if not in_solution else []
            )
            if option_parts:
                for key, value in option_parts:
                    key = key.upper()
                    options[key] = QuestionOption(
                        key=key, content=[_paragraph(value, source)]
                    )
                continue
            if statement_parts and context.section_type == "true_false":
                for key, value in statement_parts:
                    statements[key.lower()] = TrueFalseStatement(
                        key=key.lower(), content=[_paragraph(value, source)]
                    )
                continue
            target.append(_paragraph(text, source))

        answer = None
        choice = next(
            (
                (match, line)
                for line in reversed(context.lines)
                if (match := CHOICE_ANSWER_PATTERN.search(line.text))
            ),
            None,
        )
        if choice:
            from ..models.question import ChoiceAnswer

            answer = ChoiceAnswer(
                type="choice",
                value=choice[0].group(1).upper(),
                source=_source(context, choice[1]),
            )
        else:
            short = next(
                (
                    (match, line)
                    for line in reversed(context.lines)
                    if (match := SHORT_ANSWER_PATTERN.search(line.text))
                ),
                None,
            )
        if answer is None and short:
            value = short[0].group(1).strip().rstrip(".")
            if not re.fullmatch(r"[A-E]", value, re.IGNORECASE):
                numeric = None
                if re.fullmatch(r"[-+]?\d+(?:[,.]\d+)?", value):
                    numeric = float(value.replace(",", "."))
                answer = ShortAnswer(
                    type="short",
                    value=value,
                    numeric_value=numeric,
                    source=_source(context, short[1]),
                )

        full_text = "\n".join(raw_lines)
        summary = {
            key.lower(): value.casefold() == "đúng"
            for key, value in TRUE_FALSE_SUMMARY_PATTERN.findall(full_text)
        }
        if summary:
            for key, statement in statements.items():
                if key in summary:
                    statement.answer = summary[key]

        detected_type = context.section_type
        if detected_type == "unknown":
            if len(options) >= 2:
                detected_type = "multiple_choice"
            elif len(statements) >= 2:
                detected_type = "true_false"
        if detected_type == "multiple_choice" and len(options) < 2:
            warnings.append("option_boundary_uncertain")
        if detected_type == "true_false" and len(statements) < 2:
            warnings.append("true_false_column_uncertain")
        if answer is None and not any(
            statement.answer is not None for statement in statements.values()
        ):
            warnings.append("answer_not_found")
        if any(char in full_text for char in ("∫", "√", "∑", "²", "³", "→", "⃗")):
            warnings.append("formula_transcription_uncertain")

        return TranscriptionResult(
            detected_type=detected_type,
            stem=stem,
            options=list(options.values()),
            statements=list(statements.values()),
            answer=answer,
            solution=solution,
            confidence=0.55,
            warnings=list(dict.fromkeys(warnings)),
        )
