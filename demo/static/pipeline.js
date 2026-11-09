"use strict";
/* Per-run pipeline: the same picture as Home, but each box says what that step did to THIS message. Two lanes
   (without / with the trust layer), a "policy used" strip, the audit bar, and a detail area: click any box to
   see the full step. Replaces the long two-column comparison (compareHTML / playLanes keep their names so the
   simulator and the tour work unchanged). Every value comes from the simulation result r. */

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function pipeParts(r) {
  const mal = r.scenario.variant === "malicious", d = r.protected, q = r.quarantine, it = carrier(r), live = r.live;
  const aProp = live ? live.raw : r.proposal, bProp = live ? live.protected : r.proposal;
  const act = (p) => PLAIN.action[p.action] || p.action.replaceAll("_", " ");
  const n = (v) => d.claims.filter((c) => c.verification === v).length;
  const nFlags = new Set(r.flags.map((f) => f.rule)).size;
  const main = (d.citations || []).find((c) => c.rule_id === d.rule_id) || (d.citations || [])[0];
  const source = (PLAIN.channel[it.channel] || it.channel).replace(/ \(.*\)$/, "");
  const [vt] = PLAIN.verdict[d.verdict];
  const aBad = mal && !(live && !live.raw_did_attacker_goal);
  return { mal, d, q, it, live, aProp, bProp, act, n, nFlags, main, source, vt, aBad };
}

