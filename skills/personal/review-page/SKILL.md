---
name: review-page
description: Put a list of drafted items on a private page where the user approves, flags or chooses between them row by row, then read back the results and look for patterns. Use when the user must judge about 10 or more items.
---

A **review page** is a private Artifact page with one row per item. The user judges every row on its own, and their answers persist in the page's database, where you read them back. It needs the Artifact tool: without it, tell the user and stop.

`<skill>` below is this skill's folder.

## Steps

1. **Write the rows.** Write `rows.json` in the format below, in your scratchpad. Each row shows everything needed to judge it without opening another file: real examples, and every version written out in full. Write the page in the language you and the user are working in; only text quoted from the product stays in the product's language, verbatim. Done when every item is a row, and no text is shortened with `…`.

2. **Build.** Run `python3 <skill>/build.py rows.json page.html`. Done when it exits 0 and the row count it prints matches your items.

3. **Publish.** Publish `page.html` with the Artifact tool, with `capabilities: {db: {}}`, and give the user the link. Done when the user says they have finished.

4. **Read back.** Load `ArtifactData`, then list the `flags` and `approvals` collections. Count only ids in `page.html.rows.json`, which the build wrote: rows whose wording changed leave stale docs behind. Done when every row in that file is tallied as approved, picked, flagged or untouched, and you have told the user the tally and named any untouched rows.

5. **Ask about flags with no note.** Call the Skill tool with `grilling`, and put each one to the user. Done when every flag has a stated reason.

6. **Find patterns.** With 3 or more flags, read [PATTERNS.md](./PATTERNS.md) and follow it. Done when its own completion criterion is met.

7. **Rework.** Redraft every flagged row from its note. Up to about 15 changed rows, show them in chat in full; beyond that, update `rows.json`, rebuild and publish the same file again. Unchanged rows keep their answers, and a changed row returns as new. Done when every row is approved or picked.

8. **Record the result.** Write the final list in full. If the work has an issue, post it there after the user's OK; otherwise leave it in chat. Done when the user has the final list where they can find it.

## Rows format

```json
{
  "title": "Feedback Wording",
  "intro": "One or two sentences on what's being judged. `Backticks` become code.",
  "lang": "pl",
  "rows": [
    {
      "group": ["Fractions", "Multiplying"],
      "context": [
        { "label": "Problem", "text": "4 : ⅗" },
        { "label": "Student", "text": "2⅖" }
      ],
      "figure": null,
      "versions": [
        { "label": "Today", "text": "The sentence as it stands." },
        { "label": "New", "text": "The sentence to judge." }
      ],
      "mode": "approve",
      "note": "Why it changed, if that isn't obvious.",
      "tags": ["Same message as 2 others"],
      "locked": false
    }
  ]
}
```

- `title` is the page's name, two to four words. `lang` is the language of the quoted `context` and `versions` text.
- `mode` is `approve` or `choose`. `approve` judges the last version, and earlier ones are shown for comparison. `choose` shows 2 to 4 versions, and the user picks one.
- Flag covers everything else, including "none of these" and "B, but change a word".
- `group` takes one or two levels, and becomes headings and jump links. A row can leave it out.
- `figure` is an inline SVG string.
- `locked` shows a row already approved elsewhere, with no buttons.
- `context`, `figure`, `note` and `tags` are optional.
- An item that appears in two groups gets one row, and a tag names the other place. The build refuses duplicates.

## What the database holds

- `flags/<id>`: `group`, `text` (the version judged; null on a `choose` row), `versions`, `note`.
- `approvals/<id>`: `group`, `version` (the label picked), `text`, `at`.

## Changing the page

After editing `page.js`, `template.html` or `build.py`, run `python3 <skill>/test/run.py`, which needs Chrome. It drives the page against a fake store whose updates arrive late, which is the condition that once wiped typed notes. Done when it exits 0.
