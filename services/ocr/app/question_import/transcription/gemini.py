from __future__ import annotations

import asyncio
import re
from pathlib import Path

from google import genai
from google.genai import types

from .prompts import SYSTEM_PROMPT
from .schemas import (
    TranscriptionContext,
    TranscriptionResult,
    attach_region_provenance,
    enforce_explicit_answer_evidence,
    normalize_transcription_json,
)
from .vision import map_normalized_figure_boxes


class GeminiQuestionTranscriber:
    """Vertex AI implementation isolated behind the QuestionTranscriber protocol."""

    def __init__(self, *, project: str, location: str, model: str):
        if not re.fullmatch(r"[a-z][a-z0-9-]{4,62}", project):
            raise ValueError("invalid Google Cloud project id")
        if not re.fullmatch(r"[a-z0-9-]+", location):
            raise ValueError("invalid Google Cloud location")
        model = model.removeprefix("models/")
        if not re.fullmatch(r"[A-Za-z0-9._-]+", model):
            raise ValueError("invalid Gemini model")
        self.project = project
        self.location = location
        self.model = model

    async def transcribe(
        self, source_images: list[str], context: TranscriptionContext
    ) -> TranscriptionResult:
        parts = [
            types.Part.from_text(
                text=(
                    f"{SYSTEM_PROMPT}\nQuestion number: {context.question_number}. "
                    f"Expected section type: {context.section_type}. "
                    "Each image label gives its source PDF page. Figure boxes must use that "
                    "source_page and normalized 0-1000 coordinates relative to that question image."
                )
            )
        ]
        for index, path in enumerate(source_images):
            data = await asyncio.to_thread(Path(path).read_bytes)
            parts.append(
                types.Part.from_text(
                    text=f"Image {index + 1}; source_page={context.pages[index].number}"
                )
            )
            parts.append(types.Part.from_bytes(data=data, mime_type="image/webp"))

        client = genai.Client(
            enterprise=True,
            project=self.project,
            location=self.location,
            http_options=types.HttpOptions(api_version="v1"),
        )
        try:
            response = await client.aio.models.generate_content(
                model=self.model,
                contents=[types.Content(role="user", parts=parts)],
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_json_schema=TranscriptionResult.model_json_schema(),
                ),
            )
        finally:
            await client.aio.aclose()
        if not response.text:
            raise ValueError("Gemini returned an empty transcription")
        result = normalize_transcription_json(response.text)
        map_normalized_figure_boxes(result, context)
        attach_region_provenance(result, context)
        enforce_explicit_answer_evidence(result, context)
        return result
