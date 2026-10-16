from pathlib import Path
import pickle
import re


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


def _lexical_search(question: str, top_k: int) -> list[dict]:
    query_terms = set(re.findall(r"[a-z0-9]+", question.lower()))
    if not query_terms:
        return []

    ranked = []
    for chunk in chunks:
        text = str(chunk.get("text", ""))
        document_terms = set(re.findall(r"[a-z0-9]+", text.lower()))
        overlap = query_terms & document_terms
        if overlap:
            ranked.append((len(overlap) / len(query_terms), chunk))

    ranked.sort(key=lambda item: item[0], reverse=True)
    return [
        {"score": round(score, 4), **chunk}
        for score, chunk in ranked[:top_k]
    ]


def retrieve_documents(question: str, top_k: int = 3):
    """Use embeddings when installed, otherwise rank chunks by keyword overlap."""
    semantic_backend = _get_semantic_backend()
    if semantic_backend is None:
        return _lexical_search(question, top_k)

    index, embedder = semantic_backend
    try:
        query_embedding = embedder.encode(
            [question], normalize_embeddings=True
        ).astype("float32")

        scores, ids = index.search(query_embedding, min(top_k, index.ntotal))
    except Exception:
        return _lexical_search(question, top_k)

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