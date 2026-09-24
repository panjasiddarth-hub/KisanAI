from pathlib import Path
import pickle

import faiss
from sentence_transformers import SentenceTransformer


BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "models" / "kisanai_faiss.index"
CHUNKS_PATH = BASE_DIR / "models" / "kisanai_chunks.pkl"

# Load RAG artifacts
index = faiss.read_index(str(INDEX_PATH))

with open(CHUNKS_PATH, "rb") as f:
    chunks = pickle.load(f)

# Same embedding model used when the FAISS index was created
embedder = SentenceTransformer("all-MiniLM-L6-v2")


def retrieve_documents(question: str, top_k: int = 3):
    """Retrieve the most relevant agricultural knowledge chunks."""

    query_embedding = embedder.encode(
        [question],
        normalize_embeddings=True
    ).astype("float32")

    scores, ids = index.search(
        query_embedding,
        min(top_k, index.ntotal)
    )

    results = []

    for score, idx in zip(scores[0], ids[0]):
        if idx < 0:
            continue

        chunk = chunks[int(idx)]

        results.append({
            "score": round(float(score), 4),
            **chunk
        })

    return results