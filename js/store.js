// In-memory state + the fake behaviours. Persists to sessionStorage only (this tab); Reset restores the seed.
import { seed } from "./data.js";
import { today, addDays, weekday, isPast, cmp, minutes, endTime, nowTime, fmtDateTime } from "./dates.js";

const KEY = "violin-proto-v1";
let state;
let listeners = [];
let counter = 1000;
export const uid = (p = "x") => `${p}${++counter}`;

/** Ids are "<prefix><n>". After a refresh the counter must start above every id already saved, or new rows collide. */
function syncCounter(s) {
  for (const k of ["families", "parents", "students", "lessons", "sessions", "repertoire", "requests", "pauses", "notifications", "busy"]) {
    for (const row of s[k] ?? []) { const m = /^[a-z]+(\d+)$/.exec(row.id ?? ""); if (m) counter = Math.max(counter, Number(m[1])); }
  }
}
function fresh(s) { syncCounter(s); recompute(s); lowBalance(s, true); return s; }
function load() {
  try { const raw = sessionStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.lessons) return fresh(s); } } catch { /* ignore */ }
  return fresh(seed());
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
export const get = () => state;
export function reset() { state = fresh(seed()); save(); emit(); }
export function onChange(fn) { listeners.push(fn); }
function emit() { for (const fn of listeners) fn(); }
export function mutate(fn) { const r = fn(state); recompute(state); lowBalance(state, false); save(); emit(); return r; }

// ---------- derived ----------
function CONSUMES(s) { return s === "completed" || s === "no_show"; }
export const consumes = CONSUMES;

/**
 * Package assignment, like the SQL: a lesson keeps the package it was given (so a moved lesson stays in its
 * package); lessons without one fill the earliest package with room. Cancelled and moved-away lessons free their slot.
 */
export function recompute(s) {
  for (const st of s.students) {
    const sessions = s.sessions.filter((x) => x.studentId === st.id).sort((a, b) => a.seq - b.seq);
    const ids = new Set(sessions.map((b) => b.id));
    const mine = s.lessons.filter((l) => l.studentId === st.id);
    const live = mine.filter((l) => l.status !== "cancelled" && l.status !== "rescheduled").sort(cmp);
    for (const l of mine) if (!live.includes(l) || !ids.has(l.sessionId)) l.sessionId = null;
    const count = Object.fromEntries(sessions.map((b) => [b.id, 0]));
    for (const l of live) if (l.sessionId) { const b = sessions.find((x) => x.id === l.sessionId); if (count[b.id] < b.total) count[b.id]++; else l.sessionId = null; }
    for (const l of live) if (!l.sessionId) { const b = sessions.find((x) => count[x.id] < x.total); if (!b) break; l.sessionId = b.id; count[b.id]++; }
    for (const b of sessions) {
      b.used = live.filter((l) => l.sessionId === b.id && CONSUMES(l.status)).length;
      b.status = b.used >= b.total ? "completed" : "active";
      if (b.status === "completed" && !b.completedAt) b.completedAt = today();
      if (b.status === "active") b.completedAt = null;
    }
    // Undo of the lesson that closed a package: the successor it auto-opened goes away again while nothing touched it
    const extra = sessions.find((b) => b.auto && !b.paid && b.used === 0 && sessions.some((a) => a.seq < b.seq && a.status === "active"));
    if (extra) { s.sessions = s.sessions.filter((b) => b !== extra); for (const l of mine) if (l.sessionId === extra.id) l.sessionId = null; return recompute(s); }
    // Everything consumed and lessons still waiting → auto-open the next package
    const active = sessions.find((b) => b.status === "active");
    if (!active && st.autoCreate && live.some((l) => !l.sessionId)) {
      const last = sessions[sessions.length - 1];
      s.sessions.push({ id: uid("b"), studentId: st.id, seq: (last?.seq ?? 0) + 1, total: 10, priceCents: st.rateCents * 10, paid: false, paidAt: null, startedAt: today(), parentSummary: null, used: 0, status: "active", auto: true });
      return recompute(s);
    }
  }
  return s;
}

