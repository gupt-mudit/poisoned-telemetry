"use strict";
/* Guided tour: a caption bar that walks a first-time viewer through the story in ten steps, moving between
   screens and running one real attack. Every step uses the live demo; nothing is a recording. */

const tourScroll = (sel, block = "start") => { const el = $(sel); if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block }); };
const waitFor = async (sel, ms = 12000) => { const t0 = Date.now(); while (!$(sel) && Date.now() - t0 < ms) await sleep(150); return $(sel); };

const TOUR = [
  { text: "AI agents now help run telecom networks. They read alarms and help-desk tickets, and anyone can write a ticket. So one planted sentence can give the AI orders.",
    go: async () => { show("home"); } },
  { text: "Top row: today the message goes straight to the AI, and the AI acts on it. Bottom row: with our trust layer, free text is held back, every claim is fact-checked, and plain code that cites UAE law decides.",
    go: async () => { if ($("#view-home:not(.active)")) show("home"); await waitFor("#archPanel"); tourScroll("#archPanel", "center"); } },
  { text: "Let's watch an attack. A note inside a network alarm falsely claims a real fault is planned maintenance, so the alarm can be switched off.",
    go: async () => { await goSim("S1-M"); tourScroll("#stage .story"); } },
  { text: "Same message, two ways. Left: today's AI silences the alarm and the real fault stays hidden. Right: the claim is checked against the change log, it is false, and the rule stops the action.",
    go: async () => { await waitFor("#compare"); tourScroll("#compare [data-row='4']", "center"); } },
  { text: "Every run ends with an incident report: what happened, what was malicious, what the trust layer did, and which UAE law applied.",
    go: async () => { await waitFor("#incident"); tourScroll("#incident"); } },
  { text: "The regulator view: who must be told, how fast under UAE rules compared with the EU, the provable detection time from the audit log, and a draft notice for a person to send.",
    go: async () => { await waitFor("#incident"); const b = $(".ir-tabs [data-v='irReg']"); if (b) b.click(); tourScroll("#incident"); } },
  { text: "The AI never decides. Four rules in plain code, each tied to UAE law and labelled by legal force, make every decision. A person approves anything unclear.",
    go: async () => { show("rules"); } },
  { text: "Where today's rules don't clearly answer, we name the gap, compare the UAE with the EU and the UK, and propose a fix to the right authority and to ITU.",
    go: async () => { show("gaps"); } },
  { text: "And the proof: with the trust layer, 0 of 72 attacks fooled the AI on two models, 20 of 20 harmful actions were stopped in a blind test, and every step is in an audit log anyone can verify.",
    go: async () => { show("proof"); } },
  { text: "Now try it yourself: type your own attack message and see whether it gets through.",
    go: async () => { show("sim"); const d = $("details.custom"); if (d) d.open = true; tourScroll(".library"); $("#cText")?.focus(); } },
];

let tourAt = -1, tourBusy = false;
async function tourGo(i) {
  if (tourBusy) return;
  tourBusy = true;
  tourAt = Math.max(0, Math.min(TOUR.length - 1, i));
  $("#tourStep").textContent = `Step ${tourAt + 1} of ${TOUR.length}`;
  $("#tourText").textContent = TOUR[tourAt].text;
  $("#tourBack").disabled = tourAt === 0;
  $("#tourNext").textContent = tourAt === TOUR.length - 1 ? "Finish" : "Next";
  $("#tourNext").disabled = true;
  try { await TOUR[tourAt].go(); } catch (e) { /* a step that cannot run still shows its caption */ }
  $("#tourNext").disabled = false;
  tourBusy = false;
}
function startTour() { $("#tour").hidden = false; document.body.classList.add("touring"); tourGo(0); }
function endTour() { $("#tour").hidden = true; document.body.classList.remove("touring"); tourAt = -1; }

$("#tourBtn").addEventListener("click", startTour);
$("#tourNext").addEventListener("click", () => (tourAt >= TOUR.length - 1 ? endTour() : tourGo(tourAt + 1)));
$("#tourBack").addEventListener("click", () => tourGo(tourAt - 1));
$("#tourExit").addEventListener("click", endTour);
document.addEventListener("keydown", (e) => {
  if ($("#tour").hidden) return;
  if (e.key === "Escape" && !$("#drawer").classList.contains("open")) endTour();
});
