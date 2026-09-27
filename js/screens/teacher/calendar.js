import * as S from "../../store.js";
import { calendarHtml, mountCalendar, openLessonSheet, openMoveConfirm, openAddLesson, openFindTime } from "../../ui.js";
import { today, monthGrid, weekOf, addDays } from "../../dates.js";

export function render(route) {
  const view = route.query.view === "week" ? "week" : "month"; const anchor = route.query.date ?? today();
  const rows = view === "month" ? monthGrid(anchor) : [weekOf(anchor)];
  const lessons = S.lessonsBetween(rows[0][0], addDays(rows[rows.length - 1][6], 1));
  const html = calendarHtml({ view, anchor, basePath: "/calendar", lessons });
  return { html, mount(root) { mountCalendar(root, { lessons, onLesson: (l) => openLessonSheet(l), onAdd: (d) => openAddLesson(d, null), onMove: (l, d) => openMoveConfirm(l, d), onFind: () => openFindTime(null) }); } };
}
