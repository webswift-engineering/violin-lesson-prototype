// Shared widgets: escaping, sheet, toast, calendar, status editor, slot check, heatmap.
import * as S from "./store.js";
import { LOCATION_LABEL, LOC_SHORT, STATUS_LABEL, STATUS_TONE } from "./data.js";
import { DOW, fmt12, fmtDate, today, monthGrid, weekOf, sameMonth, addDays, addMonths, weekLabel, parse } from "./dates.js";
import { href } from "./router.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const chip = (tone, text) => `<span class="chip chip-${tone}">${esc(text)}</span>`;
export const statusChip = (status) => chip(STATUS_TONE[status], STATUS_LABEL[status]);
export const pageHeader = (title, { subtitle = "", back = null, action = "" } = {}) => `<div class="page-h"><div>${back ? `<a class="back" href="${href(back)}">‹ Back</a>` : ""}<h1>${esc(title)}</h1>${subtitle ? `<div class="muted small mt1">${subtitle}</div>` : ""}</div>${action}</div>`;
export const section = (title, body, action = "") => `<div class="section"><div class="sh"><h2>${esc(title)}</h2>${action}</div>${body}</div>`;
export const coll = (summary, body, open = false) => `<details class="coll"${open ? " open" : ""}><summary>${summary}</summary><div class="body">${body}</div></details>`;
export const empty = (title, hint = "") => `<div class="card empty"><div class="t">${esc(title)}</div>${hint ? `<div class="small">${esc(hint)}</div>` : ""}</div>`;
export const field = (label, input) => `<div><label class="label">${esc(label)}</label>${input}</div>`;
export const loc = (l) => LOCATION_LABEL[l] ?? l;

