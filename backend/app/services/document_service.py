import re
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader


PAGE_PATTERN = re.compile(r"\[PAGE (\d+)\]")


def load_document_text(file_path: str) -> str:
    path = Path(file_path)
    extension = path.suffix.lower()

    if extension == ".pdf":
        reader = PdfReader(path)
        sections: list[str] = []

        for page_number, page in enumerate(reader.pages, start=1):
            page_text = (page.extract_text() or "").strip()

            if page_text:
                sections.append(
                    f"[PAGE {page_number}]\n{page_text}"
                )

        return "\n\n".join(sections)

    if extension == ".txt":
        return path.read_text(
            encoding="utf-8",
            errors="ignore",
        )

    if extension == ".docx":
        document = DocxDocument(path)

        paragraphs = [
            paragraph.text.strip()
            for paragraph in document.paragraphs
            if paragraph.text.strip()
        ]

        return "\n".join(paragraphs)

    raise ValueError(
        f"Unsupported file type: {extension}. "
        "Supported types are PDF, TXT, and DOCX."
    )


def chunk_text(
    text: str,
    chunk_size: int = 220,
    overlap: int = 40,
) -> list[dict]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError(
            "overlap must be zero or greater and smaller than chunk_size"
        )

    text = text.strip()

    if not text:
        return []

    chunks: list[dict] = []

    matches = list(PAGE_PATTERN.finditer(text))

    if matches:
        sections: list[tuple[int | None, str]] = []

        for index, match in enumerate(matches):
            start = match.end()
            end = (
                matches[index + 1].start()
                if index + 1 < len(matches)
                else len(text)
            )

            page_number = int(match.group(1))
            section_text = text[start:end].strip()

            if section_text:
                sections.append((page_number, section_text))
    else:
        sections = [(None, text)]

    step = chunk_size - overlap

    for page_number, section_text in sections:
        words = section_text.split()

        for start in range(0, len(words), step):
            chunk_words = words[start : start + chunk_size]

            if not chunk_words:
                continue

            content = " ".join(chunk_words).strip()

            if len(content) < 30:
                continue

            chunks.append(
                {
                    "text": content,
                    "page": page_number,
                }
            )

            if start + chunk_size >= len(words):
                break

    return chunks


def process_document(file_path: str) -> list[dict]:
    text = load_document_text(file_path)
    return chunk_text(text)
