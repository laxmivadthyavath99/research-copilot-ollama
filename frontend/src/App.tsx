import { useState, useCallback, useEffect } from "react";
import Library from "./Library";
import ChatWindow from "./ChatWindow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface LibraryEntry {
  arxiv_id: string;
  pdf_url: string;
  title?: string;
}

export default function App() {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/library`);
      const data = await res.json();
      setLibrary(data);
    } catch {
      // server not reachable yet; Library empty-state handles this
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Library
        library={library}
        onIngested={refreshLibrary}
        activePaperId={activePaperId}
        onSelectPaper={setActivePaperId}
      />
      <ChatWindow paperId={activePaperId} />
    </div>
  );
}
