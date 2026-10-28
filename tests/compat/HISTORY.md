# Probe score history

Generated from `history/*.json` on every run of `tests/compat/probes.mjs`. Method and scoring: `README.md`.
"Changed" lists probes whose result differs from the last run that ran them.

| Date (UTC) | CLI | Env | Passed / ran | Weighted score | Changed | Failed probes |
|---|---|---|---|---|---|---|
| 2026-10-22 12:18 | 1.14.4 | wsl | 28/28 | 100% | none | — |
| 2026-10-22 12:30 | 1.14.4 | wsl | 1/1 (partial: P29) | 100% | none | — |
| 2026-10-22 12:43 | 1.14.4 | wsl | 28/29 | 97.3% | P29:now FAIL | P29 |
| 2026-10-22 12:49 | 1.14.4 | wsl | 29/29 | 100% | P29:now pass | — |
| 2026-10-27 16:26 | 1.15.0 | wsl-synth | 16/16 (partial: P01 P02 P03 P04 P05 P06 P07 P08 P09 P10 P11 P12 P13 P25 P27 P28) | 100% | none | — |
| 2026-10-28 03:16 | 1.15.0 | wsl-synth | 28/29 | 97.3% | P29:now FAIL | P29 |
| 2026-10-28 03:18 | 1.15.0 | wsl-synth | 1/1 (partial: P29) | 100% | P29:now pass | — |
| 2026-10-28 17:15 | 1.15.0 | wsl-copy | 1/1 (partial: P18) | 100% | none | — |
| 2026-10-28 17:16 | 1.15.0 | wsl-copy | 1/1 (partial: P18) | 100% | none | — |