// ---- sheet ----
const sheetRoot = () => document.getElementById("sheet-root");
export function openSheet(title, html, mount) {
  closeSheet();
  const host = document.body.dataset.frame === "phone" ? document.querySelector(".frame") : document.body;
  const root = sheetRoot(); root.innerHTML = "";
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><header><h2>${esc(title)}</h2><button class="x" aria-label="Close">✕</button></header><div class="sheet-body">${html}</div></div>`;
  ov.addEventListener("click", (e) => { if (e.target === ov) closeSheet(); });
  ov.querySelector(".x").addEventListener("click", closeSheet);
  if (host === document.body) root.appendChild(ov);
  else { ov.style.top = `${host.scrollTop}px`; ov.style.height = `${host.clientHeight}px`; host.classList.add("locked"); host.appendChild(ov); }
  if (mount) mount(ov.querySelector(".sheet-body"));
  return ov.querySelector(".sheet-body");
}
export function closeSheet() { document.querySelectorAll(".overlay").forEach((o) => o.remove()); document.querySelector(".frame")?.classList.remove("locked"); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

// ---- toast ----
export function toast(msg, tone = "") { const t = document.getElementById("toast-root"); t.innerHTML = `<div class="toast ${tone}">${esc(msg)}</div>`; clearTimeout(t._t); t._t = setTimeout(() => (t.innerHTML = ""), 3200); }

// ---- slot check ----
export function slotHtml(c) { if (!c) return ""; const ic = c.level === "ok" ? "✓" : c.level === "warn" ? "⚠" : "✕"; return `<div class="slot slot-${c.level}"><span>${ic}</span><span>${c.reasons.map(esc).join(" · ")}</span></div>`; }
export function suggestionList(sugg, actionHtml) { if (!sugg.length) return `<p class="muted small">No free times in that range.</p>`; return `<div class="card list">${sugg.map((g, i) => `<div class="li"><div><div class="med">${fmtDate(g.date)} · ${fmt12(g.time)}</div><div class="xs ${g.level === "ok" ? "ok" : "warn"}">${esc(g.reason)}</div></div>${actionHtml(g, i)}</div>`).join("")}</div>`; }

// ---- status editor (R18) ----
export function statusEditorHtml(l) {
  const opts = S.ALLOWED[l.status];
  if (!opts.length) return `<div class="status-ed"><div class="row between"><span class="muted small">Status</span>${statusChip(l.status)}</div><p class="muted small">This lesson was moved; the new lesson holds the record.</p></div>`;
  return `<div class="status-ed" data-status-ed="${l.id}"><div class="row between"><span class="muted small">Status</span>${statusChip(l.status)}</div><div class="xs muted">Change to</div><div class="trans">${opts.map((o) => `<button class="btn btn-sm ${o === "completed" ? "btn-primary" : "btn-outline"}" data-to="${o}">${STATUS_LABEL[o]}</button>`).join("")}</div><div class="effect col"></div></div>`;
}
export function mountStatusEditor(root, l, after) {
  const box = root.querySelector(`[data-status-ed="${l.id}"]`); if (!box) return;
  box.querySelectorAll("[data-to]").forEach((b) => b.addEventListener("click", () => {
    const to = b.dataset.to; const eff = box.querySelector(".effect"); const lines = [];
    if (S.consumes(l.status) && !S.consumes(to)) lines.push(`<div class="note note-info">Gives the lesson back to the package.</div>`);
    if (!S.consumes(l.status) && S.consumes(to)) lines.push(`<div class="note note-info">Uses one lesson from the package.</div>`);
    if (to === "scheduled" && l.note) lines.push(`<div class="note note-info">Clears the note “${esc(l.note)}”.</div>`);
    if (to === "completed") lines.push(`<div class="note note-ok">Opens Notes so you can record what was covered.</div>`);
    if (l.summarySentAt) lines.push(`<div class="note note-warn">The parent already received the summary for this lesson.</div><label class="check"><input type="checkbox" id="tell" checked> Tell the parent (short “attendance corrected” email)</label>`);
    lines.push(`<button class="btn btn-primary w" id="apply">Set to ${STATUS_LABEL[to]}</button>`);
    eff.innerHTML = lines.join("");
    eff.querySelector("#apply").addEventListener("click", () => { const tell = eff.querySelector("#tell")?.checked; const was = STATUS_LABEL[l.status]; S.setStatus(l.id, to, { tellParent: !!tell }); toast(`${S.studentName(l.studentId)}: ${was} → ${STATUS_LABEL[to]}${tell ? " · parent emailed" : ""}`); after?.(to); });
  }));
}

// ---- calendar ----
/** opts: { view, anchor, basePath, lessons, students, lockStudent, chrome, compact (no Find / Move buttons: the page has its own), onLesson, onAdd, onMove, todayKey } */
export function calendarHtml(o) {
  const T = o.todayKey ?? today(); const rows = o.view === "month" ? monthGrid(o.anchor) : [weekOf(o.anchor)];
  const byDay = {}; for (const l of o.lessons) (byDay[l.date] ??= []).push(l);
  const link = (v, d) => href(`${o.basePath}?view=${v}&date=${d}`);
  const prev = o.view === "month" ? addMonths(o.anchor, -1) : addDays(o.anchor, -7), next = o.view === "month" ? addMonths(o.anchor, 1) : addDays(o.anchor, 7);
  const title = o.view === "month" ? fmtDate(o.anchor, "month") : weekLabel(rows[0]);
  const strip = o.chrome === "week-strip";
  const chipHtml = (l) => `<button class="lchip s-${l.status}" draggable="${l.status === "scheduled"}" data-lesson="${l.id}" title="${esc(S.studentName(l.studentId))} · ${fmt12(l.time)} · ${STATUS_LABEL[l.status]}"><b>${fmt12(l.time)}</b> ${o.lockStudent ? loc(l.location) : esc(S.studentName(l.studentId))} ${o.lockStudent ? "" : `<span style="opacity:.6">${LOC_SHORT[l.location]}</span>`}</button>`;
  const cell = (d, tall) => { const ls = (byDay[d] ?? []).sort((a, b) => a.time.localeCompare(b.time)); const out = o.view === "month" && !sameMonth(d, o.anchor); const plan = S.dayLocation(d); return `<div class="cell ${tall ? "tall" : ""} ${out ? "out" : ""} ${d === T ? "today" : ""} ${plan === "newmarket" ? "nm" : ""}" data-day="${d}"><span class="num">${Number(d.slice(8))}</span><span class="add">+ add</span>${ls.map(chipHtml).join("")}</div>`; };
  const mobileDay = o.selected ?? (rows.flat().includes(T) ? T : rows[0][0]);
  const mobile = `<div class="phone-only"><div class="cal-strip">${rows.flat().map((d) => { const ls = byDay[d] ?? []; const out = o.view === "month" && !sameMonth(d, o.anchor); return `<button class="${d === mobileDay ? "sel" : ""} ${out ? "out" : ""} ${d === T ? "today" : ""}" data-mday="${d}">${o.view === "week" ? `<span class="xs">${DOW[parse(d).getDay()]}</span>` : ""}<span class="small">${Number(d.slice(8))}</span><span class="dots">${ls.slice(0, 3).map((l) => `<i class="d-${l.status}"></i>`).join("")}</span></button>`; }).join("")}</div><div class="row between mt3"><h3 id="mday-title">${fmtDate(mobileDay, "long")}</h3><button class="btn btn-outline btn-sm" data-add-day="${mobileDay}">+ Add</button></div><div id="mday-list" class="card list mt2">${dayList(byDay[mobileDay] ?? [], o)}</div></div>`;
  return `<div class="cal" data-cal data-base="${o.basePath}" data-view="${o.view}"><div class="cal-h"><div class="grp"><a class="btn btn-ghost btn-sm" href="${link(o.view, prev)}" aria-label="Previous">‹</a><a class="btn btn-outline btn-sm" href="${link(o.view, T)}">Today</a><a class="btn btn-ghost btn-sm" href="${link(o.view, next)}" aria-label="Next">›</a>${strip ? `<h3 style="margin-left:6px">${title}</h3>` : `<h2>${title}</h2>`}</div><div class="grp">${strip ? `<a class="btn btn-ghost btn-sm" href="${href(`/calendar?view=month&date=${o.anchor}`)}">Month →</a>` : `<div class="seg"><a class="${o.view === "month" ? "on" : ""}" href="${link("month", o.anchor)}">Month</a><a class="${o.view === "week" ? "on" : ""}" href="${link("week", o.anchor)}">Week</a></div>${o.compact ? "" : `<button class="btn btn-outline btn-sm" data-find>Find a time</button>`}`}${o.compact ? "" : `<button class="btn btn-outline btn-sm" data-move-lesson>⇄ Move</button>`}<button class="btn btn-primary btn-sm" data-add-day="${T}">+ Lesson</button></div></div>${strip ? "" : `<p class="xs muted desk-only mb2">${o.lockStudent ? `Only ${esc(o.lockStudent.name)}'s lessons. ` : ""}Drag a scheduled lesson to another day to move it. Click a lesson to edit, click a day to add.</p>`}<div class="desk-only card" style="overflow:hidden"><div class="cal-dow">${DOW.map((d) => `<div>${d}</div>`).join("")}</div>${rows.map((r) => `<div class="cal-row">${r.map((d) => cell(d, o.view === "week")).join("")}</div>`).join("")}</div>${mobile}<div class="legend"><span><i style="background:rgb(var(--brand))"></i>Scheduled</span><span><i style="background:rgb(var(--ok))"></i>Completed</span><span><i style="background:rgb(var(--warn))"></i>No-show</span><span><i style="background:rgb(var(--ink-muted))"></i>Cancelled</span><span>▔ Newmarket day</span></div></div>`;
}
function dayList(ls, o) { if (!ls.length) return `<div class="li muted small">No lessons.</div>`; return ls.sort((a, b) => a.time.localeCompare(b.time)).map((l) => `<button class="li w" style="background:none;border:0;text-align:left" data-lesson="${l.id}"><span><b>${fmt12(l.time)}</b> · ${o.lockStudent ? loc(l.location) : esc(S.studentName(l.studentId))}</span>${statusChip(l.status)}</button>`).join(""); }
export function mountCalendar(root, o) {
  const cal = root.querySelector("[data-cal]"); if (!cal) return;
  const byDay = {}; for (const l of o.lessons) (byDay[l.date] ??= []).push(l);
  cal.querySelectorAll("[data-lesson]").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); o.onLesson(S.lesson(b.dataset.lesson)); });
    b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", b.dataset.lesson); b.classList.add("dragging"); });
    b.addEventListener("dragend", () => b.classList.remove("dragging"));
  });
  cal.querySelectorAll(".cell").forEach((c) => {
    c.addEventListener("click", () => o.onAdd(c.dataset.day));
    c.addEventListener("dragover", (e) => { e.preventDefault(); c.classList.add("over"); });
    c.addEventListener("dragleave", () => c.classList.remove("over"));
    c.addEventListener("drop", (e) => { e.preventDefault(); c.classList.remove("over"); const l = S.lesson(e.dataTransfer.getData("text/plain")); if (l && l.status === "scheduled" && l.date !== c.dataset.day) o.onMove(l, c.dataset.day); });
  });
  cal.querySelectorAll("[data-add-day]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); o.onAdd(b.dataset.addDay); }));
  cal.querySelector("[data-find]")?.addEventListener("click", () => o.onFind?.());
  cal.querySelector("[data-move-lesson]")?.addEventListener("click", () => openMoveLesson(o.lockStudent ?? null));
  cal.querySelectorAll("[data-mday]").forEach((b) => b.addEventListener("click", () => {
    cal.querySelectorAll("[data-mday]").forEach((x) => x.classList.toggle("sel", x === b));
    const d = b.dataset.mday; cal.querySelector("#mday-title").textContent = fmtDate(d, "long"); cal.querySelector("[data-add-day]:not(.btn-primary)").dataset.addDay = d;
    const list = cal.querySelector("#mday-list"); list.innerHTML = dayList(byDay[d] ?? [], o);
    list.querySelectorAll("[data-lesson]").forEach((x) => x.addEventListener("click", () => o.onLesson(S.lesson(x.dataset.lesson))));
  }));
}

