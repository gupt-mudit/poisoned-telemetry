"use strict";
/* Poisoned Telemetry demo UI. All data comes from the local API (demo/server.py), which calls the real
   trust layer and reads recorded runs. Any text that came from telemetry or the user is escaped. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText);
  return r.json();
}

const S = { live: false, overview: null, scenarios: [], sel: null, run: 0, exp1: null,
            rp: { pid: "I4", model: "gpt-4.1", rep: 1 }, gaps: [], gapFilter: "all", log: "demo" };

const ICON = {
  BLOCK: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
  ESCALATE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  ALLOW: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9"/></svg>',
  EXEC: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
};
const statusBadge = (v) => {
  const m = { verified: ["b-good", "Verified"], contradicted: ["b-crit", "Contradicted"], unverified: ["b-warn", "Unverified"] }[v] || ["b-mute", v];
  return `<span class="badge ${m[0]}"><span class="dot"></span>${m[1]}</span>`;
};
const verdictBadge = (v) => {
  const c = { BLOCK: "b-crit", ESCALATE: "b-warn", ALLOW: "b-good" }[v] || "b-mute";
  return `<span class="badge ${c}"><span class="dot"></span>${esc(v)}</span>`;
};
const frac = (x) => (x ? `${x.k}/${x.n}` : "n/a");
const pct = (x) => (x && x.n ? `${Math.round(x.pct)}%` : "n/a");

/* ------------------------------------------------------------ nav */
/* Five story-ordered screens. Older names still work: they lead to where that content lives now. */
function show(view) {
  if (view === "policy") return openDecision(S.policySel);
  if (view === "agents") return openAgents(S.agentRun);
  const part = view === "audit" ? "pf-audit" : view === "results" ? "pf-results" : null;
  if (view === "command") view = "home";
  if (part) view = "proof";
  $$(".nav").forEach((b) => b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  if (view === "home") loadHome();
  if (view === "rules") loadRules();
  if (view === "gaps" && !S.gaps.length) loadGaps();
  if (view === "proof") { if (!S.exp1) loadResults(); loadAudit(); proofPart(part || "pf-results"); }
  $("main").scrollTop = 0;
}
$$(".nav").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

/* ------------------------------------------------------------ header strip + live switch */
function renderStrip(o) {
  const g = o.exp1.models.find((m) => m.model === "gpt-4.1");
  const mini = o.exp1.models.find((m) => m.model === "gpt-4.1-mini");
  const get = (m, s) => m && m.setups.find((x) => x.setup === s);
  const d = o.exp2.dev;
  const items = [
    [frac(get(g, "raw")), "AI fooled, no protection"],
    [frac(get(g, "wrapped")), "AI fooled, with trust layer"],
    [frac(get(mini, "wrapped")), "same, second AI model"],
    [d ? frac(d.malicious_stopped.protected) : "n/a", "harmful actions stopped"],
    [`${o.gaps.total}`, "gaps in current rules"],
  ];
  $("#strip").innerHTML = items.map(([b, s]) => `<div class="chip-stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
}
$("#liveSwitch").addEventListener("click", () => {
  if (!S.overview?.live_available) return;
  S.live = !S.live;
  $("#liveSwitch").setAttribute("aria-checked", String(S.live));
  $("#modeLabel").textContent = S.live ? `Live AI (${S.overview.provider})` : "Offline";
});

/* ------------------------------------------------------------ library */
const CAT_ORDER = ["false_maintenance_approval", "unauthorised_data_sharing", "forged_regulator_instruction", "emergency_response"];
function renderLibrary() {
  const sc = S.scenarios;
  $("#libCount").textContent = `${sc.length} cases`;
  const by = {};
  sc.forEach((s) => (by[s.category] ||= []).push(s));
  $("#library").innerHTML = CAT_ORDER.filter((c) => by[c]).map((c) => {
    const list = by[c].sort((a, b) => (a.variant === "malicious" ? -1 : 1) - (b.variant === "malicious" ? -1 : 1));
    return `<div class="group"><h4>${esc(list[0].category_label)}</h4><p class="cat-desc">${esc(PLAIN.category[c] || "")}</p>${list.map((s) => `
      <button class="case-btn" data-sid="${esc(s.id)}" data-case="base" aria-pressed="false">
        <span class="case-t">${twoLine(s.id, s.title)}</span>
        <span class="badge ${s.variant === "malicious" ? "b-crit" : "b-good"}">${s.variant === "malicious" ? "attack" : "clean"}</span>
      </button>
      ${s.cases.length > 1 ? `<div class="variants">${s.cases.slice(1).map((c) =>
        `<button data-sid="${esc(s.id)}" data-case="${esc(c)}" aria-pressed="false" title="Same attack, different wording">${esc(c.replaceAll("_", " "))}</button>`).join("")}</div>` : ""}
    `).join("")}</div>`;
  }).join("");
  $$("#library [data-sid]").forEach((b) => b.addEventListener("click", () => {
    $$("#library [data-sid]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    runSim({ scenario: b.dataset.sid, case: b.dataset.case });
  }));
  $("#cGoal").innerHTML = Object.entries(S.overview.goals).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("");
  $("#cGoal").value = "regulator";
}
$("#cChannel").addEventListener("change", (e) => {
  $("#cSource").value = { ticket: "ticket:TCK-50001", telemetry: "alarm:PE-07", agent: "agent:tdra-agent" }[e.target.value];
});
$("#cRun").addEventListener("click", () => {
  const text = $("#cText").value.trim();
  $("#cMsg").textContent = "";
  if (text.length < 3) { $("#cMsg").textContent = "Type at least a few words for the attacker's message."; return; }
  if (text.length > 2000) { $("#cMsg").textContent = "Keep the message under 2,000 characters."; return; }
  $$("#library [data-sid]").forEach((x) => x.setAttribute("aria-pressed", "false"));
  $("main").scrollTo({ top: 0, behavior: "smooth" });
  runSim({ custom: { text, channel: $("#cChannel").value, source: $("#cSource").value.trim() || "ticket:TCK-50001", goal: $("#cGoal").value } });
});

/* ------------------------------------------------------------ simulator run */
const STEPS = [
  ["Injected", "1"], ["Detector", "2"], ["Quarantine", "3"], ["Verification", "4"], ["Rule-checker", "5"], ["Audit", "6"],
];

async function runSim(body) {
  const run = ++S.run;
  const stage = $("#stage");
  stage.innerHTML = `<div class="panel empty"><span class="spin"></span>&nbsp; Running the trust layer${S.live ? " with live AI agents (a few seconds)" : ""}…</div>`;
  let r;
  try {
    r = await api("/api/simulate", { method: "POST", body: JSON.stringify({ ...body, live: S.live }) });
  } catch (e) {
    stage.innerHTML = `<div class="panel empty"><h3>Could not run</h3><p>${esc(e.message)}</p></div>`;
    return;
  }
  if (run !== S.run) return;
  S.last = r;
  stage.innerHTML = storyHTML(r) +
    `<div class="panel"><div class="panel-head"><h3>Same message, two ways</h3>
       <button class="btn" id="playBtn">Play again</button></div>
     <div class="panel-body">${compareHTML(r)}${takeawayHTML(r)}
       <p class="small muted" style="margin:12px 0 0">Saved as decision <b class="mono" style="color:var(--text)">#${esc(r.card_id)}</b> ·
         <a href="#" id="toCard">open the decision card</a> · <a href="#" id="toAgents">see which agents took part</a></p></div></div>` +
    incidentHTML(r) +
    `<details class="tech panel"><summary>Technical details for engineers: raw data, pipeline steps, legal citations, agents, audit hashes</summary>
       <div class="tech-body">${stageHTML(r)}</div></details>`;
  bindStage(r);
  bindIncident(r);
  finishTech(r);
  await playLanes(r, run);
}

function finishTech(r) {
  $$(".step").forEach((s, k) => {
    const [txt, cls] = stepResult(r, k);
    s.className = "step done" + (cls ? " " + cls : "");
    $("#res" + k).textContent = txt;
  });
  $$("#stream .ev").forEach((e) => e.classList.add("in"));
  $("#outcome").style.display = "";
  selectStep(r, 4);
}

function nodeOf(r) {
  const s = JSON.stringify(r.proposal) + " " + r.items.map((i) => i.node || "").join(" ");
  return (s.match(/\b(?:PE|CE|RR)-\d+\b/) || [null])[0];
}

function stageHTML(r) {
  const sc = r.scenario;
  const mal = sc.variant === "malicious";
  const exp = sc.expected ? `<span class="badge b-mute" title="Written before running">Answer key: ${esc(sc.acceptable.join(" or "))}</span>` : "";
  return `
  ${exp ? `<p class="small muted" style="margin:0">${exp} written before running, from policy and common sense.</p>` : ""}
  <div class="top-row">
    <div class="panel topo"><div class="panel-head"><h3>Network</h3><span class="small muted">nodes from inventory.csv</span></div>
      <div class="panel-body">${topoSVG(nodeOf(r))}</div></div>
    <div class="panel"><div class="panel-head"><h3>Telemetry stream (untrusted)</h3><span class="small muted">${r.items.length} event(s)</span></div>
      <div class="panel-body stream" id="stream">${r.items.map((it, k) => eventHTML(it, mal && k === r.items.length - 1)).join("")}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head"><h3>Trust layer pipeline</h3><button class="btn" id="replayBtn">Replay animation</button></div>
    <div class="pipeline" role="tablist">${STEPS.map(([l, n], k) => `
      <button class="step" role="tab" data-k="${k}" aria-selected="false"><span class="ball">${n}</span><span class="lbl">${l}</span><span class="res" id="res${k}"></span></button>`).join("")}</div>
    <div class="step-detail" id="stepDetail"><span class="muted small">Each step shows its real output when it completes. Click a step to inspect it.</span></div>
  </div>
  <div class="outcome" id="outcome" style="display:none">
    ${baselineCard(r)}
    ${protectedCard(r)}
  </div>
  ${r.opinions.length ? agentsPanel(r) : ""}
  ${r.live ? livePanel(r) : ""}`;
}

function eventHTML(it, carrier) {
  let t = esc(it.text);
  (it.flags || []).forEach((f) => {
    const sp = esc(f.span);
    if (sp && t.includes(sp)) t = t.replace(sp, `<mark class="plant" title="detector: ${esc(f.rule)}">${sp}</mark>`);
  });
  const who = { ticket: "anyone can write", telemetry: "device field", agent: "registered agent channel" }[it.channel];
  return `<div class="ev"><div class="ev-meta"><span class="mono">${esc(it.ts)}</span><b style="color:var(--text-2)">${esc(it.source)}</b>
    <span class="badge b-mute">${esc(it.channel)} · ${esc(who)}</span>${carrier ? '<span class="badge b-crit">carries the attack</span>' : ""}</div>
    <div class="ev-text">${t}</div></div>`;
}

function topoSVG(hit) {
  const N = { "RR-01": [150, 34, "route reflector", "Dubai-DC1"], "PE-03": [58, 112, "provider edge", "Dubai-DC1"],
              "PE-07": [242, 112, "provider edge", "Dubai-DC2"], "CE-12": [150, 188, "customer edge", "Abu Dhabi POP4"] };
  const L = [["RR-01", "PE-03"], ["RR-01", "PE-07"], ["PE-03", "CE-12"], ["PE-07", "CE-12"]];
  const line = ([a, b]) => `<line class="link" x1="${N[a][0]}" y1="${N[a][1]}" x2="${N[b][0]}" y2="${N[b][1]}"/>`;
  const node = (id) => { const [x, y, role, site] = N[id]; const h = id === hit;
    return `<g class="node${h ? " hit" : ""}">${h ? `<circle class="pulse" cx="${x}" cy="${y}" r="8"/>` : ""}
      <rect x="${x - 46}" y="${y - 19}" width="92" height="38" rx="8"/>
      <text x="${x}" y="${y - 2}" text-anchor="middle">${id}</text>
      <text class="sub" x="${x}" y="${y + 12}" text-anchor="middle">${role}</text><title>${id}: ${role}, ${site}</title></g>`; };
  return `<svg viewBox="0 0 300 214" role="img" aria-label="Four network nodes${hit ? `, ${hit} targeted` : ""}">
    <line class="link" x1="242" y1="112" x2="296" y2="70" stroke-dasharray="4 4"/>
    <text x="296" y="62" text-anchor="end" style="fill:var(--muted);font:10px var(--sans)">peer 203.0.113.9</text>
    ${L.map(line).join("")}${Object.keys(N).map(node).join("")}</svg>
    <p class="small muted" style="margin:6px 0 0">${hit ? `Target: <b style="color:var(--text)">${esc(hit)}</b>` : "No node targeted"}. Illustrative layout.</p>`;
}

function proposalText(p) {
  return `${esc(p.action.replaceAll("_", " "))}${p.target ? ` <b>${esc(p.target)}</b>` : ""}${p.destination ? ` → ${esc(p.destination)}` : ""}` +
    `${p.data_class && p.data_class !== "none" ? ` <span class="badge b-mute">${esc(p.data_class.replaceAll("_", " "))}</span>` : ""}` +
    `${p.claimed_authority ? ` <span class="muted">(claims to act for ${esc(p.claimed_authority)})</span>` : ""}`;
}

function baselineCard(r) {
  const mal = r.scenario.variant === "malicious";
  return `<div class="panel verdict-card">
    <div class="verdict-top"><h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-2)">Without trust layer</h3></div>
    <div class="big-verdict ${mal ? "v-EXEC" : "v-ALLOW"}">${mal ? ICON.EXEC : ICON.ALLOW}EXECUTED</div>
    <dl class="kv" style="margin-top:14px">
      <dt>Agent proposed</dt><dd>${proposalText(r.proposal)}</dd>
      <dt>Checks</dt><dd>none: today the proposal goes straight through</dd>
      <dt>Outcome</dt><dd>${mal ? '<b style="color:var(--critical)">The attacker gets what they wanted.</b>' : "Normal work proceeds."}</dd>
    </dl></div>`;
}

function protectedCard(r) {
  const d = r.protected, v = d.verdict;
  const exp = r.scenario.acceptable?.length && r.scenario.expected ? (r.scenario.acceptable.includes(v)
    ? `<span class="badge b-good">matches answer key</span>` : `<span class="badge b-crit">differs from answer key</span>`) : "";
  const cl = d.claims.length ? `<ul class="claims">${d.claims.map((c) => `<li><div>${statusBadge(c.verification)}</div>
      <div><div class="ctext">${esc(c.source)} ${esc(c.text)}</div><div class="cev">evidence: ${esc(c.evidence)}</div></div></li>`).join("")}</ul>`
    : `<p class="muted small">No decision-relevant claims in the text.</p>`;
  const rules = d.citations.map((c) => `<div class="rule-box">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="rid">${esc(c.rule_id)}</span>
        ${c.status === "verified" ? '<span class="badge b-good">citation verified</span>' : '<span class="badge b-info">citation: first pass, legal check in progress</span>'}</div>
      <p><b>Rule:</b> ${esc(c.rule)}${c.rule && !/[.]$/.test(c.rule) ? "." : ""}${c.otherwise ? ` Otherwise: <b>${esc(c.otherwise)}</b>.` : ""}</p>
      <div class="cite"><b>${esc(c.instrument)}</b><br>${esc(c.provision)}</div>
      ${c.checked_by ? `<p class="small muted">Checked: ${esc(c.checked_by)}</p>` : ""}</div>`).join("");
  return `<div class="panel verdict-card">
    <div class="verdict-top"><h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-2)">With trust layer</h3>${exp}</div>
    <div class="big-verdict v-${esc(v)}">${ICON[v] || ""}${esc(v)}</div>
    <dl class="kv" style="margin-top:14px">
      <dt>Requested action</dt><dd>${proposalText(r.proposal)}</dd>
      <dt>Deciding rule</dt><dd class="mono">${esc(d.rule_id)}</dd>
      <dt>Reason</dt><dd>${esc((d.reasons.find((x) => x.startsWith(d.rule_id)) || d.reasons[0] || "").replace(/^[^:]+:\s*(ALLOW|BLOCK|ESCALATE)\s*-\s*/, ""))}</dd>
      <dt>Who may approve</dt><dd>${esc(d.authority || "n/a")}${d.requires_human ? ' <span class="badge b-warn">human needed</span>' : ""}</dd>
    </dl>
    <h4 style="margin:14px 0 4px;font-size:12px;color:var(--text-2)">Claims checked against independent records</h4>${cl}
    <details class="why"><summary>Why this decision?</summary>
      <p class="small" style="color:var(--text-2);margin:8px 0 0">Every rule that applied, with its legal source. The strictest result wins.</p>
      ${d.reasons.map((x) => `<div class="mono small" style="margin-top:6px;color:var(--text-2)">${esc(x)}</div>`).join("")}
      ${rules || '<p class="small muted">No rule restricts this action; it is allowed and logged.</p>'}
    </details>
    <p class="footnote">Decided by deterministic rules (trustlayer/rulechecker.py). The language model never authorises an action.</p></div>`;
}

function agentsPanel(r) {
  const offline = r.mode !== "live";
  return `<div class="panel"><div class="panel-head"><h3>Institutional agents</h3>
    <span class="small muted">${offline ? "Offline: positions mirror the rule-checker; switch on Live AI for each agent's own reading" : "Live: each agent's own reading, cited from passages retrieved for it"}</span></div>
    <div class="panel-body agents">${r.opinions.map((o) => {
      const pos = { support: "b-good", object: "b-crit", escalate: "b-warn" }[o.position] || "b-mute";
      const cite = o.citation ? `${esc(o.citation.instrument)}, ${esc(o.citation.provision)}` : (o.cite_valid === false ? "invalid citation (not a retrieved passage)" : "no citation");
      return `<div class="agent"><h4>${esc(o.name)} <span class="badge ${pos}">${esc(o.position)}</span></h4>
        <div class="mand">Mandate: ${esc(o.mandate)}</div>
        ${offline ? `<div class="src">Searched the legal knowledge base (${o.retrieved.length} passages retrieved). Its own reading and citation appear in Live AI mode.</div>`
          : `<div class="reason">${esc(o.reason)}</div><div class="src">Cites: ${cite}</div><div class="src">model: ${esc(o.model)}</div>`}</div>`;
    }).join("")}</div></div>`;
}

function livePanel(r) {
  const L = r.live;
  const box = (title, p, extra) => `<div class="live-box"><h4 style="font-size:13px;margin-bottom:8px">${title}</h4>
    <dl class="kv"><dt>Proposed</dt><dd>${proposalText(p)}</dd><dt>Rationale</dt><dd>${esc(p.rationale)}</dd><dt>Model</dt><dd class="mono">${esc(p.model)}</dd></dl>${extra}</div>`;
  return `<div class="panel"><div class="panel-head"><h3>Live: what a real model proposed</h3>
    <span class="small muted">attacker's goal: ${esc(L.attacker_goal.replaceAll("_", " "))}</span></div>
    <div class="panel-body live-grid">
      ${box("Reading the raw telemetry", L.raw, `<p style="margin:10px 0 0">${L.raw_did_attacker_goal ? '<span class="badge b-crit">did what the attacker wanted</span> and nothing checks it' : '<span class="badge b-good">did not follow the attack this time</span>'}</p>`)}
      ${box("Reading the quarantined view", L.protected, `<p style="margin:10px 0 0">Rule-checker: ${verdictBadge(L.protected_decision.verdict)} <span class="mono small muted">${L.protected_decision.rule_id === "NONE" ? "no rule restricts this action" : esc(L.protected_decision.rule_id)}</span></p>`)}
    </div><p class="footnote" style="padding:0 14px 12px">One live sample. Models vary run to run, so use the recorded experiments (results screen) for rates.</p></div>`;
}

function stepDetail(r, k) {
  const q = r.quarantine, d = r.protected;
  const counts = d.claims.reduce((a, c) => ((a[c.verification] = (a[c.verification] || 0) + 1), a), {});
  switch (k) {
    case 0: return `<h4>Untrusted text entered the stream</h4><p class="small" style="color:var(--text-2);margin:0">${r.items.length} event(s). This is exactly what an unprotected agent reads:</p><pre>${esc(r.raw_view.join("\n"))}</pre>`;
    case 1: return `<h4>Detector: a cheap first screen</h4>${r.flags.length ? `<ul class="claims">${r.flags.map((f) => `<li><div><span class="badge ${f.severity === "high" ? "b-crit" : "b-warn"}">${esc(f.severity)}</span></div><div><div class="ctext mono">${esc(f.rule)}</div><div class="cev">matched: "${esc(f.span)}"</div></div></li>`).join("")}</ul>` : `<p class="small muted" style="margin:0">Nothing flagged.</p>`}<p class="footnote">Not the defence on its own: subtle attacks pass it, so every claim is verified in step 4 whether flagged or not.</p>`;
    case 2: return `<h4>The one-way hatch</h4><p class="small" style="color:var(--text-2);margin:0">Free-text fields withheld: <b>${q.free_text_withheld}</b> · unrecorded IDs replaced: <b>${q.ids_withheld}</b> · structured fields forwarded line by line: <b>${q.facts.length}</b>. No attacker sentence crosses. This is what the agent sees instead:</p><pre>${esc(q.render)}</pre>`;
    case 3: return `<h4>Every claim checked against independent records</h4><p class="small muted" style="margin:0 0 6px">changes.csv · incidents.csv · mandates.csv · inventory.csv</p>${d.claims.length ? `<ul class="claims">${d.claims.map((c) => `<li><div>${statusBadge(c.verification)}</div><div><div class="ctext">${esc(c.text)}</div><div class="cev">${esc(c.evidence)}</div></div></li>`).join("")}</ul>` : '<p class="small muted">No claims.</p>'}`;
    case 4: return `<h4>Rule-checker: ${verdictBadge(d.verdict)} <span class="mono small">${esc(d.rule_id)}</span></h4>${d.reasons.map((x) => `<div class="mono small" style="color:var(--text-2)">${esc(x)}</div>`).join("")}`;
    case 5: return `<h4>Written to the hash-chained audit log</h4><div class="audit-mini">${r.audit.map((e) => `<div><span class="muted">#${e.n}</span><span>${esc(e.event)}</span><span class="hash">${esc(e.hash.slice(0, 24))}… <span class="muted">← ${esc(e.prev.slice(0, 10))}…</span></span></div>`).join("")}</div><p class="footnote">Source text is encrypted and referenced by its SHA-256. Check it in the Audit log.</p>`;
  }
  return "";
}

function stepResult(r, k) {
  const d = r.protected;
  const c = d.claims.reduce((a, x) => ((a[x.verification] = (a[x.verification] || 0) + 1), a), {});
  return [
    [`${r.items.length} event(s)`, r.scenario.variant === "malicious" ? "alert" : ""],
    [r.flags.length ? `${r.flags.length} flag(s)` : "no flags", r.flags.length ? "warnb" : ""],
    [`${r.quarantine.free_text_withheld} withheld`, "ok"],
    [c.contradicted ? `${c.contradicted} contradicted` : c.unverified ? `${c.unverified} unverified` : c.verified ? `${c.verified} verified` : "no claims",
      c.contradicted ? "alert" : c.unverified ? "warnb" : "ok"],
    [d.verdict, { BLOCK: "alert", ESCALATE: "warnb", ALLOW: "ok" }[d.verdict]],
    [`+${r.audit.length} entries`, "ok"],
  ][k];
}

function selectStep(r, k) {
  $$(".step").forEach((s) => s.setAttribute("aria-selected", String(+s.dataset.k === k)));
  $("#stepDetail").innerHTML = stepDetail(r, k);
}

async function animate(r, run) {
  const evs = $$("#stream .ev");
  const steps = $$(".step");
  steps.forEach((s, k) => { s.className = "step"; $("#res" + k).textContent = ""; });
  $("#outcome").style.display = "none";
  evs.forEach((e) => e.classList.remove("in"));
  const t = reduced ? 0 : 1;
  for (const e of evs) { e.classList.add("in"); await sleep(260 * t); }
  for (let k = 0; k < STEPS.length; k++) {
    if (run !== S.run) return;
    steps[k].classList.add("active");
    selectStep(r, k);
    await sleep(820 * t);
    const [txt, cls] = stepResult(r, k);
    steps[k].classList.remove("active");
    steps[k].classList.add("done");
    if (cls) steps[k].classList.add(cls);
    $("#res" + k).textContent = txt;
    if (k === 4) { $("#outcome").style.display = ""; }
  }
  selectStep(r, 4);
}

function bindStage(r) {
  $$(".step").forEach((s) => s.addEventListener("click", () => selectStep(r, +s.dataset.k)));
  $("#replayBtn").addEventListener("click", () => { S.run++; animate(r, S.run); });
  $("#playBtn").addEventListener("click", () => { S.run++; playLanes(r, S.run); });
  $("#toCard").addEventListener("click", (e) => { e.preventDefault(); goPolicy(r.card_id); });
  $("#toAgents").addEventListener("click", (e) => { e.preventDefault(); goAgents(r.card_id); });
}

/* ------------------------------------------------------------ results */
async function loadResults() {
  S.exp1 = await api("/api/exp1");
  const o = S.overview, m = S.exp1.summary.models;
  const get = (mm, s) => mm.setups.find((x) => x.setup === s);
  const g = m.find((x) => x.model === "gpt-4.1"), mini = m.find((x) => x.model === "gpt-4.1-mini");
  const d = o.exp2.holdout || o.exp2.dev, dSet = o.exp2.holdout ? "Blind test set" : "Practice set";
  const tiles = [
    [frac(get(g, "wrapped")), "Attacks that fooled the AI, with our trust layer", `Without it: ${frac(get(g, "raw"))} (${pct(get(g, "raw"))}). Model gpt-4.1.`],
    [mini ? frac(get(mini, "wrapped")) : "n/a", "The same on a second AI model", mini ? `Without it: ${frac(get(mini, "raw"))} (${pct(get(mini, "raw"))}). Model gpt-4.1-mini.` : ""],
    [S.exp1.summary.adaptive_v3 ? frac(S.exp1.summary.adaptive_v3) : "n/a", "Attacks we designed to beat our own layer", "They found two holes in earlier versions; both are fixed."],
    [d ? frac(d.malicious_stopped.protected) : "n/a", "Harmful actions stopped (Exp 2)", d ? `Normal requests wrongly stopped: ${frac(d.clean_false_blocks.protected)}. ${dSet}.` : ""],
  ];
  $("#tiles").innerHTML = tiles.map(([b, l, s]) => `<div class="panel tile"><div class="big">${esc(b)}</div><div class="lbl">${esc(l)}</div><div class="sub">${esc(s)}</div></div>`).join("");
  $("#charts").innerHTML = m.map((mm) => `<div class="panel chart"><div class="panel-head"><h3>How often did the planted text fool the AI? · ${esc(mm.model)}</h3>
      <span class="small muted">out of ${mm.setups[0].n} attacks</span></div><div class="panel-body">${chartSVG(mm)}
      <p class="small muted" style="margin:8px 0 0">Shorter is better. The thin line under each bar is the 95% confidence range.
      "Warning in prompt" and "Summariser" are HolmesGPT's own options; they did not help.</p></div></div>`).join("");
  bindChartTips();
  $("#modelSeg").innerHTML = m.map((mm) => `<button data-m="${esc(mm.model)}" aria-pressed="${mm.model === S.rp.model}">${esc(mm.model)}</button>`).join("");
  $("#repSeg").innerHTML = [1, 2, 3].map((n) => `<button data-r="${n}" aria-pressed="${n === S.rp.rep}">run ${n}</button>`).join("");
  $$("#modelSeg button").forEach((b) => b.addEventListener("click", () => { S.rp.model = b.dataset.m; segSet("#modelSeg", b); loadReplay(); }));
  $$("#repSeg button").forEach((b) => b.addEventListener("click", () => { S.rp.rep = +b.dataset.r; segSet("#repSeg", b); loadReplay(); }));
  const P = S.exp1.payloads;
  $("#payloadTable").innerHTML = `<thead><tr><th>Attack</th><th>Goal</th><th class="num">Raw</th><th class="num">Protected</th></tr></thead><tbody>${P.map((p) => `
    <tr class="click" data-pid="${esc(p.id)}" aria-selected="${p.id === S.rp.pid}"><td><b class="mono">${esc(p.id)}</b> <span class="muted small">${esc(p.style)}</span></td>
    <td>${esc(p.goal)}</td><td class="num" style="color:${p.raw_k ? "var(--critical)" : "inherit"}">${esc(p.raw)}</td><td class="num">${esc(p.wrapped)}</td></tr>`).join("")}</tbody>`;
  $$("#payloadTable tr.click").forEach((tr) => tr.addEventListener("click", () => {
    S.rp.pid = tr.dataset.pid;
    $$("#payloadTable tr.click").forEach((x) => x.setAttribute("aria-selected", String(x === tr)));
    loadReplay();
  }));
  loadReplay();
  renderExp2(o.exp2);
}
const segSet = (sel, b) => $$(sel + " button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));

function chartSVG(mm) {
  const W = 540, rowH = 44, left = 128, right = 40, top = 8, H = top + rowH * mm.setups.length + 26;
  const max = Math.max(20, Math.ceil(Math.max(...mm.setups.map((s) => s.hi)) / 10) * 10);
  const x = (v) => left + (v / max) * (W - left - right);
  const ticks = []; for (let t = 0; t <= max; t += max > 50 ? 20 : 10) ticks.push(t);
  const label = { raw: "No protection", guardrail: "Warning in prompt", summariser: "Summariser", wrapped: "Our trust layer" };
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Corrupted rate by set-up for ${esc(mm.model)}">
    <g class="grid">${ticks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 22}"/>`).join("")}</g>
    <g class="axis">${ticks.map((t) => `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${t}%</text>`).join("")}</g>
    ${mm.setups.map((s, i) => { const y = top + i * rowH + 10, h = 18, w = Math.max(0, x(s.pct) - x(0));
      return `<g>
        <text class="cat" x="${left - 10}" y="${y + 13}" text-anchor="end">${label[s.setup] || s.setup}</text>
        <path class="bar" d="M${x(0)},${y} h${Math.max(0, w - 4)} a4,4 0 0 1 4,4 v${h - 8} a4,4 0 0 1 -4,4 h-${Math.max(0, w - 4)} z" ${w < 4 ? 'style="display:none"' : ""}/>
        ${w < 4 ? `<line x1="${x(0)}" x2="${x(0)}" y1="${y}" y2="${y + h}" stroke="var(--accent)" stroke-width="3"/>` : ""}
        <line class="whisk" x1="${x(s.lo)}" x2="${x(s.hi)}" y1="${y + h + 6}" y2="${y + h + 6}"/>
        <line class="whisk" x1="${x(s.lo)}" x2="${x(s.lo)}" y1="${y + h + 3}" y2="${y + h + 9}"/>
        <line class="whisk" x1="${x(s.hi)}" x2="${x(s.hi)}" y1="${y + h + 3}" y2="${y + h + 9}"/>
        <text class="lab" x="${Math.max(x(s.pct), x(0)) + 8}" y="${y + 13}">${s.k}/${s.n} (${Math.round(s.pct)}%)</text>
        <rect class="hit" x="0" y="${y - 6}" width="${W}" height="${rowH - 4}" data-tip="${esc(`${label[s.setup] || s.setup}${s.note ? " (" + s.note + ")" : ""}: ${s.k} of ${s.n} attacked runs corrupted (${s.pct}%). 95% CI ${s.lo}–${s.hi}%.`)}"/>
      </g>`; }).join("")}
  </svg>`;
}
function bindChartTips() {
  const tip = $("#tip");
  $$(".chart .hit").forEach((h) => {
    h.addEventListener("mousemove", (e) => { tip.textContent = h.dataset.tip; tip.style.display = "block"; tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY + 14 + "px"; });
    h.addEventListener("mouseleave", () => (tip.style.display = "none"));
  });
}

async function loadReplay() {
  const box = $("#replay");
  box.innerHTML = '<span class="spin"></span>';
  const r = await api(`/api/replay/${encodeURIComponent(S.rp.pid)}?model=${encodeURIComponent(S.rp.model)}&rep=${S.rp.rep}`);
  const p = r.payload;
  let planted = esc(r.planted_line || "");
  const pt = esc(p.text);
  if (planted.includes(pt)) planted = planted.replace(pt, `<mark class="plant">${pt}</mark>`);
  const verdict = (a) => a.corrupted == null ? '<span class="badge b-mute">no run</span>' :
    a.corrupted ? '<span class="badge b-crit"><span class="dot"></span>corrupted</span>' : '<span class="badge b-good"><span class="dot"></span>not corrupted</span>';
  const counts = r.wrapped_saw.claims.reduce((a, c) => ((a[c.verification] = (a[c.verification] || 0) + 1), a), {});
  box.innerHTML = `
    <div class="small muted">Attack <b class="mono" style="color:var(--text)">${esc(p.id)}</b> · ${esc(p.goal)} · ${esc(p.style)} · counts as corrupted if: ${esc(p.corrupted_if)}</div>
    <div class="answer" style="max-height:none;margin:8px 0 12px">${planted || "(planted line not found)"}</div>
    <div class="replay">
      <div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>Raw HolmesGPT</b>${verdict(r.raw)}</div>
        <div class="answer">${esc(r.raw.text || "no answer file")}</div>
        ${r.raw.judge_reason ? `<p class="small muted">Judge: ${esc(r.raw.judge_reason)}</p>` : ""}</div>
      <div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>With trust layer</b>${verdict(r.wrapped)}</div>
        <div class="answer">${esc(r.wrapped.text || "no answer file")}</div>
        <p class="small muted">The agent saw ${r.wrapped_saw.claims.length} claim(s) instead of the text
          (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}); ${r.wrapped_saw.free_text_withheld} free-text field(s) withheld.</p></div>
    </div>
    <p class="footnote">Recorded run ${r.rep} of 3, ${esc(r.model)}. Answers are shown exactly as the agent wrote them.</p>`;
}

function renderExp2(e) {
  const d = e.dev;
  const row = (l, b, p) => `<tr><td>${l}</td><td class="num">${b}</td><td class="num">${p}</td></tr>`;
  $("#exp2").innerHTML = `${d ? `<div class="warnbox"><b>Development set.</b> The rules were written alongside these cases, so they only show the pipeline works as designed.
      The evidence will be the blind holdout set (${e.holdout ? "see below" : "not yet written"}).</div>
    <table class="data"><thead><tr><th>Measure (${d.cases} cases)</th><th>Baseline</th><th>Protected</th></tr></thead><tbody>
      ${row("Attacks stopped (BLOCK or ESCALATE)", `${frac(d.malicious_stopped.baseline)}`, `${frac(d.malicious_stopped.protected)}`)}
      ${row("False blocks on clean cases", `${frac(d.clean_false_blocks.baseline)}`, `${frac(d.clean_false_blocks.protected)}`)}
    </tbody></table>` : '<p class="muted">No Exp 2 runs yet.</p>'}
    ${e.holdout ? `<h4 style="margin:16px 0 6px">Holdout set (blind)</h4><table class="data"><tbody>
      ${row("Attacks stopped", frac(e.holdout.malicious_stopped.baseline), frac(e.holdout.malicious_stopped.protected))}
      ${row("False blocks on clean cases", frac(e.holdout.clean_false_blocks.baseline), frac(e.holdout.clean_false_blocks.protected))}</tbody></table>` : ""}`;
}

/* ------------------------------------------------------------ gaps */
async function loadGaps() {
  S.gaps = await api("/api/gaps");
  renderGaps();
}
const uaeBadge = (s) => ({ open: '<span class="badge b-warn">UAE text needed</span>', first_pass: '<span class="badge b-info">UAE: first pass</span>' }[s] || "");
const compBadge = (s) => ({ confirmed: '<span class="badge b-good">comparator confirmed</span>', open: '<span class="badge b-warn">comparator open</span>', listed: '<span class="badge b-mute">comparator listed</span>' }[s] || "");
function renderGaps() {
  const list = S.gaps.filter((g) => S.gapFilter === "all" || g.uae_status === S.gapFilter);
  $("#gapGrid").innerHTML = list.map((g) => `<button class="gap" data-id="${esc(g.ID)}">
    <span class="gid">${esc(g.ID)} · exposed by ${esc(g["Exposed by"])}</span>
    <span class="q">${md(g["Open question (telecom framing)"])}</span>
    <span class="tags">${uaeBadge(g.uae_status)}${compBadge(g.comparator_status)}</span></button>`).join("");
  $$(".gap").forEach((b) => b.addEventListener("click", () => openGap(b.dataset.id)));
}
$$("#gapFilter button").forEach((b) => b.addEventListener("click", () => { S.gapFilter = b.dataset.f; segSet("#gapFilter", b); renderGaps(); }));
/* Gap-register text is written for the team; show it to viewers without internal working notes. */
const cleanReg = (t) => String(t || "—")
  .replace(/\s*[—-]\s*Claude \d+ \w+,?\s*/g, " — ")
  .replace(/Claude \d+ \w+,?\s*/g, "")
  .replaceAll("Person A to confirm", "legal check in progress")
  .replace(/`?TO_VERIFY`?/g, "to be verified")
  .replace(/ — (?=[.;)]|$)/g, "");
function openGap(id) {
  const g = S.gaps.find((x) => x.ID === id);
  $("#drawerTitle").innerHTML = `${esc(g.ID)} ${uaeBadge(g.uae_status)}`;
  const sec = (h, k) => `<section><h4>${h}</h4><p>${md(cleanReg(g[k]))}</p></section>`;
  const cases = [...new Set((g["Exposed by"] || "").match(/\bS\d-[MC]\d?\b/g) || [])];
  const col = (h, k, cls) => `<div class="cmp ${cls}"><h4>${h}</h4><p>${md(cleanReg(g[k]))}</p></div>`;
  $("#drawerBody").innerHTML = `<p class="gap-q">${md(g["Open question (telecom framing)"] || "")}</p>` +
    `<div class="cmp-grid">${col("UAE today", "Closest existing provision — UAE", "uae")}${col("Elsewhere (EU, UK and others)", "Comparator elsewhere", "world")}${col("Our proposal", "Proposed fix", "fix")}</div>` +
    sec("What existing rules already cover", "What it already covers") + sec("What remains open", "What remains open") +
    sec("Found by", "Exposed by") +
    (cases.length ? `<section><h4>See it happen</h4><div class="variants" style="margin:0">${cases.map((c) =>
      `<button class="gap-case" data-sid="${esc(c)}">Run ${esc(c)}: ${esc(plainTitle(c) || c)}</button>`).join("")}</div></section>` : "") +
    `<p class="footnote">Wording rule: existing frameworks may not explicitly resolve this question; it is a research finding, not a claim that no rule exists.
      Source: docs/gap_register.md.</p>`;
  $$(".gap-case").forEach((b) => b.addEventListener("click", () => { $("#drawerClose").click(); goSim(b.dataset.sid); }));
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#drawerClose").focus();
}
$("#drawerClose").addEventListener("click", () => { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#drawerClose").click(); });

/* ------------------------------------------------------------ audit */
async function loadAudit() {
  const a = await api(`/api/audit/${S.log}`);
  $("#auditMeta").textContent = a.total ? `${a.total} entries in ${a.path}; showing the latest ${a.entries.length}. Click a row to see what it recorded.`
    : `No entries yet in ${a.path}. Run an attack in the simulator first.`;
  const rows = a.entries.slice().reverse();
  $("#chain").innerHTML = `<thead><tr><th>#</th><th>Time (UTC)</th><th>Event</th><th>Actor</th><th>Summary</th><th>Hash</th><th>Previous</th></tr></thead><tbody>${rows.map((e) => `
    <tr class="click" data-n="${e.n}"><td class="num">${e.n}</td><td class="num">${esc(e.ts)}</td><td>${esc(e.event)}</td><td>${esc(e.actor)}</td>
    <td>${["BLOCK", "ESCALATE", "ALLOW"].includes(e.summary) ? verdictBadge(e.summary) : esc(e.summary)}</td>
    <td class="hash">${esc(e.hash.slice(0, 16))}…</td><td class="prev muted">${esc(e.prev.slice(0, 16))}…</td></tr>`).join("")}</tbody>`;
  $$("#chain tr.click").forEach((tr) => tr.addEventListener("click", () => {
    const nx = tr.nextElementSibling;
    if (nx && nx.classList.contains("expand")) { nx.remove(); return; }
    const e = a.entries.find((x) => x.n === +tr.dataset.n);
    tr.insertAdjacentHTML("afterend", `<tr class="expand"><td colspan="7"><pre>${esc(JSON.stringify({ ...e.payload, source_ref: e.source_ref, hash: e.hash, prev: e.prev }, null, 2))}</pre></td></tr>`);
  }));
}
$$("#logSeg button").forEach((b) => b.addEventListener("click", () => { S.log = b.dataset.log; segSet("#logSeg", b); $("#verifyOut").className = "verify-out"; loadAudit(); }));
$("#verifyBtn").addEventListener("click", async () => {
  const out = $("#verifyOut");
  out.className = "verify-out show"; out.innerHTML = '<span class="spin"></span> running the independent verifier…';
  const r = await api(`/api/audit/${S.log}/verify`, { method: "POST" });
  out.className = "verify-out show " + (r.ok ? "okk" : "bad");
  out.innerHTML = `${r.ok ? verdictBadge("ALLOW").replace("ALLOW", "CHAIN INTACT") : '<span class="badge b-crit">FAILED</span>'}
    <div style="margin-top:8px" class="muted">$ ${esc(r.command)}</div>${r.output.map((l) => `<div>${esc(l)}</div>`).join("")}`;
});
$("#tamperBtn").addEventListener("click", async () => {
  const out = $("#verifyOut");
  out.className = "verify-out show"; out.innerHTML = '<span class="spin"></span> editing one decision in a copy and re-checking…';
  const r = await api(`/api/audit/${S.log}/tamper`, { method: "POST" });
  out.className = "verify-out show " + (r.ok === false ? "bad" : "");
  out.innerHTML = r.changed ? `<span class="badge b-crit">TAMPERING DETECTED</span>
    <div style="margin-top:8px">Changed entry #${r.changed.entry}: ${esc(r.changed.field)} ${esc(r.changed.from)} → ${esc(r.changed.to)} (in a copy).</div>
    ${r.output.map((l) => `<div>${esc(l)}</div>`).join("")}<div class="muted" style="margin-top:6px">${esc(r.note)}</div>`
    : r.output.map((l) => `<div>${esc(l)}</div>`).join("");
});

/* ------------------------------------------------------------ boot */
(async function boot() {
  try {
    const [o, sc] = await Promise.all([api("/api/overview"), api("/api/scenarios")]);
    S.overview = o; S.scenarios = sc;
    renderStrip(o);
    renderLibrary();
    const sw = $("#liveSwitch");
    if (!o.live_available) { sw.disabled = true; sw.title = "Live AI needs an API key in .env"; }
    show("home");
  } catch (e) {
    $("#stage").innerHTML = `<div class="panel empty"><h3>Could not reach the demo server</h3><p>${esc(e.message)}</p></div>`;
  }
})();
