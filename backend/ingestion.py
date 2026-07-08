"""
ingestion.py
Fetches papers from arXiv, downloads PDFs, extracts text, and chunks it
into section-aware pieces ready for embedding.
"""

import re
import io
import requests
import fitz  # PyMuPDF
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field


ARXIV_API = "http://export.arxiv.org/api/query"
NAMESPACE = {"atom": "http://www.w3.org/2005/Atom"}


@dataclass
class PaperMeta:
    arxiv_id: str
    title: str
    authors: list
    abstract: str
    pdf_url: str


@dataclass
class Chunk:
    paper_id: str
    section: str
    text: str
    chunk_index: int
    metadata: dict = field(default_factory=dict)


def search_arxiv(query: str, max_results: int = 10) -> list[PaperMeta]:
    """Search arXiv and return paper metadata (no PDF download yet)."""
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
    }
    resp = requests.get(ARXIV_API, params=params, timeout=15)
    resp.raise_for_status()
    root = ET.fromstring(resp.text)

    papers = []
    for entry in root.findall("atom:entry", NAMESPACE):
        arxiv_id = entry.find("atom:id", NAMESPACE).text.split("/abs/")[-1]
        title = entry.find("atom:title", NAMESPACE).text.strip().replace("\n", " ")
        abstract = entry.find("atom:summary", NAMESPACE).text.strip().replace("\n", " ")
        authors = [
            a.find("atom:name", NAMESPACE).text
            for a in entry.findall("atom:author", NAMESPACE)
        ]
        pdf_url = None
        for link in entry.findall("atom:link", NAMESPACE):
            if link.get("title") == "pdf":
                pdf_url = link.get("href")
        papers.append(PaperMeta(arxiv_id, title, authors, abstract, pdf_url or ""))
    return papers


def download_pdf_text(pdf_url: str) -> str:
    """Download a PDF and extract raw text using PyMuPDF."""
    resp = requests.get(pdf_url, timeout=30)
    resp.raise_for_status()
    doc = fitz.open(stream=io.BytesIO(resp.content), filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    doc.close()
    return full_text


# Common section headers found in research papers, used to keep chunks
# section-aware rather than splitting mid-argument.
SECTION_PATTERN = re.compile(
    r"^\s*(abstract|introduction|related work|background|method(?:ology)?|"
    r"experiments?|results?|discussion|conclusion|references)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def chunk_text(paper_id: str, text: str, target_tokens: int = 500) -> list[Chunk]:
    """
    Splits text into section-aware chunks. Falls back to fixed-size
    windows within a section if it's too long.
    Rough token estimate: 1 token ~ 4 chars (good enough for chunk sizing;
    swap in tiktoken for precision if needed).
    """
    target_chars = target_tokens * 4

    # Split on detected section headers, keep header as label
    matches = list(SECTION_PATTERN.finditer(text))
    sections = []
    if not matches:
        sections.append(("body", text))
    else:
        for i, m in enumerate(matches):
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            sections.append((m.group(1).strip().lower(), text[start:end]))

    chunks = []
    idx = 0
    for section_name, section_text in sections:
        section_text = section_text.strip()
        if not section_text:
            continue
        # Fixed-size sub-split within a section
        for i in range(0, len(section_text), target_chars):
            piece = section_text[i:i + target_chars].strip()
            if len(piece) < 40:  # skip tiny fragments
                continue
            chunks.append(Chunk(
                paper_id=paper_id,
                section=section_name,
                text=piece,
                chunk_index=idx,
            ))
            idx += 1
    return chunks


def ingest_paper(arxiv_id: str, pdf_url: str) -> list[Chunk]:
    """Full pipeline: download PDF -> extract text -> chunk."""
    text = download_pdf_text(pdf_url)
    return chunk_text(arxiv_id, text)
