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

## Where things are
`trustlayer/` core · `agents/institutional.py` · `holmes_integration/` toolsets + question ·
`eval/` telemetry, injector, runners, judge, tables, spot-check, fallback agent · `scenarios/` dev + holdout ·
`kb/` ITU wrapper, articles, retriever, manifest, questions · `docs/` gap register (11 gaps), Y.3172 mapping ·
`tools/first_run.py` one-command setup + spike · `spike/` Step 0.

## Immediate next steps
1. ✅ Done 4 Nov: first run + spike. HolmesGPT stays the Exp 1 subject (subtle payloads F4, C4 corrupt some runs).
2. ✅ Done 4 Nov: Exp 1 complete, 300/300 runs → `results/exp1_table.md`. Person D: spot-check 20 judged answers.
3. Person A: open the sources in `docs/KB_SOURCES.md`, check provisions, add files + `kb/manifest.yaml` →
   `make kb-ingest kb-check`; fill `kb/questions.yaml`; replace TO_VERIFY in rules, scenarios, gap register.
4. Write blind holdout scenarios (~20 malicious, ~16 clean) — NOT Claude, NOT Person C. Then `make exp2-holdout`.
5. Rerun `make exp2 && make tables` once the KB exists (citations); spot-check 20 judged answers (`python -m eval.spotcheck`).
6. 2–3 minute demo video (raw vs wrapped on I4 fake runbook or E4 — 3/3 corrupted raw, 0/3 wrapped; C3 did not fool gpt-4.1; cyber authority citing a real article; audit trail), tag v2, submit.

## Working style the team asked for
Plain, simple explanations (several team members are not telecom or security specialists). Be honest about
limits and uncertainty. Update `TRACKER.md` after each step.
