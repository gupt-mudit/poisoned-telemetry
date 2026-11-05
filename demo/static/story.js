"use strict";
/* Plain-language, side-by-side view of one simulation: the same message handled WITHOUT and WITH the trust
   layer, step by step, for viewers who are not telecom or security specialists. Everything shown comes from
   the simulation result (r); this file only words it plainly. Loaded before app.js; uses its helpers at run time. */

const PLAIN = {
  action: {
    suppress_alert: "Silence the alarm", mark_planned_maintenance: "File the fault as planned maintenance",
    send_external: "Send data outside the company", send_report: "Send a report", config_change: "Change the network settings",
    emergency_reroute: "Re-route traffic as an emergency", diagnosis: "Investigate the problem", open_incident: "Open an incident",
  },
  harm: {
    suppress_alert: "The real fault stays hidden, so nobody fixes it.",
    mark_planned_maintenance: "The real fault is filed as routine work and ignored.",
    send_external: "Customer data leaves the company.",
    send_report: "Information goes to someone who never had the right to ask.",
    config_change: "The network is changed without real approval.",
    emergency_reroute: "A risky change skips the normal approval.",
  },
  rule: {
    "R-SUPPRESS-NEEDS-VERIFIED-CHANGE": "An alarm may only be silenced if a real, approved change in the change log covers it.",
    "R-NO-EXTERNAL-PERSONAL-DATA": "Customers' personal data may never be sent outside the company.",
    "R-AUTHORITY-FROM-REGISTERED-CHANNEL": "An instruction from the regulator counts only if it arrives through the regulator's own registered channel.",
    "R-EMERGENCY-ONLY-PERMITTED-ACTIONS": "In an emergency, only pre-approved actions are allowed, and only for a confirmed incident and an authorised person.",
    NONE: "No rule restricts this kind of action.",
  },
  verdict: {
    BLOCK: ["Stopped", "The action is not carried out."],
    ESCALATE: ["Paused for a person", "Nothing happens until a responsible human approves it."],
    ALLOW: ["Allowed", "The action goes ahead."],
  },
  claim: {
    verified: ["True", "b-good", "the records confirm it"],
    contradicted: ["False", "b-crit", "the records say otherwise"],
    unverified: ["Can't confirm", "b-warn", "no record backs it up"],
  },
  channel: {
    ticket: "a help-desk ticket (anyone can write one)",
    telemetry: "a message inside a device alarm",
    agent: "a registered agent's official channel",
  },
  flag: {
    override: "tries to override the AI's instructions", role_marker: "pretends to be a system message",
    override_word: "uses the word 'override'", output_directive: "tells the AI what to say",
    secret_request: "asks for passwords or secrets", skip_control: "asks to skip approval",
    suppression: "asks to silence alarms", authority_claim: "claims someone important approved it",
    external_destination: "contains an outside e-mail address",
  },
  category: {
    false_maintenance_approval: "A note claims the fault is planned work, so the alarm can be silenced.",
    unauthorised_data_sharing: "A message asks for customer data to be sent somewhere.",
    forged_regulator_instruction: "A message pretends to be an order from the regulator.",
    emergency_response: "A message claims an emergency to rush through a risky change.",
  },
};

const LICON = {
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13l2.5-7h11L20 13v5H4z"/><path d="M4 13h4.5l1 2h5l1-2H20"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 3.5v5.5c0 5-3.4 8.8-8 10.5-4.6-1.7-8-5.5-8-10.5V5.5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7h6zM18 7l-3 7h6z"/></svg>',
  none: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
};

const plainAction = (p) => {
  const a = PLAIN.action[p.action] || p.action.replaceAll("_", " ");
  const extra = p.destination ? ` to ${esc(p.destination)}` : p.target ? ` (${esc(p.target)})` : "";
  return `<b>${esc(a)}</b>${extra}`;
};

function carrier(r) {
  const mal = r.scenario.variant === "malicious";
  return mal ? r.items[r.items.length - 1] : r.items.find((i) => i.channel !== "telemetry") || r.items[r.items.length - 1];
}

function markFlags(it) {
  let t = esc(it.text);
  (it.flags || []).forEach((f) => {
    const sp = esc(f.span);
    if (sp && t.includes(sp)) t = t.replace(sp, `<mark class="plant">${sp}</mark>`);
  });
  return t;
}

