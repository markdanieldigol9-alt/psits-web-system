#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable


TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".html",
    ".svg",
    ".md",
    ".txt",
    ".map",
}

NON_TEXT_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".bmp",
    ".tiff",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".mp3",
    ".mp4",
    ".webm",
    ".wav",
    ".pdf",
}


@dataclass(frozen=True)
class ExtractResult:
    source: str
    output: str | None
    written: bool
    reason: str | None


def _normalize_source_path(source: str) -> PurePosixPath:
    # sourcemaps use posix-ish paths; normalize and strip leading ../ segments
    posix = PurePosixPath(source.replace("\\", "/"))
    parts = list(posix.parts)
    while parts and parts[0] in (".", ".."):
        parts.pop(0)
    return PurePosixPath(*parts)


def _should_include(source: str, include_prefixes: Iterable[str], exclude_prefixes: Iterable[str]) -> bool:
    normalized = source.replace("\\", "/")
    if any(normalized.startswith(p) for p in exclude_prefixes):
        return False
    return any(normalized.startswith(p) for p in include_prefixes)


def _pick_default_map(project_dir: Path) -> Path:
    assets_dir = project_dir / "dist" / "assets"
    candidates = sorted(assets_dir.glob("index-*.js.map"))
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        raise SystemExit(f"No sourcemap found at {assets_dir}")
    names = "\n".join(f"- {c.name}" for c in candidates[:20])
    more = "" if len(candidates) <= 20 else f"\n(and {len(candidates) - 20} more)"
    raise SystemExit(f"Multiple sourcemaps found; pass --map.\n{names}{more}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract sourcesContent from a JS sourcemap into a reconstructed directory tree."
    )
    parser.add_argument(
        "--project-dir",
        default=str(Path(__file__).resolve().parents[1]),
        help="PSITS project directory (default: PSITS/).",
    )
    parser.add_argument(
        "--map",
        dest="map_path",
        default=None,
        help="Path to the .js.map file (default: dist/assets/index-*.js.map if unique).",
    )
    parser.add_argument(
        "--out",
        dest="out_dir",
        default=None,
        help="Output directory (default: recovered-from-sourcemap/<map-stem>/ under project dir).",
    )
    parser.add_argument(
        "--include",
        action="append",
        default=None,
        help="Include sources with this prefix (repeatable). Default: ../../src/",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Exclude sources with this prefix (repeatable).",
    )
    parser.add_argument(
        "--include-node-modules",
        action="store_true",
        help="Also include ../../node_modules/ sources (disabled by default).",
    )
    parser.add_argument(
        "--write-nontext",
        action="store_true",
        help="Write non-text extensions too (not recommended; sourcemaps often contain transformed stubs).",
    )
    args = parser.parse_args()

    project_dir = Path(args.project_dir).resolve()
    map_path = Path(args.map_path).resolve() if args.map_path else _pick_default_map(project_dir)
    if not map_path.exists():
        raise SystemExit(f"Map not found: {map_path}")

    include_prefixes = args.include or ["../../src/"]
    exclude_prefixes = list(args.exclude or [])
    if args.include_node_modules:
        include_prefixes = list(include_prefixes) + ["../../node_modules/"]

    out_dir = (
        Path(args.out_dir).resolve()
        if args.out_dir
        else (project_dir / "recovered-from-sourcemap" / map_path.stem)
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = map_path.read_text(encoding="utf-8")
    sm = json.loads(raw)
    sources = sm.get("sources") or []
    sources_content = sm.get("sourcesContent") or []
    if len(sources) != len(sources_content):
        raise SystemExit(f"Invalid sourcemap: sources({len(sources)}) != sourcesContent({len(sources_content)})")

    results: list[ExtractResult] = []
    written_count = 0
    skipped_count = 0

    for source, content in zip(sources, sources_content, strict=True):
        if not _should_include(source, include_prefixes, exclude_prefixes):
            skipped_count += 1
            results.append(ExtractResult(source=source, output=None, written=False, reason="filtered"))
            continue

        rel_path = _normalize_source_path(source)
        ext = rel_path.suffix.lower()

        if ext in NON_TEXT_EXTENSIONS and not args.write_nontext:
            skipped_count += 1
            results.append(
                ExtractResult(
                    source=source,
                    output=str(rel_path),
                    written=False,
                    reason=f"non-text extension ({ext}); use --write-nontext to force",
                )
            )
            continue

        if ext and (ext not in TEXT_EXTENSIONS) and (ext not in NON_TEXT_EXTENSIONS):
            # Unknown extension: treat as text, but mark it.
            pass

        if content is None:
            skipped_count += 1
            results.append(ExtractResult(source=source, output=str(rel_path), written=False, reason="no sourcesContent"))
            continue

        dest_path = out_dir / Path(*rel_path.parts)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_text(content, encoding="utf-8", newline="\n")
        written_count += 1
        results.append(ExtractResult(source=source, output=str(rel_path), written=True, reason=None))

    manifest = {
        "map": os.fspath(map_path),
        "out_dir": os.fspath(out_dir),
        "include_prefixes": include_prefixes,
        "exclude_prefixes": exclude_prefixes,
        "counts": {"written": written_count, "skipped": skipped_count, "total": len(results)},
        "results": [r.__dict__ for r in results],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8", newline="\n")

    extracted_paths = sorted({r.output for r in results if r.written and r.output})
    (out_dir / "STRUCTURE.txt").write_text("\n".join(extracted_paths) + ("\n" if extracted_paths else ""), encoding="utf-8")

    print(f"Map: {map_path}")
    print(f"Out: {out_dir}")
    print(f"Written: {written_count} | Skipped: {skipped_count} | Total: {len(results)}")
    print(f"Manifest: {out_dir / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

