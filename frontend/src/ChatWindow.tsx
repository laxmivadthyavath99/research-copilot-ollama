import { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface Source {
  text: string;
  paper_id: string;
  section: string;
  score: number;
}

interface Message {
  role: "user" | "assistant" | "error";
  text: string;
  sources?: Source[];
}

interface Props {
  paperId: string | null;
}

export default function ChatWindow({ paperId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const question = input;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, paper_id: paperId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            text:
              err?.detail ||
              "No matches in the library yet. Add a paper on the left, then ask again.",
          },
        ]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "Couldn't reach the server. Is uvicorn running?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen flex-1 bg-paper">
      <header className="px-8 py-5 border-b border-line flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-xl">
            {paperId ? "Asking one paper" : "Asking your whole library"}
          </h2>
          {paperId && (
            <div className="font-mono text-[11px] text-ink/50 mt-0.5">{paperId}</div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 && (
          <div className="max-w-md mx-auto mt-16 text-center">
            <p className="font-display text-lg text-ink/60 leading-relaxed">
              Ask something about the papers you've added — a method, a result,
              a comparison across sources.
            </p>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "user" && (
                <div className="flex justify-end">
                  <div className="bg-ink text-paper px-4 py-2.5 rounded-sm max-w-[85%] font-body text-sm">
                    {m.text}
                  </div>
                </div>
              )}

              {m.role === "error" && (
                <div className="border border-oxblood/40 bg-oxblood/5 text-oxblood px-4 py-3 rounded-sm text-sm font-body">
                  {m.text}
                </div>
              )}

              {m.role === "assistant" && (
                <div className="space-y-3">
                  <div className="font-body text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
                    {m.text}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="grid gap-2 pt-1">
                      {m.sources.map((s, j) => (
                        <div
                          key={j}
                          className="border border-line bg-paper-dim/60 rounded-sm px-3 py-2 flex items-start gap-3"
                        >
                          <span className="font-mono text-[10px] text-oxblood shrink-0 pt-0.5">
                            {String(j + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] text-ink/70 truncate">
                              {s.paper_id} · {s.section}
                            </div>
                            <div className="font-mono text-[10px] text-sage mt-0.5">
                              match {(s.score * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="font-mono text-xs text-ink/40 tracking-wide">
              retrieving · reading · answering …
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-line px-8 py-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about your papers…"
            className="flex-1 bg-white border border-line rounded-sm px-4 py-2.5 text-sm font-body outline-none focus:border-oxblood"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-5 py-2.5 bg-ink text-paper rounded-sm text-sm font-body hover:bg-ink-light transition-colors disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