function compareHTML(r) {
  const P = pipeParts(r), { d, q } = P;
  const box = (k, kind, title, result, sub, seq, extra = "") =>
    `<button class="pb ${kind}" data-k="${k}" data-seq="${seq}" ${extra}><span class="pb-t">${title}</span>
       <span class="pb-r">${result}</span>${sub ? `<span class="pb-s">${sub}</span>` : ""}</button>`;
  const arrow = '<span class="pa" aria-hidden="true">→</span>';
  const msg = (k, seq) => box(k, "k-src", "Message", `from ${esc(P.source)}`, `“${esc(cut(P.it.text, 70))}”`, seq);
  const facts = [P.n("contradicted") && `<span class="chip c-bad">${P.n("contradicted")} false</span>`,
                 P.n("unverified") && `<span class="chip c-warn">${P.n("unverified")} can't confirm</span>`,
                 P.n("verified") && `<span class="chip c-ok">${P.n("verified")} true</span>`].filter(Boolean).join("") || '<span class="chip">no claims</span>';
  const vCls = d.verdict === "BLOCK" ? "k-stop" : d.verdict === "ESCALATE" ? "k-pause" : "k-ok";
  const tags = P.main ? forceTags(P.main.instrument).map((t) => `<span class="chip">${esc(t)}</span>`).join("") : "";
  const lawShort = P.main ? cut(P.main.instrument.split(";")[0].trim(), 90) : "no rule restricts this action";
  const first = r.audit[0], last = r.audit[r.audit.length - 1];
  return `<div class="pipe" id="compare">
    <p class="pl-label bad-l">Without protection: how AI agents work today</p>
    <div class="pl">
      ${msg("tm", 0)}${arrow}
      ${box("tai", "k-ai", "AI agent", "reads the full text", P.mal ? "planted part included" : "and acts on it", 1)}${arrow}
      ${box("tact", P.aBad ? "k-bad" : "k-ok", "Action", `Done: ${esc(P.act(P.aProp).toLowerCase())}`,
            P.aBad ? esc(PLAIN.harm[P.aProp.action] || "The attacker gets what they wanted.") : P.mal ? "this time the live AI did not follow it" : "normal work goes ahead", 2, 'data-row="4"')}
    </div>
    <p class="pl-label good-l">With our trust layer: same message, same AI</p>
    <div class="pl">
      ${msg("m", 3)}${arrow}
      ${box("q", "k-trust", "Quarantine", `held back ${q.free_text_withheld} text field${q.free_text_withheld === 1 ? "" : "s"}`,
            `${d.claims.length} neutral claim${d.claims.length === 1 ? "" : "s"} passed on${P.nFlags ? ` · ${P.nFlags} suspicious phrase${P.nFlags === 1 ? "" : "s"}` : ""}`, 4)}${arrow}
      ${box("f", "k-trust", "Fact-check", `<span class="chips">${facts}</span>`, "against the operator's records", 5)}${arrow}
      ${box("ai", "k-ai", "AI agent", "sees only checked claims", `proposes: ${esc(P.act(P.bProp).toLowerCase())}`, 6)}${arrow}
      ${box("rc", "k-trust k-rule", "Rule-checker", esc(cut(PLAIN.rule[d.rule_id] || d.rule_id, 60)), `<span class="chips">${tags}</span>`, 7)}${arrow}
      ${box("out", vCls, "Outcome", `${ICON[d.verdict]}<b>${esc(P.vt)}</b>`, d.requires_human ? `approval needed from: ${esc(d.authority || "a responsible person")}` : d.verdict === "ALLOW" ? "the action goes ahead" : "", 8, 'data-row="4"')}
    </div>
    <div class="policy-strip pbox-anim" data-seq="9" aria-label="Policy used">
      <span class="ps-h">Policy used</span>
      <span class="ps-i"><small>Rule</small><b class="mono">${esc(d.rule_id)}</b></span><span class="pa">→</span>
      <span class="ps-i"><small>UAE source</small><b>${esc(lawShort)}</b></span><span class="pa">→</span>
      <span class="ps-i"><small>Legal force</small><b>${tags || "—"}</b></span><span class="pa">→</span>
      <span class="ps-i"><small>Citation</small><b>${P.main?.status === "verified" ? "verified" : "first pass"}</b></span><span class="pa">→</span>
      <span class="ps-i ps-v ${vCls}"><small>Decision</small><b>${esc(P.vt)}</b></span>
    </div>
    <div class="audit-strip pbox-anim" data-seq="9"><b>Audit log</b> ${r.audit.length} entries sealed${first ? ` (#${first.n}–#${last.n}), last fingerprint <span class="mono hash">${esc(last.hash.slice(0, 12))}…</span>` : ""}</div>
    <div class="pipe-detail" id="pipeDetail"><span class="muted">Click any step above to see exactly what it did.</span></div>
  </div>`;
}

function pipeDetail(r, k) {
  const P = pipeParts(r), rows = laneRows(r), res = laneResult(r), it = P.it;
  const sec = ([, title, body]) => `<h4>${title}</h4><div>${body}</div>`;
  const D = {
    tm: ["The message", `<p>Arrives as ${esc(PLAIN.channel[it.channel] || it.channel)} <span class="mono muted">${esc(it.source)}</span>.</p><blockquote class="mini-quote">${glossHTML(markFlags(it))}</blockquote>`],
    m: ["The message", `<p>Arrives as ${esc(PLAIN.channel[it.channel] || it.channel)} <span class="mono muted">${esc(it.source)}</span>.</p><blockquote class="mini-quote">${glossHTML(markFlags(it))}</blockquote>`],
    tai: ["Without protection: the AI agent", sec(rows[1].a) + sec(rows[2].a) + sec(rows[3].a)],
    tact: ["Without protection: the outcome", res.a],
    q: ["Quarantine", sec(rows[0].b) + sec(rows[1].b)],
    f: ["Fact-check", sec(rows[2].b)],
    ai: ["The AI agent, behind the trust layer", `<p>It never sees the attacker's sentence, only the measurements and the neutral claims above.</p>
          <p>It proposes: <b>${esc(P.act(P.bProp))}</b>${P.live ? " (live AI)." : ' <span class="muted small">(offline test case: we assume it was fooled into proposing the attacker\'s action, and check whether the rules still stop it)</span>'}</p>`],
    rc: ["Rule-checker: the policy step", sec(rows[3].b) + (P.main ? `<div class="cite"><b>${esc(P.main.instrument)}</b><br>${esc(P.main.provision)}</div>` : "") +
          `<p class="small muted">If several rules apply, the strictest wins: stop, then pause for a person, then allow.</p>`],
    out: ["With the trust layer: the outcome", res.b],
  };
  const [h, body] = D[k] || ["", ""];
  return `<div class="pd-head"><b>${h}</b><button class="btn pd-close" aria-label="Close details">Close</button></div>${body}`;
}

/* Light up the steps one by one, then the policy strip and the takeaway. */
async function playLanes(r, run) {
  const boxes = $$("#compare [data-seq]").sort((a, b) => a.dataset.seq - b.dataset.seq);
  const take = $("#takeaway");
  boxes.forEach((b) => b.classList.remove("in"));
  take?.classList.remove("in");
  const t = reduced ? 0 : 1;
  let last = -1;
  for (const b of boxes) {
    if (run !== S.run) return;
    if (+b.dataset.seq !== last) await sleep((b.dataset.seq === "3" ? 700 : 420) * t);
    last = +b.dataset.seq;
    b.classList.add("in");
  }
  take?.classList.add("in");
}

/* Click a box to open its details (bound after the simulator renders). */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#compare .pb");
  if (b && S.last) {
    $$("#compare .pb").forEach((x) => x.classList.toggle("sel", x === b));
    const box = $("#pipeDetail");
    box.innerHTML = pipeDetail(S.last, b.dataset.k);
    box.classList.add("open");
    return;
  }
  if (e.target.closest && e.target.closest(".pd-close")) {
    $$("#compare .pb").forEach((x) => x.classList.remove("sel"));
    const box = $("#pipeDetail");
    box.classList.remove("open");
    box.innerHTML = '<span class="muted">Click any step above to see exactly what it did.</span>';
  }
});
