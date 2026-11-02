#!/usr/bin/env python3
"""Run the page against a fake store with slow echoes, in headless Chrome. Exits non-zero on a failure.

Run it after changing page.js, template.html or build.py. Set CHROME if Chrome isn't in a usual place.
"""

import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
import build  # noqa: E402

CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    shutil.which("google-chrome"),
    shutil.which("chromium"),
    shutil.which("chromium-browser"),
]


def find_chrome():
    for path in [os.environ.get("CHROME"), *CHROME_PATHS]:
        if path and Path(path).exists():
            return path
    sys.exit("run.py: Chrome not found. Set CHROME to its path.")


def run_page(page):
    wrapped = (
        '<!doctype html><html><head><meta charset="utf-8"></head><body><script>'
        + (HERE / "stub.js").read_text(encoding="utf8")
        + "</script>"
        + page
        + "<script>"
        + (HERE / "scenario.js").read_text(encoding="utf8")
        + "</script></body></html>"
    )
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "page.html"
        path.write_text(wrapped, encoding="utf8")
        dom = subprocess.run(
            [
                find_chrome(),
                "--headless=new",
                "--disable-gpu",
                f"--user-data-dir={tmp}/profile",
                "--virtual-time-budget=13000",
                "--dump-dom",
                path.as_uri(),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        ).stdout
    found = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
    if not found:
        sys.exit("run.py: the scenario produced no result; the page likely threw an error.")
    return json.loads(html.unescape(found[1]))


def main():
    data = json.loads((HERE / "rows.json").read_text(encoding="utf8"))
    page, index = build.build(data)
    log = run_page(page)
    expected = {
        "A: note typed then clicked away is stored": (log["A"].get("stored"), "note A"),
        "A: note stays on screen": (log["A"].get("shown"), "note A"),
        "A: flag doc carries the row's text": (log["flagDoc"]["text"], "Tu trzeba pomnożyć, a nie dodać."),
        "B: Flagged asks before dropping a note": (log["B_armed"], "Remove flag and note?"),
        "B: note survives": ((log["B"].get("stored"), log["B"].get("shown"), log["B"].get("hidden")), ("note B", "note B", False)),
        "C: approve shows Approved": (log["C_label"], "Approved"),
        "C: flag replaces approval": ((log["C"].get("approved"), log["C"].get("flagged")), (False, True)),
        "D: Approve asks before dropping a note": (log["D_armed"], "Approve and drop note?"),
        "D: second press approves": ((log["D"].get("approved"), log["D"].get("flagged")), (True, False)),
        "E: latest pick wins": ((log["E"].get("version"), log["E"].get("cls")), ("B", "B")),
        "E: stored text is the picked version": (log["E"].get("text"), "Najpierw sprowadź ułamki do wspólnego mianownika."),
        "E: button shows the pick": (log["E_label"], "Picked B"),
        "F: Pick asks before dropping a note": (log["F_armed"], "Pick B and drop note?"),
        "F: second press picks": ((log["F"].get("version"), log["F"].get("flagged")), ("B", False)),
        "H: pressing the pick again clears it": ((log["H"].get("approved"), log["H"].get("label")), (False, "Pick A")),
        "hide: flagged row stays right after Flag": (log["J_afterFlag"], True),
        "hide: flagged row stays while typing": (log["J_typing"], True),
        "hide: flagged row goes once focus leaves and the note saves": (log["hide"]["J"], False),
        "hide: flagged row with a note goes": (log["hide"]["A_note"], False),
        "hide: flagged row with no note goes": (log["hide"]["C_noNote"], False),
        "hide: approved and picked rows go": ((log["hide"]["D_approved"], log["hide"]["E_picked"]), (False, False)),
        "hide: untouched row stays": (log["hide"]["H_untouched"], True),
        "hide: a section with only finished rows goes": ((log["hide"]["firstSection"], log["hide"]["secondSection"]), (False, True)),
        "locked row has no buttons": (log["lockedButtons"], 0),
        "counts: done, flagged, left": (log["counts"], ["3", "4", "1"]),
        "one write at a time per doc": (log["overlaps"], 0),
        "index skips the locked row": (len(index), 8),
    }
    failures = 0
    for name, (actual, want) in expected.items():
        if actual != want:
            failures += 1
            print(f"FAIL {name}: got {actual!r}, want {want!r}")
    print(f"{len(expected) - failures} of {len(expected)} checks passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
