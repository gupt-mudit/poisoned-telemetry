# Submission checklist (ITU AI for Good Sandbox Hackathon, UAE)

This list is built from the mentoring deck (session 1, 3 Oct 2026) and the ITU AI Ready report (T-AI4G-AI4GOOD-2025-6).
Each requirement points to where it is met.
Submit the PDF in `report/final_private/` (local only, with contact details). The PDF in `report/` keeps placeholders for
the public repo.

## What must be submitted
| Requirement (deck) | Status | Where |
|---|---|---|
| Technical report, **max 5 pages**, template format | ✅ 5 pages | `report/final_private/Cybershield_AI_For_Good_UAE.pdf` |
| GitHub repository | ✅ public | https://github.com/gupt-mudit/poisoned-telemetry |
| Knowledge base of real policies, regulations and strategies, built with the ITU reference code | ✅ 8 documents, 912 chunks | `kb/`, `kb/manifest.yaml` (UAE texts are local only because they are all rights reserved) |
| Optional demo video (max 7 min, with subtitles) | ⬜ friend / Person D | script in `docs/DEMO.md` |

## Report sections the deck asks for
| Section | Where in the report |
|---|---|
| Header: names, contact, organisation, designation | Header. Designation (for example "student") is **not stated yet**: add it if the team wants it |
| Introduction: technology and importance | §1 "Technology and importance" |
| Problem, existing solutions and why they fall short | §1 "Example", "Related work (literature survey)": 20 verified research papers [15]–[34]; full survey `docs/LITERATURE_SURVEY.md` |
| Security terminology and mechanisms (mentor review) | §2 "Threat model and security techniques" table: threat → technique → algorithm in code → prior work; "Not built yet" line |
| Solution and its value | §1 "Proposed solution", "Results at a glance" |
| Mapped documents per Y.3172 node, with AI Readiness dimensions | §4 table (official dimension names from [2]) |
| Evaluation scenarios, step by step, with a judges' twist | §5 Steps 1–5 |
| Policy gaps "to be addressed in … manner" | §6 table: closest UAE provision (labelled by force), global comparator, recommendation with addressee; "From recommendation to instrument" |
| Standards gaps for ITU | §6 "Standards gaps for ITU" (SG13 Y.3172 family, SG17, an AI Readiness D10 metric) |
| Open-source code | Header (MIT licence) |
| How the knowledge base scales across geographies | §6 "Implementation gaps and scaling" |

## What judges look for (deck slides 5–6, 14)
| Point | Where |
|---|---|
| A policy and legal adviser agent consulted during error scenarios | Institutional agents (§1, §2); a real quoted opinion in §5 Step 5; demo Live AI mode |
| Institutional agents with different mandates and information | §2 "Multi-agent coordination"; `agents/institutional.py` |
| Events released progressively to different agents | §2 and §5 (scenario controller); `scenarios/run.py` |
| Audit logging and chain-of-thought tracing | §2 "Audit and reasoning trace" + security table (SHA-256 hash chain, Fernet encryption at rest, independent verifier); `trustlayer/audit.py`, `tools/verify_audit.py` |
| Policy use visible on every decision | Every decision cites its rule and law (§2 "How a decision is made"); demo decision cards |
| Real policy documents; simulated use-case data allowed | UAE and EU texts are official; the network and incident are synthetic (stated in §6 Limitations) |

## ITU AI Ready report alignment
- **Dimension 10 (AI & Policies):** sandbox with a simulated timeline, case briefs, audits and human accountability. See §4 "Evidence for D10".
- **Chapter 4 gap types** (international standards, implementations, policies): §6 uses the same three groups.

## Still open (be honest in the video too)
- Person A confirms the UAE citations (`docs/CITATION_CHECK.md`). Until then, §4 says "first-pass".
- Arabic title (English | Arabic) kept in the header.
- Optional: designation in the header; re-run Exp 2 on the dev set; hand spot-check of 20 answers.
