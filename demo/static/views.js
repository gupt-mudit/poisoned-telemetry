"use strict";
/* Story-ordered screens (v4): Home, the story cards on "Watch it happen", "How decisions are made", the session
   history drawer, and the Proof sub-navigation. Builds on the helpers in app.js, screens.js, story.js and
   report.js; all data comes from the local API. Loaded after app.js. */

/* ------------------------------------------------------------ headline numbers (recorded runs only) */
function headline() {
  const o = S.overview || {}, ms = o.exp1?.models || [];
  const get = (m, s) => m && m.setups.find((x) => x.setup === s);
  const g = ms.find((m) => m.model === "gpt-4.1"), mini = ms.find((m) => m.model === "gpt-4.1-mini");
  const h = o.exp2?.holdout;
  return {
    fooled: foolRange(),
    wrapped: [get(g, "wrapped"), get(mini, "wrapped")].filter(Boolean).map(frac).join(" and ") || "n/a",
    stopped: h ? frac(h.malicious_stopped.protected) : "n/a",
    falseBlocks: h ? frac(h.clean_false_blocks.protected) : "n/a",
  };
}

/* ------------------------------------------------------------ home: the picture */
const ARCH = {
  today: [["Message", "anyone can write it", "SRC · C", "k-src"], ["AI agent", "HolmesGPT", "M", "k-ai"], ["Action", "does what the text says", "SINK", "k-bad"]],
  ours: [["Message", "anyone can write it", "SRC · C", "k-src"], ["Quarantine", "holds back the free text", "PP", "k-trust"],
         ["Fact-check", "against the operator's records", "PP", "k-trust"], ["AI agent", "HolmesGPT", "M", "k-ai"],
         ["Rule-checker", "plain code that cites UAE law", "P", "k-trust"], ["Outcome", "stop, pause for a person, or allow", "D · SINK", "k-ok"]],
};
const ITU_NAMES = { SRC: "source", C: "collector", PP: "preprocessor", M: "model", P: "policy", D: "distributor", SINK: "recipient" };

function lane(items) {
  return `<div class="lane">${items.map(([t, s, itu, k], i) => `${i ? '<span class="arrow" aria-hidden="true">→</span>' : ""}
    <div class="box ${k}"><span class="itu">${itu}</span><b>${esc(t)}</b><small>${esc(s)}</small></div>`).join("")}</div>`;
}