/** R6: the renewal reminder goes out automatically (owner decision 2026-10-01) once per package when 2 lessons are left. */
function lowBalance(s, silent) {
  for (const b of s.sessions) {
    const left = b.total - b.used;
    if (b.status !== "active" || b.used === 0 || left > s.settings.lowBalanceThreshold || b.lowNotifiedAt) continue;
    b.lowNotifiedAt = today();
    if (silent) continue;
    const st = s.students.find((x) => x.id === b.studentId); if (!st) continue;
    notifyFamily(st.familyId, "session_low_balance", `${st.name}: ${left} lesson${left === 1 ? "" : "s"} left in package #${b.seq}`, `${st.name}：本期课包还剩 ${left} 节`, null, false, "auto");
  }
}

export const student = (id) => state.students.find((s) => s.id === id);
export const family = (id) => state.families.find((f) => f.id === id);
export const parentsOf = (familyId) => state.parents.filter((p) => p.familyId === familyId);
export const lesson = (id) => state.lessons.find((l) => l.id === id);
export const lessonsOf = (studentId) => state.lessons.filter((l) => l.studentId === studentId).sort(cmp);
export const session = (id) => state.sessions.find((b) => b.id === id);
export const sessionsOf = (studentId) => state.sessions.filter((b) => b.studentId === studentId).sort((a, b) => a.seq - b.seq);
export const activeSession = (studentId) => sessionsOf(studentId).find((b) => b.status === "active") ?? null;
export const notesOf = (lessonId) => state.notes[lessonId] ?? null;
export const studentsOfFamily = (familyId) => state.students.filter((s) => s.familyId === familyId);
export const lessonsBetween = (from, toExcl) => state.lessons.filter((l) => l.date >= from && l.date < toExcl && l.status !== "rescheduled").sort(cmp);
export const studentName = (id) => student(id)?.name ?? "?";
export const labOn = (id) => !!state.settings.labs[id];

export function attention() {
  const T = today();
  const overdue = state.lessons.filter((l) => l.status === "scheduled" && isPast(l)).length;
  const unsent = state.lessons.filter((l) => CONSUMES(l.status) && !l.summarySentAt).length;
  const notesMissing = state.lessons.filter((l) => l.status === "completed" && l.date >= addDays(T, -14) && !(state.notes[l.id]?.status === "final")).length;
  const requests = state.requests.filter((r) => r.status === "pending").length + state.pauses.filter((p) => p.status === "pending").length;
  const unpaid = state.sessions.filter((b) => b.status === "active" && !b.paid).length;
  const failed = state.notifications.filter((m) => m.status === "failed").length;
  return { overdue, unsent, notesMissing, requests, unpaid, failed };
}

export function balance(studentId) {
  const b = activeSession(studentId);
  if (!b) return { text: "No package", tone: "muted", remaining: 0, total: 0, b: null };
  const remaining = b.total - b.used;
  return { text: `${remaining} of ${b.total} left`, tone: remaining <= state.settings.lowBalanceThreshold ? "warn" : "brand", remaining, total: b.total, b };
}

// ---------- outbox ----------
export function queue(msg) {
  const row = { id: uid("m"), status: "sent", error: null, createdAt: `${today()} ${new Date().toTimeString().slice(0, 5)}`, ...msg };
  state.notifications.unshift(row);
  return row;
}
export function notifyFamily(familyId, event, subjectEn, subjectZh, lessonId = null, sms = false, how = "auto") {
  const fam = family(familyId); if (!fam) return 0;
  const subject = fam.language === "zh" ? subjectZh : subjectEn;
  let count = 0;
  for (const p of parentsOf(familyId)) {
    queue({ event, channel: "email", recipient: p.email, subject, lessonId, familyId, language: fam.language, how }); count++;
    if (sms && fam.smsOptIn && p.phone) { queue({ event, channel: "sms", recipient: p.phone, subject: null, body: subject, lessonId, familyId, language: fam.language, how }); count++; }
  }
  return count;
}
/** A message the teacher reviewed: sent by email (+ SMS when the family opted in), or copied for WeChat. */
export function sendReviewed(familyId, event, { subject, text, lessonId = null, sms = false, wechat = false }) {
  return mutate((s) => {
    const fam = family(familyId); if (!fam) return 0;
    if (wechat) { queue({ event, channel: "wechat", recipient: fam.name, subject, body: text, status: "copied", lessonId, familyId, language: fam.language, how: "reviewed" }); return 1; }
    let n = 0;
    for (const p of parentsOf(familyId)) {
      queue({ event, channel: "email", recipient: p.email, subject, body: text, lessonId, familyId, language: fam.language, how: "reviewed" }); n++;
      if (sms && fam.smsOptIn && p.phone) { queue({ event, channel: "sms", recipient: p.phone, subject: null, body: text, lessonId, familyId, language: fam.language, how: "reviewed" }); n++; }
    }
    return n;
  });
}

