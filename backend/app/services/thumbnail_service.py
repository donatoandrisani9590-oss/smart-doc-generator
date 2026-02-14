"""
Thumbnail-Generierung für Briefpapier-Vorlagen (Stationery Templates).

Konvertiert DOCX -> PDF via LibreOffice headless, rendert dann
die erste Seite als PNG via PyMuPDF (fitz).
"""
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent.parent
THUMBNAIL_STORAGE = BASE_DIR / "storage" / "thumbnails"
THUMBNAIL_STORAGE.mkdir(parents=True, exist_ok=True)


def generate_thumbnail(
    docx_path: Path,
    output_path: Optional[Path] = None,
    width: int = 400,
) -> Optional[Path]:
    """
    Generiert ein PNG-Thumbnail aus einer DOCX-Datei.

    1. Konvertierung DOCX -> PDF via LibreOffice headless
    2. Rendering der ersten Seite als PNG via PyMuPDF (fitz)

    Args:
        docx_path: Pfad zur Quell-DOCX-Datei
        output_path: Zielpfad für das PNG. Falls None, wird automatisch generiert.
        width: Zielbreite in Pixel (Höhe wird proportional berechnet)

    Returns:
        Pfad zum generierten PNG, oder None bei Fehler
    """
    if not docx_path.exists():
        logger.error(f"DOCX-Datei nicht gefunden: {docx_path}")
        return None

    try:
        # Schritt 1: DOCX -> PDF via LibreOffice
        with tempfile.TemporaryDirectory() as tmp_dir:
            result = subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", tmp_dir,
                    str(docx_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
                start_new_session=True,  # Eigene Process-Group für sauberes Cleanup
            )

            if result.returncode != 0:
                logger.warning(f"LibreOffice-Konvertierung fehlgeschlagen: {result.stderr}")
                return None

            # Generiertes PDF finden
            pdf_files = list(Path(tmp_dir).glob("*.pdf"))
            if not pdf_files:
                logger.warning("Keine PDF-Datei von LibreOffice generiert")
                return None

            pdf_path = pdf_files[0]

            # Schritt 2: PDF -> PNG via PyMuPDF
            import fitz  # PyMuPDF

            doc = fitz.open(str(pdf_path))
            try:
                if len(doc) == 0:
                    logger.warning("PDF hat keine Seiten")
                    return None

                page = doc[0]

                # Zoom für Zielbreite berechnen
                zoom = width / page.rect.width
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)

                # PNG speichern
                if output_path is None:
                    output_path = THUMBNAIL_STORAGE / f"{docx_path.stem}_thumb.png"

                output_path.parent.mkdir(parents=True, exist_ok=True)
                pix.save(str(output_path))

                logger.info(f"Thumbnail generiert: {output_path}")
                return output_path
            finally:
                doc.close()

    except FileNotFoundError:
        logger.warning("LibreOffice (soffice) nicht gefunden. Thumbnail-Generierung übersprungen.")
        return None
    except subprocess.TimeoutExpired:
        logger.warning("LibreOffice-Konvertierung Timeout")
        return None
    except ImportError:
        logger.warning("PyMuPDF (fitz) nicht installiert. Thumbnail-Generierung übersprungen.")
        return None
    except Exception as e:
        logger.error(f"Thumbnail-Generierung fehlgeschlagen: {e}")
        return None