async function loadHome() {
  const n = headline();
  let c = null;
  try { c = await api("/api/command"); } catch (e) { /* the story still renders without session data */ }
  const s = c?.session;
  const seal = !c || c.audit.ok === null ? ["no entries yet", "b-mute"] : c.audit.ok ? ["intact", "b-good"] : ["broken", "b-crit"];
  $("#home").innerHTML = `
    <section class="hero">
      <p class="kicker">ITU AI for Good Sandbox Hackathon (UAE) · Team Cybershield</p>
      <h2>Can one planted sentence take over an AI that helps run a network?</h2>
      <p class="lede">Imagine a bank assistant who does whatever a letter says, as long as the letter claims <i>“the manager approved it”</i>.
        AI agents that help run telecom networks have the same weakness: they read alarms and help-desk tickets, and anyone can write a ticket.</p>
      <div class="hero-cta">
        <button class="btn btn-primary btn-lg" id="hWatch">Watch it happen</button>
        <button class="btn btn-lg" id="hTour">Take the 2-minute tour</button>
      </div>
    </section>

    <section class="numbers" aria-label="Headline results">
      <div><b>${esc(n.fooled)}</b><span>of attacks fooled a real AI agent with no protection</span></div>
      <div><b>${esc(n.wrapped)}</b><span>attacks fooled it with our trust layer (two AI models)</span></div>
      <div><b>${esc(n.stopped)}</b><span>harmful actions stopped in a blind test (${esc(n.falseBlocks)} normal requests wrongly held)</span></div>
    </section>

    <section class="panel arch" id="archPanel">
      <div class="arch-head">
        <h3>How it works</h3>
        <div class="seg" id="archView" role="group" aria-label="Picture view">
          <button aria-pressed="true" data-v="plain">Plain view</button>
          <button aria-pressed="false" data-v="itu">ITU-T Y.3172 view</button>
        </div>
      </div>
      <p class="lane-label bad-l">Today: the message goes straight to the AI, and the AI acts on it</p>
      ${lane(ARCH.today)}
      <p class="lane-label good-l">With our trust layer: only checked facts reach the AI, and plain code decides</p>
      ${lane(ARCH.ours)}
      <div class="auditbar"><span class="itu">all steps</span><b>Audit log</b> every step is sealed into a tamper-evident chain that anyone can verify</div>
      <p class="itu-note">ITU-T Y.3172 is the ITU's blueprint for machine learning in networks: data flows from a source (SRC) and collector (C)
        through a preprocessor (PP) to the model (M), then a policy step (P) before results reach their recipient (SINK). We use the
        preprocessor as the security boundary and the policy step as the only path to action.</p>
    </section>

    <section class="explain">
      <div class="panel ex"><h3>The AI agent we tested</h3>
        <p><b>HolmesGPT</b> is a real, open-source AI that investigates network and cloud problems (a CNCF Sandbox project).
          We did not change it. We only changed what it reads, and checked what it is allowed to do.</p></div>
      <div class="panel ex"><h3>Who decides</h3>
        <p>Never the AI. Four rules in plain code, each tied to UAE law (TDRA regulation, the telecom law, the data protection
          law), decide every action. AI advisers for the regulator, the cyber authority and the data office give cited opinions.</p></div>
      <div class="panel ex"><h3>What judges can check</h3>
        <p>Run any attack, or write your own. Every run ends with an incident report, a regulator view and a sealed audit
          record. All numbers come from recorded runs.</p></div>
    </section>

    <details class="panel session">
      <summary><b>This session</b>
        <span class="muted">${s ? `${s.runs} case(s) run · ${s.blocked} stopped · ${s.escalated} paused for a person · audit log <span class="badge ${seal[1]}">${seal[0]}</span>` : "no session data"}</span></summary>
      <div class="session-body">
        <div class="cc-grid">
          <div>${c ? bigTopo(c.network.nodes) : ""}<p class="small muted">The test network: a synthetic incident (failing optics on router PE-07).
            Hover the dotted terms on other screens for plain explanations.</p></div>
          <div><div class="small muted" style="margin-bottom:6px">Network messages, replayed</div><div class="ticker" id="ticker"></div></div>
        </div>
        <div class="btn-row"><button class="btn" id="newSession" title="Archive this session's log (it is kept, not deleted) and start a fresh one">Start a new session</button></div>
      </div>
    </details>`;
  $("#hWatch").addEventListener("click", () => show("sim"));
  $("#hTour").addEventListener("click", () => startTour());
  $$("#archView button").forEach((b) => b.addEventListener("click", () => {
    $$("#archView button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#archPanel").classList.toggle("itu-on", b.dataset.v === "itu");
  }));
  $("#newSession").addEventListener("click", async () => {
    if (!confirm("Start a fresh session? The current session log is archived (kept, not deleted).")) return;
    const r = await api("/api/session/new", { method: "POST" });
    alert(r.archived ? `Archived to ${r.archived}` : "Nothing to archive yet.");
    loadHome(); refreshHistoryCount();
  });
  if (c) startTicker(c.network.log);
}
/* old name, still used by a few handlers */
function loadCommand() { return loadHome(); }

