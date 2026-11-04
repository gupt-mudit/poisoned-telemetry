# Poisoned Telemetry

**Any text an AI agent reads can give it orders. We decide which text is allowed to.**

A trust layer for AI agents that read telecom telemetry. Untrusted text is read in quarantine;
every decision-relevant claim is checked against independent records; cited policy rules give the
final verdict on every action; a hash-chained audit log records the evidence.
ITU AI for Good Lab Hackathon (UAE) · Team NetHealers · MIT licence.

## What it shows
| Experiment | Question | Agent | Headline measure |
|---|---|---|---|
| 1 | Does planted text corrupt a real agent's conclusion, and does the layer stop it? | HolmesGPT (CNCF sandbox, pinned `65332c5`) | Corrupted root-cause rate, crude vs subtle |
| 2 | Are proposed actions allowed, blocked or escalated correctly, with the right law cited? | Our institutional agents + rule-checker | Violations blocked, false blocks, citation accuracy |

The two claims are reported separately: Experiment 1 is about manipulated **conclusions**,
Experiment 2 about unauthorised **actions**.

## How the layer works
```
untrusted telemetry ─► detector ─► quarantine reader ─► claims + verification ─► agent ─► rule-checker ─► audit log
                         (flags)    (no tools; free       (every decision-relevant      (cited rules,
                                     text withheld)        claim, flagged or not)        final say)
```
- **Quarantine:** free text never crosses. Statements become neutral, templated claims with their source.
- **Verification:** each claim ends VERIFIED, CONTRADICTED or UNVERIFIED against `data/records/`. Only verified claims can support an action.
- **Rule-checker:** plain code; every rule in `trustlayer/rules.yaml` carries a citation; `RuleSet(strict=True)` refuses unverified citations.
- **Audit:** hash-chained JSONL; source text encrypted and referenced by fingerprint; `tools/verify_audit.py` checks it independently.

## Fastest start (one command)
Put your filled settings file in this folder (as `.env` or `env-file.txt`), then:
```bash
python3.12 -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
python tools/first_run.py          # install, checks, live test, HolmesGPT, spike, report
```
It never prints your key, and writes `results/FIRST_RUN_REPORT.md` (no secrets) to share.

## Quick start (step by step)
```bash
python3.12 -m venv .venv && . .venv/bin/activate
make install          # core + dev + llm + kb extras
make test             # 74 tests, offline — never calls a paid API
make validate         # policy scenarios vs answer keys -> ALL CONSISTENT
make exp2 && make tables
```
Then fill `.env` (copy `.env.example`; never commit it) and run the HolmesGPT spike: see `spike/README.md`.

## Running everything
| Step | Command | Needs |
|---|---|---|
| Spike (decide on HolmesGPT) | `make spike` | API key, HolmesGPT installed |
| Experiment 1 | `make exp1 ARGS="--reps 3"` | API key, HolmesGPT (or `--agent fallback`) |
| Experiment 2 (dev / holdout) | `make exp2` · `make exp2-holdout` | nothing (rules are deterministic); API key for agent opinions |
| Knowledge base | `make kb-setup` · `make kb-ingest` · `make kb-check` | Ollama + `nomic-embed-text`; documents + `kb/manifest.yaml` |
| Tables | `make tables` | runs |
| Audit check | `make verify-audit` | Exp 2 run |

## Layout
```
trustlayer/   models (shared formats), detector, claims, verify_claims, quarantine, rulechecker, rules.yaml, audit, llm
agents/       institutional agents (regulator, cyber authority, data office) with citation safeguard
holmes_integration/  toolset generator for the four set-ups, investigation question
eval/         telemetry generator, injector, Exp 1/2 runners, judge, tables, spot-check, fallback agent
scenarios/    policy scenarios (dev) + holdout (blind), runner, validator
kb/           ITU-pipeline ingestion wrapper, article detection, retriever, manifest, retrieval check
data/         payloads.yaml (24 attacks), records/ (independent ground truth), telemetry/
docs/         gap_register.md, y3172_mapping.md, SCENARIOS.md
tools/        verify_audit.py (independent), setup_itu.sh
spike/        Step 0 kit
```

## Honesty notes
- All data is synthetic; names, IDs and addresses are invented (documentation IP ranges, example.com).
- Development-set results only show the pipeline works as designed. **Report holdout results** (`scenarios/holdout/README.md`).
- Every `TO_VERIFY` provision must be checked against the official text before it is cited.
- We do not exploit any HolmesGPT flaw: we demonstrate the injection exposure inherent to LLM agents that read untrusted operational data, without modifying HolmesGPT.

## Pinned versions
HolmesGPT `65332c5637e3624c78eb0fa950e68946d446f75f` · ITU reference code `84010da9e9c443afcceeccb86d1700a662223395` ·
model IDs: record the values from `.env` with every run.
