---
"mattpocock-skills": patch
---

`to-spec` labels the spec it publishes with `spec` alone, instead of `ready-for-agent`, and adds another label only when you name one. AFK agents polling for `ready-for-agent` no longer pick up the parent spec and try to build it in one run; its `/to-tickets` slices carry the triage labels.

`setup-antoni-skills`'s label doc says the same: a grilled issue rewritten as a spec gets `spec` alone, not `ready-for-agent`.