/* ------------------------------------------------------------ watch it happen: story cards */
const FEATURED = [
  ["S1-M", "attack", "A fake maintenance note hides a real problem", "A note says a network fault is planned work, so the alarm can be switched off."],
  ["S2-M", "attack", "Someone tries to get customer data sent outside", "A ticket asks for customer records to go to an outside e-mail address."],
  ["S3-M", "attack", "A fake order “from the regulator”", "A ticket pretends the telecom regulator ordered safety rules to be switched off."],
  ["S4-M", "attack", "A fake emergency to skip approval", "Someone pretends to be the control-room manager and demands an urgent, risky change."],
  ["S1-C", "normal", "A real maintenance job", "Normal work: a genuine, approved job. It should go through."],
];
function renderStories() {
  $("#stories").innerHTML = FEATURED.map(([id, kind, t, d]) => `
    <button class="story-card ${kind}" data-sid="${id}" aria-pressed="false">
      <span class="badge ${kind === "attack" ? "b-crit" : "b-good"}">${kind === "attack" ? "attack" : "normal request"}</span>
      <b>${esc(t)}</b><span>${esc(d)}</span></button>`).join("");
  $$(".story-card").forEach((b) => b.addEventListener("click", () => goSim(b.dataset.sid)));
}
function goSim(sid, kase = "base") {
  show("sim");
  $$("#library [data-sid]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.sid === sid && x.dataset.case === kase)));
  $$(".story-card").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.sid === sid && kase === "base")));
  return runSim({ scenario: sid, case: kase });
}
/* keep the history count in step with every run */
const _runSim = runSim;
runSim = async function (body) { const r = await _runSim(body); refreshHistoryCount(); return r; };