// ---------- lessons ----------
export const ALLOWED = { scheduled: ["completed", "no_show", "cancelled"], completed: ["no_show", "cancelled", "scheduled"], no_show: ["completed", "cancelled", "scheduled"], cancelled: ["scheduled", "completed", "no_show"], rescheduled: [] };

export function setStatus(lessonId, status, opts = {}) {
  return mutate((s) => {
    const l = s.lessons.find((x) => x.id === lessonId);
    const prev = l.status;
    l.status = status;
    if (status === "scheduled") { l.note = null; l.summarySentAt = null; }
    if (opts.note) l.note = opts.note;
    const st = student(l.studentId); const fam = family(st.familyId);
    if (status === "cancelled" && prev === "scheduled") notifyFamily(fam.id, "lesson_cancelled", `Cancelled: ${st.name}'s lesson ${l.date}`, `课程取消：${st.name} ${l.date}`, l.id, true);
    if (opts.tellParent && prev !== "scheduled" && prev !== status) notifyFamily(fam.id, "attendance_corrected", `Correction: ${st.name}'s lesson ${l.date}`, `更正：${st.name} ${l.date} 的课`, l.id);
    return prev;
  });
}
/** Moves the lesson (it keeps its package). Telling the parent is a separate, reviewed step (draft("moved", …)). */
export function moveLesson(lessonId, date, time) {
  return mutate((s) => {
    const l = s.lessons.find((x) => x.id === lessonId);
    if (!l || l.status !== "scheduled") return { error: "This lesson is no longer scheduled." };
    return moveLessonInline(s, l, date, time);
  });
}
export function addLesson(studentId, date, time, durationMin, location) {
  return mutate((s) => { const st = student(studentId); const l = { id: uid("l"), studentId, date, time, durationMin: durationMin || st.durationMin, location: location || st.location, feeCents: st.rateCents, status: "scheduled", note: null, summarySentAt: null, planned: [], covered: [] }; s.lessons.push(l); return l; });
}
export function deleteLesson(lessonId) { mutate((s) => { s.lessons = s.lessons.filter((l) => l.id !== lessonId); }); }
export function generateLessons(studentId, count, from, notify) {
  return mutate((s) => {
    const st = student(studentId); let d = from; let made = 0;
    while (weekday(d) !== st.weekday) d = addDays(d, 1);
    for (; made < count; d = addDays(d, 7)) {
      if (s.lessons.some((l) => l.studentId === studentId && l.date === d && l.status === "scheduled")) continue;
      s.lessons.push({ id: uid("l"), studentId, date: d, time: st.time, durationMin: st.durationMin, location: st.location, feeCents: st.rateCents, status: "scheduled", note: null, summarySentAt: null, planned: [], covered: [] }); made++;
    }
    if (notify) notifyFamily(st.familyId, "schedule_published", `${st.name}'s lesson schedule`, `${st.name} 的课程安排`, null, true);
    return made;
  });
}
/** The post-lesson email without notes, after the teacher reviewed it (owner decision 2026-10-01: reviewed, not automatic). */
export function sendSummary(lessonId, { text, wechat = false } = {}) {
  const l = lesson(lessonId); const st = student(l.studentId); const d = draft("attendance", { lesson: l });
  const n = sendReviewed(st.familyId, "lesson_completed", { subject: d.subject, text: text ?? d.text, lessonId, wechat });
  mutate(() => { l.summarySentAt = `${today()} ${nowTime()}`; });
  return n;
}
export function saveNotes(lessonId, patch) { mutate((s) => { const n = s.notes[lessonId] ?? { status: "draft", transcript: null, bullets: "", data: null, finalizedAt: null, sentAt: null }; Object.assign(n, patch); s.notes[lessonId] = n; }); }
export function sendNotes(lessonId, { wechat = false } = {}) {
  return mutate((s) => {
    const l = s.lessons.find((x) => x.id === lessonId); const st = student(l.studentId); const n = s.notes[lessonId];
    n.status = "final"; n.finalizedAt = today(); n.sentAt = `${today()} ${nowTime()}${wechat ? " (WeChat)" : ""}`;
    const first = !l.summarySentAt;
    if (wechat) queue({ event: first ? "lesson_completed" : "lesson_notes", channel: "wechat", recipient: family(st.familyId).name, subject: `${st.name} · ${l.date}`, body: n.data.message, status: "copied", lessonId, familyId: st.familyId, language: family(st.familyId).language, how: "reviewed" });
    else notifyFamily(st.familyId, first ? "lesson_completed" : "lesson_notes", first ? `${st.name}'s lesson · ${l.date}` : `Notes: ${st.name}'s lesson ${l.date}`, first ? `课堂总结：${st.name} ${l.date}` : `课堂笔记：${st.name} ${l.date}`, l.id, false, "reviewed");
    l.summarySentAt = n.sentAt;
    // materialise: covered items + repertoire + next lesson plan
    l.covered = [...n.data.repertoire.map((r) => r.piece), ...n.data.technique];
    for (const r of n.data.repertoire) {
      const ex = s.repertoire.find((x) => x.studentId === st.id && x.title.toLowerCase() === r.piece.toLowerCase());
      if (ex) { ex.status = r.status; if (r.status === "completed" && !ex.completedOn) ex.completedOn = today(); }
      else s.repertoire.push({ id: uid("r"), studentId: st.id, title: r.piece, composer: r.composer, status: r.status, startedOn: today(), completedOn: r.status === "completed" ? today() : null });
    }
    const next = s.lessons.filter((x) => x.studentId === st.id && x.status === "scheduled" && (x.date > l.date || (x.date === l.date && x.time > l.time))).sort(cmp)[0];
    if (next) next.planned = [...n.data.nextPlan];
  });
}
export function previousFinalNotes(lessonId) {
  const l = lesson(lessonId);
  const prior = lessonsOf(l.studentId).filter((x) => x.id !== l.id && x.date <= l.date && state.notes[x.id]?.status === "final").sort(cmp);
  return prior.length ? state.notes[prior[prior.length - 1].id] : null;
}

