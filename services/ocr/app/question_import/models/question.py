from typing import Annotated, Literal

from pydantic import BaseModel, Field

from .content import ContentBlock
from .geometry import BoundingBox, PageRegion, SourceRegion

QuestionType = Literal["multiple_choice", "true_false", "short_answer", "unknown"]


class ExamSection(BaseModel):
    id: str
    index: int
    label: str
    detected_type: QuestionType
    page: int
    bbox: BoundingBox
    start_anchor: str
    confidence: float = Field(ge=0, le=1)
    declared_count: int | None = None


class QuestionOption(BaseModel):
    key: Literal["A", "B", "C", "D", "E"]
    content: list[ContentBlock]


class TrueFalseStatement(BaseModel):
    key: str
    content: list[ContentBlock]
    answer: bool | None = None


class ChoiceAnswer(BaseModel):
    type: Literal["choice"]
    value: Literal["A", "B", "C", "D", "E"]
    source: SourceRegion | None = None


class ShortAnswer(BaseModel):
    type: Literal["short"]
    value: str
    numeric_value: float | None = None
    source: SourceRegion | None = None


QuestionAnswer = Annotated[ChoiceAnswer | ShortAnswer, Field(discriminator="type")]


class ParseConfidence(BaseModel):
    segmentation: float = Field(ge=0, le=1)
    transcription: float = Field(ge=0, le=1)
    structure: float = Field(ge=0, le=1)
    figures: float = Field(ge=0, le=1)
    answer: float | None = Field(default=None, ge=0, le=1)

    @property
    def overall(self) -> float:
        weighted = [
            (self.segmentation, 0.3),
            (self.transcription, 0.3),
            (self.structure, 0.2),
            (self.figures, 0.2),
        ]
        if self.answer is not None:
            weighted.append((self.answer, 0.15))
        return round(
            sum(value * weight for value, weight in weighted)
            / sum(weight for _, weight in weighted),
            4,
        )


class Question(BaseModel):
    id: str
    document_id: str
    section_id: str | None
    number: str | None
    type: QuestionType
    stem: list[ContentBlock]
    options: list[QuestionOption] = []
    statements: list[TrueFalseStatement] = []
    answer: QuestionAnswer | None = None
    solution: list[ContentBlock] = []
    source_regions: list[PageRegion]
    source_snapshot_assets: list[str]
    confidence: ParseConfidence
    warnings: list[str] = []

    @property
    def overall_confidence(self) -> float:
        return self.confidence.overall


class FigureCandidate(BaseModel):
    page: int
    bbox: BoundingBox
    role: Literal["question", "solution"] = "question"
    alt: str | None = None
    confidence: float = Field(ge=0, le=1)
