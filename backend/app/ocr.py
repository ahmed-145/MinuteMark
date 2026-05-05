"""
OCR extraction service.
Handles images (JPG/PNG/WEBP) via pytesseract and PDFs via pdfplumber.
"""
import os
from pathlib import Path

UPLOAD_DIR = Path("/tmp/gradeai_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def extract_text_from_image(path: str) -> str:
    """Extract text from an image file using Tesseract OCR."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(path)
        text = pytesseract.image_to_string(img, lang="eng+ara")  # supports Arabic too
        return text.strip()
    except ImportError:
        raise RuntimeError("pytesseract not installed. Run: pip install pytesseract Pillow && sudo apt install tesseract-ocr")


def extract_text_from_pdf_pages(path: str) -> list[str]:
    """Extract text from a PDF using pdfplumber, returning a list of strings (one per page)."""
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                pages.append(t or "")
        return pages
    except ImportError:
        raise RuntimeError("pdfplumber not installed. Run: pip install pdfplumber")


def extract_text_from_pdf(path: str) -> str:
    """Extract text from a PDF as a single block of text."""
    return "\n".join(extract_text_from_pdf_pages(path)).strip()


def extract_text(path: str) -> str:
    """
    Dispatch to the right extractor based on file extension.
    Supports: .pdf, .txt, .md, .jpg, .jpeg, .png, .webp, .bmp, .tiff
    """
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext in (".txt", ".md", ".text"):
        # Plain text — just read it directly
        return Path(path).read_text(encoding="utf-8", errors="replace").strip()
    elif ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"):
        return extract_text_from_image(path)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: PDF, TXT, JPG, PNG, WEBP, BMP, TIFF")


def extract_text_pages(path: str) -> list[str]:
    """
    Extract text page by page if supported (PDF), otherwise return as a single page list.
    """
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf_pages(path)
    return [extract_text(path)]


def save_upload(contents: bytes, filename: str) -> str:
    """Save uploaded file bytes to the upload directory and return the path."""
    import uuid
    safe_name = f"{uuid.uuid4()}_{Path(filename).name}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(contents)
    return str(dest)
