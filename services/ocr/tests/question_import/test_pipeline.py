import io
import shutil
import zipfile
from pathlib import Path

import pymupdf
import pytest
from app.question_import.pipeline import DocumentImporter
from app.question_import.storage.assets import LocalAssetStorage
from PIL import Image, ImageDraw, ImageFont


def sample_pdf() -> bytes:
    document = pymupdf.open()
    first = document.new_page(width=612, height=792)
    first.insert_text((40, 70), "PHAN I. Cau trac nghiem nhieu phuong an", fontsize=12)
    first.insert_text((40, 650), "Cau 1. Noi dung cau hoi khong co dap an", fontsize=12)
    first.insert_text((40, 770), "Footer lap lai 1", fontsize=9)
    second = document.new_page(width=612, height=792)
    second.insert_text((40, 50), "A. 1    B. 2    C. 3    D. 4", fontsize=12)
    second.insert_text((40, 180), "Cau 2. Cau hoi thu hai", fontsize=12)
    second.insert_text((40, 210), "A. 5    B. 6    C. 7    D. 8", fontsize=12)
    second.insert_text((40, 770), "Footer lap lai 2", fontsize=9)
    result = document.tobytes()
    document.close()
    return result


def sample_docx() -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            "<w:p><w:r><w:t>PHAN I. Cau trac nghiem nhieu phuong an</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Cau 1. Noi dung cau hoi</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>A. 1    B. 2    C. 3    D. 4</w:t></w:r></w:p>"
            '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>'
            "</w:body></w:document>",
        )
    return output.getvalue()


def scanned_pdf() -> bytes:
    image = Image.new("RGB", (1200, 1600), "white")
    draw = ImageDraw.Draw(image)
    font_path = next(
        (
            path
            for path in [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
            ]
            if Path(path).exists()
        ),
        None,
    )
    font = ImageFont.truetype(font_path, 48) if font_path else ImageFont.load_default()
    draw.text(
        (80, 100), "PHAN I. Cau trac nghiem nhieu phuong an", fill="black", font=font
    )
    draw.text((80, 350), "Cau 1. Noi dung trang quet", fill="black", font=font)
    draw.text((80, 500), "A. 1    B. 2    C. 3    D. 4", fill="black", font=font)
    png = io.BytesIO()
    image.save(png, format="PNG")
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=png.getvalue())
    result = document.tobytes()
    document.close()
    return result


@pytest.mark.asyncio
async def test_pipeline_preserves_original_pages_snapshots_and_debug(tmp_path: Path):
    storage = LocalAssetStorage(tmp_path)
    result = await DocumentImporter(storage=storage).import_document(
        sample_pdf(), filename="de-thi.pdf", document_id="test-doc", debug=True
    )
    assert result.page_count == 2
    assert len(result.questions) == 2
    assert len(result.questions[0].source_regions) == 2
    assert len(result.questions[0].source_snapshot_assets) == 2
    assert result.questions[0].answer is None
    assert len(result.debug_pages) == 2
    assert all(Path(asset.path).exists() for asset in result.assets)
    assert any(asset.kind == "original" for asset in result.assets)
    assert any(asset.kind == "source_questions" for asset in result.assets)
    assert any(
        asset.kind == "debug" and asset.object_key.endswith(".webp")
        for asset in result.assets
    )


@pytest.mark.skipif(
    not shutil.which("libreoffice"),
    reason="LibreOffice is provided by the service image",
)
@pytest.mark.asyncio
async def test_docx_is_rendered_before_using_the_pdf_pipeline(tmp_path: Path):
    result = await DocumentImporter(
        storage=LocalAssetStorage(tmp_path)
    ).import_document(
        sample_docx(), filename="de-thi.docx", document_id="test-docx", debug=False
    )
    assert result.page_count == 1
    assert len(result.questions) == 1
    assert any(
        asset.object_key.endswith("original/document.docx") for asset in result.assets
    )
    assert any(
        asset.object_key.endswith("original/rendered_source.pdf")
        for asset in result.assets
    )


@pytest.mark.skipif(
    not shutil.which("tesseract"), reason="Tesseract structural fallback is unavailable"
)
@pytest.mark.asyncio
async def test_scanned_page_uses_ocr_only_to_recover_structure(tmp_path: Path):
    result = await DocumentImporter(
        storage=LocalAssetStorage(tmp_path)
    ).import_document(
        scanned_pdf(), filename="scan.pdf", document_id="test-scan", debug=False
    )
    assert result.stats.detected_questions == 1
    assert "structural_ocr_used" in result.warnings
    assert "scanned_source_page" in result.questions[0].warnings
    assert "visual_transcription_required" in result.questions[0].warnings