// ---- lesson sheet (calendar / today) ----
export function openLessonSheet(l, onChanged) {
  const st = S.student(l.studentId); const n = S.notesOf(l.id);
  const html = `<p class="muted small mb3">${fmtDate(l.date, "long")} · ${fmt12(l.time)} · ${l.durationMin} min · ${loc(l.location)}${l.note ? ` · note: ${esc(l.note)}` : ""}</p>
    ${l.status === "scheduled" ? `<div class="trans mb3"><button class="btn btn-primary" style="flex:1" data-set="completed">Completed</button><button class="btn btn-outline" style="flex:1" data-set="no_show">No-show</button><button class="btn btn-ghost" data-set="cancelled">…</button></div>
      <button class="btn btn-accent w" id="mv-open">⇄ Move this lesson</button>` : ""}
    ${l.status === "completed" || l.status === "no_show" ? `<a class="btn btn-primary w mb3" href="${href(`/lessons/${l.id}/notes`)}">${n?.status === "final" ? "View notes" : "Notes & send summary"}</a>` : ""}
    ${l.status !== "scheduled" ? statusEditorHtml(l) : ""}
    <div class="row mt4 small" style="gap:14px"><a class="brand" href="${href(`/lessons/${l.id}`)}">Lesson page →</a><a class="brand" href="${href(`/students/${st.id}`)}">Student →</a></div>`;
  openSheet(st.name, html, (root) => {
    root.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => { const to = b.dataset.set; if (to === "cancelled") { const note = prompt("Cancel this lesson? Optional note to the parent:", ""); if (note === null) return; S.setStatus(l.id, "cancelled", { note }); toast("Cancelled · parent emailed"); closeSheet(); onChanged?.(); return; } S.setStatus(l.id, to); closeSheet(); if (to === "completed") { location.hash = `/lessons/${l.id}/notes`; } else { toast(`${st.name}: no-show`); onChanged?.(); } }));
    mountStatusEditor(root, l, () => { closeSheet(); onChanged?.(); });
    root.querySelector("#mv-open")?.addEventListener("click", () => openMoveLesson(st, onChanged, l));
    root.querySelectorAll("a[href]").forEach((a) => a.addEventListener("click", closeSheet));
  });
}
export function openMoveConfirm(l, toDate, onChanged) {
  openSheet("Move lesson", `<p class="mb3">${esc(S.studentName(l.studentId))}: <b>${fmtDate(l.date)}</b> → <b>${fmtDate(toDate)}</b></p><div class="col"><div>${field("Time", `<input class="input" type="time" id="mv-time" value="${l.time}">`)}</div><div id="mv-check"></div>${tellHtml("mv")}<button class="btn btn-primary w" id="mv-go">Move lesson</button></div>`, (root) => {
    const t = root.querySelector("#mv-time"), go = root.querySelector("#mv-go");
    const upd = () => { const c = S.checkSlot({ date: toDate, time: t.value, durationMin: l.durationMin, location: l.location, excludeId: l.id }); root.querySelector("#mv-check").innerHTML = slotHtml(c); go.disabled = c.level === "block"; };
    t.addEventListener("input", upd); upd();
    go.addEventListener("click", () => moveWithReview(l, toDate, t.value, { note: root.querySelector("#mv-note").value, tell: root.querySelector("#mv-tell").checked, onChanged }));
  });
}
export function openAddLesson(day, lockStudent, onChanged) {
  const students = lockStudent ? [lockStudent] : S.get().students.filter((s) => s.active);
  const first = students[0];
  openSheet("Add lesson", `<div class="col"><div>${field("Student", lockStudent ? `<div class="input ro">${esc(lockStudent.name)}</div>` : `<select class="input" id="ad-st">${students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>`)}</div><div class="grid3"><div style="grid-column:span 2">${field("Date", `<input class="input" type="date" id="ad-date" value="${day}">`)}</div>${field("Time", `<input class="input" type="time" id="ad-time" value="${first?.time ?? "16:00"}">`)}</div><div class="grid2">${field("Minutes", `<input class="input" type="number" id="ad-dur" value="${first?.durationMin ?? 45}" min="15" step="5">`)}${field("Location", `<select class="input" id="ad-loc">${Object.entries(LOCATION_LABEL).map(([k, v]) => `<option value="${k}" ${first?.location === k ? "selected" : ""}>${v}</option>`).join("")}</select>`)}</div><div id="ad-check"></div><button class="btn btn-primary w" id="ad-go">Add lesson</button><p class="xs muted">For a recurring weekly slot, use “Generate from the weekly slot” on the student page.</p></div>`, (root) => {
    const q = (id) => root.querySelector(id); const upd = () => { q("#ad-check").innerHTML = slotHtml(S.checkSlot({ date: q("#ad-date").value, time: q("#ad-time").value, durationMin: Number(q("#ad-dur").value), location: q("#ad-loc").value })); };
    ["#ad-date", "#ad-time", "#ad-dur", "#ad-loc"].forEach((id) => q(id).addEventListener("input", upd)); upd();
    q("#ad-st")?.addEventListener("change", () => { const s = S.student(q("#ad-st").value); q("#ad-time").value = s.time ?? "16:00"; q("#ad-dur").value = s.durationMin; q("#ad-loc").value = s.location; upd(); });
    q("#ad-go").addEventListener("click", () => { const sid = lockStudent ? lockStudent.id : q("#ad-st").value; S.addLesson(sid, q("#ad-date").value, q("#ad-time").value, Number(q("#ad-dur").value), q("#ad-loc").value); toast(`Added ${S.studentName(sid)} · ${fmtDate(q("#ad-date").value)} ${fmt12(q("#ad-time").value)}`); closeSheet(); onChanged?.(); });
  });
}
/** "Move a lesson": pick the lesson (and the student when not locked), then date + time with the slot check and suggestions. */
export function openMoveLesson(lockStudent, onChanged, preselect = null) {
  const T = today(); const students = lockStudent ? [lockStudent] : S.get().students.filter((s) => s.active);
  const upcomingOf = (sid) => S.lessonsOf(sid).filter((l) => l.status === "scheduled" && (l.date > T || (l.date === T)));
  let sid = preselect ? preselect.studentId : (lockStudent?.id ?? students[0]?.id);
  const body = () => { const ls = upcomingOf(sid); const l = preselect && preselect.studentId === sid ? preselect : ls[0]; return `<div class="col">
      <div>${field("Student", lockStudent ? `<div class="input ro">${esc(lockStudent.name)}</div>` : `<select class="input" id="ml-st">${students.map((s) => `<option value="${s.id}" ${s.id === sid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`)}</div>
      <div>${field("Which lesson", ls.length ? `<select class="input" id="ml-l">${ls.map((x) => `<option value="${x.id}" ${l && x.id === l.id ? "selected" : ""}>${fmtDate(x.date)} · ${fmt12(x.time)} · ${loc(x.location)}</option>`).join("")}</select>` : `<div class="input ro">No upcoming lessons</div>`)}</div>
      ${l ? `<div class="grid2">${field("New date", `<input class="input" type="date" id="ml-date" value="${l.date}">`)}${field("New time", `<input class="input" type="time" id="ml-time" value="${l.time}">`)}</div><div id="ml-check"></div><details><summary class="xs brand" style="cursor:pointer">Suggested free times</summary><div id="ml-sugg" class="mt2"></div></details>${tellHtml("ml")}<button class="btn btn-primary w" id="ml-go" disabled>Move lesson</button>` : ""}</div>`; };
  const wire = (root) => {
    root.querySelector("#ml-st")?.addEventListener("change", (e) => { sid = e.target.value; preselect = null; root.innerHTML = body(); wire(root); });
    root.querySelector("#ml-l")?.addEventListener("change", (e) => { preselect = S.lesson(e.target.value); root.innerHTML = body(); wire(root); });
    const l = S.lesson(root.querySelector("#ml-l")?.value); if (!l) return;
    const d = root.querySelector("#ml-date"), t = root.querySelector("#ml-time"), go = root.querySelector("#ml-go"), chk = root.querySelector("#ml-check");
    const upd = () => { const changed = d.value !== l.date || t.value !== l.time; const c = changed ? S.checkSlot({ date: d.value, time: t.value, durationMin: l.durationMin, location: l.location, excludeId: l.id }) : null; go.disabled = !changed || c.level === "block"; chk.innerHTML = slotHtml(c); };
    d.addEventListener("input", upd); t.addEventListener("input", upd);
    const sugg = S.suggestSlots(l.studentId, T, addDays(T, 14), l.location, 4).filter((g) => !(g.date === l.date && g.time === l.time));
    root.querySelector("#ml-sugg").innerHTML = suggestionList(sugg, (g, i) => `<button class="btn btn-outline btn-sm" data-pick="${g.date}|${g.time}">Use</button>`);
    root.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { const [dd, tt] = b.dataset.pick.split("|"); d.value = dd; t.value = tt; upd(); }));
    go.addEventListener("click", () => moveWithReview(l, d.value, t.value, { note: root.querySelector("#ml-note").value, tell: root.querySelector("#ml-tell").checked, onChanged }));
  };
  openSheet("Move a lesson", body(), wire);
}

// ---- review before sending (owner decision 2026-10-01: post-lesson emails and reschedule messages are reviewed) ----
const tellHtml = (p) => `<textarea class="input" id="${p}-note" rows="2" placeholder="Optional note to the parent"></textarea><label class="check"><input type="checkbox" id="${p}-tell" checked> Tell the parent (you check the message before it goes)</label>`;
/**
 * The parent's message as an editable draft: Send (email, + SMS when asked and the family opted in), Copy for WeChat,
 * or Don't send. Nothing reaches the parent before one of the first two. `send(value, { wechat })` overrides the default send.
 */
export function openReview({ title = "Message to the parent", familyId, draft, event, lessonId = null, sms = false, send = null, onDone = null }) {
  const fam = S.family(familyId); const parents = S.parentsOf(familyId); const zh = fam.language === "zh";
  const channels = sms && fam.smsOptIn ? "email + SMS" : "email";
  openSheet(title, `<p class="muted small mb2">To ${parents.map((p) => esc(p.name)).join(", ")} · ${zh ? "中文" : "English"}</p>
    ${field("Subject", `<input class="input" id="rv-subj" value="${esc(draft.subject)}">`)}
    <textarea class="input mt2" id="rv-text" rows="7">${esc(draft.text)}</textarea>
    <div class="col mt3"><button class="btn btn-primary w" id="rv-send">Send ${channels}</button><button class="btn btn-outline w" id="rv-copy">Copy for WeChat</button><button class="btn btn-ghost w" id="rv-skip">Don't send</button></div>
    <p class="xs muted mt2">Nothing reaches the parent until you send it or paste it yourself.</p>`, (root) => {
    const val = () => ({ subject: root.querySelector("#rv-subj").value, text: root.querySelector("#rv-text").value });
    const go = (v, wechat) => (send ? send(v, { wechat }) : S.sendReviewed(familyId, event, { ...v, lessonId, sms, wechat }));
    root.querySelector("#rv-send").addEventListener("click", () => { const v = val(); closeSheet(); go(v, false); toast(`Sent to ${fam.name} by ${channels}`); onDone?.("sent"); });
    root.querySelector("#rv-copy").addEventListener("click", async () => { const v = val(); try { await navigator.clipboard?.writeText(v.text); } catch { /* clipboard blocked: the outbox keeps the text */ } closeSheet(); go(v, true); toast("Copied · paste it into WeChat"); onDone?.("copied"); });
    root.querySelector("#rv-skip").addEventListener("click", () => { closeSheet(); toast("Not sent · the parent has not been told", "warn"); onDone?.("skipped"); });
  });
}
/** Move, then (when asked) show the parent's message for review. */
export function moveWithReview(l, date, time, { note = "", tell = true, onChanged = null } = {}) {
  const from = { date: l.date, time: l.time }; const st = S.student(l.studentId);
  const nl = S.moveLesson(l.id, date, time);
  if (nl?.error) return toast(nl.error, "warn");
  if (!tell) { toast(`${st.name} moved to ${fmtDate(date)} ${fmt12(time)} · parent not told`); onChanged?.(nl); return nl; }
  openReview({ title: "Tell the parent", familyId: st.familyId, event: "reschedule_approved", lessonId: nl.id, sms: true, draft: S.draft("moved", { lesson: nl, from, to: { date, time }, note }), onDone: () => onChanged?.(nl) });
  return nl;
}
/** The post-lesson email without notes, reviewed first. */
export function openAttendanceReview(lessonId, onDone) {
  const l = S.lesson(lessonId); const st = S.student(l.studentId);
  openReview({ title: "Attendance email", familyId: st.familyId, event: "lesson_completed", lessonId, draft: S.draft("attendance", { lesson: l }), send: (v, { wechat }) => S.sendSummary(lessonId, { text: v.text, wechat }), onDone });
}

export function openFindTime(lockStudent, onChanged) {
  const students = lockStudent ? [lockStudent] : S.get().students.filter((s) => s.active); const T = today();
  openSheet("Find a time", `<div class="col"><div>${field("Student", lockStudent ? `<div class="input ro">${esc(lockStudent.name)}</div>` : `<select class="input" id="ft-st">${students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>`)}</div><div class="grid3">${field("From", `<input class="input" type="date" id="ft-from" value="${T}">`)}${field("To", `<input class="input" type="date" id="ft-to" value="${addDays(T, 14)}">`)}${field("Location", `<select class="input" id="ft-loc">${Object.entries(LOCATION_LABEL).map(([k, v]) => `<option value="${k}" ${students[0]?.location === k ? "selected" : ""}>${v}</option>`).join("")}</select>`)}</div><button class="btn btn-primary w" id="ft-go">Find times</button><div id="ft-out"></div><p class="xs muted">Ranked by: no conflict, matches your location plan that day, close to the student's usual slot, fewest location switches, earliest.</p></div>`, (root) => {
    const q = (id) => root.querySelector(id);
    q("#ft-go").addEventListener("click", () => { const sid = lockStudent ? lockStudent.id : q("#ft-st").value; const sugg = S.suggestSlots(sid, q("#ft-from").value, q("#ft-to").value, q("#ft-loc").value, 8); q("#ft-out").innerHTML = suggestionList(sugg, (g, i) => `<button class="btn btn-outline btn-sm" data-i="${i}">Add</button>`); q("#ft-out").querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { const g = sugg[Number(b.dataset.i)]; S.addLesson(sid, g.date, g.time, null, q("#ft-loc").value); toast(`Added ${fmtDate(g.date)} ${fmt12(g.time)}`); closeSheet(); onChanged?.(); })); });
  });
}

