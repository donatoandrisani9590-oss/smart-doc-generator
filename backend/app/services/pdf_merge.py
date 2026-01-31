"""
PDF Merge Service: Merges generated documents with static attachments.
Uses PyMuPDF (fitz) for high-performance PDF manipulation.
"""
import fitz  # PyMuPDF
import os
from typing import Optional
import tempfile
from datetime import datetime


def merge_pdfs(
    main_document_path: str,
    attachment_paths: list[str],
    output_path: Optional[str] = None
) -> str:
    """
    Merge a main document with multiple attachments.
    
    Args:
        main_document_path: Path to the main generated PDF
        attachment_paths: List of paths to attachment PDFs
        output_path: Optional custom output path
    
    Returns:
        Path to the merged PDF
    """
    if not output_path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"storage/generated/merged_{timestamp}.pdf"
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Open main document
    merged_doc = fitz.open(main_document_path)
    
    # Append each attachment
    for attachment_path in attachment_paths:
        if os.path.exists(attachment_path):
            attachment = fitz.open(attachment_path)
            merged_doc.insert_pdf(attachment)
            attachment.close()
    
    # Save merged document
    merged_doc.save(output_path)
    merged_doc.close()
    
    return output_path


def add_page_numbers(
    pdf_path: str,
    output_path: Optional[str] = None,
    start_page: int = 1,
    format_string: str = "Seite {current} von {total}"
) -> str:
    """
    Add page numbers to a PDF.
    
    Args:
        pdf_path: Path to the PDF
        output_path: Optional custom output path
        start_page: First page number
        format_string: Format for page numbers
    
    Returns:
        Path to the numbered PDF
    """
    if not output_path:
        output_path = pdf_path.replace(".pdf", "_numbered.pdf")
    
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    
    for page_num, page in enumerate(doc, start=start_page):
        text = format_string.format(current=page_num, total=total_pages)
        
        # Position at bottom center
        rect = page.rect
        text_point = fitz.Point(rect.width / 2, rect.height - 20)
        
        page.insert_text(
            text_point,
            text,
            fontsize=9,
            fontname="helv",
            color=(0.4, 0.4, 0.4)
        )
    
    doc.save(output_path)
    doc.close()
    
    return output_path


def convert_docx_to_pdf(docx_path: str, output_path: Optional[str] = None) -> str:
    """
    Convert a DOCX file to PDF.
    Note: This requires LibreOffice to be installed.
    
    Args:
        docx_path: Path to the DOCX file
        output_path: Optional custom output path
    
    Returns:
        Path to the PDF
    """
    import subprocess
    
    if not output_path:
        output_path = docx_path.replace(".docx", ".pdf")
    
    output_dir = os.path.dirname(output_path) or "."
    
    # Use LibreOffice for conversion
    result = subprocess.run([
        "soffice",
        "--headless",
        "--convert-to", "pdf",
        "--outdir", output_dir,
        docx_path
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        raise RuntimeError(f"PDF conversion failed: {result.stderr}")
    
    return output_path


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract all text from a PDF for indexing/search.
    
    Args:
        pdf_path: Path to the PDF
    
    Returns:
        Extracted text
    """
    doc = fitz.open(pdf_path)
    text_parts = []
    
    for page in doc:
        text_parts.append(page.get_text())
    
    doc.close()
    return "\n".join(text_parts)


def get_pdf_info(pdf_path: str) -> dict:
    """
    Get metadata about a PDF.
    
    Args:
        pdf_path: Path to the PDF
    
    Returns:
        Dictionary with page_count, file_size, etc.
    """
    doc = fitz.open(pdf_path)
    
    info = {
        "page_count": len(doc),
        "file_size_bytes": os.path.getsize(pdf_path),
        "title": doc.metadata.get("title", ""),
        "author": doc.metadata.get("author", ""),
        "producer": doc.metadata.get("producer", ""),
    }
    
    doc.close()
    return info