// ---------- packages ----------
export function togglePaid(sessionId) { mutate((s) => { const b = s.sessions.find((x) => x.id === sessionId); b.paid = !b.paid; b.paidAt = b.paid ? today() : null; if (b.paid) { const st = student(b.studentId); notifyFamily(st.familyId, "session_paid", `Receipt: package #${b.seq} for ${st.name}`, `收据：${st.name} 第 ${b.seq} 期课包`); } }); }
export function newSession(studentId, priceCents, alreadyUsed = 0) { mutate((s) => { const last = sessionsOf(studentId).slice(-1)[0]; s.sessions.push({ id: uid("b"), studentId, seq: (last?.seq ?? 0) + 1, total: 10, priceCents, paid: false, paidAt: null, startedAt: today(), parentSummary: null }); for (let i = 0; i < alreadyUsed; i++) s.lessons.push({ id: uid("l"), studentId, date: addDays(today(), -7 * (alreadyUsed - i)), time: "12:00", durationMin: 45, location: "online", feeCents: 0, status: "completed", note: "Backfilled", summarySentAt: "backfill", planned: [], covered: [] }); }); }
export function backfill(studentId, date, time, status) { mutate((s) => { const st = student(studentId); s.lessons.push({ id: uid("l"), studentId, date, time, durationMin: st.durationMin, location: st.location, feeCents: st.rateCents, status, note: "Backfilled", summarySentAt: "backfill", planned: [], covered: [] }); }); }

