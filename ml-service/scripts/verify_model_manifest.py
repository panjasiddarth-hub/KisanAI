"""Verify model artifact hashes without deserializing pickle/joblib files."""

import hashlib
import json
from pathlib import Path
import sys


BASE_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = BASE_DIR / "models" / "model-manifest.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as artifact:
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    failures = []

    models = list(manifest["artifacts"])
    disease_model = manifest.get("disease_model")
    if disease_model:
        models.append({
            "id": "disease_image_classifier",
            "files": [disease_model["artifact"]],
        })

    for model in models:
        for record in model["files"]:
            path = BASE_DIR / "models" / record["path"]
            if not path.is_file():
                failures.append(f"MISSING {model['id']}: {record['path']}")
                continue

            actual = sha256_file(path)
            expected = record["sha256"].lower()
            if actual != expected:
                failures.append(f"MISMATCH {model['id']}: {record['path']}")
            else:
                print(f"OK {model['id']}: {record['path']}")

    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1

    print("All manifest artifact hashes match. No model files were deserialized.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
