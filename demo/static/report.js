"use strict";
/* Incident report shown after each simulation: what happened, what was suspicious, what the trust layer did,
   which policy applied and where the evidence is. Every line comes from the simulation result (r) and the gap
   register; nothing is written by a language model. Loaded after story.js, before app.js. */

/* Gaps a scenario category exposes (from the "Exposed by" column of docs/gap_register.md). */
const GAPS_BY_CATEGORY = {
  false_maintenance_approval: ["G1", "G2"],
  unauthorised_data_sharing: ["G4"],
  forged_regulator_instruction: ["G3"],
  emergency_response: ["G8"],
};

/* Legal force of each source named in a rule's citation (labels as used in the report). */
function forceTags(instrument) {
  const t = [];
  if (/PDPL|Federal Law|Decree-Law|telecom law/i.test(instrument)) t.push("law");
  if (/Licence/i.test(instrument)) t.push("licence condition");
  if (/Information Assurance Regulation/i.test(instrument)) t.push("regulation");
  if (/operator/i.test(instrument)) t.push("operator policy");
  return t;
}

function markSpans(text, spans) {
  let out = esc(text);
  [...new Set(spans)].filter(Boolean).forEach((s) => { out = out.split(esc(s)).join(`<mark class="plant">${esc(s)}</mark>`); });
  return out;
}

function incidentStatus(r) {
  const mal = r.scenario.variant === "malicious", v = r.protected.verdict;
  if (mal && v === "BLOCK") return ["Attack stopped", "b-good"];
  if (mal && v === "ESCALATE") return ["Attack paused for a person", "b-warn"];
  if (mal) return ["Attack allowed: review needed", "b-crit"];
  if (v === "ALLOW") return ["No attack: normal work allowed", "b-good"];
  return ["False alarm: legitimate request held", "b-warn"];
}

function incidentSummary(r) {
  const mal = r.scenario.variant === "malicious", d = r.protected;
  const act = (PLAIN.action[r.proposal.action] || r.proposal.action).toLowerCase();
  const where = PLAIN.channel[r.items[r.items.length - 1]?.channel] || "a message";
  const bad = d.claims.filter((c) => c.verification !== "verified").length;
  const verdict = PLAIN.verdict[d.verdict][0].toLowerCase();
  if (mal) {
    return `Text in ${esc(where)} tried to make the AI <b>${esc(act)}</b>. ` +
      (bad ? (bad === d.claims.length ? (bad === 1 ? "Its claim could not be backed by the operator's records, " : `None of its ${bad} claims could be backed by the operator's records, `)
             : `${bad} of its ${d.claims.length} claims could not be backed by the operator's records, `) : "Its claims were checked against the records, ") +
      `so the action was <b>${esc(verdict)}</b> under a rule that cites UAE law.`;
  }
  return `A legitimate request asked the AI to <b>${esc(act)}</b>. Its claims were checked against the records and the action was <b>${esc(verdict)}</b>.`;
}

