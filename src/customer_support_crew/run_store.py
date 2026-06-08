from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUNS_DIR = PROJECT_ROOT / "data" / "runs"


class RunStore:
    """Small JSON-backed run store for the local integrated MVP."""

    def __init__(self, runs_dir: str | Path = DEFAULT_RUNS_DIR) -> None:
        self.runs_dir = Path(runs_dir)
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def save(self, record: dict[str, Any]) -> dict[str, Any]:
        path = self._path(record["run_id"])
        path.write_text(json.dumps(record, indent=2), encoding="utf-8")
        return record

    def get(self, run_id: str) -> dict[str, Any] | None:
        path = self._path(run_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def list(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for path in self.runs_dir.glob("*.json"):
            records.append(json.loads(path.read_text(encoding="utf-8")))
        return sorted(records, key=lambda record: record.get("updated_at") or record.get("created_at") or "", reverse=True)

    def _path(self, run_id: str) -> Path:
        safe_id = "".join(ch for ch in run_id if ch.isalnum() or ch in {"-", "_"})
        return self.runs_dir / f"{safe_id}.json"
