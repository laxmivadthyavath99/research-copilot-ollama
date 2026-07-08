"""
vectorstore.py
Wraps Chroma for embedding storage/retrieval. Uses Chroma's built-in
default embedding function to start (free, local, no API key needed).
Swap `embedding_function` for OpenAI/Voyage/etc. later if you want
higher-quality retrieval.
"""

import chromadb
from chromadb.utils import embedding_functions

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "research_papers"


class VectorStore:
    def __init__(self, path: str = CHROMA_PATH):
        self.client = chromadb.PersistentClient(path=path)
        # Free, local, all-MiniLM-L6-v2 sentence embeddings.
        self.embed_fn = embedding_functions.DefaultEmbeddingFunction()
        # Explicitly use cosine distance so `1 - distance` is a meaningful
        # similarity score in roughly [0, 1]. Chroma's default metric
        # otherwise produces unbounded L2 distances that break scoring.
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self.embed_fn,
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: list) -> None:
        """chunks: list of ingestion.Chunk objects"""
        if not chunks:
            return
        ids = [f"{c.paper_id}_{c.chunk_index}" for c in chunks]
        documents = [c.text for c in chunks]
        metadatas = [
            {"paper_id": c.paper_id, "section": c.section}
            for c in chunks
        ]
        self.collection.add(ids=ids, documents=documents, metadatas=metadatas)

    def query(self, question: str, n_results: int = 5, paper_id: str | None = None,
              min_score: float = 0.15):
        where = {"paper_id": paper_id} if paper_id else None
        results = self.collection.query(
            query_texts=[question],
            n_results=n_results,
            where=where,
        )
        # Flatten Chroma's nested response into a simple list of hits,
        # dropping weak/irrelevant matches below min_score.
        hits = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            score = 1 - dist
            if score < min_score:
                continue
            hits.append({"text": doc, "paper_id": meta["paper_id"],
                         "section": meta["section"], "score": score})
        return hits