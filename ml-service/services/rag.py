from pathlib import Path
import pickle


BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "models" / "kisanai_faiss.index"
CHUNKS_PATH = BASE_DIR / "models" / "kisanai_chunks.pkl"

with open(CHUNKS_PATH, "rb") as f:
    chunks = pickle.load(f)

_semantic_backend = None
_semantic_backend_checked = False


def _get_semantic_backend():
    global _semantic_backend, _semantic_backend_checked
    if _semantic_backend_checked:
        return _semantic_backend

    _semantic_backend_checked = True
    try:
        import faiss
        from sentence_transformers import SentenceTransformer

        index = faiss.read_index(str(INDEX_PATH))
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        _semantic_backend = (index, embedder)
    except Exception:
        _semantic_backend = None
    return _semantic_backend


def retrieve_documents(question: str, top_k: int = 3):
    """Search the FAISS embedding index; never substitute lexical ranking."""
    semantic_backend = _get_semantic_backend()
    if semantic_backend is None:
        raise RuntimeError("Semantic retrieval is unavailable: FAISS or the embedding model could not be loaded.")

    index, embedder = semantic_backend
    try:
        query_embedding = embedder.encode(
            [question], normalize_embeddings=True
        ).astype("float32")

        scores, ids = index.search(query_embedding, min(top_k, index.ntotal))
    except Exception as error:
        raise RuntimeError(f"Semantic retrieval failed: {error}") from error

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
