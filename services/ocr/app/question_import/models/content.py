from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from .geometry import SourceRegion


class TextNode(BaseModel):
    type: Literal["text"]
    text: str


class InlineMathNode(BaseModel):
    type: Literal["math_inline"]
    latex: str


InlineNode = Annotated[TextNode | InlineMathNode, Field(discriminator="type")]


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"]
    children: list[InlineNode]
    source: SourceRegion | None = None


class MathBlock(BaseModel):
    type: Literal["math_block"]
    latex: str
    source: SourceRegion | None = None


class FigureBlock(BaseModel):
    type: Literal["figure"]
    asset_id: str
    alt: str | None = None
    source: SourceRegion | None = None
    role: Literal["question", "solution"] = "question"


class LineBreakBlock(BaseModel):
    type: Literal["line_break"]


CellContentBlock = Annotated[
    ParagraphBlock | MathBlock | FigureBlock | LineBreakBlock,
    Field(discriminator="type"),
]


class TableCell(BaseModel):
    content: list[CellContentBlock]


class TableBlock(BaseModel):
    type: Literal["table"]
    rows: list[list[TableCell]]
    source: SourceRegion | None = None


ContentBlock = Annotated[
    ParagraphBlock | MathBlock | FigureBlock | TableBlock | LineBreakBlock,
    Field(discriminator="type"),
]
