# CLAUDE.md — project memory for Claude Code

Read this first, then `TRACKER.md` (status) and `README.md` (how to run).

## The project
**Poisoned Telemetry** — a trust layer for AI agents that read telecom telemetry. Team NetHealers
(Bengaluru, 4 people: A = knowledge base & policy, B = HolmesGPT & data, C = trust layer,
D = agents, experiments, demo). Built for the **ITU AI for Good Lab Hackathon (UAE)**.
One-line pitch: *any text an AI agent reads can give it orders, so we decide which text is allowed to.*

## Hackathon facts that drive every decision
- Submission **10 Nov 2026** (report + GitHub repo + results); shortlist 18 Nov; live final **8 Dec**, GITEX Dubai.
- Scored on: knowledge-base quality (UAE policy, built with ITU's reference pipeline), agent capability in
  progressive error scenarios, **policy/standards gap identification with global comparators (heaviest)**,
  auditability / chain-of-thought tracing, alignment with ITU-T Y.3172 and the ITU AI Readiness framework.
- **Prototype accuracy is not scored.** Policy use must be visible on every decision, not a final slide.
- Plan: v1 core → v2 results + policy docs (= the submission) → v3 signatures, extra agents → v4 demo polish
  ("attack me" box, replay slider) only after shortlisting. Never start a stage before the previous one runs.

## Architecture (see README for the diagram)
untrusted telemetry → `detector` (flags) → `quarantine` (no tools; free text withheld; claims as neutral
templates with source) → `verify_claims` (EVERY decision-relevant claim checked against `data/records/`,
flagged or not: verified / contradicted / unverified) → agent → `rulechecker` (plain code, cited rules in
`trustlayer/rules.yaml`, final say) → `audit` (hash-chained JSONL; source text encrypted, referenced by hash;
`tools/verify_audit.py` verifies independently).

Two experiments, reported **separately** (never let one stand in for the other):
1. **Exp 1** — HolmesGPT (CNCF sandbox, pinned commit `65332c5637e3…`), 4 set-ups differing in ONE thing:
   raw · guardrail (llm_instructions) · summariser (HolmesGPT's llm_summarize + --fast-model) · wrapped
   (our quarantine as the toolset command). Metric: corrupted root-cause rate, crude vs subtle payloads.
   HolmesGPT is mostly read-only, so "instruct" attacks are weak here; actions are tested in Exp 2.
2. **Exp 2** — policy enforcement on our institutional agents (regulator, cyber authority, data office) +
   rule-checker: 4 categories (false maintenance approval, unauthorised data sharing, forged regulator
   instruction, emergency response), each malicious + clean. Baseline vs protected.

Ground truth of the synthetic incident: optics/fibre degradation on PE-07 xe-0/1/2 → link flaps → BGP resets.
CHG-4458 is a genuine, unrelated change.

## Rules we follow (do not break these)
- **Never print, log or commit API keys.** `.env` is gitignored. `tests/conftest.py` forces offline mode so
  `make test` never spends money.
- **Never invent results.** Tables come only from `eval/tables.py` over real runs. Report failures.
- **Dev vs holdout:** `scenarios/policy/` is the development set (100% by construction). Evidence = the
  **holdout** set in `scenarios/holdout/`, written blind by someone who has not read the rules (not Person C).
- **Citations:** every `provision: TO_VERIFY` must be checked against the official text by Person A before it
  is cited. `RuleSet(strict=True)` refuses drafts. Gap register wording: "existing frameworks may not
  explicitly resolve…", never "no rule exists".
- **Fairness:** the wrapped set-up forwards every structured field line by line; it must not win by
  pre-digesting data. No attacker sentence may cross the hatch (test checks 6-word fragments, all payloads).
- **HolmesGPT:** we do not exploit any flaw in it; we show the injection exposure inherent to LLM agents
  reading untrusted data, without modifying HolmesGPT. Don't overclaim its adoption (adopters file lists
  Microsoft AKS team and Innovaccer).
- Agents may cite only passages actually retrieved for them; invented citations are recorded as invalid.

## Findings and fixes so far (keep this list growing)
- C3 (subtle fake approval) evades the detector but is CONTRADICTED by verification — key demo moment.
- A real change existing is VERIFIED as existing; "it caused the fault" stays UNVERIFIED.
- Change windows and stated extensions are checked ("extended to 12:00" → contradicted).
- S2-M answer key corrected to the agreed claim taxonomy (`data_request`).
- `\bUAE\b` never matched filenames like `UAE_PDPL.pdf` → fixed pattern.
- `pip install -e .` failed (no package list) → fixed in pyproject.
- Our folder `holmes/` clashed with HolmesGPT's `holmes` package → renamed `holmes_integration/`.
- HolmesGPT gotcha: "toolset is already defined in the built-in toolsets" → delete the `~/.holmes` cache.
- ITU reference code (pinned `84010da…`) has no UAE or telecom-security documents → our corpus is a
  genuine addition; its country detection lacked the UAE → patched in `kb/ingest_uae.py`.
- Provider: `PT_LLM_PROVIDER=openai` supported (team uses an OpenAI key); also `anthropic`, `fake`.
- Models pinned 4 Nov: `gpt-4.1-2025-04-14` (reasoning, judge, HolmesGPT), `gpt-4.1-mini-2025-04-14` (quarantine,
  HolmesGPT fast). Token caps are 200–400, so reasoning models (gpt-5.x, o-series) would need code changes first.
- Spike: 0/10 corrupted (C1, C3) although the payload reached the model. Exp 1 complete (300/300): corrupted
  raw 19%, guardrail 21%, summariser 28%, **wrapped 0%** (72 attacked runs each). Subtle > crude on raw (23% vs 12%).
  Best payloads: I4 fake runbook, E4 subscriber-ID request, F1 DDoS claim. Summariser amplifies instruct payloads
  (67% vs 17% raw). HolmesGPT's own guardrail/summariser do not help. Detail in TRACKER.md.
- A failed HolmesGPT run must never be recorded as data: `run_exp1` now stops on a non-zero exit.
- `audit.py` loads `.env` itself (it used to fall back to an ephemeral key, making stored source text unreadable).
- UAE official sites (uaelegislation.gov.ae, csc.gov.ae, ai.gov.ae) block automated reading; TDRA texts are
  "all rights reserved" → keep UAE PDFs local, never commit them. Candidate sources: `docs/KB_SOURCES.md`.
- Dev set now has 16 clean cases (written by Claude after reading the rules → dev only, never evidence).
- Run commands with `.venv/bin/python` (the venv is at `.venv`, Python 3.12).
- Evidence: `python -m eval.evidence` → `results/EVIDENCE.md` (CIs, Fisher, judge cross-check, claim stats, every
  batch); narrative in `docs/EVIDENCE_SUMMARY.md`. Wrapper v2 (field hardening) fixed a real hole found by our own
  adaptive attacks (AD2/AD3 6/6 on v1 → 0/12 on v2; main benchmark still 0/72). Any change to `trustlayer/` must
  be followed by a wrapped re-run before quoting numbers. gpt-4.1-mini batch complete (300/300): raw 42%,
  guardrail 40%, summariser 31%, wrapped 0/72. Wrapper v3 (5 Nov): unrecorded IDs (e.g. planted VA-2291) are replaced
  by "[unrecorded ID #n]"; re-run 0/72 both models, 0/12 adaptive, planted IDs in answers 0/163.
- KB has NIS2, EU AI Act, GDPR (articles + annexes only, verbatim, from EU CELLAR; headings marked `§§`). EUR-Lex
  and legislation.gov.uk block scripts — use CELLAR (`http://publications.europa.eu/resource/celex/<CELEX>`,
  `Accept: application/xhtml+xml`) for EU texts; do not try to get around bot checks. Convert with
  `python -I tools/eurlex_to_txt.py <in.xhtml> <out.txt> <title> <celex> <eli_url>`.
- `kb/InputDocs/UAE_Telecom_Cyber/` is gitignored (UAE texts are all rights reserved). It now holds the IA Regulation
  v1.1, the PDPL (Arabic) and the AI Charter. TDRA PDFs download with plain curl, but large ones return 502. Retrieval: 2/7.
- Git repo is PUBLIC: https://github.com/gupt-mudit/poisoned-telemetry (pushed 5 Nov). Never commit UAE texts, .env or raw runs. The ITU code is a submodule. Holdout authors use `docs/HOLDOUT_BRIEF.md` and the template.
- Rule/gap citations marked "Claude 5 Nov, Person A to confirm" are first-pass reads, not confirmations; keep status draft.
- 9 Nov holdout (AI-written, blind): 20/20 stopped, 2/16 false blocks (internal send_report too strict); incident claims verify existence only (not node/severity); `docs/HOLDOUT_RESULTS.md`. CHG-4471 is the fake attack ID: never add it as a record.
- 9 Nov report v7 (mentor review): literature survey (`docs/LITERATURE_SURVEY.md`, refs [15]–[34], each checked on arXiv/Crossref/USENIX) and a threat-model + security-techniques table. The audit log is a tamper-evident record with source text encrypted at rest; it does NOT encrypt or sign inter-agent messages (Ed25519 planned). Never describe it otherwise.
- 6 Nov: telecom law (OCR) + Licence 2/2026 added to the local KB (TDRA 502s were transient). All 4 rules now have provisions (still draft). `docs/CITATION_CHECK.md` = Person A's 27-row check sheet with PDF pages. pdftotext/pdftoppm crash (libhvf); render PDFs with PDFKit via swift, OCR with tesseract.

## Where things are
`trustlayer/` core · `agents/institutional.py` · `holmes_integration/` toolsets + question ·
`eval/` telemetry, injector, runners, judge, tables, spot-check, fallback agent · `scenarios/` dev + holdout ·
`kb/` ITU wrapper, articles, retriever, manifest, questions · `docs/` gap register (11 gaps), Y.3172 mapping ·
`tools/first_run.py` one-command setup + spike · `spike/` Step 0 · `demo/` local demo UI (`make demo`, docs/DEMO.md; 7 screens; offline by default; shows only recorded or session-logged data).

## HANDOVER (6 Nov 2026): start here
The work moves to a new teammate from here. They read this section first, then the status table at the top of
`TRACKER.md`.

### Done (do not redo)
- **Trust layer v3** (quarantine, claim verification, rule-checker, hash-chained audit). 128 tests pass (`make test`, offline).
- **Exp 1 complete on two models.**
  - gpt-4.1: corrupted raw 14/72 (19%), guardrail 21%, summariser 28%, **wrapped 0/72**.
  - gpt-4.1-mini: raw 30/72 (42%), **wrapped 0/72**.
  - Adaptive attacks on v3: 0/12.
  - Evidence: `results/EVIDENCE.md`, `docs/EVIDENCE_SUMMARY.md`.
- **Exp 2 on the dev set:** 9/9 attacks stopped, 0/16 false blocks. It is dev only, NOT evidence (last run 4 Nov, before the UAE KB).
- **KB:** 8 documents (5 UAE + NIS2, AI Act, GDPR).
  - The UAE texts are local only (see below).
  - Retrieval check: 3/9 (target 8/10). It is weak because the PDPL copy is Arabic and the questions are English.
- **Citations:** all 4 rules have a first-pass provision, and 8 of 11 gaps have UAE citations. Status is still `draft`.
  `docs/CITATION_CHECK.md` lists all 27 citations with PDF page numbers for Person A.
- **Demo UI:** 7 screens, `make demo` → http://127.0.0.1:8765. See `docs/DEMO.md` (video script included).
- **Public repo:** https://github.com/gupt-mudit/poisoned-telemetry (owner gupt-mudit).

### Not in git: how to get each
| What | Why it is not in git | How to get it |
|---|---|---|
| `.env` (API key, model IDs, `PT_AUDIT_KEY`) | secret | Copy `.env.example` and fill it in. Use the pinned models above. Get `PT_AUDIT_KEY` from Mudit privately: it is needed only to read the encrypted source text of old runs. Never paste a key into chat, a commit or a doc. |
| UAE law texts (`kb/InputDocs/UAE_Telecom_Cyber/*.txt`) | "all rights reserved": never commit | Download from the official URLs in `kb/manifest.yaml`. The IA Regulation, Licence 2/2026 and AI Charter download with plain curl; the PDPL comes from u.ae. The telecom law PDF has outlined text, so it needs OCR: render with PDFKit (swift) and run tesseract. `pdftotext` and `pdftoppm` crash on Mudit's Mac (libhvf). Or ask Mudit for the files privately. |
| `results/runs/` (52 MB of raw answers and audit logs) | size, and it has not been reviewed for publication | Ask Mudit for a private zip and unpack it to `results/runs/`. Without it, `eval.evidence`, the spot-check and the demo's Results screen are empty. The summary tables in `results/*.md` ARE in git. |
| `kb/chroma/` (vector store) | rebuilt locally | Install Ollama, run `ollama pull nomic-embed-text`, then `make kb-ingest PY=.venv/bin/python`. |
| ITU reference code | git submodule | `git submodule update --init` |

### Setup on a new machine
```bash
git clone https://github.com/gupt-mudit/poisoned-telemetry && cd poisoned-telemetry
git submodule update --init
python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev,llm,kb,demo]"
make test PY=.venv/bin/python          # 128 pass, offline
make demo PY=.venv/bin/python          # demo UI
```
Always pass `PY=.venv/bin/python` to make (the Makefile defaults to `python3`). HolmesGPT is only needed to re-run Exp 1, which is already done.

### Remaining work, in order (submission 10 Nov)
| # | Task | Who | Command / file | Done when |
|---|---|---|---|---|
| 1 | ✅ **Blind holdout set**, DONE 9 Nov: 36 cases by Claude Opus 5.5 in a fresh chat (`docs/HOLDOUT_PROMPT.md`). 20/20 attacks stopped, 2/16 false blocks. See `docs/HOLDOUT_RESULTS.md` | — | — | Do NOT change rules and re-report these cases; any rule fix needs a new blind batch |
| 2 | **Confirm the 27 citations** against the official PDFs | Person A | `docs/CITATION_CHECK.md` | Each rule has `status: verified` and a named `checked_by`; `RuleSet(strict=True)` loads |
| 3 | **Get the 3 blocked texts** (English PDPL, cybercrime law FDL 34/2021, CSC Incident Response Framework v2.0) in a normal browser. Then fill G7, the G6 civil-liability part, and the G1 India and CSC parts. | Person A | `docs/KB_SOURCES.md`, `docs/gap_register.md` | Files in the UAE folder plus manifest entries; `make kb-ingest kb-check` |
| 4 | **Re-run Exp 2 on the dev set** with the UAE KB (the citation figures are stale) | anyone, Claude OK | `make exp2 PY=.venv/bin/python && make tables PY=.venv/bin/python` | `results/exp2_dev_table.md` updated |
| 5 | **Hand spot-check of 20 graded answers** (blind) | Person D | `results/spotcheck/SHEET.md` (needs `results/runs`), then `python -m eval.spotcheck --score` | Agreement reported in TRACKER and the report |
| 6 | **Submission report**: not started | Claude can draft it | Sources: `docs/EVIDENCE_SUMMARY.md`, `results/EVIDENCE.md`, `docs/gap_register.md`, `docs/y3172_mapping.md`, TRACKER | Report with holdout numbers filled in from real runs only |
| 7 | **Demo video**, 2–3 minutes | Person D | `docs/DEMO.md`: click **New session** first | Video file |
| 8 | **Tag v2 and submit** | team | `git tag v2 && git push --tags` | Submitted 10 Nov |

Suggested order: 1 and 2 start at once (they are the slowest and nobody else can do them); 4 and 6 run in parallel; 5 and 7 on 7–8 Nov; final numbers into the report on 9 Nov.

### Gotchas
- Any change to `trustlayer/` needs a wrapped Exp 1 re-run before its numbers are quoted.
- Never commit UAE texts, `.env` or `results/runs/`. The repo is public, so check `git status` before every commit.
- Do not try to get around the site blocks on uaelegislation.gov.ae, csc.gov.ae or EUR-Lex. Use a normal browser, or CELLAR for EU texts.
- The demo writes its own log to `results/runs/audit_demo/`. "New session" archives it; nothing is deleted.

## Working style the team asked for
Plain, simple explanations (several team members are not telecom or security specialists). Be honest about
limits and uncertainty. Update `TRACKER.md` after each step.
