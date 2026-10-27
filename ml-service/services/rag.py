"""Source-linked retrieval over a small, reviewed government agriculture corpus."""

from datetime import date
import json
from pathlib import Path
from urllib.parse import urlparse

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


CORPUS_PATH = Path(__file__).resolve().parents[1] / "models" / "rag_corpus.json"
MAX_SOURCE_AGE_DAYS = 365
MIN_RELEVANCE_SCORE = 0.12
_corpus = None
_vectorizer = None
_matrix = None
_load_error = None


def validate_corpus(items: object, today: date | None = None) -> list[dict]:
    """Require dated reviews and HTTPS sources on official Indian domains."""
    if not isinstance(items, list) or not items:
        raise ValueError("RAG corpus is empty or has an invalid format.")

    today = today or date.today()
    seen_ids = set()
    validated = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Every RAG corpus entry must be an object.")
        required = ("id", "title", "publisher", "url", "checkedDate", "scope", "text")
        if any(not isinstance(item.get(key), str) or not item[key].strip() for key in required):
            raise ValueError("RAG entries must include title, publisher, HTTPS URL, review date, scope, and text.")
        if item["id"] in seen_ids:
            raise ValueError("RAG corpus IDs must be unique.")
        seen_ids.add(item["id"])

        parsed_url = urlparse(item["url"])
        host = (parsed_url.hostname or "").lower()
        if parsed_url.scheme != "https" or not (host.endswith(".gov.in") or host.endswith(".nic.in")):
            raise ValueError("RAG sources must use HTTPS on an official .gov.in or .nic.in domain.")
        try:
            checked_date = date.fromisoformat(item["checkedDate"])
        except ValueError as error:
            raise ValueError("RAG source review dates must use YYYY-MM-DD.") from error
        age = (today - checked_date).days
        if age < 0 or age > MAX_SOURCE_AGE_DAYS:
            raise ValueError("RAG sources must be reviewed within the past year.")
        if len(item["text"]) > 5000:
            raise ValueError("RAG corpus summaries must be 5,000 characters or shorter.")
        validated.append({**item, "text": item["text"].strip()})
    return validated


def _load_index() -> None:
    global _corpus, _vectorizer, _matrix, _load_error
    if _corpus is not None or _load_error is not None:
        return
    try:
        raw = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
        corpus = validate_corpus(raw)
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        matrix = vectorizer.fit_transform([f"{doc['title']} {doc['text']}" for doc in corpus])
        if matrix.shape[0] != len(corpus) or matrix.shape[1] == 0:
            raise ValueError("RAG corpus did not produce a searchable index.")
        _corpus, _vectorizer, _matrix = corpus, vectorizer, matrix
    except Exception as error:
        _load_error = str(error)


def rag_status() -> dict:
    _load_index()
    if _load_error:
        return {"available": False, "detail": f"Verified RAG corpus unavailable: {_load_error}"}
    try:
        validate_corpus(_corpus)
    except ValueError as error:
        return {"available": False, "detail": str(error)}
    return {
        "available": True,
        "detail": f"Source-linked agriculture corpus ready ({len(_corpus)} reviewed summaries; local TF-IDF retrieval).",
        "corpusSize": len(_corpus),
        "retrievalMethod": "tfidf_keyword",
    }


def retrieve_documents(question: str, top_k: int = 3) -> list[dict]:
    """Return only sufficiently relevant entries with their official citations."""
    _load_index()
    if _load_error:
        raise RuntimeError(_load_error)
    try:
        validate_corpus(_corpus)
    except ValueError as error:
        raise RuntimeError(str(error)) from error
    if not isinstance(question, str) or not question.strip():
        raise RuntimeError("A non-empty question is required for retrieval.")

    query = _vectorizer.transform([question.strip()])
    scores = cosine_similarity(query, _matrix)[0]
    ranked = sorted(enumerate(scores), key=lambda pair: float(pair[1]), reverse=True)
    results = []
    for index, score in ranked:
        if float(score) < MIN_RELEVANCE_SCORE:
            break
        doc = _corpus[index]
        results.append({
            "id": doc["id"],
            "title": doc["title"],
            "publisher": doc["publisher"],
            "url": doc["url"],
            "checkedDate": doc["checkedDate"],
            "sourceDate": doc.get("sourceDate"),
            "scope": doc["scope"],
            "text": doc["text"],
            "score": round(float(score), 4),
        })
        if len(results) >= min(max(int(top_k), 1), 10):
            break
    return results
