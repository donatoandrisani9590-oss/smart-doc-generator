"""
Diff Service -- Berechnet wortweisen Diff zwischen zwei Texten.

Nutzt difflib.SequenceMatcher für Word-Level-Vergleich.
Gibt strukturierte Diff-Operationen zurück (insert, delete, equal).
"""
import difflib
import re
from typing import Optional
from pydantic import BaseModel


class DiffOperation(BaseModel):
    """Eine einzelne Diff-Operation."""
    type: str  # "equal" | "insert" | "delete"
    text: str


class DiffResult(BaseModel):
    """Strukturiertes Ergebnis eines Text-Vergleichs."""
    operations: list
    stats: dict  # {"inserts": int, "deletes": int, "equal_count": int}


def compute_diff(
    original: str,
    modified: str,
    granularity: str = "word",  # "word" | "sentence"
) -> DiffResult:
    """Compute a structured diff between two texts."""
    if granularity == "sentence":
        orig_tokens = _split_sentences(original)
        mod_tokens = _split_sentences(modified)
    else:
        orig_tokens = _split_words(original)
        mod_tokens = _split_words(modified)

    matcher = difflib.SequenceMatcher(None, orig_tokens, mod_tokens)
    operations: list = []
    stats = {"inserts": 0, "deletes": 0, "equal_count": 0}

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            text = " ".join(orig_tokens[i1:i2])
            operations.append(DiffOperation(type="equal", text=text))
            stats["equal_count"] += i2 - i1
        elif tag == "delete":
            text = " ".join(orig_tokens[i1:i2])
            operations.append(DiffOperation(type="delete", text=text))
            stats["deletes"] += i2 - i1
        elif tag == "insert":
            text = " ".join(mod_tokens[j1:j2])
            operations.append(DiffOperation(type="insert", text=text))
            stats["inserts"] += j2 - j1
        elif tag == "replace":
            # Replace = delete old + insert new
            del_text = " ".join(orig_tokens[i1:i2])
            ins_text = " ".join(mod_tokens[j1:j2])
            operations.append(DiffOperation(type="delete", text=del_text))
            operations.append(DiffOperation(type="insert", text=ins_text))
            stats["deletes"] += i2 - i1
            stats["inserts"] += j2 - j1

    return DiffResult(operations=operations, stats=stats)


def _split_words(text: str) -> list:
    """Split text into words, preserving punctuation."""
    return re.findall(r'\S+', text)


def _split_sentences(text: str) -> list:
    """Split text into sentences."""
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
