# Knowledge-base sources — checklist for Person A

Compiled 4 Nov 2026 from official sites. **Update 4 Nov: NIS2, the EU AI Act and GDPR are now in
`kb/InputDocs/Comparators/` with manifest entries (from EU CELLAR).**
**Update 5 Nov: three UAE texts are in the local KB (gitignored):**
- the TDRA IA Regulation v1.1 (tdra.gov.ae PDF);
- the PDPL official Arabic text (u.ae PDF);
- the UAE AI Charter (ai.gov.ae PDF).

**Still missing** (servers returned 502, or the site blocks scripts):
- the telecom law FDL 3/2003 (TDRA, 502);
- Licence 2/2026 (TDRA, 502);
- the English PDPL (uaelegislation.gov.ae, 403);
- the cybercrime law FDL 34/2021 (uaelegislation.gov.ae);
- the CSC Incident Response Framework v2.0 (csc.gov.ae refuses the connection).

Open these in a normal browser and save them to `kb/InputDocs/UAE_Telecom_Cyber/`.
No UK text has been downloaded. A person must open each official text, check the
provision, then add the file and its manifest entry (`checked_by: <name>`).

Status words: **CONFIRMED** = heading/number read on the official site. **UNCONFIRMED** = seen only in
secondary sources or search snippets; do not cite until checked.

> Why UAE items are all UNCONFIRMED: uaelegislation.gov.ae is behind a bot check, csc.gov.ae and ai.gov.ae
> blocked automated access, and the TDRA PDFs could not be read automatically. Open them in a normal browser.

## Copyright — read before committing anything
TDRA and u.ae pages say "all rights reserved"; TDRA says copying without authorisation is prohibited.
**Keep UAE PDFs local only** (do not commit them to the public repo). In the manifest set
`licence: "link only, not redistributed"`. EUR-Lex (reuse with acknowledgement), legislation.gov.uk
(Open Government Licence v3.0) and OWASP (CC BY-SA 4.0) can be redistributed with attribution.
Suggest adding `kb/InputDocs/UAE_Telecom_Cyber/` to `.gitignore` before the repo goes public.

## UAE (all provisions UNCONFIRMED)
| Instrument | Official URL | Provisions to check | Feeds rule |
|---|---|---|---|
| Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL) | https://uaelegislation.gov.ae/en/legislations/1972 · Arabic PDF on u.ae: https://assets.u.ae/api/public/content/954629a06cc64fd887771ce3273d6154?v=21d88839 | Secondary sources say: Art. 4 (processing without consent, incl. security), Art. 9 (breach notification), Art. 20 (security of processing), Arts. 22–23 (cross-border transfer). Disclosure to third parties: unknown. **Executive Regulations: not found on any official site — treat as not issued.** | R-NO-EXTERNAL-PERSONAL-DATA |
| Federal Law by Decree No. 3 of 2003 (telecom sector), as amended | TDRA consolidated English (2022): https://tdra.gov.ae/-/media/About/Legal-References/LAW/LAW-English/Final-TDRA-telecom-law_Final_english_o-02-07-2022--W-OUT-Bleed.ashx (19.6 MB) · portal: https://uaelegislation.gov.ae/en/legislations/1132 | Snippets suggest Art. 14 (Authority competences incl. requesting information), Art. 12 (oversight of licensees). Art. 14 lists differ between copies (2020 amendment). Licence variation: unknown. | R-AUTHORITY-FROM-REGISTERED-CHANNEL |
| UAE Information Assurance Regulation v1.1 (Mar 2020) | https://tdra.gov.ae/-/media/About/regulations-and-ruling/EN/UAE-Information-Assurance-Regulation-v1-1-pdf.ashx | Incident-management and continuity control IDs. Check whether the CSC "UAE Information Assurance Standard" (https://csc.gov.ae/en/w/uae-information-assurance-standard) supersedes it. | R-SUPPRESS-NEEDS-VERIFIED-CHANGE, R-EMERGENCY |
| Telecom licence conditions (outage reporting, emergencies), e.g. Licence 2/2026 public version | https://tdra.gov.ae/-/media/About/LICENSING/EN/Licence-22026-Etisalat-Public.ashx | Outage-reporting and emergency clauses. No stand-alone TDRA outage-reporting regulation was found; it appears to live in licence conditions. | R-EMERGENCY, gap register |
| TDRA telecom emergency/crisis plan | https://tdra.gov.ae/en/initiatives/business-resilience-and-continuity-in-the-telecom | Plan text not public — good evidence for a transparency gap. | gap register |
| CSC Cyber Incident Response Framework v2.0 | https://csc.gov.ae/documents/38662/1042755/Cyber+Incident+response+Framework+v2.0.pdf/0254af1b-a531-bc79-9bae-5ab7961da2e2?t=1771617652094 · landing: https://u.ae/en/about-the-uae/strategies-initiatives-and-awards/strategies-plans-and-visions/Cypersecurity/Cyber-Incident-Response-Framework | Who must report, deadlines, severity levels. | cyber-agent opinions, gap register |
| National Cybersecurity Strategy 2025–2031 | https://csc.gov.ae/en/ (no direct PDF found) | Pillars | context |
| UAE National Strategy for AI 2031 | https://u.ae/-/media/AI-publications/UAE-National-Strategy-for-Artificial-Intelligence-2031.pdf | Policy, not law | context, Readiness mapping |
| UAE Charter for the Development and Use of AI (2024) | https://ai.gov.ae/wp-content/uploads/2024/07/UAEAI-Methaq-EN2-3.pdf | Principle numbers (human oversight, safety, accountability) | gap register |
| AE/SCNS/NCEMA 7000:2021 business continuity | ncema.gov.ae (no direct PDF; a non-NCEMA copy exists on enec.gov.ae — do not use as the official source) | Clauses; NCEMA consent needed to reproduce | R-EMERGENCY |

