# Citation check sheet (for Person A, about 45 minutes)

Claude read these provisions in the official texts on 5 and 6 Nov. That is a first pass, not a confirmation.
For each row, open the official PDF at the page given, read the provision, and fill in the last column:
**OK** (it says what we claim), **FIX** (write the correction), or **DROP** (don't cite it).

When every row of a rule is OK, open `trustlayer/rules.yaml`, set that rule's `status: verified` and replace
`checked_by` with your name and the date. Do the same for the gap register (`docs/gap_register.md`): replace
"Claude 5/6 Nov, Person A to confirm" with "checked by <name>, <date>". Then run `make test`
(`RuleSet(strict=True)` must load).

**PDFs** (also copied locally under `kb/InputDocs/UAE_Telecom_Cyber/` as text; the PDFs are on Claude's machine only.
Download your own copy from the official link):
- **IA Reg** = UAE Information Assurance Regulation v1.1 (TDRA, March 2020):
  https://tdra.gov.ae/-/media/About/regulations-and-ruling/EN/UAE-Information-Assurance-Regulation-v1-1-pdf.ashx
- **PDPL** = Federal Decree-Law 45/2021, official Arabic text (u.ae):
  https://assets.u.ae/api/public/content/954629a06cc64fd887771ce3273d6154?v=21d88839.
  If you can, also get the English text at https://uaelegislation.gov.ae/en/legislations/1972/download (browser only).
- **Charter** = UAE Charter for the Development and Use of AI (July 2024):
  https://ai.gov.ae/wp-content/uploads/2024/07/UAEAI-Methaq-EN2-3.pdf
- **Telecom law** = FDL 3/2003 as amended, TDRA consolidated English text (2022):
  https://tdra.gov.ae/-/media/About/Legal-References/LAW/LAW-English/Final-TDRA-telecom-law_Final_english_o-02-07-2022--W-OUT-Bleed.ashx
  Our text copy is **OCR**, so check every quote in the PDF itself.
- **Licence** = Licence No. 2 of 2026, public version (TDRA; Etisalat):
  https://tdra.gov.ae/-/media/About/LICENSING/EN/Licence-22026-Etisalat-Public.ashx.
  It is one licensee's licence: cite it as an example of UAE licence conditions, not as binding on all operators.

Page numbers are PDF page numbers (the page counter in your viewer, not the number printed on the page). In the IA
Regulation a control's text can start on the page before its ID.

## Rules (`trustlayer/rules.yaml`)

| # | Rule | Cited provision | PDF, page | What we claim it says | Your check |
|---|---|---|---|---|---|
| 1 | R-SUPPRESS | IA Reg T3.2.3 | IA Reg p. 117 | Change Management: the entity shall control changes to information systems | |
| 2 | R-SUPPRESS | IA Reg T7.6.1 | IA Reg p. 185 | Change Control Procedures: formal approval, audit trail of all change requests | |
| 3 | R-SUPPRESS | IA Reg T3.6.2 | IA Reg p. 126 | Audit logging of user activities, exceptions and security events | |
| 4 | R-NO-EXTERNAL-PERSONAL-DATA | PDPL Art. 4 | PDPL p. 7 | Processing without consent is prohibited unless an exception applies | |
| 5 | R-NO-EXTERNAL-PERSONAL-DATA | PDPL Art. 7(1) | PDPL p. 8 | Controller: technical and organisational security measures | |
| 6 | R-NO-EXTERNAL-PERSONAL-DATA | PDPL Art. 8(5) | PDPL p. 9 | The processor discloses data only where the law allows | |
| 7 | R-NO-EXTERNAL-PERSONAL-DATA | PDPL Art. 20(1) | PDPL p. 13 | Security of processing: appropriate technical and organisational measures | |
| 8 | R-NO-EXTERNAL-PERSONAL-DATA | PDPL Arts. 22–23 | PDPL p. 14 | Conditions for transfer outside the State | |
| 9 | R-EMERGENCY | IA Reg T3.2.3(4) | IA Reg p. 117 | Assign management responsibilities for the control of changes | |
| 10 | R-EMERGENCY | IA Reg T8.2.2(7) | IA Reg p. 199 | CSIRT roles, responsibilities and corresponding authority | |
| 11 | R-AUTHORITY | Telecom law Art. 12 | Telecom law p. 14 | TDRA is the competent body to oversee the sector and Licensees | |
| 12 | R-AUTHORITY | Telecom law Art. 14 | Telecom law p. 15 | TDRA issues regulations, instructions, decisions and rules, including on "requesting any information required for the activities of TDRA" (find the clause number in the PDF) | |
| 13 | R-AUTHORITY | Licence Art. 6.2–6.3 | Licence p. 18 | TDRA may require reports in a format it sets; reports are provided by an authorised employee who confirms they are accurate and complete | |
| 14 | R-AUTHORITY | Licence Art. 8.3 | Licence p. 22 | A direction to assume control must be "received in writing" | |

## Gap register (`docs/gap_register.md`)

| # | Gap | Cited provision | PDF, page | What we claim it says | Your check |
|---|---|---|---|---|---|
| 15 | G1 | IA Reg T8.3.2, T8.2.3 | IA Reg pp. 200, 206 | Reporting through management channels incl. to the authority; incident classification; **no hour deadline in the text** | |
| 16 | G1 | Licence Art. 12.9.2 | Licence p. 33 | Unplanned interruption: inform TDRA "as soon as possible", **no fixed deadline** | |
| 17 | G2 | IA Reg T8.3.2 guidance | IA Reg p. 206 | Events to report include ineffective control, integrity breach, uncontrolled system changes (guidance, informative) | |
| 18 | G3 | Telecom law Arts. 12, 14 | pp. 14–15 | As rows 11–12 | |
| 19 | G3 | Telecom law Art. 79 repeated (second one) | p. 47 | The Board may fine Licensees for violating TDRA instructions | |
| 20 | G3 | Licence Arts. 8.1, 8.3, 12.7 | pp. 20, 22, 32 | Emergency: comply with "any direction whatsoever"; assume-control direction in writing; comply with TDRA resilience directives | |
| 21 | G4 | PDPL Art. 9(1), 9(3), 8(5) | PDPL p. 9 | Breach notification to the Data Office; processor tells controller; **period left to Executive Regulations** | |
| 22 | G5 | Charter Principles 5, 7; IA Reg T3.6.2 | Charter p. 4; IA p. 126 | Transparency; governance and accountability; audit logging | |
| 23 | G6 | Licence Arts. 3.4.1, 12.1, 12.4 | pp. 11, 30, 31 | Licensee stays "fully liable" when it subcontracts operation; resilience duty; recovery arrangements for "cyber incident" | |
| 24 | G8 | Charter Principle 6 | Charter p. 4 | Human oversight | |
| 25 | G9 | IA Reg T7.7.1; PDPL Art. 20(1)(d) | IA p. 190; PDPL p. 13 | Vulnerability testing before production; regular testing of security measures | |
| 26 | G10 | IA Reg T8.3.1 guidance | IA Reg p. 205 | Share priority information urgently "even if it is not fully analyzed or confirmed" | |
| 27 | G11 | Telecom law Art. 14; Licence Arts. 6.2–6.4 | pp. 15; 18 | Information requests; authorised employee confirms accuracy; TDRA access to premises | |

## Still not done (Claude could not get these texts)
- **G7:** cybercrime law, FDL 34/2021. uaelegislation.gov.ae blocks scripts (Cloudflare), so open it in a browser.
- **G1:** CSC Cyber Incident Response Framework v2.0. csc.gov.ae refused connections from our side; it may only be
  reachable from the UAE. Also the India comparator: the 6-hour reporting rule, from the official source.
- **G6:** civil liability (UAE Civil Transactions Law) and the EU comparators: Product Liability Directive (EU)
  2024/2853 and Cyber Resilience Act (EU) 2024/2847. EU texts can be fetched from CELLAR. Claude can do that if asked.
- **Scenarios:** 21 dev cases in `scenarios/policy/` have `expected_citations[].provision: TO_VERIFY`. Fill them
  from this sheet once confirmed. They are dev-only, so this is lower priority.
