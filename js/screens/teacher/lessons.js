import * as S from "../../store.js";
import { esc, chip, statusChip, pageHeader, section, coll, empty, field, statusEditorHtml, mountStatusEditor, slotHtml, suggestionList, toast, loc, openMoveLesson, openAttendanceReview } from "../../ui.js";
import { today, addDays, fmt12, fmtDate, money, isPast } from "../../dates.js";
import { href, go } from "../../router.js";

const FILTERS = [["upcoming", "Upcoming"], ["overdue", "To mark"], ["unsent", "Summaries to send"], ["no-notes", "Need notes"], ["past", "Past"]];
export function list(route) {
  const f = route.query.filter ?? "upcoming"; const T = today(); const all = S.get().lessons.filter((l) => l.status !== "rescheduled");
  let rows = [];
  if (f === "upcoming") rows = all.filter((l) => l.status === "scheduled" && !isPast(l)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  if (f === "overdue") rows = all.filter((l) => l.status === "scheduled" && isPast(l));
  if (f === "unsent") rows = all.filter((l) => S.consumes(l.status) && !l.summarySentAt);
  if (f === "no-notes") rows = all.filter((l) => l.status === "completed" && l.date >= addDays(T, -14) && S.notesOf(l.id)?.status !== "final").sort((a, b) => b.date.localeCompare(a.date));
  if (f === "past") rows = all.filter((l) => l.date < T).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const html = `${pageHeader("Lessons", { back: "/more" })}<div class="row wrap mb3">${FILTERS.map(([k, l]) => `<a class="chip ${f === k ? "chip-brand" : "chip-muted"}" href="${href(`/lessons?filter=${k}`)}">${l}</a>`).join("")}</div>
    ${rows.length ? `<div class="card list">${rows.map((l) => `<a class="li" href="${href(f === "no-notes" ? `/lessons/${l.id}/notes` : `/lessons/${l.id}`)}"><div><div class="med">${esc(S.studentName(l.studentId))}</div><div class="xs muted">${fmtDate(l.date)} · ${fmt12(l.time)} · ${loc(l.location)}</div></div><div class="row">${f === "no-notes" ? `<span class="btn btn-accent btn-sm">✎ Write notes</span>` : statusChip(l.status)}</div></a>`).join("")}</div>` : empty("Nothing here", f === "no-notes" ? "Every completed lesson of the last two weeks has notes." : "")}`;
  return { html };
}

export function detail(route) {
  const l = S.lesson(route.params.id); if (!l) return { html: empty("Lesson not found") };
  const s = S.student(l.studentId); const bal = S.balance(s.id); const n = S.notesOf(l.id); const simple = S.labOn("simple_lesson");
  const html = `${pageHeader(s.name, { subtitle: `${fmtDate(l.date, "long")} · ${fmt12(l.time)} · ${l.durationMin} min · ${loc(l.location)}${l.movedFrom ? ` · moved from ${esc(l.movedFrom)}` : ""}`, back: "/today", action: statusChip(l.status) })}
    ${route.query.warning ? `<div class="note note-warn mb3">${esc(route.query.warning)}</div>` : ""}
    <div class="card p4 col">
      <div class="row between small"><a class="brand" href="${href(`/students/${s.id}`)}">Student profile →</a>${chip(bal.tone, bal.text)}</div>
      ${l.status === "scheduled" ? `<div class="trans"><button class="btn btn-primary" style="flex:1" data-set="completed">Completed</button><button class="btn btn-outline" style="flex:1" data-set="no_show">No-show</button></div><div class="trans"><button class="btn btn-accent btn-sm" id="move-here">⇄ Move this lesson</button><button class="btn btn-ghost btn-sm" data-set="cancelled">Cancel lesson</button></div>` : ""}
      ${l.status === "completed" || l.status === "no_show" ? `<div class="row wrap"><a class="btn btn-primary btn-sm" href="${href(`/lessons/${l.id}/notes`)}">${n?.status === "final" ? "View notes" : n ? "Continue notes" : "Write notes"}</a>${l.summarySentAt ? `<span class="xs muted">Summary sent ${esc(l.summarySentAt)}</span>` : `<button class="btn btn-outline btn-sm" id="send-sum">Send attendance only</button>`}</div>` : ""}
      ${l.status === "cancelled" ? `<p class="small muted">${l.note === "Paused" ? "Paused (skipped during a pause window). " : "Cancelled. "}Not counted against the package.</p>` : ""}
      ${l.note && l.note !== "Paused" ? `<p class="small"><span class="muted">Note: </span>${esc(l.note)}</p>` : ""}
      ${l.status !== "scheduled" ? coll("Change status", statusEditorHtml(l)) : ""}
    </div>
    <div class="col3 mt4">
      ${coll(`Plan for this lesson · ${l.planned.length}`, `<ul class="list">${l.planned.map((p, i) => `<li class="li" style="padding-inline:0"><span class="small">${esc(p)}</span>${l.status !== "rescheduled" ? `<button class="link xs danger" data-rm-plan="${i}">×</button>` : ""}</li>`).join("") || `<li class="muted small">Nothing planned yet. Finalised notes seed the next lesson's plan.</li>`}</ul>${l.status === "scheduled" ? `<div class="row mt2"><input class="input" id="plan-new" placeholder="Add an item"><button class="btn btn-outline btn-sm" id="plan-add">Add</button></div>` : ""}`, l.status === "scheduled" && l.planned.length > 0)}
      ${l.covered.length ? coll(`Covered · ${l.covered.length}`, `<ul class="small" style="list-style:disc;padding-left:20px">${l.covered.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`) : ""}
      ${simple ? coll("More tools", `<p class="muted small">Move, delete and fee live here in the “simpler lesson page” lab.</p>`) : ""}
      ${l.status === "scheduled" ? `<div class="row between small muted"><span>Fee ${money(l.feeCents)}</span><button class="link xs danger" id="del">Delete this scheduled lesson</button></div>` : ""}
    </div>`;
  return { html, mount(root) {
    const q = (id) => root.querySelector(id);
    root.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => { const to = b.dataset.set; if (to === "cancelled") { const note = prompt("Cancel this lesson? Optional note to the parent:", ""); if (note === null) return; S.setStatus(l.id, "cancelled", { note }); toast("Cancelled · parent emailed"); return; } S.setStatus(l.id, to); if (to === "completed") go(`/lessons/${l.id}/notes`); }));
    mountStatusEditor(root, l);
    q("#move-here")?.addEventListener("click", () => openMoveLesson(s, (nl) => nl && go(`/lessons/${nl.id}`), l));
    q("#send-sum")?.addEventListener("click", () => openAttendanceReview(l.id));
    root.querySelectorAll("[data-rm-plan]").forEach((b) => b.addEventListener("click", () => S.setPlanned(l.id, l.planned.filter((_, i) => i !== Number(b.dataset.rmPlan)))));
    q("#plan-add")?.addEventListener("click", () => { const v = q("#plan-new").value.trim(); if (v) S.setPlanned(l.id, [...l.planned, v]); });
    q("#del")?.addEventListener("click", () => { if (confirm("Delete this scheduled lesson? The parent is not notified.")) { S.deleteLesson(l.id); go(`/students/${s.id}`); } });
  } };
}
export { section };