// ---------- requests ----------
export function createRequest(lessonId, date, time, reason) { return mutate((s) => { const l = lesson(lessonId); const st = student(l.studentId); const r = { id: uid("q"), lessonId, familyId: st.familyId, status: "pending", proposedDate: date, proposedTime: time, reason, counterDate: null, counterTime: null, teacherNote: null, createdAt: today(), newLessonId: null }; s.requests.push(r); queue({ event: "reschedule_requested", channel: "email", recipient: s.settings.teacherEmail, subject: `Reschedule request: ${st.name}`, lessonId, familyId: st.familyId, language: "en" }); return r; }); }
/** True when the request's lesson was moved or cancelled after the parent asked (like reschedule_lesson in SQL, which raises). */
export const requestStale = (r) => lesson(r.lessonId)?.status !== "scheduled";
/** Records the decision. The parent message is drafted with draft("approved" | "countered" | "declined") and reviewed by the teacher. */
export function decideRequest(id, decision, note, counterDate, counterTime) {
  return mutate((s) => {
    const r = s.requests.find((x) => x.id === id); const l = lesson(r.lessonId);
    if (decision !== "reject" && l.status !== "scheduled") return { error: "This lesson was already moved or cancelled, so the request can only be declined." };
    r.teacherNote = note || null;
    if (decision === "approve") { const nl = moveLessonInline(s, l, r.proposedDate, r.proposedTime); r.status = "approved"; r.newLessonId = nl.id; return { request: r, lesson: nl }; }
    if (decision === "reject") { r.status = "rejected"; return { request: r }; }
    r.status = "countered"; r.counterDate = counterDate; r.counterTime = counterTime; return { request: r };
  });
}
/** The parent accepts the teacher's alternative: confirmed to them right away (they chose it themselves). */
export function acceptCounter(id) {
  return mutate((s) => {
    const r = s.requests.find((x) => x.id === id); const l = lesson(r.lessonId);
    if (l.status !== "scheduled") { r.status = "rejected"; return { error: "This lesson was changed in the meantime. Please contact your teacher." }; }
    const nl = moveLessonInline(s, l, r.counterDate, r.counterTime); r.status = "approved"; r.newLessonId = nl.id; const st = student(l.studentId);
    notifyFamily(st.familyId, "reschedule_approved", `Confirmed: ${st.name}'s lesson is now ${fmtDateTime(r.counterDate, r.counterTime)}`, `已确认：${st.name} 的课改为 ${fmtDateTime(r.counterDate, r.counterTime, "zh")}`, nl.id, true);
    return { lesson: nl };
  });
}
/** A pending request is withdrawn by the parent; declining the teacher's alternative is "rejected", as in live. */
export function withdrawRequest(id) { mutate((s) => { const r = s.requests.find((x) => x.id === id); r.status = r.status === "countered" ? "rejected" : "withdrawn"; }); }
function moveLessonInline(s, l, date, time) { const nl = { ...l, id: uid("l"), date, time, status: "scheduled", movedFrom: `${l.date} ${l.time}`, covered: [] }; l.status = "rescheduled"; l.movedTo = nl.id; s.lessons.push(nl); return nl; }

/** Hours from now until a date + time (the 24 h rule counts hours, not days). */
export function hoursUntil(date, time) { const [y, m, d] = date.split("-").map(Number); const [h, mi] = time.split(":").map(Number); return (new Date(y, m - 1, d, h, mi) - new Date()) / 3600000; }

