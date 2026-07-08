"""
main.py
FastAPI backend for the Research Copilot.

Endpoints:
  GET  /papers/search      -> search arXiv, return metadata (no download)
  POST /papers/ingest      -> download + chunk + embed a chosen paper
  POST /chat                -> RAG: retrieve chunks, ask Groq's free API, return
                                answer with citations back to source papers
  GET  /library             -> list papers saved by the user (Mongo)

Run locally:
  uvicorn main:app --reload --port 8000

This version uses Groq's free API (https://console.groq.com) for the LLM
step. No credit card required to sign up, generous free-tier rate limits,
and no local RAM/CPU load since inference happens on Groq's servers.

Setup:
  1. Sign up at https://console.groq.com (no card needed)
  2. Create an API key under API Keys
  3. Put it in backend/.env as GROQ_API_KEY=your_key_here

Env vars:
  GROQ_API_KEY   required
  GROQ_MODEL     default: llama-3.1-8b-instant
  MONGODB_URI    optional; falls back to in-memory list
"""

import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from ingestion import search_arxiv, ingest_paper, PaperMeta
from vectorstore import VectorStore

load_dotenv()

app = FastAPI(title="Research Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your Vercel domain before prod
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = VectorStore()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Simple in-memory library fallback if Mongo isn't wired up yet.
# Swap this for a real motor/MongoDB collection when you deploy.
_library: list[dict] = []


class ChatRequest(BaseModel):
    question: str
    paper_id: str | None = None  # scope to one paper, or None = whole library


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]


@app.get("/papers/search")
def papers_search(query: str, max_results: int = 10):
    papers = search_arxiv(query, max_results)
    return [p.__dict__ for p in papers]


@app.post("/papers/ingest")
def papers_ingest(paper: dict):
    """
    Accepts a paper dict (as returned by /papers/search), downloads the
    PDF, chunks it, embeds the chunks, and saves metadata to the library.
    """
    arxiv_id = paper.get("arxiv_id")
    pdf_url = paper.get("pdf_url")
    if not arxiv_id or not pdf_url:
        raise HTTPException(400, "paper must include arxiv_id and pdf_url")

    chunks = ingest_paper(arxiv_id, pdf_url)
    vector_store.add_chunks(chunks)
    _library.append(paper)
    return {"status": "ingested", "chunks_created": len(chunks)}


@app.get("/library")
def get_library():
    return _library


def ask_cloud_llm(system_prompt: str, user_prompt: str) -> str:
    """Calls Groq's free hosted API. No local RAM/CPU load."""
    if not GROQ_API_KEY:
        raise HTTPException(
            500,
            "GROQ_API_KEY is not set. Add it to backend/.env - sign up free "
            "at https://console.groq.com",
        )
    try:
        resp = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except requests.exceptions.HTTPError:
        raise HTTPException(
            resp.status_code,
            f"Groq API error: {resp.text}",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(503, f"Couldn't reach Groq: {e}")


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    hits = vector_store.query(req.question, n_results=5, paper_id=req.paper_id)
    if not hits:
        raise HTTPException(404, "No ingested papers match this query yet")

    context_block = "\n\n".join(
        f"[Source {i+1} | paper {h['paper_id']} | section: {h['section']}]\n{h['text']}"
        for i, h in enumerate(hits)
    )

    system_prompt = (
        "You are a research assistant. Answer the user's question using ONLY "
        "the provided source excerpts. Cite sources inline like [Source 1]. "
        "If the excerpts don't contain the answer, say so plainly."
    )
    user_prompt = f"Sources:\n{context_block}\n\nQuestion: {req.question}"

    answer_text = ask_cloud_llm(system_prompt, user_prompt)

    return ChatResponse(answer=answer_text, sources=hits)


@app.get("/")
def health():
    return {"status": "ok"}