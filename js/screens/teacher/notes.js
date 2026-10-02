// Quick notes (lab "quick_notes"): record or type → one wait → the parent's email as the review → send.
import * as S from "../../store.js";
import { esc, chip, statusChip, pageHeader, empty, toast, loc, field, openAttendanceReview } from "../../ui.js";
import { fmt12, fmtDate, today } from "../../dates.js";
import { href, go } from "../../router.js";

const MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>`;
const fmtS = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const recs = {};
const blank = () => ({ secs: 0, timer: null, stage: "idle", typed: "" });
let rec = blank();

/**
 * Prototype stand-in for the AI step. It only reuses what the teacher typed and last lesson's plan, so the review
 * screen never shows things she did not say. The live app writes real prose in the family's language.
 */
function draftFrom(l, prev, typed, secs = 0) {
  const s = S.student(l.studentId); const fam = S.family(s.familyId); const zh = fam.language === "zh";
  const points = (typed ?? "").split(/\n|;|；/).map((x) => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  const base = prev?.data ? JSON.parse(JSON.stringify(prev.data)) : { repertoire: [], wentWell: [], practice: [], technique: [], nextPlan: [], uncertainties: [] };
  const first = zh ? s.name : s.name.split(" ")[0];
  base.repertoire = l.planned.length ? l.planned.map((p) => ({ piece: p, composer: null, section: null, status: "in_progress" })) : base.repertoire;
  base.message = points.length
    ? (zh ? `${first} 今天的课：${points.join("；")}。` : `${first}'s lesson today: ${points.join("; ")}.`)
    : secs ? (zh ? `（示例）${first} 今天的课堂录音已转成文字。` : `(Demo) ${first}'s voice memo, transcribed.`) : (zh ? `${first} 本周继续按下面的计划练习。` : `${first} keeps the plan below this week.`);
  base.wentWell = [];
  base.nextPlan = base.nextPlan?.length ? base.nextPlan : [];
  base.uncertainties = [
    ...(base.practice.length ? [zh ? "曲目和练习计划沿用上节课，请确认是否需要修改。" : "Pieces and the practice plan are copied from last lesson. Check they still fit."] : [zh ? "还没有练习计划，请在“Edit details”里添加。" : "No practice plan yet. Add one under Edit details."]),
    ...(zh && points.some((x) => /[a-z]{3}/i.test(x)) ? ["The live app writes this email in 中文; the prototype keeps your words as typed."] : []),
  ];
  base.totalMin = base.practice.reduce((a, p) => a + p.min, 0);
  return base;
}
/** Plain text of the parent's email, for pasting into WeChat. */
function plainText(d, s, zh, bal) {
  return [d.message, d.repertoire.length ? `${zh ? "本节课内容" : "What we worked on"}: ${d.repertoire.map((r) => r.piece).join(", ")}` : "", d.wentWell.length ? `${zh ? "做得好的地方" : "What went well"}: ${d.wentWell.join(zh ? "；" : "; ")}` : "", d.practice.length ? `${zh ? `本周练习（每天约 ${d.totalMin} 分钟）` : `Practice this week (about ${d.totalMin} min/day)`}:\n${d.practice.map((p) => `· ${p.task} — ${zh ? `每天 ${p.min} 分钟` : `${p.min} min/day`}`).join("\n")}` : "", bal].filter(Boolean).join("\n\n");
}

