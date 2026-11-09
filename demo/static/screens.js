"use strict";
/* Screens 01 (command centre), 03 (policy intelligence) and 04 (agent activity). Data: /api/command,
   /api/decisions, /api/agents, all built from this session's audit log, the records and the rules.
   Loaded before app.js; uses its helpers ($, esc, api, ...) at run time. */

let TICKER = null;

/* ------------------------------------------------------------ helpers shared by these screens */
function goSim(sid, kase = "base") {
  show("sim");
  $$("#library [data-sid]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.sid === sid && x.dataset.case === kase)));
  runSim({ scenario: sid, case: kase });
}
function goPolicy(id) { S.policySel = id; show("policy"); }
function goAgents(id) { S.agentRun = id; show("agents"); }
const kindBadge = (k) => k === "AI model" ? '<span class="badge b-info">AI model · advises only</span>' : '<span class="badge b-mute">plain code</span>';
const ACTOR_NAME = { "scenario-controller": "Scenario controller", "quarantine-reader": "Quarantine reader", "ops-agent": "Operations agent",
  "rule-checker": "Rule-checker", "tdra-agent": "Telecom regulator agent", "cyber-agent": "Cyber authority agent",
  "data-office-agent": "Data office agent", demo: "Audit log", audit: "Audit log", none: "No check (baseline)" };
const CLAIM_TYPE = { approval: "Change / maintenance approval", authority: "Authority of the requester", incident: "Incident record",
  data_request: "Data request", action_request: "Requested network action", cause: "Stated cause" };

/* ============================================================ 01 COMMAND CENTRE */
async function loadCommand() {
  const c = await api("/api/command");
  const s = c.session;
  const seal = c.audit.ok === null ? ["–", "no entries yet", "b-mute"] : c.audit.ok ? ["Intact", "hash chain verified just now", "b-good"] : ["BROKEN", "verification failed", "b-crit"];
  const tile = (big, label, sub, cls = "") => `<div class="panel tile ${cls}"><div class="big">${big}</div><div class="lbl">${label}</div><div class="sub">${sub}</div></div>`;
  const step = (n, t, d) => `<li><span class="ov-n">${n}</span><div><b>${t}</b><span>${d}</span></div></li>`;
  $("#command").innerHTML = `
    <div class="panel ov-hero">
      <div>
        <h3>Can one planted sentence take over an AI that helps run a network?</h3>
        <p>Pick an attack and watch the same message handled twice: by today's AI, and by the same AI behind our trust layer.</p>
      </div>
      <button class="btn btn-primary" id="ovTry">Try an attack</button>
    </div>
    <ol class="ov-flow" aria-label="How the trust layer works">
      ${step(1, "Message arrives", "an alarm, log line or help-desk ticket")}
      ${step(2, "Quarantine", "free text is held back; only neutral claims pass")}
      ${step(3, "Fact-check", "each claim is checked against the operator's records")}
      ${step(4, "Rule-checker", "plain code applies rules that cite UAE law")}
      ${step(5, "Audit log", "every step is sealed into a tamper-evident chain")}
    </ol>
    <div class="tiles ov-tiles">
      ${tile(s.runs, "Cases run this session", `${s.attacks} attack(s), ${s.runs - s.attacks} normal request(s)${s.live_runs ? `, ${s.live_runs} with live AI` : ""}`)}
      ${tile(s.blocked, "Stopped by the trust layer", `without it, ${s.attacks_executed_without_layer} would have gone through · ${s.escalated} paused for a person`)}
      ${tile(`${s.claims.contradicted}<span class="of"> false</span> · ${s.claims.unverified}<span class="of"> unconfirmed</span>`, "Claims caught by fact-checking", `${s.claims.verified} confirmed true`)}
      ${tile(`<span class="badge ${seal[2]}"><span class="dot"></span>${seal[0]}</span>`, "Audit log", `${seal[1]} · ${s.audit_entries} entries`)}
    </div>
    <div class="cc-grid">
      <div class="panel"><div class="panel-head"><h3>Start with an attack</h3></div>
        <div class="panel-body inject">
          ${[["S1-M", "Fake maintenance approval", "A note claims a BGP anomaly is planned work."],
             ["S2-M", "Subscriber data disclosure", "A ticket asks for customer records to go outside."],
             ["S3-M", "Forged regulator instruction", "A message claims TDRA ordered a change."],
             ["S4-M", "Fake emergency", "A message claims an emergency to skip approval."]].map(([id, t, d]) =>
            `<button class="inject-btn" data-sid="${id}"><b>${t}</b><span>${d}</span></button>`).join("")}
        </div></div>
      <div class="panel"><div class="panel-head"><h3>Recent decisions</h3><span class="small muted">click to open</span></div>
        <div class="panel-body">${c.recent.length ? `<div class="feed">${c.recent.slice(0, 6).map((d) => `
          <button class="feed-row" data-id="${esc(d.id)}"><span>${esc(plainTitle(d.title) || d.title)}</span>
          ${verdictBadge(d.verdict)}<span class="muted small">${esc(d.ts.slice(11, 16))}</span></button>`).join("")}</div>`
          : '<p class="muted">No decisions yet. Start with an attack.</p>'}</div></div>
    </div>
    <details class="panel ov-net">
      <summary>The test network <span class="muted small">synthetic incident of 2 Nov: failing optics on PE-07</span></summary>
      <div class="cc-grid ov-net-body">
        <div>${bigTopo(c.network.nodes)}</div>
        <div><div class="small muted" style="margin-bottom:6px">Telemetry, replayed</div><div class="ticker" id="ticker"></div></div>
      </div>
      <p class="small muted ov-records">The trust layer checks claims against the operator's records: ${c.records.changes_approved} of
        ${c.records.changes_total} changes in the change log are approved; open incidents:
        ${c.records.incidents_open.map((i) => `${esc(i.incident_id)} on ${esc(i.node)} (${esc(i.severity)})`).join(", ") || "none"}.</p>
    </details>`;
  $("#ovTry").addEventListener("click", () => show("sim"));
  $$(".inject-btn").forEach((b) => b.addEventListener("click", () => goSim(b.dataset.sid)));
  $$(".feed-row").forEach((b) => b.addEventListener("click", () => goPolicy(b.dataset.id)));
  startTicker(c.network.log);
}

function bigTopo(nodes) {
  const P = { "RR-01": [260, 42], "PE-03": [100, 140], "PE-07": [420, 140], "CE-12": [260, 240] };
  const by = Object.fromEntries(nodes.map((n) => [n.node, n]));
  const L = [["RR-01", "PE-03"], ["RR-01", "PE-07"], ["PE-03", "CE-12"], ["PE-07", "CE-12"]];
  const status = (n) => n.state === "flapping" || n.alarms ? ["crit", `${n.alarms} alarms · link flapping`] :
    n.note ? ["warn", n.note] : ["ok", "normal"];
  const nodeSvg = (id) => {
    const n = by[id]; if (!n) return "";
    const [x, y] = P[id]; const [cls, txt] = status(n);
    return `<g class="bn ${cls}">${cls === "crit" ? `<circle class="pulse" cx="${x}" cy="${y}" r="8"/>` : ""}
      <rect x="${x - 82}" y="${y - 30}" width="164" height="62" rx="10"/>
      <circle class="sdot" cx="${x - 68}" cy="${y - 14}" r="4"/>
      <text x="${x - 58}" y="${y - 10}" class="t1">${id}</text>
      <text x="${x - 68}" y="${y + 5}" class="t2">${esc(n.role.replace("_", " "))} · ${esc(n.site)}</text>
      <text x="${x - 68}" y="${y + 17}" class="t3">${esc(txt)}</text>
      ${n.rx != null ? `<text x="${x - 68}" y="${y + 28}" class="t2">optical power ${n.rx} dBm</text>` : ""}
      <title>${id}: ${esc(n.role)} at ${esc(n.site)}; criticality ${esc(n.criticality)}. ${esc(txt)}</title></g>`;
  };
  return `<svg class="bigtopo" viewBox="0 0 520 280" role="img" aria-label="Test network with four nodes">
    <line class="link" x1="460" y1="110" x2="512" y2="62" stroke-dasharray="4 4"/><text x="515" y="54" text-anchor="end" class="t2">peer 203.0.113.9</text>
    ${L.map(([a, b]) => `<line class="link ${by[a] && by[b] && (status(by[a])[0] === "crit" || status(by[b])[0] === "crit") ? "hot" : ""}" x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}"/>`).join("")}
    ${Object.keys(P).map(nodeSvg).join("")}</svg>
    <p class="small muted" style="margin:6px 0 0">The real fault in this test incident: failing optics on PE-07 (link flaps, then BGP resets). A genuine,
      unrelated change CHG-4458 happened at the same time, which attackers try to exploit.</p>`;
}

function startTicker(lines) {
  clearInterval(TICKER);
  const box = $("#ticker"); if (!box || !lines.length) return;
  let i = 0;
  const add = () => {
    const l = lines[i % lines.length]; i++;
    const div = document.createElement("div");
    div.className = "tk" + (/\bALARM\b/.test(l) ? " alarm" : /\bSYSLOG\b/.test(l) ? " sys" : "");
    div.textContent = l.replace(/^2026-11-02T/, "").replace(/Z\s+/, "  ");
    box.prepend(div);
    while (box.children.length > 14) box.lastChild.remove();
  };
  for (let k = 0; k < 10; k++) add();
  TICKER = setInterval(() => { if (!$("#view-home").classList.contains("active")) return; add(); }, reduced ? 4000 : 1300);
}

document.addEventListener("DOMContentLoaded", () => {
  $("#newSession")?.addEventListener("click", async () => {
    if (!confirm("Start a fresh session? The current session log is archived (kept, not deleted).")) return;
    const r = await api("/api/session/new", { method: "POST" });
    loadCommand();
    alert(r.archived ? `Archived to ${r.archived}` : "Nothing to archive yet.");
  });
});

/* ============================================================ 03 POLICY INTELLIGENCE */
async function loadPolicy() {
  const d = await api("/api/decisions");
  S.decisions = d.decisions;
  const sel = d.decisions.find((x) => x.id === S.policySel) || d.decisions[0];
  $("#policy").innerHTML = `
    <div class="pol-grid">
      <div class="panel"><div class="panel-head"><h3>Decision log</h3><span class="small muted">${d.decisions.length} this session</span></div>
        <div class="dec-list">${d.decisions.length ? d.decisions.map((x) => `
          <button class="dec-item" data-id="${esc(x.id)}" aria-pressed="${sel && x.id === sel.id}">
            <span class="mono small muted">${esc(x.id)} · ${esc(x.ts.slice(11))}</span>
            <span class="case-t">${twoLine(x.title, x.title)}</span>
            <span>${verdictBadge(x.verdict)} <span class="badge ${x.variant === "malicious" ? "b-crit" : "b-good"}">${x.variant === "malicious" ? "attack" : "clean"}</span></span>
          </button>`).join("") : '<p class="muted" style="padding:14px">No decisions yet. Run a case in the attack simulator.</p>'}</div></div>
      <div id="decCard">${sel ? decisionCard(sel) : '<div class="panel empty"><h3>No decision selected</h3><p>Run a case in the simulator; its decision card appears here.</p></div>'}</div>
    </div>
    <h3 class="sec-title">Rules in force</h3>
    <div class="rules-grid">${d.rules.map(ruleCard).join("")}</div>`;
  $$(".dec-item").forEach((b) => b.addEventListener("click", () => {
    S.policySel = b.dataset.id;
    $$(".dec-item").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#decCard").innerHTML = decisionCard(S.decisions.find((x) => x.id === b.dataset.id));
    bindCard();
  }));
  $$(".rule-sc").forEach((b) => b.addEventListener("click", () => goSim(b.dataset.sid)));
  bindCard();
}

function evidenceRows(claims) {
  const by = {};
  claims.forEach((c) => (by[c.type] ||= []).push(c));
  const rank = { contradicted: 3, unverified: 2, verified: 1 };
  return Object.entries(by).map(([t, cs]) => {
    const worst = cs.slice().sort((a, b) => rank[b.verification] - rank[a.verification])[0];
    const [w, cls] = PLAIN.claim[worst.verification];
    return `<div class="ev-row"><span>${esc(CLAIM_TYPE[t] || t)}</span><span class="badge ${cls}"><span class="dot"></span>${w}</span>
      <span class="muted small">${esc(worst.evidence)}</span></div>`;
  }).join("") || '<p class="muted small">No claims to check in this message.</p>';
}

function decisionCard(d) {
  const [vt, vx] = PLAIN.verdict[d.verdict];
  const main = d.citations.find((c) => c.rule_id === d.rule_id) || d.citations[0];
  const reason = (d.reasons.find((x) => x.startsWith(d.rule_id)) || d.reasons[0] || "").replace(/^[^:]+:\s*(ALLOW|BLOCK|ESCALATE)\s*-\s*/, "");
  const matches = d.acceptable?.length ? (d.acceptable.includes(d.verdict) ? '<span class="badge b-good">matches answer key</span>' : '<span class="badge b-crit">differs from answer key</span>') : "";
  return `<div class="panel dcard">
    <div class="dcard-head">
      <div><div class="eyebrow">Policy decision</div><h3 class="mono">#${esc(d.id)}</h3>
        ${plainTitle(d.title) ? `<p class="dcard-plain">${esc(plainTitle(d.title))}</p>` : ""}
        <p class="muted small" style="margin:2px 0 0">${glossText(d.title)} · ${esc(d.ts)} UTC · ${esc(d.mode)}</p></div>
      <div class="big-verdict v-${esc(d.verdict)}">${ICON[d.verdict]}${esc(vt.toUpperCase())}</div>
    </div>
    <div class="dcard-body">
      <section><h4>Requested action</h4><p>${plainAction(d.proposal)}${d.proposal.claimed_authority ? ` <span class="muted">(claims to act for ${esc(d.proposal.claimed_authority)})</span>` : ""}</p>
        <p class="muted small">Without the trust layer this would have been <b style="color:${d.variant === "malicious" ? "var(--critical)" : "inherit"}">executed</b> with no check.</p></section>
      <section><h4>Applicable policy</h4>
        ${d.rule_id === "NONE" ? `<p>${esc(PLAIN.rule.NONE)}</p>` : `<p class="rule-plain">${esc(PLAIN.rule[d.rule_id] || main?.rule || "")}</p>
        <div class="cite"><b>${esc(main?.instrument || "")}</b><br>${esc(main?.provision || "")}</div>
        <p style="margin-top:6px">${main?.status === "verified" ? '<span class="badge b-good">citation verified</span>' : '<span class="badge b-info">citation: first pass, legal check in progress</span>'}</p>`}</section>
      <section><h4>Evidence verification</h4><div class="ev-table">${evidenceRows(d.claims)}</div></section>
      <section class="enforce"><h4>Enforcement decision</h4>
        <div class="enf ${d.verdict}"><b>${esc(d.verdict === "BLOCK" ? "BLOCK ACTION" : d.verdict === "ESCALATE" ? "HOLD FOR HUMAN APPROVAL" : "ALLOW ACTION")}</b>
          <span>${esc(vx)}</span><span class="small">Reason: ${esc(reason)}</span>
          ${d.requires_human ? `<span class="small">Who may approve: ${esc(d.authority)}</span>` : ""}</div>
        ${matches}</section>
      <details class="why"><summary>Why was this ${d.verdict === "ALLOW" ? "allowed" : d.verdict === "BLOCK" ? "blocked" : "paused"}?</summary>
        <p class="small" style="color:var(--text-2);margin:8px 0 0">Every rule that applied, with its legal source. The strictest result wins.</p>
        ${d.reasons.map((x) => `<div class="mono small" style="margin-top:6px;color:var(--text-2)">${esc(x)}</div>`).join("")}
        ${d.citations.map((c) => `<div class="rule-box"><div style="display:flex;justify-content:space-between;gap:8px"><span class="rid">${esc(c.rule_id)}</span>
          ${c.status === "verified" ? '<span class="badge b-good">verified</span>' : '<span class="badge b-info">first pass</span>'}</div>
          <p><b>Rule (as coded):</b> ${esc(c.rule)}${c.otherwise ? ` Otherwise: <b>${esc(c.otherwise)}</b>.` : ""}</p>
          <div class="cite"><b>${esc(c.instrument)}</b><br>${esc(c.provision)}</div>
          ${c.checked_by ? `<p class="small muted">Checked: ${esc(c.checked_by)}</p>` : ""}</div>`).join("")}
        <h4 style="margin:12px 0 4px;font-size:12px;color:var(--text-2)">All claims checked</h4>
        <ul class="claims">${d.claims.map((c) => `<li><div>${statusBadge(c.verification)}</div><div><div class="ctext">${esc(c.source)} ${esc(c.text)}</div><div class="cev">${esc(c.evidence)}</div></div></li>`).join("") || "<li>none</li>"}</ul>
        <p class="small muted" style="margin-top:10px">Audit references: decision <span class="hash mono">${esc((d.decision_hash || "").slice(0, 20))}…</span>,
          card <span class="hash mono">${esc(d.audit_ref.slice(0, 20))}…</span>
          · <a href="#" class="to-audit">open the audit log</a> · <a href="#" class="to-agents" data-id="${esc(d.id)}">see who took part</a></p>
      </details>
      <p class="footnote">Decision generated by deterministic policy rules (trustlayer/rulechecker.py). The language model never authorises an action.</p>
    </div></div>`;
}
function bindCard() {
  $$(".to-audit").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); show("audit"); }));
  $$(".to-agents").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); goAgents(a.dataset.id); }));
}

function ruleCard(r) {
  return `<div class="panel rule-card">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><span class="rid mono">${esc(r.id)}</span>
      ${r.status === "verified" ? '<span class="badge b-good">verified</span>' : '<span class="badge b-info">draft: first pass</span>'}</div>
    <p class="rule-plain" style="margin:8px 0">${esc(PLAIN.rule[r.id] || r.rule)}</p>
    <p class="small muted" style="margin:0 0 8px">Applies to: ${r.applies_to.map((a) => esc(PLAIN.action[a] || a)).join(", ")}${r.otherwise ? ` · otherwise ${esc(r.otherwise)}` : ""}${r.escalate_if ? ` · escalate if ${esc(r.escalate_if)}` : ""}</p>
    <div class="cite"><b>${esc(r.instrument)}</b><br>${esc(r.provision)}</div>
    <p class="small muted" style="margin:8px 0 4px">Tested by these cases (click to run):</p>
    <div class="variants" style="margin:0">${r.scenarios.map((s) => `<button class="rule-sc" data-sid="${esc(s)}">${esc(s)}</button>`).join("")}</div>
  </div>`;
}

/* ============================================================ 04 AGENT ACTIVITY */
async function loadAgents() {
  const d = await api("/api/agents");
  S.roster = d.roster; S.runs = d.runs;
  const run = d.runs.find((r) => r.card.id === S.agentRun) || d.runs[0];
  $("#agents").innerHTML = `
    <div class="ag-grid">
      <div>
        <div class="panel"><div class="panel-head"><h3>Who takes part</h3><span class="small muted">click to highlight</span></div>
          <div class="roster">${d.roster.map(rosterCard).join("")}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Activity timeline</h3>
          ${d.runs.length ? `<select id="runSel" class="sel">${d.runs.map((r) => `<option value="${esc(r.card.id)}" ${run && r.card.id === run.card.id ? "selected" : ""}>${esc(r.card.id)} · ${esc(r.card.title)}</option>`).join("")}</select>` : ""}</div>
        <div class="panel-body" id="timeline">${run ? timelineHTML(run) : '<p class="muted">No activity yet. Run a case in the attack simulator.</p>'}</div>
      </div>
    </div>`;
  $("#runSel")?.addEventListener("change", (e) => { S.agentRun = e.target.value; $("#timeline").innerHTML = timelineHTML(S.runs.find((r) => r.card.id === e.target.value)); applyAgentFilter(); });
  $$(".ros").forEach((b) => b.addEventListener("click", () => { S.agentFilter = S.agentFilter === b.dataset.agent ? null : b.dataset.agent; applyAgentFilter(); }));
  applyAgentFilter();
}

function rosterCard(a) {
  return `<button class="ros" data-agent="${esc(a.id)}">
    <div class="ros-top"><b>${esc(a.name)}</b>${kindBadge(a.kind)}</div>
    <div class="ros-m">${esc(a.mandate)}</div>
    <dl class="kv small">
      <dt>Tools</dt><dd>${a.tools.map(esc).join("; ")}</dd>
      <dt>Can act alone</dt><dd>No</dd>
      ${a.registered ? `<dt>Registered channel</dt><dd class="mono">agent:${esc(a.id)}</dd>` : ""}
      ${a.may_approve.length ? `<dt>May approve</dt><dd>${a.may_approve.map((x) => esc(x.replaceAll("_", " "))).join(", ")}</dd>` : ""}
      <dt>Signed messages</dt><dd class="muted">${esc(a.signature)}</dd>
    </dl></button>`;
}

function timelineHTML(run) {
  const E = run.entries, card = run.card;
  const iBase = E.findIndex((e) => e.event === "decision" && e.actor === "none");
  const kept = E.filter((e, k) => !(k > 0 && k <= iBase) && e.event !== "decision_card");
  const steps = [];
  for (const e of kept) {
    const p = e.payload;
    if (e.event === "quarantine") steps.push({ actor: "quarantine-reader", e, title: "Read the incoming text in isolation",
      body: `Withheld the free text. Passed on ${p.claims.length} claim(s) instead.${p.flags.length ? ` Flagged: ${[...new Set(p.flags.map((f) => PLAIN.flag[f.rule] || f.rule))].map(esc).join(", ")}.` : ""}${Object.keys(p.withheld_ids || {}).length ? ` Replaced ${Object.keys(p.withheld_ids).length} unrecorded ID(s) with placeholders.` : ""}` });
    else if (e.event === "event_released") steps.push({ actor: "scenario-controller", e, title: "Delivered a message to the operations agent",
      body: `Message <span class="mono">${esc(p.item)}</span> from <span class="mono">${esc(p.source)}</span> (${esc(PLAIN.channel[p.channel] || p.channel)}). Its text is stored encrypted, referenced by fingerprint.` });
    else if (e.event === "decision" && e.actor === "rule-checker") {
      steps.push({ actor: "ops-agent", e: null, title: "Proposed an action",
        body: `${plainAction(card.proposal)}${card.mode === "live" ? "" : ' <span class="muted small">(test case: assumes the agent was fooled into proposing it)</span>'}` });
      steps.push({ actor: "rule-checker", e, title: `Decided: ${PLAIN.verdict[p.verdict][0]}`,
        body: `Checked ${p.claims.length} claim(s) against the records (${["contradicted", "unverified", "verified"].map((s) => [s, p.claims.filter((c) => c.status === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${PLAIN.claim[s][0].toLowerCase()}`).join(", ") || "none"}). Rule <span class="mono">${esc(p.rule)}</span>. ${verdictBadge(p.verdict)}` });
    } else if (e.event === "opinion") steps.push({ actor: e.actor, e, title: `Gave an opinion: ${esc(p.position)}`,
      body: p.model === "fake" ? `Searched the legal knowledge base (${(p.retrieved || []).length} passages). Offline, its position mirrors the rule-checker; switch on Live AI for its own reading.`
        : `${esc(p.reason)}<br><span class="muted small">Cites: ${p.citations?.length ? esc(p.citations[0].instrument + ", " + p.citations[0].provision) : p.cite_valid === false ? "invalid citation (not a retrieved passage), recorded as invalid" : "none"} · ${esc(p.model)}</span>` });
    else if (e.event === "live_agents") steps.push({ actor: "ops-agent", e, title: "Live AI: what the model actually proposed",
      body: `Reading the raw text: ${plainAction(p.raw_proposal)}.<br>Reading the quarantined view: ${plainAction(p.protected_proposal)} → ${verdictBadge(p.protected_verdict)}` });
  }
  const cardE = E.find((e) => e.event === "decision_card");
  steps.push({ actor: "audit", e: cardE, title: "Sealed the record", body: `Decision card <span class="mono">${esc(card.id)}</span> written. Every step above is chained by hash.` });
  return `<p class="small muted" style="margin:0 0 12px">${esc(card.title)} · ${esc(run.ts)} UTC · ${card.variant === "malicious" ? "attack" : "clean case"} · ${esc(card.mode)}
      · <a href="#" class="to-policy" data-id="${esc(card.id)}">open decision card</a></p>
    <ol class="tl">${steps.map((s) => `<li class="tl-step" data-actor="${esc(s.actor)}">
      <div class="tl-dot ${s.actor === "rule-checker" ? "rc" : ["tdra-agent", "cyber-agent", "data-office-agent", "ops-agent"].includes(s.actor) ? "ai" : ""}"></div>
      <div class="tl-body"><div class="tl-head"><b>${esc(ACTOR_NAME[s.actor] || s.actor)}</b><span class="muted small mono">${s.e ? `#${s.e.n} · ${esc(s.e.ts.slice(11, 19))} · ${esc(s.e.hash.slice(0, 12))}…` : "from the decision record"}</span></div>
      <div class="tl-title">${s.title}</div><div class="tl-text">${s.body}</div></div></li>`).join("")}</ol>`;
}

function applyAgentFilter() {
  const f = S.agentFilter;
  $$(".ros").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.agent === f)));
  $$(".tl-step").forEach((li) => li.classList.toggle("dim", !!f && li.dataset.actor !== f));
  $$(".to-policy").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); goPolicy(a.dataset.id); }));
}
