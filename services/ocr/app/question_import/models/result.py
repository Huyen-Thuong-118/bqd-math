from pydantic import BaseModel

from .question import ExamSection, Question


class AssetRecord(BaseModel):
    id: str
    document_id: str
    kind: str
    object_key: str
    path: str
    public_url: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    page: int | None = None


class ImportStats(BaseModel):
    detected_questions: int = 0
    mcq_count: int = 0
    true_false_count: int = 0
    short_answer_count: int = 0
    questions_with_figures: int = 0
    questions_with_answers: int = 0
    questions_with_solutions: int = 0


class DebugPage(BaseModel):
    page: int
    page_asset_id: str
    layout_object_key: str
    overlay_asset_id: str


class ImportedDocument(BaseModel):
    id: str
    filename: str
    title: str | None = None
    original_asset_id: str
    page_count: int
    sections: list[ExamSection]
    questions: list[Question]
    assets: list[AssetRecord]
    debug_pages: list[DebugPage] = []
    warnings: list[str]
    stats: ImportStats


class ImportResponse(BaseModel):
    document_id: str
    status: str = "completed"
    result: ImportedDocument
