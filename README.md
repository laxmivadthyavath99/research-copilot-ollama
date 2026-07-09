# Research Copilot

A RAG-based research assistant for exploring academic papers: search arXiv,
add papers to a personal library, and ask questions that get answered with
inline citations back to the exact source section - not hallucinated,
grounded in retrieved text.

**Live app:** https://research-copilot-ollama.vercel.app
**Live API:** https://research-copilot-ollama.onrender.com

Built free end-to-end - no paid API keys, no billing, deployed on free-tier
hosting throughout.

## Why this exists

Reading and cross-referencing papers is slow. This tool lets you build a
personal library of papers on a topic and ask questions across all of them
at once, getting answers grounded in the actual text with citations you can
verify - not a general-knowledge chatbot guessing at what a paper probably
says.

## Architecture

| Layer | Choice | Notes |
|---|---|---|
| Ingestion | arXiv API + PyMuPDF | Downloads PDF, extracts text, section-aware chunking (references section excluded - it's citation noise, not content) |
| Embeddings | Chroma's local default model | Free, runs in-process, cosine distance configured explicitly for meaningful similarity scores |
| Vector store | Chroma (persistent local) | No external vector DB needed for this scale |
| LLM synthesis | Groq free API (`llama-3.1-8b-instant`) | Fast, free tier, no card required. Model configurable via `GROQ_MODEL` env var |
| Backend | FastAPI | REST endpoints for search, ingest, chat, library |
| Frontend | React + TypeScript + Vite + Tailwind | Two-pane UI: paper library sidebar + chat pane with catalog-style citation cards |
| Deploy | Vercel (frontend) + Render (backend) | Both free tier |

## Live demo walkthrough

1. Search for a topic (e.g. "retrieval augmented generation")
2. Add 2-3 papers to your library
3. Ask a question - either scoped to one paper, or across your whole library
4. Answers cite specific sources with a similarity score, so you can see
   exactly what grounded each claim

## Local setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
```
Get a free Groq key at https://console.groq.com (no card required).

Run:
```bash
uvicorn main:app --reload --port 8000
```

Test:
```bash
curl "http://localhost:8000/papers/search?query=retrieval augmented generation"
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
Opens at `http://localhost:5173`. Requires the backend running at the same time.

Optional `frontend/.env` if backend isn't on `localhost:8000`:
```
VITE_API_BASE=http://localhost:8000
```

## API reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/papers/search?query=...` | GET | Search arXiv, returns metadata (no download yet) |
| `/papers/ingest` | POST | `{arxiv_id, pdf_url}` - downloads, chunks, embeds, adds to library |
| `/chat` | POST | `{question, paper_id?}` - retrieves relevant chunks, asks Groq, returns cited answer |
| `/library` | GET | List all ingested papers |

## Deployment

**Backend (Render):**
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env vars: `GROQ_API_KEY`, `GROQ_MODEL`, `PYTHON_VERSION=3.11.9`

**Frontend (Vercel):**
- Root directory: `frontend`
- Env var: `VITE_API_BASE=<render-backend-url>`

**CORS:** `backend/main.py` allowlists the exact Vercel domain plus
`localhost:5173` for local dev - not wildcarded, since this is a live
public deployment.

## Known limitations (and why they're worth mentioning, not hiding)

- **No persistent vector storage across deploys.** Chroma's data lives on
  Render's ephemeral disk - every redeploy wipes the library. Fine for a
  demo; a production version would need a hosted vector DB (Pinecone,
  Weaviate Cloud both have free tiers).
- **Render free tier spins down after inactivity.** First request after
  idle time takes 30-50s to wake up. Not a bug, just the tradeoff for
  zero-cost hosting.
- **512MB RAM ceiling on Render's free tier** required optimizing PDF
  ingestion to stream to disk rather than hold the full document in memory
  twice - a real, specific engineering constraint that shaped the ingestion
  pipeline design.
- **Retrieval quality is bounded by Chroma's default embedding model**
  (a small local sentence-transformer). Swapping in a stronger hosted
  embedding model (Voyage AI, OpenAI) would likely improve match quality,
  at the cost of no longer being fully free.

## Possible next steps

- Compare-two-papers endpoint: retrieve chunks from two `paper_id`s, ask
  the model to contrast methodology/results directly
- Swap in-memory library for MongoDB Atlas for real persistence
- Citation graph visualization pulling from Semantic Scholar's citation API
- Auto-generated "related work" paragraph drafts from a set of ingested
  papers
- Hosted embeddings for better retrieval quality

## Tech decisions worth knowing for a walkthrough/interview

- **Cosine distance was explicitly configured** on the Chroma collection -
  the default metric produced unbounded, unreliable similarity scores that
  looked broken (including a genuine negative score bug caught during
  development) until this was fixed.
- **References sections are excluded from chunking.** Early testing showed
  retrieval surfacing bibliography entries (paper titles matching keywords)
  instead of actual explanatory content - a real, diagnosable RAG failure
  mode, not a hypothetical one.
- **The LLM provider was swapped twice during development**: started with
  the Anthropic API (paid), moved to local Ollama (free but RAM-constrained
  on limited hardware), landed on Groq's free hosted API as the best fit
  for a memory-constrained laptop that still needed reliable inference.