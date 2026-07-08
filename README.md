# Research Copilot

RAG-based research assistant: search arXiv, ingest papers, ask questions,
get answers with inline citations back to the source text.

## Architecture
- **Ingestion**: arXiv API search → PDF download (PyMuPDF text extraction) → section-aware chunking
- **Embeddings + retrieval**: Chroma (local, free default embedding model — swap for OpenAI/Voyage later)
- **Synthesis**: Claude API (`claude-sonnet-4-6`) answers using only retrieved chunks, cites sources inline
- **Backend**: FastAPI
- **Frontend**: React + TypeScript (stub chat component included, build out with Vite)
- **Deploy**: frontend → Vercel, backend → Railway, metadata → MongoDB Atlas (optional, in-memory fallback for local dev)

## Backend setup (local)

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# create a .env file with:
# ANTHROPIC_API_KEY=your_key_here
# CLAUDE_MODEL=claude-haiku-4-5-20251001   (default, cheap — good for dev)
#   -> switch to claude-sonnet-4-6 for higher-quality demo answers

uvicorn main:app --reload --port 8000
```

Test it:
```bash
curl "http://localhost:8000/papers/search?query=retrieval augmented generation"
```

## Frontend setup

The `frontend/src/ChatWindow.tsx` is a working chat component. To scaffold
a full Vite + React + TS app around it:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
# copy ChatWindow.tsx into src/, import it into App.tsx
npm run dev
```

Set `VITE_API_BASE` in a `.env` file to point at your deployed backend URL.

## API flow

1. `GET /papers/search?query=...` — search arXiv, get back metadata + pdf_url, no download yet
2. `POST /papers/ingest` — pass one result from search; downloads PDF, chunks, embeds, saves to library
3. `POST /chat` — `{ "question": "...", "paper_id": "optional" }` — retrieves top chunks, asks Claude, returns answer + sources
4. `GET /library` — list ingested papers

## Next steps / stretch features
- Swap in-memory `_library` for MongoDB Atlas (motor client, you've already used Atlas before)
- Add `/papers/compare` endpoint: retrieve chunks from two paper_ids, ask Claude to contrast methodology/results
- Citation graph viz with d3.js pulling from Semantic Scholar's citation API
- Auto-generate a "related work" paragraph draft from a set of ingested papers
- Confidence threshold: if retrieval similarity scores are all low, tell the user "not enough ingested papers cover this" instead of hallucinating

## Notes
- The default Chroma embedding function is local and free — good for getting started, but retrieval quality improves noticeably if you switch to `text-embedding-3-small` (OpenAI) or Voyage AI embeddings once you're ready to add an API key.
- Tighten CORS `allow_origins` in `main.py` before deploying — currently wide open for local dev.
