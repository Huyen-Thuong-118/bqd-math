from __future__ import annotations

import io
import json

from PIL import Image, ImageDraw

from .layout.reading_order import lines_in_reading_order
from .models.document import DocumentPage
from .models.geometry import PageRegion, QuestionRegion
from .models.question import ExamSection, FigureCandidate
from .models.result import DebugPage
from .segmentation.solutions import is_solution_start
from .storage.assets import AssetStorage


async def create_debug_artifacts(
    *,
    document_id: str,
    pages: list[DocumentPage],
    sections: list[ExamSection],
    questions: list[QuestionRegion],
    ignored: list[PageRegion],
    figures: list[FigureCandidate],
    storage: AssetStorage,
) -> list[DebugPage]:
    result: list[DebugPage] = []
    page_by_number = {page.number: page for page in pages}
    solution_regions: list[tuple[str, PageRegion]] = []
    for question in questions:
        solution_start = None
        for question_page in question.regions:
            source_page = page_by_number[question_page.page]
            marker = next(
                (
                    line
                    for line in lines_in_reading_order(source_page)
                    if line.bbox.intersects(question_page.bbox)
                    and is_solution_start(line.text)
                ),
                None,
            )
            if marker:
                solution_start = (question_page.page, marker.bbox.y0)
                break
        if solution_start:
            for question_page in question.regions:
                if question_page.page < solution_start[0]:
                    continue
                y0 = (
                    solution_start[1]
                    if question_page.page == solution_start[0]
                    else question_page.bbox.y0
                )
                solution_regions.append(
                    (
                        question.number,
                        PageRegion(
                            page=question_page.page,
                            bbox=question_page.bbox.model_copy(update={"y0": y0}),
                        ),
                    )
                )
    for page in pages:
        payload = {
            "page": page.number,
            "width": page.width,
            "height": page.height,
            "pixel_width": page.pixel_width,
            "pixel_height": page.pixel_height,
            "requires_visual_transcription": page.requires_visual_transcription,
            "text_regions": [
                region.model_dump(mode="json") for region in page.text_regions
            ],
            "ignored_regions": [
                item.model_dump(mode="json")
                for item in ignored
                if item.page == page.number
            ],
            "section_boxes": [
                item.model_dump(mode="json")
                for item in sections
                if item.page == page.number
            ],
            "question_boxes": [
                {
                    "number": question.number,
                    "section_id": question.section_id,
                    **item.model_dump(mode="json"),
                }
                for question in questions
                for item in question.regions
                if item.page == page.number
            ],
            "solution_boxes": [
                {"number": number, **item.model_dump(mode="json")}
                for number, item in solution_regions
                if item.page == page.number
            ],
            "figure_boxes": [
                item.model_dump(mode="json")
                for item in figures
                if item.page == page.number
            ],
        }
        layout = await storage.save(
            json.dumps(payload, ensure_ascii=False, indent=2).encode(),
            document_id=document_id,
            kind="debug",
            extension="json",
            name=f"page_{page.number:03d}_layout",
            page=page.number,
        )
        with Image.open(page.rendered_path) as source:
            image = source.convert("RGB")
        draw = ImageDraw.Draw(image)

        def draw_box(
            box,
            color: str,
            label: str,
            width: int = 4,
            source_page=page,
            source_image=image,
            painter=draw,
        ):
            pixel = box.to_pixels(
                source_page.width,
                source_page.height,
                source_image.width,
                source_image.height,
            )
            xy = (pixel.x0, pixel.y0, pixel.x1, pixel.y1)
            painter.rectangle(xy, outline=color, width=width)
            painter.text(
                (pixel.x0 + 3, pixel.y0 + 3),
                label,
                fill=color,
                stroke_fill="white",
                stroke_width=2,
            )

        for item in ignored:
            if item.page == page.number:
                draw_box(item.bbox, "#777777", "ignored", 2)
        for section in sections:
            if section.page == page.number:
                draw_box(section.bbox, "#0066ff", section.id)
        for index, question in enumerate(questions, 1):
            for item in question.regions:
                if item.page == page.number:
                    draw_box(item.bbox, "#00a050", f"q{index}:{question.number}")
        for number, item in solution_regions:
            if item.page == page.number:
                draw_box(item.bbox, "#ff8c00", f"solution:{number}", 3)
        for figure in figures:
            if figure.page == page.number:
                draw_box(figure.bbox, "#d00000", f"figure:{figure.role}")
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=92, method=6)
        overlay = await storage.save(
            output.getvalue(),
            document_id=document_id,
            kind="debug",
            extension="webp",
            name=f"page_{page.number:03d}_debug",
            page=page.number,
        )
        result.append(
            DebugPage(
                page=page.number,
                page_asset_id=page.rendered_asset_id,
                layout_object_key=layout.object_key,
                overlay_asset_id=overlay.id,
            )
        )
    return result
