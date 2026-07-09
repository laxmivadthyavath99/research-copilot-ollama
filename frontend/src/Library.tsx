import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface Paper {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  pdf_url: string;
}

interface LibraryEntry {
  arxiv_id: string;
  pdf_url: string;
  title?: string;
}

interface Props {
  library: LibraryEntry[];
  onIngested: () => void;
  activePaperId: string | null;
  onSelectPaper: (id: string | null) => void;
}

export default function Library({ library, onIngested, activePaperId, onSelectPaper }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/papers/search?query=${encodeURIComponent(query)}&max_results=6`
      );
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function ingest(paper: Paper) {
    setIngestingId(paper.arxiv_id);
    try {
      await fetch(`${API_BASE}/papers/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arxiv_id: paper.arxiv_id,
          pdf_url: paper.pdf_url,
          title: paper.title,
        }),
      });
      onIngested();
      setResults((prev) => prev.filter((p) => p.arxiv_id !== paper.arxiv_id));
    } finally {
      setIngestingId(null);
    }
  }

  const ingestedIds = new Set(library.map((l) => l.arxiv_id));

  return (
    <aside className="w-80 shrink-0 bg-ink text-paper h-screen overflow-y-auto flex flex-col">
      <div className="px-5 pt-6 pb-4 border-b border-ink-light">
        <div className="font-mono text-xs tracking-widest text-oxblood-light uppercase mb-1">
          Research Copilot
        </div>
        <h1 className="font-display text-2xl leading-tight">Your reading room</h1>
      </div>

      <div className="px-5 py-4 border-b border-ink-light">
        <label className="font-mono text-[11px] tracking-wide text-paper/60 uppercase block mb-2">
          Find a paper
        </label>
        <div className="flex gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. retrieval augmented generation"
            className="flex-1 bg-ink-light text-paper placeholder:text-paper/40 text-sm px-3 py-2 rounded-sm border border-transparent focus:border-oxblood-light outline-none"
          />
          <button
            onClick={search}
            disabled={searching}
            className="px-3 py-2 bg-oxblood hover:bg-oxblood-light transition-colors text-sm rounded-sm disabled:opacity-50"
          >
            {searching ? "…" : "Go"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((p) => {
              const already = ingestedIds.has(p.arxiv_id);
              return (
                <div key={p.arxiv_id} className="border border-ink-light rounded-sm p-3">
                  <div className="font-display text-sm leading-snug mb-1">{p.title}</div>
                  <div className="font-mono text-[10px] text-paper/50 mb-2">
                    {p.arxiv_id} · {p.authors.slice(0, 2).join(", ")}
                    {p.authors.length > 2 ? " et al." : ""}
                  </div>
                  <button
                    onClick={() => ingest(p)}
                    disabled={already || ingestingId === p.arxiv_id}
                    className="font-mono text-[11px] uppercase tracking-wide px-2 py-1 border border-sage text-sage hover:bg-sage hover:text-ink transition-colors rounded-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-sage"
                  >
                    {already ? "In library" : ingestingId === p.arxiv_id ? "Reading…" : "+ Add to library"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-5 py-4 flex-1">
        <label className="font-mono text-[11px] tracking-wide text-paper/60 uppercase block mb-3">
          Library ({library.length})
        </label>

        {library.length === 0 ? (
          <p className="text-sm text-paper/50 leading-relaxed">
            Nothing ingested yet. Search above and add a paper to start asking questions.
          </p>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => onSelectPaper(null)}
              className={`w-full text-left px-3 py-2 rounded-sm text-sm font-mono transition-colors ${
                activePaperId === null
                  ? "bg-oxblood text-paper"
                  : "text-paper/70 hover:bg-ink-light"
              }`}
            >
              All papers
            </button>
            {library.map((p) => (
              <div
                key={p.arxiv_id}
                className={`w-full rounded-sm text-sm transition-colors flex items-start justify-between gap-2 ${
                  activePaperId === p.arxiv_id
                    ? "bg-oxblood text-paper"
                    : "text-paper/70 hover:bg-ink-light"
                }`}
              >
                <button
                  onClick={() => onSelectPaper(p.arxiv_id)}
                  className="flex-1 min-w-0 text-left px-3 py-2"
                >
                  <div className="font-display leading-snug">{p.title || p.arxiv_id}</div>
                  <div className="font-mono text-[10px] opacity-60 mt-0.5">{p.arxiv_id}</div>
                </button>
                <a
                  href={p.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open PDF"
                  className="font-mono text-[11px] px-2 py-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  open↗
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
