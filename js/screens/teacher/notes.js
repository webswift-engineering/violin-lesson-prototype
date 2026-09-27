// Quick notes (lab "quick_notes"): record or type → one wait → the parent's email as the review → send.
import * as S from "../../store.js";
import { esc, chip, statusChip, pageHeader, empty, toast, loc, field } from "../../ui.js";
import { fmt12, fmtDate, today } from "../../dates.js";
import { href, go } from "../../router.js";

const MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>`;
const fmtS = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
let rec = { secs: 0, timer: null, stage: "idle" };

function draftFrom(l, prev, typed) {
  const s = S.student(l.studentId); const fam = S.family(s.familyId); const zh = fam.language === "zh";
  const base = prev?.data ? JSON.parse(JSON.stringify(prev.data)) : { repertoire: [{ piece: "Twinkle, Twinkle", composer: "Suzuki", section: null, status: "in_progress" }], wentWell: [], practice: [{ task: zh ? "空弦长弓" : "Open-string long bows", min: 5, days: 6, tip: null }], technique: [], nextPlan: [], uncertainties: [] };
  const first = s.name.split(" ")[0];
  base.message = zh ? `今天 ${s.name} 的状态很好。${typed ? typed.replace(/^[-•]\s*/gm, "").replace(/\n+/g, "，") + "。" : "上周的练习内容有明显进步，本周请继续按下面的计划练习。"}` : `${first} had a focused lesson today. ${typed ? typed.replace(/^[-•]\s*/gm, "").replace(/\n+/g, "; ") + "." : "Last week's practice paid off; the plan below keeps the momentum."}`;
  base.wentWell = zh ? ["音准更稳定", "节奏跟着节拍器"] : ["Steadier intonation", "Kept time with the metronome"];
  base.nextPlan = base.nextPlan?.length ? base.nextPlan : (zh ? ["下一首曲子的第一段", "换弦练习"] : ["Next piece, first phrase", "String-crossing exercise"]);
  base.uncertainties = rec.secs > 0 ? [] : [zh ? "没有录音，笔记基于文字要点。" : "No audio recorded; notes are based on the typed bullets."];
  base.totalMin = base.practice.reduce((a, p) => a + p.min, 0);
  return base;
}

export function render(route) {
  const l = S.lesson(route.params.id); if (!l) return { html: empty("Lesson not found") };
  const s = S.student(l.studentId); const fam = S.family(s.familyId); const parent = S.parentsOf(fam.id)[0]; const zh = fam.language === "zh";
  const n = S.notesOf(l.id); const prev = S.previousFinalNotes(l.id); const lab = S.labOn("quick_notes");
  const head = pageHeader(s.name, { subtitle: `${fmtDate(l.date)} · ${fmt12(l.time)} · ${loc(l.location)} · ${statusChip(l.status)}`, back: `/lessons/${l.id}`, action: lab ? `<a class="chip chip-accent" href="${href("/settings")}">Beta · switch back</a>` : "" });
  if (!lab) return { html: head + `<div class="card p4 col"><div class="b">Notes (current six-step flow)</div><p class="muted small">The prototype does not rebuild the old page. Turn on <b>Quick notes</b> under More → Studio settings → Experimental features to try the new flow.</p><a class="btn btn-primary" href="${href("/settings")}">Open settings</a></div>` };

  const mailPreview = (d) => `<div class="mail"><div class="mh"><span>To: ${esc(parent.name)} · ${zh ? "中文" : "English"}</span><span>${esc(s.name)} · ${fmtDate(l.date, "md")}</span></div>
      <div class="sec"><h4>${zh ? "老师的话" : "Message"}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><p data-field="message">${esc(d.message)}</p></div>
      <div class="sec"><h4>${zh ? "本节课内容" : "What we worked on"}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><div class="row wrap" data-field="repertoire">${d.repertoire.map((r) => chip("brand", `${r.piece}${r.composer ? " · " + r.composer : ""}${r.section ? " · " + r.section : ""}`)).join("")}</div></div>
      <div class="sec"><h4>${zh ? "做得好的地方" : "What went well"}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><p data-field="wentWell">${d.wentWell.map(esc).join(zh ? "；" : "; ")}</p></div>
      <div class="sec"><h4>${zh ? `本周练习 · 每天约 ${d.totalMin} 分钟` : `Practice this week · about ${d.totalMin} min/day`}</h4><button class="btn btn-ghost btn-xs edit" data-edit>Edit</button><div class="plan" data-field="practice">${d.practice.map((p) => `<div class="it"><span>${esc(p.task)}${p.tip ? `<div class="xs muted">${esc(p.tip)}</div>` : ""}</span><b>${zh ? `每天 ${p.min} 分钟` : `${p.min} min/day`}</b></div>`).join("")}</div></div>
      <div class="sec"><h4>${zh ? "课包" : "Package"}</h4><p class="muted small">${S.balance(s.id).text}${S.balance(s.id).b ? ` · ${S.balance(s.id).b.paid ? (zh ? "已付款" : "paid") : (zh ? "待付款" : "payment pending")}` : ""}</p></div></div>`;

  let html = head, mount = () => {};
  if (n?.status === "final") {
    html += `<div class="note note-ok mb3">Sent to ${esc(parent.name)} ${esc(n.sentAt ?? "")}. Next lesson's plan was filled in.</div>${mailPreview(n.data)}<div class="card p3 mt3 small"><div class="muted xs">Teacher-only (not sent)</div><div><b>Next lesson:</b> ${n.data.nextPlan.map(esc).join(" · ")}</div>${n.data.uncertainties.length ? `<div class="muted">Please double-check: ${n.data.uncertainties.map(esc).join(" · ")}</div>` : ""}</div><div class="row mt3"><a class="btn btn-outline btn-sm" href="${href("/today")}">Back to Today</a><button class="btn btn-ghost btn-sm" id="resend">Resend to parent</button></div>`;
    mount = (root) => root.querySelector("#resend").addEventListener("click", () => { S.sendNotes(l.id); toast("Notes re-sent"); });
    return { html, mount };
  }
  if (rec.stage === "working") {
    html += `<div class="steps"><div class="step run" id="s1"><i></i><span>Uploading your memo (${fmtS(rec.secs)})</span></div><div class="step" id="s2"><i></i><span>Listening (Whisper)</span></div><div class="step" id="s3"><i></i><span>Writing the notes in the family's language (Claude)</span></div></div><p class="tc muted small">Usually 20–40 seconds. You can lock the phone; the notes will be here when you return.</p>`;
    mount = (root) => { const go1 = (i) => { if (i > 3) { rec.stage = "review"; S.saveNotes(l.id, { data: draftFrom(l, prev, rec.typed), bullets: rec.typed ?? "", transcript: rec.secs ? `(${fmtS(rec.secs)} memo transcribed)` : null }); return; } for (let k = 1; k < i; k++) { const e = root.querySelector("#s" + k); e.className = "step done"; e.querySelector("i").textContent = "✓"; } root.querySelector("#s" + i).className = "step run"; setTimeout(() => go1(i + 1), i === 3 ? 1400 : 800); }; go1(1); };
    return { html, mount };
  }
  if (n?.data && (rec.stage === "review" || rec.stage === "idle")) {
    rec.stage = "review";
    html += `<p class="muted small mb2">This is the email the parent will receive. Tap Edit on a section to fix it in place.</p>${mailPreview(n.data)}
      <div class="card p3 mt3 small"><div class="muted xs">Teacher-only (not sent)</div><div><b>Next lesson:</b> ${n.data.nextPlan.map(esc).join(" · ") || "—"}</div>${n.data.uncertainties.length ? `<div class="warn">Please double-check: ${n.data.uncertainties.map(esc).join(" · ")}</div>` : ""}</div>
      <div class="row wrap mt3"><button class="btn btn-ghost btn-sm" id="revise">✨ Ask for a change…</button><button class="btn btn-ghost btn-sm" id="details">Edit details</button><button class="btn btn-ghost btn-sm" id="redo">Start over</button></div>
      <div id="details-box" class="hide card p3 mt3 col small">${field("Message to parent", `<textarea class="input" id="d-msg">${esc(n.data.message)}</textarea>`)}${field("Practice plan (one per line: task | min/day)", `<textarea class="input" id="d-plan">${n.data.practice.map((p) => `${p.task} | ${p.min}`).join("\n")}</textarea>`)}${field("Next lesson plan (one per line)", `<textarea class="input" id="d-next">${n.data.nextPlan.join("\n")}</textarea>`)}<button class="btn btn-outline btn-sm" id="d-save">Apply</button></div>
      <div class="sticky-foot"><button class="btn btn-primary w" id="send">${l.status === "scheduled" ? "Mark completed & send" : "Send to parent"}</button></div>`;
    mount = (root) => {
      root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { const f = b.parentElement.querySelector("[data-field]"); const on = f.getAttribute("contenteditable") === "true"; f.setAttribute("contenteditable", String(!on)); b.textContent = on ? "Edit" : "Done"; if (!on) f.focus(); else if (f.dataset.field === "message" || f.dataset.field === "wentWell") { const d = n.data; if (f.dataset.field === "message") d.message = f.textContent.trim(); else d.wentWell = f.textContent.split(/;|；/).map((x) => x.trim()).filter(Boolean); S.saveNotes(l.id, { data: d }); toast("Saved"); } }));
      root.querySelector("#revise").addEventListener("click", () => { const ins = prompt("Tell Claude what to change", "Shorter, and mention the recital on Oct 18"); if (ins) { rec.stage = "working"; rec.typed = (rec.typed ?? "") + `\n${ins}`; go(`/lessons/${l.id}/notes`); S.saveNotes(l.id, { bullets: rec.typed }); } });
      root.querySelector("#details").addEventListener("click", () => root.querySelector("#details-box").classList.toggle("hide"));
      root.querySelector("#d-save").addEventListener("click", () => { const d = n.data; d.message = root.querySelector("#d-msg").value; d.practice = root.querySelector("#d-plan").value.split("\n").filter(Boolean).map((line) => { const [task, min] = line.split("|").map((x) => x.trim()); return { task, min: Number(min) || 5, days: 6, tip: null }; }); d.totalMin = d.practice.reduce((a, p) => a + p.min, 0); d.nextPlan = root.querySelector("#d-next").value.split("\n").map((x) => x.trim()).filter(Boolean); S.saveNotes(l.id, { data: d }); toast("Applied"); });
      root.querySelector("#redo").addEventListener("click", () => { if (confirm("Start over? The draft is discarded.")) { rec = { secs: 0, timer: null, stage: "idle", typed: "" }; S.saveNotes(l.id, { data: null, bullets: "", transcript: null }); } });
      root.querySelector("#send").addEventListener("click", () => { if (l.status === "scheduled") S.setStatus(l.id, "completed"); S.sendNotes(l.id); rec = { secs: 0, timer: null, stage: "idle", typed: "" }; toast(`Sent to ${parent.name} · ${zh ? "中文" : "English"}`); });
    };
    return { html, mount };
  }
  // idle: record or type
  html += `<button class="mic" id="mic" aria-label="Record">${MIC}</button><div class="timer" id="timer">Tap to record</div><p class="tc muted small mb3">Talk for 1–3 minutes: what you worked on, what went well, what to practise.</p>
    <div class="card p3 col"><div class="muted small">Or type a few words</div><textarea class="input" id="typed" placeholder="- A string intonation, better than last week&#10;- Minuet 2 bars 1–8&#10;- practise with metronome">${esc(rec.typed ?? n?.bullets ?? "")}</textarea></div>
    <div class="row wrap mt3"><button class="btn btn-outline btn-sm" id="same" ${prev ? "" : "disabled"}>↺ Same practice plan as last time</button>${S.consumes(l.status) && !l.summarySentAt ? `<button class="btn btn-outline btn-sm" id="skip">Send attendance only</button>` : ""}</div>
    ${prev ? `<details class="mt3"><summary class="muted small" style="cursor:pointer">Last lesson's notes</summary><div class="small mt2 card p3">${esc(prev.data.message)}<div class="xs muted mt1">Practice: ${prev.data.practice.map((p) => `${p.task} ${p.min} min/day`).join(" · ")}</div></div></details>` : ""}
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
    root.querySelector("#skip")?.addEventListener("click", () => { const c = S.sendSummary(l.id); toast(`Attendance email sent (${c})`); go("/today"); });
  };
  return { html, mount };
}
export { today };