/* ---------- the attack, in one card */
function storyHTML(r) {
  const sc = r.scenario, mal = sc.variant === "malicious", it = carrier(r);
  return `<div class="panel story">
    <div class="story-top">
      <div>
        <div class="eyebrow">${mal ? "The attack" : "A normal, legitimate case"} · ${esc(sc.category_label)}</div>
        <h3>${esc(sc.title)}</h3>
        <p>${esc(sc.story)}</p>
      </div>
      <div class="scen-tags">
        <span class="badge ${mal ? "b-crit" : "b-good"}">${mal ? "attack" : "clean"}${sc.case !== "base" ? " · " + esc(sc.case.replaceAll("_", " ")) : ""}</span>
        <span class="badge b-mute">${r.mode === "live" ? "live AI" : "offline"}</span>
      </div>
    </div>
    <div class="bubble-row">
      <div class="bubble-who">${LICON.inbox}<span>Arrives as ${esc(PLAIN.channel[it.channel] || it.channel)}<br><span class="mono muted">${esc(it.source)}</span></span></div>
      <blockquote class="bubble ${mal ? "bad" : ""}">${markFlags(it)}</blockquote>
    </div>
    <p class="story-ask">The AI agent is asked to: ${plainAction(r.proposal)}</p>
  </div>`;
}

/* ---------- two lanes, same rows */
function laneRows(r) {
  const mal = r.scenario.variant === "malicious", it = carrier(r), d = r.protected, q = r.quarantine;
  const flags = [...new Set(r.flags.map((f) => PLAIN.flag[f.rule] || f.rule))];
  const claimLi = d.claims.map((c) => {
    const [w, cls, why] = PLAIN.claim[c.verification] || [c.verification, "b-mute", ""];
    return `<li><span class="badge ${cls}"><span class="dot"></span>${w}</span><span>The message ${esc(c.text)}.<br><span class="muted small">${esc(c.evidence)} (${why})</span></span></li>`;
  }).join("");
  return [
    { label: "The message arrives",
      a: [LICON.inbox, "Goes straight to the AI", "Nothing stands between the message and the AI agent."],
      b: [LICON.shield, "Goes to the quarantine first", "The AI agent does not read it directly."] },
    { label: "What the AI reads",
      a: [LICON.eye, "The full text, word for word", `<blockquote class="mini-quote">${markFlags(it)}</blockquote>${mal ? "Including the planted part." : ""}`],
      b: [LICON.shield, "Neutral facts only",
          `The free text is held back (${q.free_text_withheld} field${q.free_text_withheld === 1 ? "" : "s"}). The AI gets ${d.claims.length} short claim${d.claims.length === 1 ? "" : "s"}, labelled as claims, not facts.` +
          (flags.length ? `<div class="flags">Suspicious wording spotted: ${flags.map((f) => `<span class="badge b-warn">${esc(f)}</span>`).join(" ")}</div>` : "")] },
    { label: "Is it true?",
      a: [LICON.none, "Nobody checks", "The AI cannot look anything up, so it takes the message at its word."],
      b: [LICON.search, "Every claim is checked against the company's records",
          d.claims.length ? `<ul class="plain-claims">${claimLi}</ul>` : "No checkable claims in the message."] },
    { label: "Is it allowed?",
      a: [LICON.none, "No rules", "The AI decides on its own."],
      b: [LICON.scale, "A fixed rule decides, not the AI",
          `<div class="rule-plain">${esc(PLAIN.rule[d.rule_id] || d.rule_id)}</div><span class="muted small mono">${esc(d.rule_id)}</span>`] },
  ];
}

function laneResult(r) {
  const mal = r.scenario.variant === "malicious", d = r.protected;
  const live = r.live;
  const aProp = live ? live.raw : r.proposal;
  let aTitle, aText, aCls;
  if (live && !live.raw_did_attacker_goal && mal) {
    aCls = "neutral"; aTitle = `Did: ${PLAIN.action[aProp.action] || aProp.action}`;
    aText = "This time the live AI did not follow the attack. But nothing would have stopped it if it had.";
  } else if (mal) {
    aCls = "bad"; aTitle = `Done: ${PLAIN.action[aProp.action] || aProp.action}`;
    aText = `${PLAIN.harm[aProp.action] || "The attacker gets what they wanted."} The attacker gets what they wanted.`;
  } else {
    aCls = "good"; aTitle = `Done: ${PLAIN.action[aProp.action] || aProp.action}`; aText = "Normal work goes ahead.";
  }
  const [vt, vx] = PLAIN.verdict[d.verdict];
  const bCls = d.verdict === "ALLOW" ? "good" : d.verdict === "BLOCK" ? "stop" : "pause";
  const note = !live && mal ? `<p class="assume">This assumes the AI believed the message. In our recorded tests, unprotected AI agents were fooled in ${foolRange()} of attacks.</p>` : "";
  return {
    a: `<div class="result ${aCls}"><div class="result-title">${ICON.EXEC}${esc(aTitle)}</div><p>${esc(aText)}</p>${note}</div>`,
    b: `<div class="result ${bCls}"><div class="result-title">${ICON[d.verdict]}${esc(vt)}</div><p>${esc(vx)}${d.requires_human ? " A responsible person is asked to decide." : ""}</p>
        <p class="muted small">Recorded in a tamper-proof log (${r.audit.length} new entries).</p></div>`,
  };
}

