# Demo (current structure, 9 Nov, v4)

> This section replaces the screen-by-screen notes further down, which describe the earlier 7-screen layout.

**Run it:** `make demo PY=.venv/bin/python`, then open http://127.0.0.1:8765. Offline by default (no AI calls, no cost).

**Five screens, in story order:**
1. **Home**: the question, an everyday comparison, three headline numbers, the today vs trust-layer picture (switch to the
   **ITU-T Y.3172 view** to label each part SRC, C, PP, M, P, SINK), what HolmesGPT is, and this session's status.
2. **Watch it happen**: five plain story cards (four attacks, one normal request), "Write your own attack", and all 56 cases
   for engineers. Each run shows the two lanes, then a **report with five tabs**: Summary · Policy and law · Agents involved ·
   Regulator view · Evidence (with a live chain check).
3. **How decisions are made**: AI proposes → code checks the rules → a person approves anything unclear; how many decisions in
   this session were checked against a UAE-linked rule; the four rules with legal-force labels and "Try it"; what legal force
   means; who decides and who advises.
4. **Policy gaps**: the 11 gaps; each opens UAE today vs elsewhere (EU, UK) vs our proposal, plus a "see it happen" case; and
   what we propose to ITU (SG13, SG17, a D10 metric).
5. **Proof**: Results (Exp 1 charts, blind test, replay of recorded answers), Audit log (Verify, Tamper test), and
   "What's real" (what is live, what is prepared, limits).

**Header:** **Take the tour** (10 captioned steps that move between screens and run one real attack), **History** (every decision
this session, each opening its full decision card), and the **Live AI** switch.

## Recording the video (3 to 5 minutes)
1. On Home, open **This session → Start a new session**, so counts start at zero.
2. Click **Take the tour** and read each caption aloud; click **Next** when the screen settles. The tour runs the fake
   maintenance attack itself.
3. After the tour (it ends on "Write your own attack"), type one attack of your own and run it: this answers "is it scripted?".
4. Optional, if `.env` has a key: switch on **Live AI** and run one story, to show a real model being fooled without the layer.

# Demo UI: Poisoned Telemetry command centre

```bash
make demo PY=.venv/bin/python
```

Then open http://127.0.0.1:8765. The server listens on this machine only.

## The seven screens, and where each one's data comes from

