from pydantic import BaseModel, Field

from .geometry import BoundingBox


class TextSpan(BaseModel):
    text: str
    bbox: BoundingBox
    font_size: float | None = None
    font_name: str | None = None
    flags: int | None = None


class TextLine(BaseModel):
    spans: list[TextSpan]
    bbox: BoundingBox

    @property
    def text(self) -> str:
        return "".join(span.text for span in self.spans).strip()


class TextRegion(BaseModel):
    lines: list[TextLine]
    bbox: BoundingBox


class PageImageObject(BaseModel):
    bbox: BoundingBox
    xref: int | None = None


class DocumentPage(BaseModel):
    number: int = Field(ge=1)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    pixel_width: int = Field(gt=0)
    pixel_height: int = Field(gt=0)
    text_regions: list[TextRegion]
    embedded_images: list[PageImageObject]
    rendered_path: str
    rendered_asset_id: str
    requires_visual_transcription: bool = False

    @property
    def lines(self) -> list[TextLine]:
        return [line for region in self.text_regions for line in region.lines]


class IngestedDocument(BaseModel):
    id: str
    filename: str
    original_asset_id: str
    pages: list[DocumentPage]