function incidentHTML(r) {
  const d = r.protected, mal = r.scenario.variant === "malicious";
  const [status, scls] = incidentStatus(r);
  const last = r.items[r.items.length - 1] || {};
  const flagged = r.items.filter((i) => i.flags.length);
  const row = (label, body) => `<div class="ir-row"><div class="ir-label">${label}</div><div class="ir-body">${body}</div></div>`;

  const suspicious = mal
    ? (flagged.length
        ? flagged.map((i) => `<blockquote class="ir-quote">${glossHTML(markSpans(i.text, i.flags.map((f) => f.span)))}</blockquote>`).join("") +
          `<p class="ir-note">Wording flagged: ${[...new Set(r.flags.map((f) => PLAIN.flag[f.rule] || f.rule))].map(esc).join("; ")}.</p>`
        : `<blockquote class="ir-quote">${glossText(last.text || "")}</blockquote><p class="ir-note">No wording was flagged: the attack is polite, so it is caught by the fact-check below.</p>`)
    : `<p>Nothing suspicious in the message.</p>`;

  const claims = d.claims.length
    ? `<ul class="ir-claims">${d.claims.map((c) => {
        const [lab, cls] = PLAIN.claim[c.verification];
        return `<li><span class="badge ${cls}">${lab}</span><span>${esc(c.text)}<span class="ir-ev">${esc(c.evidence)}</span></span></li>`;
      }).join("")}</ul>`
    : "<p>No checkable claims in the message.</p>";

  const without = mal
    ? `The AI would <b>${esc((PLAIN.action[r.proposal.action] || r.proposal.action).toLowerCase())}</b>. ${esc(PLAIN.harm[r.proposal.action] || "The attacker gets what they wanted.")}`
    : "The request would go ahead, as it should.";

  const withheld = r.quarantine.free_text_withheld;
  const did = `<ol class="ir-steps">
      <li>Held back ${withheld} free-text field${withheld === 1 ? "" : "s"}; the AI saw only measurements and neutral claims.</li>
      <li>Checked ${d.claims.length} claim${d.claims.length === 1 ? "" : "s"} against the change log, incident records and mandate register.</li>
      <li>Decision: <b>${esc(PLAIN.verdict[d.verdict][0])}</b>${d.requires_human ? ` · approval needed from: ${esc(d.authority || "a responsible person")}` : ""}.</li>
    </ol>`;

  const policy = (d.citations.length ? d.citations : [{ rule_id: d.rule_id }]).map((c) => {
    const tags = forceTags(c.instrument || "");
    return `<div class="ir-policy">
        <p class="ir-rule">${esc(PLAIN.rule[c.rule_id] || c.rule || c.rule_id)}</p>
        ${c.instrument ? `<p class="ir-law"><b>Legal basis:</b> ${esc(c.instrument)}</p>
        <p class="ir-tags">${tags.map((t) => `<span class="badge b-mute">${esc(t)}</span>`).join(" ")}
          <span class="badge ${c.status === "verified" ? "b-good" : "b-info"}">${c.status === "verified" ? "citation verified" : "citation: first pass"}</span>
          <span class="mono ir-rid">${esc(c.rule_id)}</span></p>` : `<p class="ir-note">No rule restricts this kind of action, so it is allowed and logged.</p>`}
      </div>`;
  }).join("");

  const first = r.audit[0], lastA = r.audit[r.audit.length - 1];
  const evidence = `Decision <b class="mono">#${esc(r.card_id)}</b> · audit entries ${first ? `#${first.n}–#${lastA.n}` : "none"}
      ${lastA ? `· last fingerprint <span class="mono hash">${esc(lastA.hash.slice(0, 16))}…</span>` : ""}
      <br><a href="#" id="irAudit">Check the audit log</a> · <a href="#" id="irCard">Open the decision card</a>`;

  const gapIds = mal ? (GAPS_BY_CATEGORY[r.scenario.category] || []) : [];
  const gaps = gapIds.length ? row("Open policy question", `<div id="irGaps" data-ids="${gapIds.join(",")}"><span class="muted">Loading…</span></div>`) : "";

  return `<section class="panel incident" id="incident" aria-label="Incident report">
    <div class="ir-head">
      <div>
        <div class="ir-kicker">Incident report · #${esc(r.card_id)} · ${esc(r.mode === "live" ? "live AI" : "offline")}</div>
        <h3>${esc(plainTitle(r.scenario.id) || r.scenario.title)}</h3>
        ${r.scenario.id !== "CUSTOM" ? `<p class="pl-tech-line">${glossText(r.scenario.title)}</p>` : ""}
      </div>
      <div class="ir-actions"><span class="badge ${scls}">${esc(status)}</span>
        <button class="btn" id="irPrint" title="Print or save this report as PDF">Save as PDF</button></div>
    </div>
    <p class="ir-summary">${incidentSummary(r)}</p>
    <div class="ir-tabs" role="tablist" aria-label="Report sections">
      <button role="tab" aria-selected="true" data-v="irOp">Summary</button>
      <button role="tab" aria-selected="false" data-v="irLaw">Policy and law</button>
      <button role="tab" aria-selected="false" data-v="irAg">Agents involved</button>
      <button role="tab" aria-selected="false" data-v="irReg">Regulator view</button>
      <button role="tab" aria-selected="false" data-v="irEv">Evidence</button>
    </div>
    <div class="ir-pane" id="irLaw" hidden><p class="muted">Loading…</p></div>
    <div class="ir-pane" id="irAg" hidden><p class="muted">Loading…</p></div>
    <div class="ir-grid ir-pane" id="irReg" hidden>${regulatorHTML(r)}</div>
    <div class="ir-pane" id="irEv" hidden>${evidenceTabHTML(r)}</div>
    <div class="ir-grid ir-pane" id="irOp">
      ${row("What happened", `${glossText(r.scenario.story || "")}<p class="ir-note">Source: ${esc(PLAIN.channel[last.channel] || last.channel || "")} · <span class="mono">${esc(last.source || "")}</span>${last.node ? ` · node ${esc(last.node)}` : ""}</p>`)}
      ${row(mal ? "What was malicious" : "What was checked", suspicious + claims)}
      ${row("Without protection", without)}
      ${row("What the trust layer did", did)}
      ${row("Policy applied", policy)}
      ${row("Evidence", evidence)}
      ${gaps}
    </div>
  </section>`;
}

async function bindIncident(r) {
  $("#irPrint")?.addEventListener("click", () => window.print());
  $$(".ir-tabs button").forEach((b) => b.addEventListener("click", () => irTab(r, b.dataset.v)));
  $("#irVerify")?.addEventListener("click", async () => {
    const out = $("#irVerifyOut");
    out.innerHTML = '<span class="spin"></span> checking the chain with the independent verifier…';
    const v = await api("/api/audit/demo/verify", { method: "POST" });
    out.innerHTML = v.ok ? '<span class="badge b-good">Chain intact</span> no entry has been changed since it was written.'
      : '<span class="badge b-crit">Check failed</span> the chain does not verify.';
  });
  $("#irAuditFull")?.addEventListener("click", (e) => { e.preventDefault(); show("audit"); });
  $("#irCopy")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#irDraft").innerText); $("#irCopy").textContent = "Copied"; }
    catch (e) { $("#irCopy").textContent = "Select the text to copy"; }
  });
  $("#irAudit")?.addEventListener("click", (e) => { e.preventDefault(); show("audit"); });
  $("#irCard")?.addEventListener("click", (e) => { e.preventDefault(); goPolicy(r.card_id); });
  const box = $("#irGaps");
  if (!box) return;
  try {
    if (!S.gaps.length) await loadGaps();
    const ids = box.dataset.ids.split(",");
    box.innerHTML = ids.map((id) => {
      const g = S.gaps.find((x) => x.ID === id);
      return g ? `<p class="ir-gap"><b>${esc(id)}.</b> ${md(g["Open question (telecom framing)"])} <a href="#" class="ir-gaplink" data-id="${esc(id)}">See the closest UAE rule and our proposal</a></p>` : "";
    }).join("");
    $$(".ir-gaplink").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openGap(a.dataset.id); }));
  } catch (e) {
    box.innerHTML = '<span class="muted">Gap register not available.</span>';
  }
}

/* ------------------------------------------------------------ regulator view
   What the incident looks like to the authorities. The legal text mirrors docs/gap_register.md and the report's
   gap table; every UAE reading is a first pass until the team's legal check is done. Wording rule: existing
   frameworks may not explicitly resolve these questions; this is not a claim that no rule exists. */
const IA_REPORT = { text: "IA Regulation T8.3.2: report information security events through management channels, including to the appropriate authority; T8.2.3: classify incidents and identify those to report at sector and national level.", force: "regulation" };
const IA_SPEED = { text: "No hour limit found in the IA Regulation. Licence No. 2 of 2026, Art. 12.9.2: “as soon as possible”.", force: "regulation · licence condition" };
const REG = {
  false_maintenance_approval: {
    to: ["TDRA (telecom regulator)", "National cyber authority"], subject: "Attempted manipulation of an AI agent to hide a network alarm",
    reportable: IA_REPORT, unclear: "Whether a manipulated AI decision with no outage is reportable is not explicit. IA guidance (informative) lists integrity breaches and uncontrolled system changes.",
    speed: IA_SPEED, comp: [["EU NIS2 Art. 23(4)(a)", "early warning within 24 hours of becoming aware", 24], ["UK Communications Act s.105K", "“as soon as reasonably practicable”", 0]],
    gaps: ["G1", "G2"], fix: "The clock starts at first automated detection; an AI may not silence a security alarm without a human co-sign." },
  unauthorised_data_sharing: {
    to: ["UAE Data Office"], subject: "Attempted disclosure of subscriber data through an AI agent",
    reportable: { text: "PDPL Art. 9(1): the controller notifies the Data Office upon becoming aware of a breach that may affect privacy, confidentiality or security.", force: "law" },
    unclear: "Whether a disclosure caused by a manipulated AI counts as a breach, and when the operator becomes aware, is not explicit.",
    speed: { text: "“Upon becoming aware”; the period is left to the Executive Regulations (not found).", force: "law" },
    comp: [["EU GDPR Art. 33(1)", "notify within 72 hours of becoming aware", 72]],
    gaps: ["G4"], fix: "Treat an AI-mediated disclosure as a breach once logged; the audit-log time fixes when the operator became aware." },
  forged_regulator_instruction: {
    to: ["TDRA (the authority impersonated)", "National cyber authority"], subject: "Forged regulator instruction sent to an AI agent",
    reportable: { text: "Telecom law Arts. 12, 14: TDRA instructions bind licensees. Licence No. 2 of 2026, Art. 8.1: in a declared emergency, comply with “any direction whatsoever”.", force: "law · licence condition" },
    unclear: "How a direction that reaches an AI system is authenticated, and whether a forged one must be reported, is not explicit.",
    speed: { text: "No specific duty found for a forged direction.", force: "" },
    comp: [["Elsewhere", "none found that addresses machine channels; ITU-T SG17 agent-identity work is in progress", 0]],
    gaps: ["G3"], fix: "Directions to AI-operated systems only through authenticated, registered channels; a forged direction is a reportable incident." },
  emergency_response: {
    to: ["TDRA (telecom regulator)", "National cyber authority"], subject: "Fake emergency used to rush an AI agent into a risky change",
    reportable: IA_REPORT, unclear: "Which AI-proposed actions need a human's approval, as opposed to general oversight, is not explicit (AI Charter: human oversight, principle).",
    speed: IA_SPEED, comp: [["EU NIS2 Art. 23(4)(a)", "early warning within 24 hours of becoming aware", 24], ["EU AI Act Art. 14", "human oversight of high-risk AI", 0]],
    gaps: ["G8", "G1"], fix: "Publish a minimum list of AI actions that need human approval: alarm suppression, core configuration changes, any external disclosure." },
};

function utc(ts) { return ts ? ts.replace("T", " ").replace(/\.\d+/, "").replace(/(\+00:00|Z)$/, "") + " UTC" : "—"; }
function addHours(ts, h) {
  const d = new Date(ts.endsWith("Z") || ts.includes("+") ? ts : ts + "Z");
  return isNaN(d) ? "" : new Date(d.getTime() + h * 3600e3).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function regulatorHTML(r) {
  const d = r.protected, mal = r.scenario.variant === "malicious";
  const row = (label, body) => `<div class="ir-row"><div class="ir-label">${label}</div><div class="ir-body">${body}</div></div>`;
  if (!mal) {
    return row("For the regulator", "Nothing to report. This was a legitimate request; its claims were checked against the records and the decision is logged.") +
      row("Status", '<span class="badge b-info">UAE readings: first pass</span>');
  }
  const L = REG[r.scenario.category] || REG.false_maintenance_approval;
  const first = r.audit[0] || {}, lastA = r.audit[r.audit.length - 1] || {};
  const last = r.items[r.items.length - 1] || {};
  const outcome = d.verdict === "BLOCK" ? "Attempt stopped before it had any effect. No service impact; nothing left the company."
    : d.verdict === "ESCALATE" ? "Action held for a named person to approve; no effect so far."
    : "The action went ahead: impact possible. Treat as an incident and review.";
  const force = (f) => f ? f.split(" · ").map((x) => `<span class="badge b-mute">${esc(x)}</span>`).join(" ") : "";
  const deadlines = L.comp.map(([who, what, h]) => `<li><b>${esc(who)}:</b> ${esc(what)}${h && first.ts ? ` <span class="ir-ev">If it applied here: by ${esc(addHours(first.ts, h))}</span>` : ""}</li>`).join("");

  const draft = [
    ["To", L.to.join("; ")],
    ["Subject", `${L.subject} (#${r.card_id})`],
    ["Detected (UTC)", utc(first.ts)],
    ["Affected", `${last.node ? `node ${last.node}, ` : ""}operations AI agent`],
    ["What happened", r.scenario.story || r.scenario.title],
    ["How it arrived", `${PLAIN.channel[last.channel] || last.channel} (${last.source || "unknown source"})`],
    ["Outcome", `${PLAIN.verdict[d.verdict][0]} under rule ${d.rule_id}. ${outcome}`],
    ["Evidence", `audit entries #${first.n}–#${lastA.n}, fingerprint ${String(lastA.hash || "").slice(0, 16)}…`],
  ];

  return row("Who would be told", L.to.map((t) => `<span class="badge b-info">${esc(t)}</span>`).join(" ")) +
    row("Effect", esc(outcome)) +
    row("Is it reportable today?", `<p>${esc(L.reportable.text)}</p><p class="ir-tags">${force(L.reportable.force)}<span class="badge b-info">first pass</span></p>
        <p class="ir-note">${esc(L.unclear)}</p>`) +
    row("How fast?", `<p><b>UAE:</b> ${esc(L.speed.text)}</p><ul class="ir-steps ir-comp">${deadlines}</ul>`) +
    row("When the clock starts", `Detected by the trust layer at <b>${esc(utc(first.ts))}</b> (audit #${esc(first.n)}). The audit log fixes this time, so “when did the operator become aware?” has a provable answer.`) +
    row("Our recommendation", `${esc(L.fix)} <span class="ir-ev">Policy gaps ${L.gaps.map(esc).join(", ")}: existing frameworks may not explicitly resolve this; it is not a claim that no rule exists.</span>`) +
    row("Draft notification", `<div class="ir-draft" id="irDraft">${draft.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}</div>
        <p class="ir-note"><b>Draft only, not sent.</b> Prepared from the audit log; a responsible person reviews and sends it. <button class="btn" id="irCopy" style="margin-left:8px;padding:4px 10px;font-size:12.5px">Copy draft</button></p>`);
}

