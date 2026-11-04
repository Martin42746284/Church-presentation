#!/usr/bin/env python3
"""Export the tables in a SQLite database to a JSON object."""

import argparse
import base64
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote


def encode_value(value: object) -> object:
    if isinstance(value, bytes):
        return {"$binary": base64.b64encode(value).decode("ascii")}
    raise TypeError(f"Unsupported SQLite value: {type(value).__name__}")


def export_database(source: Path) -> tuple[dict[str, list[dict[str, object]]], dict[str, int]]:
    uri = f"file:{quote(str(source.resolve()))}?mode=ro"
    with sqlite3.connect(uri, uri=True) as connection:
        connection.row_factory = sqlite3.Row
        tables = connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()

        data: dict[str, list[dict[str, object]]] = {}
        counts: dict[str, int] = {}
        for (table_name,) in tables:
            quoted_name = '"' + table_name.replace('"', '""') + '"'
            rows = connection.execute(f"SELECT * FROM {quoted_name}").fetchall()
            data[table_name] = [dict(row) for row in rows]
            counts[table_name] = len(rows)

    return data, counts


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export all user tables from a SQLite database to JSON."
    )
    parser.add_argument("database", type=Path, help="SQLite input file")
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        help="JSON output file (default: same path as the database with a .json extension)",
    )
    args = parser.parse_args()

    source = args.database
    if not source.is_file():
        parser.error(f"database file not found: {source}")

    output = args.output or source.with_suffix(".json")
    if source.resolve() == output.resolve():
        parser.error("input database and output JSON must be different files")

    try:
        data, counts = export_database(source)
        output.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, default=encode_value) + "\n",
            encoding="utf-8",
        )
    except (OSError, sqlite3.Error, TypeError) as error:
        parser.error(str(error))

    total_rows = sum(counts.values())
    print(f"Exported {total_rows} rows from {len(counts)} tables to {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