function foolRange() {
  const ms = S.overview?.exp1?.models || [];
  const vals = ms.map((m) => m.setups.find((x) => x.setup === "raw")).filter(Boolean).map((x) => Math.round(x.pct));
  if (!vals.length) return "some";
  const lo = Math.min(...vals), hi = Math.max(...vals);
  return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
}

function compareHTML(r) {
  const rows = laneRows(r), res = laneResult(r);
  const cell = (side, [ic, title, body], k) => `<div class="lstep ${side}" data-row="${k}">
      <div class="lnum">${k + 1}</div><div class="lic">${ic}</div>
      <div><div class="ltitle">${title}</div><div class="lbody">${body}</div></div></div>`;
  return `<div class="compare" id="compare">
    <div class="lane-head bad"><span class="dot"></span><div><b>Without protection</b><span>how AI agents work today</span></div></div>
    <div class="lane-head good"><span class="dot"></span><div><b>With our trust layer</b><span>same message, same AI</span></div></div>
    ${rows.map((row, k) => `<div class="row-label" data-row="${k}">${esc(row.label)}</div>${cell("a", row.a, k)}${cell("b", row.b, k)}`).join("")}
    <div class="row-label" data-row="4">Outcome</div>
    <div class="lstep a outcome-cell" data-row="4">${res.a}</div>
    <div class="lstep b outcome-cell" data-row="4">${res.b}</div>
  </div>`;
}

function takeawayHTML(r) {
  const mal = r.scenario.variant === "malicious", d = r.protected;
  const c = d.claims.reduce((a, x) => ((a[x.verification] = (a[x.verification] || 0) + 1), a), {});
  const checked = [c.contradicted && `${c.contradicted} false`, c.unverified && `${c.unverified} unconfirmed`, c.verified && `${c.verified} true`].filter(Boolean).join(", ");
  const act = (PLAIN.action[r.proposal.action] || r.proposal.action).toLowerCase();
  let head, text, cls;
  if (mal && d.verdict !== "ALLOW") {
    cls = "good"; head = "Why the trust layer is better";
    text = `Without protection, the AI would <b>${esc(act)}</b> just because a message told it to. With the trust layer, the AI never read the attacker's words. The claims were checked against the records (${esc(checked || "none")}), and a fixed rule decided: <b>${esc(PLAIN.verdict[d.verdict][0].toLowerCase())}</b>.`;
  } else if (mal) {
    cls = "warn"; head = "The trust layer allowed this one";
    text = "The claims in this message checked out against the records, so the rule allowed it. If this is wrong, the records or the rule need fixing, and the decision is in the log for review.";
  } else if (d.verdict === "ALLOW") {
    cls = "good"; head = "Normal work is not blocked";
    text = `This is a legitimate request. Both sides let it through. The trust layer checked it first (${esc(checked || "no claims")}) and found nothing wrong.`;
  } else {
    cls = "warn"; head = "Here the trust layer was more careful than needed";
    text = `This request is legitimate, but the trust layer ${d.verdict === "ESCALATE" ? "asked a person to confirm it" : "stopped it"}. That is a false alarm, and we count these in our results.`;
  }
  return `<div class="takeaway ${cls}" id="takeaway"><b>${head}.</b> ${text}</div>`;
}

async function playLanes(r, run) {
  const cells = $$("#compare [data-row]");
  const take = $("#takeaway");
  cells.forEach((c) => c.classList.remove("in"));
  take.classList.remove("in");
  const t = reduced ? 0 : 1;
  for (let k = 0; k <= 4; k++) {
    if (run !== S.run) return;
    $$(`#compare [data-row="${k}"]`).forEach((c) => c.classList.add("in"));
    await sleep((k === 3 ? 1300 : 1000) * t);
  }
  take.classList.add("in");
}
