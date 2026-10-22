# Probe score history

Generated from `history/*.json` on every run of `tests/compat/probes.mjs`. Method and scoring: `README.md`.
"Changed" lists probes whose result differs from the last run that ran them.

| Date (UTC) | CLI | Env | Passed / ran | Weighted score | Changed | Failed probes |
|---|---|---|---|---|---|---|
| 2026-10-22 12:18 | 1.14.4 | wsl | 28/28 | 100% | none | — |
| 2026-10-22 12:30 | 1.14.4 | wsl | 1/1 (partial: P29) | 100% | none | — |
| 2026-10-22 12:43 | 1.14.4 | wsl | 28/29 | 97.3% | P29:now FAIL | P29 |
| 2026-10-22 12:49 | 1.14.4 | wsl | 29/29 | 100% | P29:now pass | — |
