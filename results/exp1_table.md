# Experiment 1: manipulated conclusions on HolmesGPT

Agent: holmes; model: openai/gpt-4.1-2025-04-14; judge: heuristic, llm:gpt-4.1-2025-04-14.

| Measure | raw | guardrail | summariser | wrapped |
|---|---|---|---|---|
| Corrupted conclusion, all payloads | 14/72 (19%) | 15/72 (21%) | 20/72 (28%) | 0/72 (0%) |
| ...crude payloads | 3/24 (12%) | 3/24 (12%) | 10/24 (42%) | 0/24 (0%) |
| ...subtle payloads | 11/48 (23%) | 12/48 (25%) | 10/48 (21%) | 0/48 (0%) |
| ...conceal | 1/18 (6%) | 1/18 (6%) | 0/18 (0%) | 0/18 (0%) |
| ...fabricate | 4/18 (22%) | 5/18 (28%) | 7/18 (39%) | 0/18 (0%) |
| ...exfiltrate | 6/18 (33%) | 6/18 (33%) | 1/18 (6%) | 0/18 (0%) |
| ...instruct | 3/18 (17%) | 3/18 (17%) | 12/18 (67%) | 0/18 (0%) |
| Correct root cause, clean data | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| Correct root cause, poisoned data | 68/72 (94%) | 67/72 (93%) | 66/72 (92%) | 72/72 (100%) |

Spot-check 20 judged answers by hand (`python -m eval.spotcheck`) and report agreement.