/* ------------------------------------------------------------ report tabs */
async function irTab(r, id) {
  $$(".ir-tabs button").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.v === id)));
  $$(".ir-pane").forEach((p) => (p.hidden = p.id !== id));
  try {
    if (id === "irLaw" && !$("#irLaw").dataset.done) {
      const d = await api("/api/decisions");
      S.decisions = d.decisions;
      const dec = d.decisions.find((x) => x.id === r.card_id);
      $("#irLaw").innerHTML = dec ? decisionCard(dec) : '<p class="muted">Decision not found in this session\'s log.</p>';
      $("#irLaw").dataset.done = "1";
      bindCard();
    }
    if (id === "irAg" && !$("#irAg").dataset.done) {
      const d = await api("/api/agents");
      S.roster = d.roster; S.runs = d.runs;
      const run = d.runs.find((x) => x.card.id === r.card_id);
      $("#irAg").innerHTML = (run ? timelineHTML(run) : '<p class="muted">No agent activity found for this run.</p>') +
        '<p class="footnote">AI advisers only give opinions. Offline, their position mirrors the rule-checker; switch on Live AI for their own cited reading.</p>';
      $("#irAg").dataset.done = "1";
      $$("#irAg .to-policy").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); irTab(r, "irLaw"); }));
    }
  } catch (e) {
    $("#" + id).innerHTML = `<p class="muted">Could not load: ${esc(e.message)}</p>`;
  }
}

function evidenceTabHTML(r) {
  const rows = r.audit.map((a) => `<tr><td class="num">${a.n}</td><td>${esc(a.event.replaceAll("_", " "))}</td><td>${esc(ACTOR_NAME?.[a.actor] || a.actor)}</td>
    <td class="mono hash">${esc(a.hash.slice(0, 14))}…</td><td class="mono muted">${esc(a.prev.slice(0, 10))}…</td></tr>`).join("");
  return `<p>This run added <b>${r.audit.length}</b> entries to the audit log. Each entry stores the fingerprint (SHA-256) of the one
      before it, so changing any entry later breaks the chain. The attacker's original text is stored encrypted and referenced only by
      its fingerprint.</p>
    <div style="overflow:auto"><table class="data"><thead><tr><th>#</th><th>Step</th><th>By</th><th>Fingerprint</th><th>Previous</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="btn-row"><button class="btn btn-primary" id="irVerify">Verify the chain now</button>
      <a href="#" id="irAuditFull" class="small" style="align-self:center">Open the full audit log and tamper test</a></div>
    <p class="small" id="irVerifyOut" role="status"></p>`;
}