// ---------- drafts the teacher reviews before anything reaches the parent ----------
/** kind: moved | approved | countered | declined | attendance → { lang, subject, text } in the family's language. */
export function draft(kind, { lesson: l, from = null, to = null, note = "" }) {
  const st = student(l.studentId); const fam = family(st.familyId); const zh = fam.language === "zh";
  const p = parentsOf(fam.id)[0]; const hi = zh ? `${p?.name ?? ""}您好，` : `Hi ${(p?.name ?? "").split(" ")[0]},`;
  const sign = zh ? `—— ${state.settings.teacherName}` : `— ${state.settings.teacherName}`;
  const when = (d, t) => fmtDateTime(d, t, zh ? "zh" : "en");
  const extra = note?.trim() ? `\n${note.trim()}` : "";
  const bal = balance(st.id);
  const T = {
    moved: () => (zh ? [`${st.name} 的课改时间了`, `${hi}${st.name} 原定 ${when(from.date, from.time)} 的课改到 ${when(to.date, to.time)}。${extra}`] : [`${st.name}'s lesson has moved`, `${hi} ${st.name}'s lesson on ${when(from.date, from.time)} has moved to ${when(to.date, to.time)}.${extra}`]),
    approved: () => (zh ? [`已确认：${st.name} 的课改到 ${when(to.date, to.time)}`, `${hi}可以的，${st.name} 原定 ${when(from.date, from.time)} 的课改到 ${when(to.date, to.time)}。${extra}`] : [`Confirmed: ${st.name}'s lesson is now ${when(to.date, to.time)}`, `${hi} that works. ${st.name}'s lesson on ${when(from.date, from.time)} is now ${when(to.date, to.time)}.${extra}`]),
    countered: () => (zh ? [`${st.name} 的课：老师建议其他时间`, `${hi}${when(from.date, from.time)} 我这边不方便，改到 ${when(to.date, to.time)} 可以吗？请在家长门户里接受或拒绝。${extra}`] : [`Another time for ${st.name}'s lesson`, `${hi} ${when(from.date, from.time)} doesn't work for me. Could we do ${when(to.date, to.time)} instead? Please accept or decline in the portal.${extra}`]),
    declined: () => (zh ? [`${st.name} 的课无法改期`, `${hi}抱歉，${st.name} ${when(l.date, l.time)} 的课这次没法改，还是按原时间上。${extra}`] : [`${st.name}'s lesson stays as planned`, `${hi} sorry, I can't move ${st.name}'s lesson on ${when(l.date, l.time)} this time, so it stays as planned.${extra}`]),
    attendance: () => (l.status === "no_show"
      ? (zh ? [`考勤：${st.name} ${when(l.date, l.time)}`, `${hi}${st.name} ${when(l.date, l.time)} 的课记为缺席（计入课包）。课包还剩 ${bal.remaining} 节（共 ${bal.total} 节）。${extra}`] : [`Attendance: ${st.name} · ${when(l.date, l.time)}`, `${hi} ${st.name} was marked absent for the lesson on ${when(l.date, l.time)} (it counts toward the package). ${bal.remaining} of ${bal.total} lessons left.${extra}`])
      : (zh ? [`课堂总结：${st.name} ${when(l.date, l.time)}`, `${hi}${st.name} ${when(l.date, l.time)} 的课已上完。课包还剩 ${bal.remaining} 节（共 ${bal.total} 节）。${extra}`] : [`${st.name}'s lesson · ${when(l.date, l.time)}`, `${hi} ${st.name} attended the lesson on ${when(l.date, l.time)}. ${bal.remaining} of ${bal.total} lessons left in the package.${extra}`])),
  }[kind]();
  return { lang: fam.language, subject: T[0], text: `${T[1]}\n${sign}` };
}

// ---------- pauses ----------
export function pausePreview(studentId, startsOn, endsOn) { return state.lessons.filter((l) => l.studentId === studentId && l.status === "scheduled" && l.date >= startsOn && l.date <= endsOn).sort(cmp); }
export function createPause(studentId, startsOn, endsOn, reason) { return mutate((s) => { const st = student(studentId); const p = { id: uid("z"), studentId, familyId: st.familyId, startsOn, endsOn, reason, status: "pending", result: null, createdAt: today() }; s.pauses.push(p); queue({ event: "pause_requested", channel: "email", recipient: s.settings.teacherEmail, subject: `Pause request: ${st.name}`, familyId: st.familyId, language: "en" }); return p; }); }
export function applyPause(studentId, startsOn, endsOn, requestId = null, note = null) {
  return mutate((s) => {
    const st = student(studentId);
    const inWin = s.lessons.filter((l) => l.studentId === studentId && l.status === "scheduled" && l.date >= startsOn && l.date <= endsOn);
    for (const l of inWin) { l.status = "cancelled"; l.note = "Paused"; }
    const last = s.lessons.filter((l) => l.studentId === studentId && l.status === "scheduled").map((l) => l.date).sort().slice(-1)[0] ?? endsOn;
    let d = addDays(last > endsOn ? last : endsOn, 1); const created = [];
    if (st.weekday !== null) { while (weekday(d) !== st.weekday) d = addDays(d, 1); for (let i = 0; i < inWin.length; i++, d = addDays(d, 7)) { const nl = { id: uid("l"), studentId, date: d, time: st.time, durationMin: st.durationMin, location: st.location, feeCents: st.rateCents, status: "scheduled", note: null, summarySentAt: null, planned: [], covered: [] }; s.lessons.push(nl); created.push(nl); } }
    const result = { cancelled: inWin.length, created: created.length, newDates: created.map((l) => l.date) };
    if (requestId) { const p = s.pauses.find((x) => x.id === requestId); p.status = "approved"; p.result = result; p.teacherNote = note; }
    notifyFamily(st.familyId, "pause_approved", `Confirmed: ${st.name}'s lessons paused ${startsOn} – ${endsOn}`, `已确认：${st.name} 的课暂停 ${startsOn} – ${endsOn}`, null, true);
    return result;
  });
}
export function rejectPause(id, note) { mutate((s) => { const p = s.pauses.find((x) => x.id === id); p.status = "rejected"; p.teacherNote = note; const st = student(p.studentId); notifyFamily(st.familyId, "pause_rejected", `Pause not possible: ${st.name}`, `无法暂停：${st.name}`); }); }
export function withdrawPause(id) { mutate((s) => { const p = s.pauses.find((x) => x.id === id); p.status = "withdrawn"; }); }

