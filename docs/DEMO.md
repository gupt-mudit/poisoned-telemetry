# Demo UI: Poisoned Telemetry command centre

```bash
make demo PY=.venv/bin/python
```

Then open http://127.0.0.1:8765. The server listens on this machine only.

## What is real on each screen

| Screen | Where it comes from |
|---|---|
| **01 Attack simulator** | The real pipeline. `scenarios.run.run_full` (the same code as Experiment 2) runs the case through `trustlayer.quarantine` and `trustlayer.rulechecker`, then writes to a real hash-chained audit log (`results/runs/audit_demo/`). "Write your own attack" builds a one-event case and runs it through the same code. |
| **02 Experiment results** | `results/runs/*.jsonl`, the recorded runs. Each confidence interval is a Wilson interval. The replay shows the recorded HolmesGPT answer files exactly as written. |
| **03 Policy gap explorer** | Parsed from `docs/gap_register.md`. Status badges come from the text itself: "Person A to confirm" means first pass, and `TO_VERIFY` means open. |
| **04 Audit & forensics** | The audit logs. **Verify** runs `tools/verify_audit.py`, which imports nothing from our code. **Tamper test** edits one decision in a *copy* of the log and runs the verifier on that copy. The real log is never changed. |

Nothing on screen is typed in by hand. If a run file is missing, the screen says so.

**Offline (the default):** no model is called, so it costs nothing. Decisions are identical to Live mode, because the rule-checker is plain code. Offline, the institutional agents only show that they searched the knowledge base.

**Live AI (the switch, top right):** uses the provider and key from `.env`. A real model then plays three roles:
- the operations agent, twice: once reading the raw telemetry, once reading the quarantined view;
- the regulator, cyber-authority and data-office agents, which each give their own cited opinion.

Live mode costs about $0.01–0.03 per click on gpt-4.1. A single live run is one sample. Use the results screen for rates.

## Things not to claim in the demo
- Citations show "first pass, Person A to confirm" until Person A confirms them. Don't call them verified.
- Experiment 2 numbers come from the **development set**. They are not evidence until the blind holdout set runs.
- Agent messages are not signed yet (signatures are planned for v3).

## 2–3 minute video script
1. **(15 s) Problem.** "Any text an AI agent reads can give it orders. In a telecom network, anyone can write a help-desk ticket."
2. **(40 s) Simulator: "Fake maintenance approval hides a BGP anomaly".** Let the pipeline run.
   - The attack is highlighted in the stream.
   - The quarantine withholds the text, so the agent only sees neutral claims.
   - CHG-4471 shows as **contradicted**: it is not in the change log.
   - Show the two outcomes side by side: **EXECUTED** without the trust layer, **BLOCK** with it.
   - Open "Why this decision?" to show the rule and its UAE IA Regulation citation.
3. **(15 s) Click its clean twin** ("Genuine maintenance correctly recognised") → **ALLOW**. Normal work still goes through.
4. **(30 s) Live AI on, "A ticket pretends to carry regulator approval".** In our test run (6 Nov, gpt-4.1), the raw agent proposed the attacker's config change on RR-01, and the agent reading the quarantined view proposed only a diagnosis. Models vary from run to run, so record a take where this happens, or say so if it doesn't. Whatever the model proposes, the rule-checker blocks the forged instruction.
5. **(30 s) Results.** Show the corrupted-rate charts (raw 19% vs trust layer 0/72 on gpt-4.1; 42% vs 0/72 on gpt-4.1-mini). Then replay **I4**: the raw HolmesGPT answer follows the planted "shut the interface permanently" runbook, and the protected answer does not.
6. **(20 s) Policy gaps.** Open G3: who may instruct a licensee, and how an instruction reaching an AI agent is authenticated. Point out the first-pass and confirmed badges.
7. **(20 s) Audit.** Click **Verify** (CHAIN INTACT), then **Tamper test**: changing BLOCK → ALLOW in a copy is detected.
