#!/usr/bin/env python3
"""Build a review page from a rows JSON file. See SKILL.md for the format.

Usage: build.py <rows.json> <page.html>
Writes the page, and <page.html>.rows.json mapping each reviewable row's id to what it asks.
"""

import hashlib
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def fail(message):
    sys.exit(f"build.py: {message}")


def esc(text):
    return html.escape(str(text), quote=True)


def inline(text):
    """Escape a note, turning `backticks` into code."""
    parts = str(text).split("`")
    return "".join(
        f"<code>{esc(part)}</code>" if i % 2 else esc(part)
        for i, part in enumerate(parts)
    )


def row_id(row):
    """A row's id comes from its content, so changed wording needs a fresh judgement."""
    key = json.dumps(
        [row.get("context") or [], [v["text"] for v in row["versions"]]],
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha1(key.encode()).hexdigest()[:10]


def check(row, where):
    versions = row.get("versions")
    if not isinstance(versions, list) or not versions:
        fail(f"{where}: needs at least one version")
    for version in versions:
        if not version.get("label") or not version.get("text"):
            fail(f"{where}: every version needs a label and text")
    mode = row.get("mode", "approve")
    if mode not in ("approve", "choose"):
        fail(f"{where}: mode must be approve or choose, not {mode!r}")
    if mode == "choose" and not 2 <= len(versions) <= 4:
        fail(f"{where}: a choose row needs 2 to 4 versions")
    labels = [v["label"] for v in versions]
    if len(set(labels)) != len(labels):
        fail(f"{where}: version labels must differ")
    if len(row.get("group") or []) > 2:
        fail(f"{where}: group takes at most two levels")


def render_row(row, rid, lang):
    mode = row.get("mode", "approve")
    versions = row["versions"]
    locked = row.get("locked", False)
    judged = versions[-1]["label"] if mode == "approve" else None

    context = row.get("context") or []
    ctx = "".join(
        f'<div><dt>{esc(c["label"])}</dt><dd lang="{lang}">{esc(c["text"])}</dd></div>'
        for c in context
    )
    figure = row.get("figure")
    fig = f'<div class="fig">{figure}</div>' if figure else ""
    ctx_cell = f'<div class="cell ctx">{fig}<dl>{ctx}</dl></div>' if ctx or fig else ""

    cells = []
    for v in versions:
        label = esc(v["label"])
        kind = "judged" if v["label"] == judged or mode == "choose" else "earlier"
        pick = ""
        if mode == "choose" and not locked:
            pick = (
                f'<button type="button" class="pick" data-pick="{rid}" data-version="{label}" '
                f'data-idle="Pick {label}" data-on="Picked {label}" aria-pressed="false">Pick {label}</button>'
            )
        cells.append(
            f'<div class="cell version {kind}" data-version-cell="{label}"><span class="lab">{label}</span>'
            f'<p lang="{lang}">{esc(v["text"])}</p>{pick}</div>'
        )

    note = f'<p class="note">{inline(row["note"])}</p>' if row.get("note") else ""
    tags = [esc(t) for t in row.get("tags") or []]
    if locked:
        tags.insert(0, "Already approved")
    tag_html = "".join(f'<span class="tag">{t}</span>' for t in tags)
    tag_html = f'<div class="tags">{tag_html}</div>' if tag_html else ""

    controls = ""
    if not locked:
        approve = ""
        if mode == "approve":
            label = esc(judged)
            approve = (
                f'<button type="button" class="pick" data-pick="{rid}" data-version="{label}" '
                'data-idle="Approve" data-on="Approved" aria-pressed="false">Approve</button>'
            )
        controls = (
            f'<div class="ctl"><div class="btns">{approve}'
            f'<button type="button" class="flag" data-flag="{rid}" aria-pressed="false">Flag</button></div>'
            f'<div class="notebox" hidden><textarea id="note-{rid}" data-note="{rid}" rows="2" placeholder="What should change? (optional)"></textarea>'
            f'<div class="notefoot"><button type="button" class="savenote" data-save-note="{rid}">Save note</button>'
            '<span data-note-status role="status"></span></div></div></div>'
        )

    columns = (
        2
        if mode == "choose" and len(versions) == 2
        else (1 if mode == "choose" else len(versions))
    )
    row_class = "row" + ("" if ctx_cell else " no-ctx") + (" locked" if locked else "")
    data = "" if locked else f' data-row="{rid}"'
    return (
        f'<article class="{row_class}" id="r-{rid}"{data}>{ctx_cell}<div class="main {mode}" style="--n:{columns}">'
        f'<div class="versions">{"".join(cells)}</div>'
        f'<div class="foot">{note}{tag_html}{controls}</div></div></article>'
    )


def build(data):
    if not data.get("title"):
        fail("the file needs a title")
    rows = data.get("rows")
    if not rows:
        fail("the file needs at least one row")
    lang = esc(data.get("lang", "en"))

    seen = {}
    index = {}
    # chapter name -> section name -> rendered rows
    chapters = {}
    for n, row in enumerate(rows, 1):
        check(row, f"row {n}")
        rid = row_id(row)
        if rid in seen:
            fail(
                f"rows {seen[rid]} and {n} are the same item: keep one and tag the other place"
            )
        seen[rid] = n
        group = list(row.get("group") or [])
        top, section = (["", ""] + group)[-2:]
        chapters.setdefault(top, {}).setdefault(section, []).append(
            render_row(row, rid, lang)
        )
        if not row.get("locked"):
            mode = row.get("mode", "approve")
            index[rid] = {
                "group": " / ".join(group),
                "mode": mode,
                "judged": row["versions"][-1]["text"] if mode == "approve" else None,
                "versions": row["versions"],
            }
    if not index:
        fail("every row is locked, so there is nothing to review")

    nav, sections = [], []
    for c, (top, secs) in enumerate(chapters.items()):
        if top:
            sections.append(f'<h2 class="chapter">{esc(top)}</h2>')
        chips = []
        for s, (section, body) in enumerate(secs.items()):
            key = f"s{c}-{s}"
            heading = f"<div><h3>{esc(section)}</h3>" if section else "<div>"
            sections.append(
                f'<section class="topic" id="{key}" data-section="{key}"><header class="thead">{heading}'
                f'<p class="count" data-count></p></div></header><div class="rows">{"".join(body)}</div></section>'
            )
            if section:
                chips.append(
                    f'<a class="chip" href="#{key}" data-chip="{key}">{esc(section)}</a>'
                )
        if chips:
            label = f'<span class="nav-label">{esc(top)}</span>' if top else ""
            nav.append(
                f'<div class="nav-ch">{label}<div class="chips">{"".join(chips)}</div></div>'
            )
    has_nav = sum(len(s) for s in chapters.values()) > 1

    # "<" is escaped so row text can't end the script block.
    rows_data = json.dumps(index, ensure_ascii=False).replace("<", "\\u003c")
    values = {
        "TITLE": esc(data["title"]),
        "INTRO": inline(data.get("intro", "")),
        "TOTAL": str(len(index)),
        "NAV": (
            f'<nav class="toc" aria-label="Sections">{"".join(nav)}</nav>'
            if has_nav
            else ""
        ),
        "SECTIONS": "".join(sections),
        "ROWS_DATA": rows_data,
        "SCRIPT": (HERE / "page.js").read_text(encoding="utf8"),
    }
    template = (HERE / "template.html").read_text(encoding="utf8")
    return re.sub(r"%%([A-Z_]+)%%", lambda m: values[m[1]], template), index


def main():
    if len(sys.argv) != 3:
        fail("usage: build.py <rows.json> <page.html>")
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf8"))
    page, index = build(data)
    out = Path(sys.argv[2])
    out.write_text(page, encoding="utf8")
    out.with_name(out.name + ".rows.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1), encoding="utf8"
    )
    print(
        f"{len(index)} rows to review, {len(data['rows']) - len(index)} locked, {len(page)} bytes: {out}"
    )


if __name__ == "__main__":
    main()
