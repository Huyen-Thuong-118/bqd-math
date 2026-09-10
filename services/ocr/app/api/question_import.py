from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated

import pymupdf
import pytesseract
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from ..question_import.parser.answers import extract_legacy_answer_key
from ..question_import.pipeline import DocumentImporter
from ..question_import.transcription.gemini import GeminiQuestionTranscriber
from ..question_import.transcription.vision import HttpVisionTranscriber

MAX_DOCUMENT_BYTES = int(os.getenv("QUESTION_IMPORT_MAX_BYTES", str(50 * 1024 * 1024)))
router = APIRouter()


def build_importer() -> DocumentImporter:
    endpoint = os.getenv("VISION_TRANSCRIBER_URL", "").strip()
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    if endpoint:
        transcriber = HttpVisionTranscriber(endpoint)
    elif project:
        transcriber = GeminiQuestionTranscriber(
            project=project,
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "global").strip() or "global",
            model=os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
            or "gemini-3.1-flash-lite",
        )
    else:
        transcriber = None
    return DocumentImporter(transcriber=transcriber)


importer = build_importer()


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_DOCUMENT_BYTES + 1)
    if not data:
        raise HTTPException(400, "File đang rỗng")
    if len(data) > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            413, f"File vượt quá {MAX_DOCUMENT_BYTES // (1024 * 1024)} MB"
        )
    return data


async def _run_import(file: UploadFile, document_id: str | None, debug: bool):
    filename = Path(file.filename or "document.pdf").name
    data = await _read_upload(file)
    try:
        result = await importer.import_document(
            data,
            filename=filename,
            document_id=document_id or None,
            debug=debug,
        )
        return {"document_id": result.id, "status": "completed", "result": result}
    except ValueError as error:
        raise HTTPException(422, f"Không nhập được tài liệu: {error}") from error
    except Exception as error:
        raise HTTPException(
            500, "Importer gặp lỗi nội bộ; file gốc đã được giữ nếu có thể"
        ) from error


@router.post("/api/question-import")
async def question_import(
    file: Annotated[UploadFile, File()],
    document_id: Annotated[str | None, Form()] = None,
    debug: Annotated[bool, Form()] = True,
):
    return await _run_import(file, document_id, debug)


@router.post("/api/question-import/debug")
async def question_import_debug(
    file: Annotated[UploadFile, File()],
    document_id: Annotated[str | None, Form()] = None,
):
    return await _run_import(file, document_id, True)


def _legacy_text(data: bytes) -> tuple[int, str, list[int]]:
    document = pymupdf.open(stream=data, filetype="pdf")
    pages: list[str] = []
    ocr_pages: list[int] = []
    try:
        for index, page in enumerate(document):
            text = page.get_text("text", sort=True).strip()
            if len(text) < 80:
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
                with Image.open(
                    __import__("io").BytesIO(pixmap.tobytes("png"))
                ) as image:
                    try:
                        text = pytesseract.image_to_string(image, lang="vie+eng")
                    except pytesseract.TesseractError:
                        text = pytesseract.image_to_string(image, lang="eng")
                ocr_pages.append(index + 1)
            pages.append(text)
        return len(document), "\n".join(pages), ocr_pages
    finally:
        document.close()


@router.post("/analyze")
async def analyze(file: Annotated[UploadFile, File()]):
    data = await _read_upload(file)
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "File không phải PDF")
    result = await importer.import_document(
        data, filename=Path(file.filename or "document.pdf").name, debug=False
    )
    sections = []
    for section in result.sections:
        detected = sum(
            question.section_id == section.id for question in result.questions
        )
        count = detected or section.declared_count or 0
        sections.append(
            {
                "label": section.label,
                "type": {
                    "multiple_choice": "MULTIPLE_CHOICE",
                    "true_false": "TRUE_FALSE",
                    "short_answer": "SHORT_ANSWER",
                    "unknown": "MULTIPLE_CHOICE",
                }[section.detected_type],
                "count": count,
            }
        )
    return {
        "pageCount": result.page_count,
        "ocrPages": [
            page
            for page in range(1, result.page_count + 1)
            if any(
                warning == "scanned_source_page"
                and any(region.page == page for region in question.source_regions)
                for question in result.questions
                for warning in question.warnings
            )
        ],
        "sections": sections,
        "warnings": result.warnings,
    }


@router.post("/analyze-answer")
async def analyze_answer(file: Annotated[UploadFile, File()]):
    data = await _read_upload(file)
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "File không phải PDF")
    try:
        page_count, text, ocr_pages = _legacy_text(data)
        return {
            "pageCount": page_count,
            "ocrPages": ocr_pages,
            **extract_legacy_answer_key(text),
        }
    except Exception as error:
        raise HTTPException(422, f"Không đọc được PDF đáp án: {error}") from error