| Screen | Where it comes from |
|---|---|
| **Overview** | **Session counts** (cases run, attacks that would have succeeded without protection, stopped / paused / allowed, claims caught, audit seal) come from this session's audit log (`results/runs/audit_demo/`). The seal is checked live by `tools/verify_audit.py`.<br>**Network map and telemetry feed** come from the synthetic incident (`data/telemetry/pe07_incident.log`) and the records. The feed replays that log; it is not a live network.<br>**"New session"** archives the log (it is renamed, never deleted) and starts a fresh one. |
| **Try an attack** | Two lanes in plain language (`demo/static/story.js`): the same message handled without and with the trust layer, step by step.<br>It runs `scenarios.run.run_full`, the same code as Experiment 2, through `trustlayer.quarantine` and `trustlayer.rulechecker`.<br>"Write your own attack" builds a one-event case and runs it through the same code.<br>Every run is saved as a decision card (#PT-0001, …) in the audit log. |
| **Decisions** | Decision cards from this session's audit log: requested action, applicable rule and law (with a draft or verified badge), evidence check, enforcement decision, "Why was this blocked?", and audit references.<br>"Rules in force" reads `trustlayer/rules.yaml` and lists which test cases exercise each rule. |
| **Agents** | Each agent's role, tools, and registered channel and approval rights (from `data/records/mandates.csv`).<br>A timeline for any run, built from its audit entries: who received what, what it did, and its hash.<br>Offline, the operations agent's proposal is the scripted test case; in Live AI mode it is the model's real proposal. |
| **Policy gaps** | Parsed from `docs/gap_register.md`. Badges come from the text itself: "Person A to confirm" means first pass, and `TO_VERIFY` means open.<br>"Run S1-M in the simulator" opens the case that exposes the gap. |
| **Audit log** | The audit logs. **Verify** runs `tools/verify_audit.py`, which imports nothing from our code.<br>**Tamper test** edits one decision in a *copy* of the log and verifies the copy. The real log is never changed. |
| **Results** | `results/runs/*.jsonl` (the recorded runs), with Wilson confidence intervals. The replay shows the recorded HolmesGPT answers exactly as written. |

Nothing on screen is typed in by hand. If a run file is missing, the screen says so.

**Offline mode (the default):** no model is called, so it costs nothing. Decisions are identical in both modes, because the rule-checker is plain code. Offline, the institutional agents only show that they searched the knowledge base.

**Live AI mode (the switch, top right):** uses the provider and key from `.env`. A real model plays the operations agent twice (once reading the raw text, once reading the quarantined view) and plays the regulator, cyber-authority and data-office agents. It costs about $0.01–0.03 per run on gpt-4.1. One live run is one sample; use the Results screen for rates.

## Things not to claim in the demo
- Citations show "first pass, legal check in progress" until Person A confirms them. Don't call them verified.
- Experiment 2 evidence is the **blind holdout set** (20/20 stopped, 2/16 false blocks). The development-set result (9/9, 0/16) is practice only, so don't quote it as evidence.
- Agent messages are not signed yet. The Agents screen says so.
- The command centre's network is the synthetic test incident, not a live network.

## 2–3 minute video script
**Before recording:** click **New session** on the Overview screen, so the counts start at zero.

1. **(15 s) Problem.** "Any text an AI agent reads can give it orders. In a telecom network, anyone can write a help-desk ticket." Show the command centre: PE-07 flapping, the feed scrolling.
2. **(40 s) Inject "Fake maintenance approval"** from the command centre. The same message plays out in two lanes:
   - **Left lane (without protection):** the AI reads the note, nobody checks it, and it silences the alarm.
   - **Right lane (with the trust layer):** the note is held back, CHG-4471 is checked and found **False**, a fixed rule decides, and the action is **Stopped**.
   - The green box explains why the trust layer is better.
3. **(15 s) Run its clean twin** ("Genuine maintenance correctly recognised") → **Allowed**. Normal work still goes through.
4. **(25 s) Open the decision card** (Decisions screen). Show the requested action, the UAE citation (with its first-pass badge), the evidence check and "Why was this blocked?". Then click "see which agents took part" (Agents screen) to show the timeline.
5. **(25 s) Live AI on, "A ticket pretends to carry regulator approval".** In our test run (6 Nov, gpt-4.1), the raw agent proposed the attacker's config change and the quarantined agent proposed only a diagnosis. Models vary, so record a take where this happens, or say so if it doesn't. Either way, the rule-checker blocks the forged instruction.
6. **(25 s) Results screen.** Raw 19% vs trust layer 0/72 on gpt-4.1; raw 42% vs 0/72 on gpt-4.1-mini. Replay **I4**: the raw answer follows the planted "shut the interface permanently" runbook, and the protected answer does not.
7. **(15 s) Policy gaps screen.** Open G3: who may instruct a licensee, and how an instruction reaching an AI agent is authenticated.
8. **(15 s) Audit log screen.** Click **Verify** (CHAIN INTACT), then **Tamper test**: changing BLOCK → ALLOW in a copy is caught.

**9 Nov UI update:** light, minimal theme; screens renamed (Overview, Try an attack, Decisions, Agents, Audit log, Results, Policy gaps) and grouped as "See it work" and "Evidence". The Overview now opens with one question and a **Try an attack** button. The Results tile for Experiment 2 shows the blind test set (20/20 stopped, 2/16 false blocks) when it is available.

**Incident report (9 Nov):** after the two lanes finish, scroll down to the incident report: it is the best place to end the video (what happened → what was malicious → what we did → which UAE law → evidence → open policy question). "Save as PDF" prints just the report.

**Regulator view (9 Nov):** on the incident report, click **Regulator view** to show what the authorities would receive: who is told, whether it is reportable today under UAE rules (first pass), the NIS2/GDPR deadlines for comparison, the provable detection time from the audit log, our recommendation and a draft notification (never sent). Say clearly that the UAE readings are first pass and that the draft is for a person to review.

**Plain words (9 Nov):** each case title is a plain sentence (large) with the technical title underneath (small). Hover any dotted-underlined term (RR-01, route filters, NOC lead…) for a one-line explanation. In the video, read the large sentence aloud and point at the small technical line only if the audience is technical.