// ---------- students ----------
export function saveStudent(id, patch) { return mutate((s) => { if (id) { Object.assign(s.students.find((x) => x.id === id), patch); return id; } const nid = uid("s"); s.students.push({ id: nid, active: true, autoCreate: true, notes: "", ...patch }); return nid; }); }
export function saveFamily(id, patch) { mutate((s) => Object.assign(s.families.find((x) => x.id === id), patch)); }
export function newFamily(name, language, parentName, email, phone, sms) { return mutate((s) => { const fid = uid("f"); s.families.push({ id: fid, name, language, smsOptIn: sms }); s.parents.push({ id: uid("p"), familyId: fid, name: parentName, email, phone, primary: true }); return fid; }); }
export function addParent(familyId, name, email, phone) { mutate((s) => s.parents.push({ id: uid("p"), familyId, name, email, phone, primary: false })); }
/** A family keeps at least one parent (their sign-in and the email address). */
export function removeParent(id) { return mutate((s) => { const p = s.parents.find((x) => x.id === id); if (s.parents.filter((x) => x.familyId === p.familyId).length < 2) return { error: "A family needs at least one parent. Add another parent first." }; s.parents = s.parents.filter((x) => x.id !== id); if (p.primary) s.parents.find((x) => x.familyId === p.familyId).primary = true; return {}; }); }
export function deleteStudent(id) {
  return mutate((s) => {
    const st = student(id); const lessons = s.lessons.filter((l) => l.studentId === id).length; const sessions = s.sessions.filter((b) => b.studentId === id).length;
    const ids = new Set(s.lessons.filter((l) => l.studentId === id).map((l) => l.id)); s.requests = s.requests.filter((r) => !ids.has(r.lessonId));
    s.lessons = s.lessons.filter((l) => l.studentId !== id); s.sessions = s.sessions.filter((b) => b.studentId !== id); s.repertoire = s.repertoire.filter((r) => r.studentId !== id); s.pauses = s.pauses.filter((p) => p.studentId !== id);
    s.students = s.students.filter((x) => x.id !== id);
    let familyDeleted = false;
    if (!s.students.some((x) => x.familyId === st.familyId)) { s.families = s.families.filter((f) => f.id !== st.familyId); s.parents = s.parents.filter((p) => p.familyId !== st.familyId); familyDeleted = true; }
    if (!s.families.some((f) => f.id === s.portal.familyId) && s.families[0]) s.portal = { familyId: s.families[0].id, lang: s.families[0].language };
    return { name: st.name, lessons, sessions, familyDeleted };
  });
}
export function upsertRepertoire(studentId, item) { mutate((s) => { if (item.id) Object.assign(s.repertoire.find((r) => r.id === item.id), item); else s.repertoire.push({ id: uid("r"), studentId, startedOn: today(), completedOn: null, ...item }); }); }
export function deleteRepertoire(id) { mutate((s) => { s.repertoire = s.repertoire.filter((r) => r.id !== id); }); }
export function setPlanned(lessonId, items) { mutate((s) => { s.lessons.find((l) => l.id === lessonId).planned = items; }); }

