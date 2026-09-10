from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class BoundingBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float

    @model_validator(mode="after")
    def ordered(self) -> BoundingBox:
        if self.x1 < self.x0 or self.y1 < self.y0:
            raise ValueError("bounding box coordinates must be ordered")
        return self

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    @property
    def area(self) -> float:
        return self.width * self.height

    def intersects(self, other: BoundingBox) -> bool:
        return not (
            self.x1 <= other.x0
            or other.x1 <= self.x0
            or self.y1 <= other.y0
            or other.y1 <= self.y0
        )

    def contains(self, other: BoundingBox) -> bool:
        return (
            self.x0 <= other.x0
            and self.y0 <= other.y0
            and self.x1 >= other.x1
            and self.y1 >= other.y1
        )

    def union(self, other: BoundingBox) -> BoundingBox:
        return BoundingBox(
            x0=min(self.x0, other.x0),
            y0=min(self.y0, other.y0),
            x1=max(self.x1, other.x1),
            y1=max(self.y1, other.y1),
        )

    def expand(
        self,
        amount: float,
        *,
        max_width: float | None = None,
        max_height: float | None = None,
    ) -> BoundingBox:
        return BoundingBox(
            x0=max(0, self.x0 - amount),
            y0=max(0, self.y0 - amount),
            x1=min(max_width, self.x1 + amount)
            if max_width is not None
            else self.x1 + amount,
            y1=min(max_height, self.y1 + amount)
            if max_height is not None
            else self.y1 + amount,
        )

    def normalized(
        self, page_width: float, page_height: float, scale: int = 1000
    ) -> BoundingBox:
        if page_width <= 0 or page_height <= 0:
            raise ValueError("page dimensions must be positive")
        return BoundingBox(
            x0=self.x0 / page_width * scale,
            y0=self.y0 / page_height * scale,
            x1=self.x1 / page_width * scale,
            y1=self.y1 / page_height * scale,
        )

    @classmethod
    def from_normalized(
        cls,
        value: BoundingBox,
        page_width: float,
        page_height: float,
        scale: int = 1000,
    ) -> BoundingBox:
        return cls(
            x0=value.x0 / scale * page_width,
            y0=value.y0 / scale * page_height,
            x1=value.x1 / scale * page_width,
            y1=value.y1 / scale * page_height,
        )

    def to_pixels(
        self, page_width: float, page_height: float, pixel_width: int, pixel_height: int
    ) -> BoundingBox:
        if min(page_width, page_height, pixel_width, pixel_height) <= 0:
            raise ValueError("page and image dimensions must be positive")
        return BoundingBox(
            x0=self.x0 * pixel_width / page_width,
            y0=self.y0 * pixel_height / page_height,
            x1=self.x1 * pixel_width / page_width,
            y1=self.y1 * pixel_height / page_height,
        )


class PageRegion(BaseModel):
    page: int = Field(ge=1)
    bbox: BoundingBox


class SourceRegion(PageRegion):
    document_id: str


class QuestionRegion(BaseModel):
    number: str
    section_id: str | None = None
    regions: list[PageRegion]
    confidence: float = Field(ge=0, le=1)