// ---- heatmap (52 weeks, GitHub-style: month labels, hover tooltip, click for the day's detail) ----
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ZH_STATUS = { scheduled: "已排", completed: "已上", no_show: "缺席", cancelled: "已取消", rescheduled: "已改期" };
const ZH_LOC = { newmarket: "Newmarket", north_york: "North York", online: "线上" };
export function heatmapHtml(lessons, opts = {}) {
  const zh = opts.lang === "zh"; const MONTHS = zh ? MON3.map((_, i) => `${i + 1}月`) : MON3;
  const T = today(); const start = weekOf(addDays(T, -363))[0]; const end = weekOf(T)[6];
  const by = {}; for (const l of lessons) (by[l.date] ??= []).push(l);
  let cells = "", months = ""; let col = 0, lastMonth = -1, lastLabelCol = -9;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dt = parse(d); const future = d > T; const ls = by[d] ?? [];
    const st = ls.length ? (ls.find((l) => l.status === "completed") ? "completed" : ls.find((l) => l.status === "no_show") ? "no_show" : ls.find((l) => l.status === "scheduled") ? "scheduled" : "cancelled") : "";
    if (dt.getDay() === 0) { if (dt.getMonth() !== lastMonth && dt.getDate() <= 7) { if (col - lastLabelCol >= 3) { months += `<span style="left:${col * 13}px">${MONTHS[dt.getMonth()]}</span>`; lastLabelCol = col; } lastMonth = dt.getMonth(); } col++; }
    cells += `<button type="button" class="hc ${st ? `h-${st}` : ""} ${future ? "future" : ""}" data-day="${d}" ${ls.length ? `data-n="${ls.length}"` : ""} aria-label="${d}${st ? ", " + (zh ? ZH_STATUS[st] : STATUS_LABEL[st]) : zh ? "，没有课" : ", no lesson"}" tabindex="${ls.length ? 0 : -1}"></button>`;
  }
  return `<div class="heat-wrap" data-heat><div class="heat-months">${months}</div><div class="heat-body"><div class="heat-dow"><span></span><span>${zh ? "一" : "Mon"}</span><span></span><span>${zh ? "三" : "Wed"}</span><span></span><span>${zh ? "五" : "Fri"}</span><span></span></div><div class="heat">${cells}</div></div><div class="heat-legend"><span>${zh ? "少" : "Less"}</span><i></i><i class="h-cancelled"></i><i class="h-no_show"></i><i class="h-completed"></i><span>${zh ? "多" : "More"}</span><span class="muted" style="margin-left:auto">${opts.hint ?? "Hover a day for the date; click to see what happened."}</span></div><div class="heat-tip" hidden></div><div class="heat-detail" hidden></div></div>`;
}
/** opts: { lessons, detail(day, lessons) → html, lang } */
export function mountHeatmap(root, opts) {
  const wrap = root.querySelector("[data-heat]"); if (!wrap) return;
  const by = {}; for (const l of opts.lessons) (by[l.date] ??= []).push(l);
  const tip = wrap.querySelector(".heat-tip"), detail = wrap.querySelector(".heat-detail");
  const zh = opts.lang === "zh";
  const label = (d) => { const ls = by[d] ?? []; const date = zh ? fmtDate(d, "zh") : fmtDate(d, "mdy"); if (!ls.length) return `${date} · ${zh ? "没有课" : "no lesson"}`; return `${date} · ${ls.map((l) => `${zh ? l.time : fmt12(l.time)} ${zh ? ZH_STATUS[l.status] : STATUS_LABEL[l.status]}`).join(", ")}`; };
  const show = (cell) => { tip.textContent = label(cell.dataset.day); tip.hidden = false; const r = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect(); tip.style.left = `${Math.max(0, Math.min(r.left - w.left + r.width / 2, w.width - 20))}px`; tip.style.top = `${r.top - w.top - 8}px`; };
  wrap.querySelectorAll(".hc").forEach((c) => {
    c.addEventListener("mouseenter", () => show(c)); c.addEventListener("focus", () => show(c));
    c.addEventListener("mouseleave", () => (tip.hidden = true)); c.addEventListener("blur", () => (tip.hidden = true));
    c.addEventListener("click", () => { wrap.querySelectorAll(".hc.sel").forEach((x) => x.classList.remove("sel")); c.classList.add("sel"); const d = c.dataset.day; detail.innerHTML = opts.detail ? opts.detail(d, by[d] ?? []) : defaultDetail(d, by[d] ?? [], zh); detail.hidden = false; });
  });
  const today_ = wrap.querySelector(`.hc[data-day="${today()}"]`); if (today_) today_.classList.add("is-today");
}
export function defaultDetail(d, ls, zh = false, noteHref = (l) => `/lessons/${l.id}/notes`, lessonHref = (l) => `/lessons/${l.id}`) {
  const date = zh ? fmtDate(d, "zh") : fmtDate(d, "long");
  if (!ls.length) return `<div class="row between"><b>${date}</b><span class="muted small">${zh ? "这天没有课" : "No lesson this day"}</span></div>`;
  return `<b>${date}</b><div class="list mt1">${ls.map((l) => { const n = S.notesOf(l.id); return `<div class="li" style="padding-inline:0"><div><div class="small"><a class="med" href="${href(lessonHref(l))}">${zh ? l.time : fmt12(l.time)}</a> · ${l.durationMin} ${zh ? "分钟" : "min"} · ${zh ? ZH_LOC[l.location] : loc(l.location)}${l.sessionId ? ` · ${zh ? "课包" : "package"} #${S.session(l.sessionId)?.seq}` : ""}</div>${l.note && l.note !== "Backfilled" ? `<div class="xs muted">${esc(zh && l.note === "Paused" ? "暂停" : l.note)}</div>` : ""}${n?.status === "final" ? `<div class="xs muted" style="max-width:32rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.data.message)}</div>` : ""}</div><div class="row">${n?.status === "final" ? `<a class="chip chip-brand" href="${href(noteHref(l))}">${zh ? "查看笔记" : "notes"}</a>` : ""}${zh ? chip(STATUS_TONE[l.status], ZH_STATUS[l.status]) : statusChip(l.status)}</div></div>`; }).join("")}</div>`;
}