/* ------------------------------------------------------------ how decisions are made */
const FORCE_LEGEND = [
  ["law", "Passed by the state: the telecom law, the data protection law (PDPL)."],
  ["regulation", "Binding rules from a regulator: the TDRA Information Assurance Regulation."],
  ["licence condition", "Conditions in the operator's TDRA licence."],
  ["guidance", "Official guidance that explains a rule; informative, not binding."],
  ["principle", "High-level commitments, such as the UAE AI Charter."],
  ["operator policy", "The operator's own procedures, which we label separately and never present as law."],
];
async function loadRules() {
  const [d, a] = await Promise.all([api("/api/decisions"), api("/api/agents").catch(() => ({ roster: [] }))]);
  const decs = d.decisions, cited = decs.filter((x) => x.rule_id && x.rule_id !== "NONE");
  const forces = {};
  cited.forEach((x) => (x.citations || []).forEach((c) => forceTags(c.instrument || "").forEach((t) => (forces[t] = (forces[t] || 0) + 1))));
  const tryCase = (r) => r.scenarios.find((s) => /-M$|^S\d-M/.test(s)) || r.scenarios[0];
  $("#rules").innerHTML = `
    <ol class="steps3">
      <li><span class="ov-n">1</span><div><b>The AI proposes</b><span>one action, e.g. “silence the alarm”. It cannot carry anything out itself.</span></div></li>
      <li><span class="ov-n">2</span><div><b>Plain code checks the rules</b><span>using only facts verified against the operator's records. If rules disagree, the strictest wins: stop, then pause, then allow.</span></div></li>
      <li><span class="ov-n">3</span><div><b>A person approves anything unclear</b><span>paused actions wait for the named approver from the mandate register.</span></div></li>
    </ol>

    <div class="panel coverage">
      <div><b>${cited.length} of ${decs.length}</b><span>decisions in this session were checked against a rule tied to UAE law${decs.length - cited.length ? ` (the rest had no rule restricting them, so they were allowed and logged)` : ""}</span></div>
      <div class="cov-tags">${Object.entries(forces).map(([k, v]) => `<span class="badge b-mute">${esc(k)} · ${v}</span>`).join(" ") || '<span class="muted small">Run a case to fill this in.</span>'}</div>
    </div>

    <h3 class="sec-title">The four rules</h3>
    <div class="rules-grid">${d.rules.map((r) => `
      <div class="panel rule2">
        <div class="rule2-top"><span class="badge ${r.status === "verified" ? "b-good" : "b-info"}">${r.status === "verified" ? "citation verified" : "citation: first pass"}</span>
          <span class="mono small muted">${esc(r.id)}</span></div>
        <p class="rule2-plain">${esc(PLAIN.rule[r.id] || r.rule)}</p>
        <p class="small muted">Applies when the AI proposes to: ${r.applies_to.map((x) => esc((PLAIN.action[x] || x).toLowerCase())).join(", ")}.</p>
        <p class="rule2-law"><b>Based on:</b> ${esc(r.instrument)}</p>
        <p class="rule2-tags">${forceTags(r.instrument).map((t) => `<span class="badge b-mute">${esc(t)}</span>`).join(" ")}</p>
        <details class="rule2-more"><summary>Exact provisions</summary><p class="small">${esc(r.provision)}</p></details>
        <div class="btn-row"><button class="btn rule-try" data-sid="${esc(tryCase(r))}">Try it: run ${esc(tryCase(r))}</button>
          <span class="small muted">tested by ${r.scenarios.length} case(s)</span></div>
      </div>`).join("")}</div>

    <h3 class="sec-title">What “legal force” means</h3>
    <div class="force-grid">${FORCE_LEGEND.map(([k, v]) => `<div><span class="badge b-mute">${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}</div>

    <h3 class="sec-title">Who decides, who advises</h3>
    <div class="roster2">${(a.roster || []).map((x) => `
      <div class="panel ros2"><div class="ros-top"><b>${esc(x.name)}</b>${kindBadge(x.kind)}</div>
        <p class="small">${esc(x.mandate)}</p><p class="small muted">Can act alone: no${x.registered ? ` · official channel: <span class="mono">agent:${esc(x.id)}</span>` : ""}</p></div>`).join("")}</div>`;
  $$(".rule-try").forEach((b) => b.addEventListener("click", () => goSim(b.dataset.sid)));
}

/* ------------------------------------------------------------ session history and the side panel */
function openDrawer(title, html) {
  $("#drawerTitle").innerHTML = title;
  $("#drawerBody").innerHTML = html;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#drawerClose").focus();
}
async function refreshHistoryCount() {
  try { const d = await api("/api/decisions"); S.decisions = d.decisions; $("#historyCount").textContent = d.decisions.length || ""; }
  catch (e) { /* counter is optional */ }
}
async function openHistory() {
  const d = await api("/api/decisions");
  S.decisions = d.decisions;
  openDrawer("This session", d.decisions.length ? `<p class="small muted" style="margin-top:0">Every decision made in this session, newest first. Open one for its full decision card.</p>
    <div class="hist">${d.decisions.map((x) => `<button class="hist-row" data-id="${esc(x.id)}">
      <span class="case-t">${twoLine(x.title, x.title)}</span>
      <span class="hist-meta">${verdictBadge(x.verdict)}<span class="mono small muted">${esc(x.id)} · ${esc(x.ts.slice(11, 16))}</span></span></button>`).join("")}</div>`
    : '<p class="muted">No decisions yet. Run a story on “Watch it happen”.</p>');
  $$(".hist-row").forEach((b) => b.addEventListener("click", () => openDecision(b.dataset.id)));
}
async function openDecision(id) {
  if (!S.decisions || !S.decisions.find((x) => x.id === id)) S.decisions = (await api("/api/decisions")).decisions;
  const d = S.decisions.find((x) => x.id === id) || S.decisions[0];
  if (!d) return openHistory();
  openDrawer(`Decision #${esc(d.id)}`, `<p style="margin-top:0"><a href="#" id="toHist">← All decisions</a></p>${decisionCard(d)}`);
  $("#toHist").addEventListener("click", (e) => { e.preventDefault(); openHistory(); });
  bindCard();
}
async function openAgents(id) {
  const d = await api("/api/agents");
  S.roster = d.roster; S.runs = d.runs;
  const run = d.runs.find((r) => r.card.id === id) || d.runs[0];
  openDrawer("Who took part", run ? timelineHTML(run) : '<p class="muted">No activity yet.</p>');
  $$(".to-policy").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openDecision(a.dataset.id); }));
}
function goPolicy(id) { openDecision(id); }
function goAgents(id) { openAgents(id); }
$("#historyBtn").addEventListener("click", openHistory);

/* ------------------------------------------------------------ proof sub-navigation */
function proofPart(id) {
  $$("#proofNav button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === id)));
  $$(".proof-part").forEach((p) => (p.hidden = p.id !== id));
}
$$("#proofNav button").forEach((b) => b.addEventListener("click", () => proofPart(b.dataset.p)));

renderStories();
refreshHistoryCount();