## Global comparators (CONFIRMED on official sites)
| Instrument | Official URL | Provisions |
|---|---|---|
| NIS2 Directive (EU) 2022/2555 | https://eur-lex.europa.eu/eli/dir/2022/2555/oj | Art. 21 risk-management measures; **Art. 23 reporting**: 23(4)(a) early warning 24 h, (b) notification 72 h, (d) final report 1 month |
| EU AI Act, Regulation (EU) 2024/1689 | https://eur-lex.europa.eu/eli/reg/2024/1689/oj | Art. 12 record-keeping; Art. 14 human oversight; **Art. 15(5)** robustness vs data/model poisoning, adversarial examples; Art. 19 logs; Art. 26(6) deployer log keeping; Art. 73 serious incidents; Recital 76 |
| GDPR, Regulation (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Art. 32 security; Art. 33 breach notification (re-read the 72 h wording); Art. 34; Chapter V Arts. 44–50 transfers |
| UK Communications Act 2003 s.105K (inserted by Telecommunications (Security) Act 2021) | https://www.legislation.gov.uk/ukpga/2003/21/section/105K | Duty to inform Ofcom of security compromises "as soon as reasonably practicable"; 105K(2) significance factors |
| Electronic Communications (Security Measures) Regulations 2022, SI 2022/933 | https://www.legislation.gov.uk/uksi/2022/933/contents/made | Reg. 5 protecting monitoring tools; reg. 6 monitoring & analysis; reg. 9 remediation; reg. 10 governance |
| ITU-T Y.3172 (06/2019) | https://www.itu.int/rec/T-REC-Y.3172 | Architecture mapping (© ITU) |
| NIST AI 600-1 GenAI Profile | https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf | Information-security risk incl. prompt injection (section not yet read) |
| OWASP LLM01:2025 Prompt Injection | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Indirect injection (community standard, not law) |

## Check first (highest value)
1. PDPL article numbers (4, 9, 20, 22–23) and whether Executive Regulations exist.
2. Telecom law Arts. 12 and 14 (information requests, oversight) in the 2022 consolidated text.
3. CSC Incident Response Framework v2.0: reporting duty and deadlines.
4. Whether the CSC IA Standard supersedes TDRA IA Regulation v1.1.

Then: put files in `kb/InputDocs/UAE_Telecom_Cyber/` and `kb/InputDocs/Comparators/`, add manifest
entries, run `make kb-ingest && make kb-check`, fill `provision:` in `trustlayer/rules.yaml`, set
`status: verified`, and rerun `make exp2 && make tables`.
