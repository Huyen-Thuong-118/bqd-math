import io
import re
import unicodedata

import pymupdf
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

app = FastAPI(title="BQD Math OCR", version="1.0.0")
MAX_PDF_BYTES = 20 * 1024 * 1024


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFD", value.lower())
    return "".join(char for char in value if unicodedata.category(char) != "Mn")


def infer_sections(text: str):
    plain = normalize(text)
    patterns = [
        ("Trắc nghiệm", "MULTIPLE_CHOICE", r"phan\s*i[^\n]{0,160}?cau\s*1\s*den\s*cau\s*(\d+)", 12),
        ("Đúng / Sai", "TRUE_FALSE", r"phan\s*ii[^\n]{0,160}?cau\s*1\s*den\s*cau\s*(\d+)", 4),
        ("Trả lời ngắn", "SHORT_ANSWER", r"phan\s*iii[^\n]{0,160}?cau\s*1\s*den\s*cau\s*(\d+)", 6),
    ]
    sections = []
    for label, question_type, pattern, fallback in patterns:
        match = re.search(pattern, plain, flags=re.DOTALL)
        count = int(match.group(1)) if match else fallback
        sections.append({"label": label, "type": question_type, "count": count})
    return sections


def extract_answer_key(text: str):
    # Hỗ trợ cả hai format đang có trong data:
    # - bảng đầu phần: "1) B" ... "12) D";
    # - lời giải từng câu: "Đáp án: B." hoặc "Đáp án B.".
    part_one = re.split(r"Phần\s*I", text, maxsplit=1, flags=re.IGNORECASE)
    multiple_choice = []
    if len(part_one) == 2:
        table = part_one[1].split("Câu 1.", 1)[0]
        multiple_choice = re.findall(r"(?m)^\s*\d+\)\s*([ABCD])\s*$", table.upper())[:12]
    if len(multiple_choice) < 12:
        multiple_choice = re.findall(
            r"Đáp án\s*:?\s*([ABCD])(?:\.|\s|$)", text, flags=re.IGNORECASE
        )[:12]
    multiple_choice = [answer.upper() for answer in multiple_choice]

    # Phần II: bảng đáp án có 4 chuỗi, mỗi chuỗi gồm 4 ký tự Đ/S.
    part_two = re.split(r"Phần\s*II", text, maxsplit=1, flags=re.IGNORECASE)
    true_false = []
    if len(part_two) == 2:
        table = part_two[1].split("Câu 1.", 1)[0]
        rows = re.findall(r"(?m)^\s*\d+\)\s*([DĐS]{4})\s*$", table.upper())
        if not rows:
            rows = re.findall(r"(?m)^\s*([DĐS]{4})\s*$", table.upper())
        true_false = [",".join("D" if char in "DĐ" else "S" for char in row) for row in rows[:4]]

    # Phần III: chỉ đọc vùng bảng từ "Đáp án" đến câu giải đầu tiên để không
    # nhặt nhầm các con số xuất hiện trong nội dung lời giải.
    part_three = re.split(r"Phần\s*III", text, maxsplit=1, flags=re.IGNORECASE)
    short_answer = []
    if len(part_three) == 2:
        table = part_three[1].split("Câu 1.", 1)[0]
        short_answer = re.findall(r"(?m)^\s*\d+\)\s*(-?\d+(?:[,.]\d+)?)\s*$", table)[:6]
        if not short_answer:
            answer_area = re.split(r"Đáp án", table, maxsplit=1, flags=re.IGNORECASE)
            if len(answer_area) == 2:
                table = answer_area[1]
            short_answer = re.findall(r"(?m)^\s*(-?\d+(?:[,.]\d+)?)\s*$", table)[:6]

    answers = multiple_choice + true_false + short_answer
    return {
        "multipleChoice": multiple_choice,
        "trueFalse": true_false,
        "shortAnswer": short_answer,
        "answerKey": answers,
        "complete": len(multiple_choice) == 12 and len(true_false) == 4 and len(short_answer) == 6,
    }


def extract_document(data: bytes):
    document = pymupdf.open(stream=data, filetype="pdf")
    pages = []
    ocr_pages = []
    for index, page in enumerate(document):
        text = page.get_text("text").strip()
        if len(text) < 80:
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
            image = Image.open(io.BytesIO(pixmap.tobytes("png")))
            text = pytesseract.image_to_string(image, lang="vie+eng")
            ocr_pages.append(index + 1)
        pages.append(text)
    return document, "\n".join(pages), ocr_pages


@app.get("/health")
def health():
    return {"ok": True, "engine": str(pytesseract.get_tesseract_version())}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    data = await file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF vượt quá 20 MB")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "File không phải PDF")

    try:
        document, full_text, ocr_pages = extract_document(data)
        return {
            "pageCount": len(document),
            "ocrPages": ocr_pages,
            "sections": infer_sections(full_text),
            "textPreview": full_text[:1200],
        }
    except Exception as error:
        raise HTTPException(422, f"Không đọc được PDF: {error}") from error


@app.post("/analyze-answer")
async def analyze_answer(file: UploadFile = File(...)):
    data = await file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF vượt quá 20 MB")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "File không phải PDF")
    try:
        document, full_text, ocr_pages = extract_document(data)
        return {
            "pageCount": len(document),
            "ocrPages": ocr_pages,
            **extract_answer_key(full_text),
        }
    except Exception as error:
        raise HTTPException(422, f"Không đọc được PDF đáp án: {error}") from error
