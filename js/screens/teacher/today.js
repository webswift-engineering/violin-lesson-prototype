import * as S from "../../store.js";
import { esc, chip, statusChip, section, empty, calendarHtml, mountCalendar, openLessonSheet, openMoveConfirm, openAddLesson, openFindTime, openMoveLesson, toast, loc } from "../../ui.js";
import { today, addDays, fmt12, fmtDate, isPast } from "../../dates.js";
import { href, go } from "../../router.js";

function lessonCard(l) {
  const st = S.student(l.studentId); const bal = S.balance(st.id); const n = S.notesOf(l.id);
  const overdue = l.status === "scheduled" && isPast(l);
  let acts = "";
  if (l.status === "scheduled") acts = `<div class="grid2"><button class="btn btn-primary" data-set="completed" data-l="${l.id}">Completed</button><button class="btn btn-outline" data-set="no_show" data-l="${l.id}">No-show</button></div><div class="row"><button class="btn btn-ghost btn-sm" data-move="${l.id}">⇄ Move</button><button class="btn btn-ghost btn-sm" data-set="cancelled" data-l="${l.id}">Cancel</button></div>`;
  else if (l.status === "completed") acts = n?.status === "final" ? `<div class="row"><a class="btn btn-outline btn-sm" href="${href(`/lessons/${l.id}/notes`)}">View notes</a>${l.summarySentAt ? chip("ok", "Summary sent") : ""}</div>` : `<a class="btn btn-accent w" href="${href(`/lessons/${l.id}/notes`)}">✎ Write notes · about 2 min</a>${l.summarySentAt ? "" : `<button class="btn btn-ghost btn-sm" data-send="${l.id}">Send attendance only</button>`}`;
  else if (l.status === "no_show") acts = l.summarySentAt ? chip("ok", "Parent told") : `<button class="btn btn-outline w" data-send="${l.id}">Send attendance</button>`;
  return `<div class="card lcard"><div class="row between"><a class="who" href="${href(`/lessons/${l.id}`)}">${esc(st.name)}</a>${overdue ? chip("warn", "To mark") : statusChip(l.status)}</div><div class="muted small">${fmt12(l.time)} · ${l.durationMin} min · ${loc(l.location)} · ${chip(bal.tone, bal.text)}${l.planned.length ? `<div class="xs mt1">Plan: ${l.planned.map(esc).join(" · ")}</div>` : ""}</div>${acts}</div>`;
}

export function render(route) {
  const T = today(); const st = S.get();
  const todays = S.lessonsBetween(T, addDays(T, 1));
  const overdue = st.lessons.filter((l) => l.status === "scheduled" && l.date < T);
  const weekAnchor = route.query.date ?? T;
  const weekLessons = S.lessonsBetween(addDays(weekAnchor, -7), addDays(weekAnchor, 14));
  const html = `<div class="page-h"><div><h1>Today</h1><div class="muted small mt1">${fmtDate(T, "long")} · ${loc(S.dayLocation(T))} day</div></div><a class="btn btn-outline btn-sm" href="${href("/calendar")}">Calendar</a></div>
    ${overdue.length ? `<div class="note note-warn mb3">${overdue.length} earlier lesson${overdue.length > 1 ? "s" : ""} still to mark: ${overdue.slice(0, 3).map((l) => `<a class="b" href="${href(`/lessons/${l.id}`)}">${esc(S.studentName(l.studentId))} ${fmtDate(l.date, "md")}</a>`).join(", ")}</div>` : ""}
    ${todays.length ? `<div class="col3">${todays.map(lessonCard).join("")}</div>` : empty("No lessons today", "Enjoy the quiet.")}
    ${S.labOn("today_week") ? section("This week", calendarHtml({ view: "week", anchor: weekAnchor, basePath: "/today", lessons: weekLessons, chrome: "week-strip" }), `<a class="small brand" href="${href("/lessons")}">All lessons →</a>`) : section("Next 7 days", `<div class="card list">${S.lessonsBetween(addDays(T, 1), addDays(T, 8)).map((l) => `<a class="li" href="${href(`/lessons/${l.id}`)}"><span class="med">${esc(S.studentName(l.studentId))}</span><span class="muted small">${fmtDate(l.date)} · ${fmt12(l.time)}</span></a>`).join("") || `<div class="li muted small">Nothing scheduled.</div>`}</div>`, `<a class="small brand" href="${href("/lessons")}">All lessons →</a>`)}`;
  return { html, mount(root) {
    root.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => {
      const to = b.dataset.set, id = b.dataset.l;
      if (to === "cancelled") { const note = prompt("Cancel this lesson? Optional note to the parent:", ""); if (note === null) return; S.setStatus(id, "cancelled", { note }); toast("Cancelled · parent emailed"); return; }
      S.setStatus(id, to);
      if (to === "completed") go(`/lessons/${id}/notes`); else toast(`${S.studentName(S.lesson(id).studentId)}: no-show`);
    }));
    root.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", () => { const l = S.lesson(b.dataset.move); openMoveLesson(S.student(l.studentId), null, l); }));
    root.querySelectorAll("[data-send]").forEach((b) => b.addEventListener("click", () => { const n = S.sendSummary(b.dataset.send); toast(`Attendance email sent (${n} message${n === 1 ? "" : "s"})`); }));
    mountCalendar(root, { lessons: weekLessons, onLesson: (l) => openLessonSheet(l), onAdd: (d) => openAddLesson(d, null), onMove: (l, d) => openMoveConfirm(l, d), onFind: () => openFindTime(null) });
  } };
}
