from __future__ import annotations

import os
from pathlib import Path

import pytesseract
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.question_import import router

app = FastAPI(title="BQD Math Question Importer", version="2.0.0")
app.include_router(router)

asset_root = Path(
    os.getenv("QUESTION_IMPORT_STORAGE_ROOT", "/tmp/bqd-question-import")
).resolve()
asset_root.mkdir(parents=True, exist_ok=True)
app.mount(
    "/api/question-import/assets",
    StaticFiles(directory=asset_root),
    name="question-import-assets",
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "question-import",
        "version": app.version,
        "structuralOcrEngine": str(pytesseract.get_tesseract_version()),
        "visionConfigured": bool(
            os.getenv("VISION_TRANSCRIBER_URL", "").strip()
            or os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
        ),
    }