export function render(route) {
  const l = S.lesson(route.params.id); if (!l) return { html: empty("Lesson not found") };
  const s = S.student(l.studentId); const fam = S.family(s.familyId); const parent = S.parentsOf(fam.id)[0]; const zh = fam.language === "zh";
  const n = S.notesOf(l.id); const prev = S.previousFinalNotes(l.id); const lab = S.labOn("quick_notes");
  rec = recs[l.id] ??= blank();
  const bal = S.balance(s.id); const balText = bal.b ? (zh ? `课包：还剩 ${bal.remaining} 节（共 ${bal.total} 节）· ${bal.b.paid ? "已付款" : "待付款"}` : `Package: ${bal.text} · ${bal.b.paid ? "paid" : "payment pending"}`) : "";
  const head = pageHeader(s.name, { subtitle: `${fmtDate(l.date)} · ${fmt12(l.time)} · ${loc(l.location)} · ${statusChip(l.status)}`, back: `/lessons/${l.id}`, action: lab ? `<a class="chip chip-accent" href="${href("/settings")}">Beta · switch back</a>` : "" });
  if (!lab) return { html: head + `<div class="card p4 col"><div class="b">Notes (current six-step flow)</div><p class="muted small">The prototype does not rebuild the old page. Turn on <b>Quick notes</b> under More → Studio settings → Experimental features to try the new flow.</p><a class="btn btn-primary" href="${href("/settings")}">Open settings</a></div>` };

  const mailPreview = (d) => `<div class="mail"><div class="mh"><span>To: ${esc(parent.name)} · ${zh ? "中文" : "English"}</span><span>${esc(s.name)} · ${fmtDate(l.date, "md")}</span></div>
      <div class="sec"><h4>${zh ? "老师的话" : "Message"}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><p data-field="message">${esc(d.message)}</p></div>
      ${d.repertoire.length ? `<div class="sec"><h4>${zh ? "本节课内容" : "What we worked on"}</h4><div class="row wrap" data-field="repertoire">${d.repertoire.map((r) => chip("brand", `${r.piece}${r.composer ? " · " + r.composer : ""}${r.section ? " · " + r.section : ""}`)).join("")}</div></div>` : ""}
      <div class="sec"><h4>${zh ? "做得好的地方" : "What went well"}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><p data-field="wentWell">${d.wentWell.length ? d.wentWell.map(esc).join(zh ? "；" : "; ") : `<span class="muted">${zh ? "（可选，点 Edit 填写）" : "(optional, tap Edit)"}</span>`}</p></div>
      <div class="sec"><h4>${zh ? `本周练习 · 每天约 ${d.totalMin} 分钟` : `Practice this week · about ${d.totalMin} min/day`}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><div class="plan" data-field="practice">${d.practice.map((p) => `<div class="it"><span>${esc(p.task)}${p.tip ? `<div class="xs muted">${esc(p.tip)}</div>` : ""}</span><b>${zh ? `每天 ${p.min} 分钟` : `${p.min} min/day`}</b></div>`).join("")}</div></div>
      ${balText ? `<div class="sec"><p class="muted small">${esc(balText)}</p></div>` : ""}</div>`;

  let html = head, mount = () => {};
  if (n?.status === "final") {
    html += `<div class="note note-ok mb3">Sent to ${esc(parent.name)} ${esc(n.sentAt ?? "")}. Next lesson's plan was filled in.</div>${mailPreview(n.data)}<div class="card p3 mt3 small"><div class="muted xs">Teacher-only (not sent)</div><div><b>Next lesson:</b> ${n.data.nextPlan.map(esc).join(" · ")}</div>${n.data.uncertainties.length ? `<div class="muted">Please double-check: ${n.data.uncertainties.map(esc).join(" · ")}</div>` : ""}</div><div class="row mt3"><a class="btn btn-outline btn-sm" href="${href("/today")}">Back to Today</a><button class="btn btn-ghost btn-sm" id="copy">Copy for WeChat</button><button class="btn btn-ghost btn-sm" id="resend">Resend to parent</button></div>`;
    mount = (root) => { root.querySelector("#resend").addEventListener("click", () => { S.sendNotes(l.id); toast("Notes re-sent"); }); root.querySelector("#copy").addEventListener("click", () => { navigator.clipboard?.writeText(plainText(n.data, s, zh, balText)).catch(() => {}); toast("Copied · paste it into WeChat"); }); };
    return { html, mount };
  }
  if (rec.stage === "working") {
    const steps = rec.secs ? [`Uploading your memo (${fmtS(rec.secs)})`, "Turning your voice into text", `Writing the email in ${zh ? "中文" : "English"}`] : ["Reading your notes", `Writing the email in ${zh ? "中文" : "English"}`];
    html += `<div class="steps">${steps.map((t, i) => `<div class="step${i ? "" : " run"}" id="s${i + 1}"><i></i><span>${esc(t)}</span></div>`).join("")}</div><p class="tc muted small">Usually 20–40 seconds. You can lock the phone; the notes will be here when you return.</p>`;
    const last = steps.length; const r0 = rec;
    mount = (root) => { const here = () => location.hash.startsWith(`#/lessons/${l.id}/notes`);
      const go1 = (i) => { if (r0 !== recs[l.id]) return; if (i > last || !here()) { r0.stage = "review"; S.saveNotes(l.id, { data: draftFrom(l, prev, r0.typed, r0.secs), bullets: r0.typed ?? "", transcript: r0.secs ? `(${fmtS(r0.secs)} memo transcribed)` : null }); return; } for (let k = 1; k < i; k++) { const e = root.querySelector("#s" + k); e.className = "step done"; e.querySelector("i").textContent = "✓"; } root.querySelector("#s" + i).className = "step run"; setTimeout(() => go1(i + 1), i === last ? 1400 : 800); }; go1(1); };
    return { html, mount };
  }
  if (n?.data && (rec.stage === "review" || rec.stage === "idle")) {
    rec.stage = "review";
    html += `<p class="muted small mb2">This is the email the parent will receive. Tap Edit on a section to fix it in place.</p>${mailPreview(n.data)}
      <div class="card p3 mt3 small"><div class="muted xs">Teacher-only (not sent)</div><div><b>Next lesson:</b> ${n.data.nextPlan.map(esc).join(" · ") || "—"}</div>${n.data.uncertainties.length ? `<div class="warn">Please double-check: ${n.data.uncertainties.map(esc).join(" · ")}</div>` : ""}</div>
      <div class="row wrap mt3"><button class="btn btn-ghost btn-sm" id="revise">✨ Ask for a change…</button><button class="btn btn-ghost btn-sm" id="details">Edit details</button><button class="btn btn-ghost btn-sm" id="redo">Start over</button></div>
      <div id="details-box" class="hide card p3 mt3 col small">${field("Message to parent", `<textarea class="input" id="d-msg">${esc(n.data.message)}</textarea>`)}${field("Practice plan (one per line: task | min/day)", `<textarea class="input" id="d-plan">${esc(n.data.practice.map((p) => `${p.task} | ${p.min}`).join("\n"))}</textarea>`)}${field("Next lesson plan (one per line)", `<textarea class="input" id="d-next">${esc(n.data.nextPlan.join("\n"))}</textarea>`)}<button class="btn btn-outline btn-sm" id="d-save">Apply</button></div>
      <div class="sticky-foot grid2"><button class="btn btn-outline" id="wechat">Copy for WeChat</button><button class="btn btn-primary" id="send">${l.status === "scheduled" ? "Mark completed & send" : "Send to parent"}</button></div>`;
    mount = (root) => {
      root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { const f = b.parentElement.querySelector("[data-field]"); const on = f.getAttribute("contenteditable") === "true"; f.setAttribute("contenteditable", String(!on)); b.textContent = on ? "Edit" : "Done"; if (!on) f.focus(); else if (f.dataset.field === "message" || f.dataset.field === "wentWell") { const d = n.data; if (f.dataset.field === "message") d.message = f.textContent.trim(); else d.wentWell = f.textContent.split(/;|；/).map((x) => x.trim()).filter(Boolean); S.saveNotes(l.id, { data: d }); toast("Saved"); } }));
      root.querySelector("#revise").addEventListener("click", () => { const ins = prompt("Tell Claude what to change", "Shorter, and mention the recital on Oct 18"); if (ins) { rec.stage = "working"; rec.typed = (rec.typed ?? "") + `\n${ins}`; go(`/lessons/${l.id}/notes`); S.saveNotes(l.id, { bullets: rec.typed }); } });
      root.querySelector("#details").addEventListener("click", () => root.querySelector("#details-box").classList.toggle("hide"));
      root.querySelector("#d-save").addEventListener("click", () => { const d = n.data; d.message = root.querySelector("#d-msg").value; d.practice = root.querySelector("#d-plan").value.split("\n").filter(Boolean).map((line) => { const [task, min] = line.split("|").map((x) => x.trim()); return { task, min: Number(min) || 5, days: 6, tip: null }; }); d.totalMin = d.practice.reduce((a, p) => a + p.min, 0); d.nextPlan = root.querySelector("#d-next").value.split("\n").map((x) => x.trim()).filter(Boolean); S.saveNotes(l.id, { data: d }); toast("Applied"); });
      root.querySelector("#redo").addEventListener("click", () => { if (confirm("Start over? The draft is discarded.")) { recs[l.id] = blank(); S.saveNotes(l.id, { data: null, bullets: "", transcript: null }); } });
      root.querySelector("#send").addEventListener("click", () => { if (l.status === "scheduled") S.setStatus(l.id, "completed"); recs[l.id] = blank(); S.sendNotes(l.id); toast(`Sent to ${parent.name} · ${zh ? "中文" : "English"}`); });
      root.querySelector("#wechat").addEventListener("click", () => { navigator.clipboard?.writeText(plainText(n.data, s, zh, balText)).catch(() => {}); if (l.status === "scheduled") S.setStatus(l.id, "completed"); recs[l.id] = blank(); S.sendNotes(l.id, { wechat: true }); toast("Copied · paste it into WeChat"); });
    };
    return { html, mount };
  }
  // idle: record or type
  html += `<button class="mic" id="mic" aria-label="Record">${MIC}</button><div class="timer" id="timer">Tap to record</div><p class="tc muted small mb3">Talk for 1–3 minutes: what you worked on, what went well, what to practise.</p>
    <div class="card p3 col"><div class="muted small">Or type a few words</div><textarea class="input" id="typed" placeholder="- A string intonation, better than last week&#10;- Minuet 2 bars 1–8&#10;- practise with metronome">${esc(rec.typed ?? n?.bullets ?? "")}</textarea></div>
    <div class="row wrap mt3"><button class="btn btn-outline btn-sm" id="same" ${prev ? "" : "disabled"}>↺ Same practice plan as last time</button>${S.consumes(l.status) && !l.summarySentAt ? `<button class="btn btn-outline btn-sm" id="skip">Send attendance only</button>` : ""}</div>
    ${prev ? `<details class="mt3"><summary class="muted small" style="cursor:pointer">Last lesson's notes</summary><div class="small mt2 card p3">${esc(prev.data.message)}<div class="xs muted mt1">Practice: ${prev.data.practice.map((p) => `${esc(p.task)} ${p.min} min/day`).join(" · ")}</div></div></details>` : ""}
    ${l.planned.length ? `<div class="note note-info mt3 small">Planned for this lesson: ${l.planned.map(esc).join(" · ")}</div>` : ""}
    <div class="sticky-foot"><button class="btn btn-primary w" id="gen" disabled>Write the notes</button></div>`;
  mount = (root) => {
    const mic = root.querySelector("#mic"), timer = root.querySelector("#timer"), ta = root.querySelector("#typed"), gen = root.querySelector("#gen");
    const upd = () => { gen.disabled = !(rec.secs > 0 || ta.value.trim()); };
    ta.addEventListener("input", () => { rec.typed = ta.value; upd(); });
    mic.addEventListener("click", () => { if (mic.classList.contains("on")) { clearInterval(rec.timer); mic.classList.remove("on"); timer.textContent = `${fmtS(rec.secs)} recorded · tap to re-record`; upd(); return; } rec.secs = 0; mic.classList.add("on"); timer.textContent = "0:00"; rec.timer = setInterval(() => { rec.secs++; timer.textContent = fmtS(rec.secs); if (rec.secs >= 8) { clearInterval(rec.timer); mic.classList.remove("on"); timer.textContent = `${fmtS(rec.secs)} recorded (demo stops at 8 s) · tap to re-record`; upd(); } }, 1000); });
    if (rec.secs) timer.textContent = `${fmtS(rec.secs)} recorded · tap to re-record`; upd();
    gen.addEventListener("click", () => { rec.stage = "working"; S.saveNotes(l.id, { bullets: ta.value }); });
    root.querySelector("#same")?.addEventListener("click", () => { rec.stage = "review"; S.saveNotes(l.id, { data: draftFrom(l, prev, ""), bullets: "" }); toast("Filled from last lesson · no AI call"); });
    root.querySelector("#skip")?.addEventListener("click", () => openAttendanceReview(l.id, (how) => how !== "skipped" && go("/today")));
  };
  return { html, mount };
}
export { today };
