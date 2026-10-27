import json
import unittest
from datetime import date
from pathlib import Path

from services.rag import CORPUS_PATH, retrieve_documents, validate_corpus


class RagTests(unittest.TestCase):
    def test_curated_corpus_has_recent_official_source_links(self):
        items = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
        validated = validate_corpus(items, today=date(2026, 10, 27))
        self.assertGreaterEqual(len(validated), 5)
        self.assertTrue(all(item["url"].startswith("https://") for item in validated))

    def test_retrieval_returns_relevant_citable_source(self):
        results = retrieve_documents("How can I check soil health card nutrient values and fertilizer advice?", 3)
        self.assertTrue(results)
        self.assertIn("soil-health-card", results[0]["id"])
        self.assertTrue(results[0]["url"].startswith("https://"))
        self.assertTrue(results[0]["publisher"])
        self.assertTrue(results[0]["checkedDate"])

    def test_unrelated_question_does_not_receive_unrelated_grounding(self):
        self.assertEqual(retrieve_documents("How do I repair a mobile phone screen?", 3), [])

    def test_rejects_non_official_source_or_stale_review(self):
        item = {
            "id": "example", "title": "Example", "publisher": "Example",
            "url": "https://example.com/advice", "checkedDate": "2026-10-27",
            "scope": "India", "text": "Example summary",
        }
        with self.assertRaises(ValueError):
            validate_corpus([item], today=date(2026, 10, 27))
        item["url"] = "https://agriculture.gov.in/advice"
        item["checkedDate"] = "2024-01-01"
        with self.assertRaises(ValueError):
            validate_corpus([item], today=date(2026, 10, 27))


if __name__ == "__main__":
    unittest.main()
