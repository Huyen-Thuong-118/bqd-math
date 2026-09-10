from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from uuid import uuid4

from .debug import create_debug_artifacts
from .figures.cropper import crop_region
from .figures.detector import embedded_figure_candidates
from .ingest.docx import DocxIngestor
from .ingest.ocr import OcrEngine, TesseractStructuralOcr
from .ingest.pdf import PdfIngestor
from .layout.reading_order import lines_in_reading_order
from .layout.repeated_regions import detect_repeated_regions, is_ignored
from .models.content import FigureBlock
from .models.document import TextRegion
from .models.geometry import PageRegion, QuestionRegion, SourceRegion
from .models.question import ParseConfidence, Question
from .models.result import ImportedDocument, ImportStats
from .segmentation.questions import build_question_regions, detect_question_anchors
from .segmentation.sections import detect_sections
from .segmentation.solutions import is_solution_start
from .storage.assets import AssetStorage, LocalAssetStorage, RecordingAssetStorage
from .transcription.base import ExtractedTextTranscriber, QuestionTranscriber
from .transcription.schemas import TranscriptionContext
from .validation.validator import expected_count_warnings, validate_question

logger = logging.getLogger(__name__)


class DocumentImporter:
    def __init__(
        self,
        *,
        storage: AssetStorage | None = None,
        transcriber: QuestionTranscriber | None = None,
        ocr: OcrEngine | None = None,
        dpi: int = 200,
    ):
        root = os.getenv("QUESTION_IMPORT_STORAGE_ROOT", "/tmp/bqd-question-import")
        self.storage = storage or LocalAssetStorage(root)
        self.transcriber = transcriber or ExtractedTextTranscriber()
        self.ocr = ocr or TesseractStructuralOcr()
        self.pdf = PdfIngestor(dpi=dpi)
        self.docx = DocxIngestor()

    async def import_document(
        self,
        data: bytes,
        *,
        filename: str,
        document_id: str | None = None,
        debug: bool = True,
    ) -> ImportedDocument:
        document_id = document_id or uuid4().hex
        if not re.fullmatch(r"[A-Za-z0-9_-]{8,120}", document_id):
            raise ValueError(
                "document_id must contain 8-120 letters, numbers, underscores, or hyphens"
            )
        storage = RecordingAssetStorage(self.storage)
        suffix = Path(filename).suffix.casefold()
        if suffix not in {".pdf", ".docx"}:
            raise ValueError("only PDF and DOCX documents are supported")
        if suffix == ".pdf" and not data.startswith(b"%PDF-"):
            raise ValueError("file content does not match PDF extension")
        if suffix == ".docx" and not data.startswith(b"PK"):
            raise ValueError("file content does not match DOCX extension")

        original = await storage.save(
            data,
            document_id=document_id,
            kind="original",
            extension=suffix[1:],
            name="document",
        )
        pdf_data = await self.docx.to_pdf(data, filename) if suffix == ".docx" else data
        if suffix == ".docx":
            await storage.save(
                pdf_data,
                document_id=document_id,
                kind="original",
                extension="pdf",
                name="rendered_source",
            )
        ingested = await self.pdf.ingest(
            pdf_data,
            filename=filename,
            document_id=document_id,
            original_asset_id=original.id,
            storage=storage,
        )

        ocr_pages: list[int] = []
        for page in ingested.pages:
            if page.requires_visual_transcription:
                ocr_lines = await self.ocr.extract_lines(page)
                if ocr_lines:
                    page.text_regions.append(
                        TextRegion(
                            lines=ocr_lines,
                            bbox=self._union_boxes([line.bbox for line in ocr_lines]),
                        )
                    )
                    ocr_pages.append(page.number)

        ignored = detect_repeated_regions(ingested.pages)
        sections = detect_sections(ingested.pages, ignored)
        anchors = detect_question_anchors(ingested.pages, sections, ignored)
        question_regions = build_question_regions(
            ingested.pages, anchors, sections, ignored
        )
        section_by_id = {section.id: section for section in sections}
        page_by_number = {page.number: page for page in ingested.pages}
        questions: list[Question] = []
        all_figures = []

        for index, region in enumerate(question_regions, 1):
            snapshot_records = []
            for item in region.regions:
                snapshot_records.append(
                    await crop_region(
                        page_by_number[item.page],
                        item,
                        storage=storage,
                        document_id=document_id,
                        kind="source_questions",
                        name=f"q_{index:03d}_page_{item.page:03d}",
                    )
                )
            lines = self._region_lines(region, ingested.pages, ignored)
            section = section_by_id.get(region.section_id)
            context = TranscriptionContext(
                document_id=document_id,
                question_number=region.number,
                section_type=section.detected_type if section else "unknown",
                pages=[page_by_number[item.page] for item in region.regions],
                source_regions=region.regions,
                lines=lines,
            )
            try:
                draft = await self.transcriber.transcribe(
                    [item.path for item in snapshot_records], context
                )
            except Exception:
                logger.exception(
                    "Visual transcription failed for %s question %s",
                    document_id,
                    region.number,
                )
                draft = await ExtractedTextTranscriber().transcribe(
                    [item.path for item in snapshot_records], context
                )
                draft.warnings.append("visual_transcription_failed")

            figures = draft.figures or embedded_figure_candidates(
                region, ingested.pages
            )
            self._assign_figure_roles(figures, region, lines, ingested.pages)
            for figure_index, figure in enumerate(figures, 1):
                asset = await crop_region(
                    page_by_number[figure.page],
                    PageRegion(page=figure.page, bbox=figure.bbox),
                    storage=storage,
                    document_id=document_id,
                    kind="figures",
                    name=f"q_{index:03d}_figure_{figure_index:02d}",
                )
                block = FigureBlock(
                    type="figure",
                    asset_id=asset.id,
                    alt=figure.alt,
                    source=SourceRegion(
                        document_id=document_id, page=figure.page, bbox=figure.bbox
                    ),
                    role=figure.role,
                )
                (draft.solution if figure.role == "solution" else draft.stem).append(
                    block
                )
            all_figures.extend(figures)

            answer_confidence = None
            if draft.answer is not None or any(
                statement.answer is not None for statement in draft.statements
            ):
                answer_confidence = max(0.5, draft.confidence)
            warnings = list(draft.warnings)
            if len(region.regions) > 1:
                warnings.append("question_spans_pages")
            if any(
                page_by_number[item.page].requires_visual_transcription
                for item in region.regions
            ):
                warnings.append("scanned_source_page")
            question = Question(
                id=f"{document_id}_q_{index:03d}",
                document_id=document_id,
                section_id=region.section_id,
                number=region.number,
                type=draft.detected_type,
                stem=draft.stem,
                options=draft.options,
                statements=draft.statements,
                answer=draft.answer,
                solution=draft.solution,
                source_regions=region.regions,
                source_snapshot_assets=[item.id for item in snapshot_records],
                confidence=ParseConfidence(
                    segmentation=region.confidence,
                    transcription=draft.confidence,
                    structure=0.9 if draft.detected_type != "unknown" else 0.45,
                    figures=min((figure.confidence for figure in figures), default=0.5),
                    answer=answer_confidence,
                ),
                warnings=list(dict.fromkeys(warnings)),
            )
            questions.append(validate_question(question))

        warnings = []
        if not sections:
            warnings.append("section_not_found")
        if not questions:
            warnings.append("question_boundary_uncertain")
        if ocr_pages:
            warnings.append("structural_ocr_used")
        warnings.extend(expected_count_warnings(sections, questions))

        debug_pages = []
        if debug:
            debug_pages = await create_debug_artifacts(
                document_id=document_id,
                pages=ingested.pages,
                sections=sections,
                questions=question_regions,
                ignored=ignored,
                figures=all_figures,
                storage=storage,
            )
        return ImportedDocument(
            id=document_id,
            filename=filename,
            title=Path(filename).stem,
            original_asset_id=original.id,
            page_count=len(ingested.pages),
            sections=sections,
            questions=questions,
            assets=storage.records,
            debug_pages=debug_pages,
            warnings=list(dict.fromkeys(warnings)),
            stats=self._stats(questions),
        )

    @staticmethod
    def _union_boxes(boxes):
        box = boxes[0]
        for item in boxes[1:]:
            box = box.union(item)
        return box

    @staticmethod
    def _region_lines(region: QuestionRegion, pages, ignored):
        page_by_number = {page.number: page for page in pages}
        lines = []
        for item in region.regions:
            page = page_by_number[item.page]
            lines.extend(
                line
                for line in lines_in_reading_order(page)
                if line.bbox.intersects(item.bbox)
                and not is_ignored(page.number, line.bbox, ignored)
            )
        return lines

    @staticmethod
    def _assign_figure_roles(figures, region, lines, pages):
        page_by_number = {page.number: page for page in pages}
        solution_position = None
        for item in region.regions:
            page = page_by_number[item.page]
            for line in lines_in_reading_order(page):
                if line.bbox.intersects(item.bbox) and is_solution_start(line.text):
                    solution_position = (page.number, line.bbox.y0)
                    break
            if solution_position:
                break
        if solution_position:
            for figure in figures:
                if (figure.page, figure.bbox.y0) > solution_position:
                    figure.role = "solution"

    @staticmethod
    def _stats(questions: list[Question]) -> ImportStats:
        def has_figure(question: Question) -> bool:
            return any(
                isinstance(block, FigureBlock)
                for block in question.stem + question.solution
            )

        return ImportStats(
            detected_questions=len(questions),
            mcq_count=sum(question.type == "multiple_choice" for question in questions),
            true_false_count=sum(
                question.type == "true_false" for question in questions
            ),
            short_answer_count=sum(
                question.type == "short_answer" for question in questions
            ),
            questions_with_figures=sum(has_figure(question) for question in questions),
            questions_with_answers=sum(
                question.answer is not None
                or any(
                    statement.answer is not None for statement in question.statements
                )
                for question in questions
            ),
            questions_with_solutions=sum(
                bool(question.solution) for question in questions
            ),
        )