// ---------- settings / labs / outbox ----------
export function saveSettings(patch) { mutate((s) => Object.assign(s.settings, patch)); }
export function setLab(id, on) { mutate((s) => { s.settings.labs[id] = on; }); }
export function retryNotification(id) { mutate((s) => { const m = s.notifications.find((x) => x.id === id); m.status = "sent"; m.error = null; }); }
export function addOverride(day, location) { mutate((s) => { s.dayOverrides = s.dayOverrides.filter((o) => o.day !== day); s.dayOverrides.push({ day, location }); }); }
export function removeOverride(day) { mutate((s) => { s.dayOverrides = s.dayOverrides.filter((o) => o.day !== day); }); }
export function addBusy(date, start, end, title) { mutate((s) => s.busy.push({ id: uid("u"), date, start, end, title })); }
export function removeBusy(id) { mutate((s) => { s.busy = s.busy.filter((b) => b.id !== id); }); }
export function setPortal(patch) { mutate((s) => Object.assign(s.portal, patch)); }

// ---------- scheduler (mirror of src/lib/domain/scheduler.ts, simplified) ----------
export function dayLocation(date) { const o = state.dayOverrides.find((x) => x.day === date); return o ? o.location : state.settings.dayLocations[weekday(date)]; }
export function checkSlot({ date, time, durationMin, location, excludeId = null }) {
  const st = state.settings; const reasons = []; let level = "ok";
  const start = minutes(time), end = start + durationMin;
  if (date < today() || (date === today() && time < nowTime())) { level = "block"; reasons.push("That time has already passed"); }
  if (start < minutes(st.teachingStart) || end > minutes(st.teachingEnd)) { level = "block"; reasons.push(`Outside teaching hours (${st.teachingStart}–${st.teachingEnd})`); }
  const same = state.lessons.filter((l) => l.date === date && l.status !== "cancelled" && l.status !== "rescheduled" && l.id !== excludeId);
  for (const l of same) {
    const s2 = minutes(l.time), e2 = s2 + l.durationMin;
    if (s2 < end && start < e2) { level = "block"; reasons.push(`Overlaps ${studentName(l.studentId)} ${l.time}`); continue; }
    const gap = s2 >= end ? s2 - end : start - e2;
    const inPerson = l.location !== "online" && location !== "online";
    if (inPerson && l.location !== location && gap < st.commuteMinutes) { level = level === "block" ? level : "block"; reasons.push(`${st.commuteMinutes} min commute from ${studentName(l.studentId)} (${l.location === "newmarket" ? "Newmarket" : "North York"}) does not fit`); }
    else if (gap < st.bufferMinutes) { if (level === "ok") level = "warn"; reasons.push(`Only ${gap} min after ${studentName(l.studentId)}`); }
  }
  for (const b of state.busy.filter((x) => x.date === date)) { if (minutes(b.start) < end && start < minutes(b.end)) { level = "block"; reasons.push(`Unavailable: ${b.title}`); } }
  const plan = dayLocation(date);
  if (location !== "online" && plan !== location) { if (level === "ok") level = "warn"; reasons.push(`${date} is a ${plan === "newmarket" ? "Newmarket" : "North York"} day`); }
  if (!reasons.length) reasons.push(plan === location ? `Free · matches the ${plan === "newmarket" ? "Newmarket" : "North York"} day` : "Free");
  return { level, reasons };
}
export function suggestSlots(studentId, from, to, location, limit = 6) {
  const st = student(studentId); const out = [];
  for (let d = from; d <= to && out.length < 40; d = addDays(d, 1)) {
    for (let m = minutes(state.settings.teachingStart); m + st.durationMin <= minutes(state.settings.teachingEnd); m += 15) {
      const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const c = checkSlot({ date: d, time, durationMin: st.durationMin, location });
      if (c.level === "block") continue;
      const score = (c.level === "ok" ? 0 : 5) + (weekday(d) === st.weekday ? 0 : 2) + Math.abs(m - minutes(st.time ?? "16:00")) / 60 + (dayLocation(d) === location ? 0 : 3);
      out.push({ date: d, time, level: c.level, reason: c.reasons[0], score });
    }
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}
export { endTime };

state = load();
