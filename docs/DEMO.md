# Demo UI: Poisoned Telemetry command centre

```bash
make demo PY=.venv/bin/python
```

Then open http://127.0.0.1:8765. The server listens on this machine only.

## The seven screens, and where each one's data comes from

| Screen | Where it comes from |
|---|---|
| **01 Command centre** | **Session counts** (cases run, attacks that would have succeeded without protection, stopped / paused / allowed, claims caught, audit seal) come from this session's audit log (`results/runs/audit_demo/`). The seal is checked live by `tools/verify_audit.py`.<br>**Network map and telemetry feed** come from the synthetic incident (`data/telemetry/pe07_incident.log`) and the records. The feed replays that log; it is not a live network.<br>**"New session"** archives the log (it is renamed, never deleted) and starts a fresh one. |
| **02 Attack simulator** | Two lanes in plain language (`demo/static/story.js`): the same message handled without and with the trust layer, step by step.<br>It runs `scenarios.run.run_full`, the same code as Experiment 2, through `trustlayer.quarantine` and `trustlayer.rulechecker`.<br>"Write your own attack" builds a one-event case and runs it through the same code.<br>Every run is saved as a decision card (#PT-0001, …) in the audit log. |
| **03 Policy intelligence** | Decision cards from this session's audit log: requested action, applicable rule and law (with a draft or verified badge), evidence check, enforcement decision, "Why was this blocked?", and audit references.<br>"Rules in force" reads `trustlayer/rules.yaml` and lists which test cases exercise each rule. |
| **04 Agent activity** | Each agent's role, tools, and registered channel and approval rights (from `data/records/mandates.csv`).<br>A timeline for any run, built from its audit entries: who received what, what it did, and its hash.<br>Offline, the operations agent's proposal is the scripted test case; in Live AI mode it is the model's real proposal. |
| **05 Policy gap explorer** | Parsed from `docs/gap_register.md`. Badges come from the text itself: "Person A to confirm" means first pass, and `TO_VERIFY` means open.<br>"Run S1-M in the simulator" opens the case that exposes the gap. |
| **06 Audit & forensics** | The audit logs. **Verify** runs `tools/verify_audit.py`, which imports nothing from our code.<br>**Tamper test** edits one decision in a *copy* of the log and verifies the copy. The real log is never changed. |
| **07 Experiment results** | `results/runs/*.jsonl` (the recorded runs), with Wilson confidence intervals. The replay shows the recorded HolmesGPT answers exactly as written. |

Nothing on screen is typed in by hand. If a run file is missing, the screen says so.

**Offline mode (the default):** no model is called, so it costs nothing. Decisions are identical in both modes, because the rule-checker is plain code. Offline, the institutional agents only show that they searched the knowledge base.

**Live AI mode (the switch, top right):** uses the provider and key from `.env`. A real model plays the operations agent twice (once reading the raw text, once reading the quarantined view) and plays the regulator, cyber-authority and data-office agents. It costs about $0.01–0.03 per run on gpt-4.1. One live run is one sample; use screen 07 for rates.

## Things not to claim in the demo
- Citations show "first pass, Person A to confirm" until Person A confirms them. Don't call them verified.
- Experiment 2 numbers come from the **development set**. They are not evidence until the blind holdout set runs.
- Agent messages are not signed yet. The Agent activity screen says so.
- The command centre's network is the synthetic test incident, not a live network.

## 2–3 minute video script
**Before recording:** click **New session** on screen 01, so the counts start at zero.

1. **(15 s) Problem.** "Any text an AI agent reads can give it orders. In a telecom network, anyone can write a help-desk ticket." Show the command centre: PE-07 flapping, the feed scrolling.
2. **(40 s) Inject "Fake maintenance approval"** from the command centre. The same message plays out in two lanes:
   - **Left lane (without protection):** the AI reads the note, nobody checks it, and it silences the alarm.
   - **Right lane (with the trust layer):** the note is held back, CHG-4471 is checked and found **False**, a fixed rule decides, and the action is **Stopped**.
   - The green box explains why the trust layer is better.
3. **(15 s) Run its clean twin** ("Genuine maintenance correctly recognised") → **Allowed**. Normal work still goes through.
4. **(25 s) Open the decision card** (screen 03). Show the requested action, the UAE citation (with its first-pass badge), the evidence check and "Why was this blocked?". Then click "see which agents took part" (screen 04) to show the timeline.
5. **(25 s) Live AI on, "A ticket pretends to carry regulator approval".** In our test run (6 Nov, gpt-4.1), the raw agent proposed the attacker's config change and the quarantined agent proposed only a diagnosis. Models vary, so record a take where this happens, or say so if it doesn't. Either way, the rule-checker blocks the forged instruction.
6. **(25 s) Results (screen 07).** Raw 19% vs trust layer 0/72 on gpt-4.1; raw 42% vs 0/72 on gpt-4.1-mini. Replay **I4**: the raw answer follows the planted "shut the interface permanently" runbook, and the protected answer does not.
7. **(15 s) Policy gaps (screen 05).** Open G3: who may instruct a licensee, and how an instruction reaching an AI agent is authenticated.
8. **(15 s) Audit (screen 06).** Click **Verify** (CHAIN INTACT), then **Tamper test**: changing BLOCK → ALLOW in a copy is caught.
