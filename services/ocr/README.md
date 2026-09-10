# Question import service

This internal FastAPI service imports Vietnamese THPT Math exams from PDF or
DOCX. Rendered pages are authoritative; extracted PDF text and Tesseract are
used only to locate structural anchors.

## API

- `POST /api/question-import` — multipart fields: `file`, optional
  `document_id`, optional `debug` (defaults to `true`).
- `POST /api/question-import/debug` — imports and always creates page layout
  JSON plus labeled WebP overlays.
- `GET /api/question-import/assets/{object_key}` — serves preserved source,
  page, snapshot, figure, and debug assets. Keep this service private or proxy
  the route through the authenticated application in production.
- `POST /analyze` and `POST /analyze-answer` remain available for the existing
  exam creation screen.

The synchronous importer is exposed as
`await DocumentImporter.import_document(...)`, so it can be moved to a worker
without changing the parsing stages.

## Vision configuration

The service selects transcription in this order:

1. `VISION_TRANSCRIBER_URL`: provider-neutral JSON HTTP adapter.
2. `GOOGLE_CLOUD_PROJECT`: Vertex AI Gemini using Application Default
   Credentials. Optional settings are `GOOGLE_CLOUD_LOCATION` and
   `GEMINI_MODEL`.
3. Conservative extracted-text fallback. This fallback always adds
   `visual_transcription_required`; it never claims PDF-extracted mathematics
   is canonical and never manufactures an answer.

Assets default to `/tmp/bqd-question-import`. Set
`QUESTION_IMPORT_STORAGE_ROOT` to persistent storage in production. Docker
Compose uses a named volume at `/data/question-import`.

The structured result keeps formulas as `math_inline`/`math_block` LaTeX nodes
and figures as independent WebP assets with page/bounding-box provenance.
Answers are accepted only when an explicit answer marker is present in the
source region; a model suggestion alone is never treated as ground truth.

For local Docker Compose, Google Cloud settings are read from the project
`.env`, and the host's Application Default Credentials directory is mounted
read-only into the OCR container.

## Verification

```bash
docker compose -f infra/docker-compose.yml build ocr
docker run --rm bqd-math-ocr pytest -q
```
