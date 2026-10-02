// The sample studio. Everything here is invented and regenerated around today's date.
import { today, addDays, weekday, isPast, key } from "./dates.js";

let n = 0;
const id = (p) => `${p}${++n}`;

export function seed() {
  n = 0;
  const T = today();
  const settings = {
    studioName: "Jillian Yang Violin Studio", teacherName: "Jillian Yang", teacherEmail: "teacher@example.com", teacherPhone: "+1 555 010 0000",
    replyTo: "teacher@example.com", timezone: "America/Toronto", websiteUrl: "https://www.jillianyang.com", reminderHours: 24, lowBalanceThreshold: 2, minNoticeHours: 24,
    teachingStart: "10:00", teachingEnd: "20:00", bufferMinutes: 15, commuteMinutes: 45,
    dayLocations: { 0: "north_york", 1: "north_york", 2: "newmarket", 3: "north_york", 4: "newmarket", 5: "north_york", 6: "north_york" },
    labs: { quick_notes: true, today_week: true, simple_lesson: false },
  };
  const families = [
    { id: "f1", name: "Chen family", language: "en", smsOptIn: false },
    { id: "f2", name: "Nguyen family", language: "en", smsOptIn: true },
    { id: "f3", name: "王家", language: "zh", smsOptIn: true },
  ];
  const parents = [
    { id: "p1", familyId: "f1", name: "Amy Chen", email: "amy.chen@example.com", phone: "+1 555 111 0001", primary: true },
    { id: "p2", familyId: "f2", name: "Linh Nguyen", email: "linh.nguyen@example.com", phone: "+1 555 111 0002", primary: true },
    { id: "p3", familyId: "f3", name: "王丽", email: "li.wang@example.com", phone: "+1 555 111 0003", primary: true },
    { id: "p4", familyId: "f3", name: "王强", email: "qiang.wang@example.com", phone: "", primary: false },
  ];
  const students = [
    { id: "s1", familyId: "f1", name: "Emma Chen", level: "Suzuki Book 2", age: 8, size: "1/2", durationMin: 45, rateCents: 6500, weekday: 2, time: "16:00", location: "newmarket", active: true, autoCreate: true, notes: "Loves Twinkle variations. Bring the small shoulder rest." },
    { id: "s2", familyId: "f2", name: "Kai Nguyen", level: "Suzuki Book 4", age: 11, size: "3/4", durationMin: 60, rateCents: 8000, weekday: 4, time: "17:00", location: "north_york", active: true, autoCreate: true, notes: "" },
    { id: "s3", familyId: "f3", name: "王小明", level: "Beginner", age: 6, size: "1/4", durationMin: 30, rateCents: 5000, weekday: 6, time: "10:00", location: "online", active: true, autoCreate: true, notes: "" },
    { id: "s4", familyId: "f3", name: "王小美", level: "Suzuki Book 1", age: 9, size: "1/2", durationMin: 45, rateCents: 6500, weekday: 6, time: "10:45", location: "online", active: true, autoCreate: true, notes: "" },
    { id: "s5", familyId: "f1", name: "Lucas Chen", level: "Suzuki Book 3", age: 12, size: "4/4", durationMin: 45, rateCents: 6500, weekday: null, time: null, location: "newmarket", active: false, autoCreate: true, notes: "Paused for the school year." },
  ];

  // Lessons: weekly slots from 9 weeks back to 6 weeks ahead. Past lessons get attendance.
  const lessons = [];
  const pastPattern = { s1: ["c", "c", "c", "n", "c", "c", "c", "x", "c"], s2: ["c", "c", "c", "c", "c", "c", "n", "c", "c"], s3: ["c", "n", "c", "c", "c", "c", "c", "c", "c"], s4: ["c", "c", "c", "c", "x", "c", "c", "c", "c"] };
  for (const s of students) {
    if (!s.weekday && s.weekday !== 0) continue;
    // first slot date >= T-63
    let d = addDays(T, -63);
    while (weekday(d) !== s.weekday) d = addDays(d, 1);
    let i = 0;
    for (; d <= addDays(T, 42); d = addDays(d, 7), i++) {
      const l = { id: id("l"), studentId: s.id, date: d, time: s.time, durationMin: s.durationMin, location: s.location, feeCents: s.rateCents, status: "scheduled", note: null, summarySentAt: null, planned: [], covered: [] };
      if (isPast(l)) {
        const p = pastPattern[s.id][i] ?? "c";
        l.status = p === "n" ? "no_show" : p === "x" ? "cancelled" : "completed";
        if (p === "x") l.note = s.id === "s4" ? "Paused" : "Sick";
        if (l.status !== "cancelled") l.summarySentAt = `${d} ${s.time}`;
      }
      lessons.push(l);
    }
  }
  // Today: guarantee a realistic day whatever the weekday.
  const todays = [
    { studentId: "s4", time: "10:00", durationMin: 45, location: "online", status: "completed", summarySentAt: null }, // needs notes
    { studentId: "s2", time: "12:35", durationMin: 60, location: "north_york", status: "scheduled" },
    { studentId: "s1", time: "16:00", durationMin: 45, location: "newmarket", status: "scheduled" },
    { studentId: "s3", time: "17:30", durationMin: 30, location: "online", status: "scheduled" },
  ];
  const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fits = (time, dur, loc) => lessons.filter((l) => l.date === T).every((l) => { const gap = Math.max(mins(l.time) - (mins(time) + dur), mins(time) - (mins(l.time) + l.durationMin)); const travel = l.location !== loc && l.location !== "online" && loc !== "online" ? 45 : 15; return gap >= travel; });
  const slots = ["10:00", "11:00", "12:35", "13:30", "14:30", "15:30", "16:00", "17:30", "18:30", "19:00"];
  for (const t of todays) {
    if (lessons.some((l) => l.studentId === t.studentId && l.date === T)) continue;
    const time = [t.time, ...slots].find((x) => fits(x, t.durationMin, t.location)); if (!time) continue;
    const st = students.find((x) => x.id === t.studentId);
    lessons.push({ id: id("l"), studentId: t.studentId, date: T, time, durationMin: t.durationMin, location: t.location, feeCents: st.rateCents, status: t.status, note: null, summarySentAt: t.summarySentAt ?? null, planned: [], covered: [] });
  }
  // Yesterday: one overdue lesson still "scheduled" (to mark) for Kai if none exists
  const y = addDays(T, -1);
  if (!lessons.some((l) => l.date === y)) lessons.push({ id: id("l"), studentId: "s2", date: y, time: "17:00", durationMin: 60, location: "north_york", feeCents: 8000, status: "scheduled", note: null, summarySentAt: null, planned: [], covered: [] });
  // Two completed lessons this week without notes (the "needs notes" chip)
  const recentDone = lessons.filter((l) => l.status === "completed" && l.date < T).sort((a, b) => b.date.localeCompare(a.date));
  if (recentDone[0]) recentDone[0].summarySentAt = null;

  // Planned items for upcoming lessons (seeded by earlier notes)
  for (const l of lessons.filter((x) => x.status === "scheduled" && x.date >= T).slice(0, 6)) {
    l.planned = l.studentId === "s1" ? ["Minuet No. 2 bars 9–16", "Vibrato introduction"] : l.studentId === "s2" ? ["Seitz Concerto No. 2, 3rd mvt", "Shifting to 3rd position"] : ["Twinkle variation B", "Bow hold check"];
  }

  // Sessions (packages). The store recomputes assignment and counts from lessons.
  const sessions = [
    { id: "b1", studentId: "s1", seq: 1, total: 10, priceCents: 65000, paid: true, paidAt: addDays(T, -100), startedAt: addDays(T, -100), parentSummary: "Emma finished Book 1 in this package: steady bow, confident Twinkle variations, first Minuet learned." },
    { id: "b2", studentId: "s1", seq: 2, total: 10, priceCents: 65000, paid: false, paidAt: null, startedAt: addDays(T, -30), parentSummary: null },
    { id: "b3", studentId: "s2", seq: 1, total: 10, priceCents: 80000, paid: true, paidAt: addDays(T, -50), startedAt: addDays(T, -50), parentSummary: null },
    { id: "b4", studentId: "s3", seq: 1, total: 10, priceCents: 50000, paid: true, paidAt: addDays(T, -60), startedAt: addDays(T, -60), parentSummary: null },
    { id: "b5", studentId: "s4", seq: 1, total: 10, priceCents: 65000, paid: false, paidAt: null, startedAt: addDays(T, -60), parentSummary: null },
  ];

  const repertoire = [
    { id: "r1", studentId: "s1", title: "Minuet No. 1", composer: "J. S. Bach", status: "completed", startedOn: addDays(T, -70), completedOn: addDays(T, -21) },
    { id: "r2", studentId: "s1", title: "Minuet No. 2", composer: "J. S. Bach", status: "in_progress", startedOn: addDays(T, -21), completedOn: null },
    { id: "r3", studentId: "s1", title: "Lightly Row", composer: "Folk", status: "completed", startedOn: addDays(T, -120), completedOn: addDays(T, -80) },
    { id: "r4", studentId: "s2", title: "Concerto No. 2, 3rd mvt", composer: "F. Seitz", status: "polishing", startedOn: addDays(T, -40), completedOn: null },
    { id: "r5", studentId: "s2", title: "Concerto in A minor, 1st mvt", composer: "A. Vivaldi", status: "in_progress", startedOn: addDays(T, -10), completedOn: null },
    { id: "r6", studentId: "s3", title: "Twinkle, Twinkle (Var. A)", composer: "Suzuki", status: "completed", startedOn: addDays(T, -55), completedOn: addDays(T, -14) },
    { id: "r7", studentId: "s3", title: "Twinkle, Twinkle (Var. B)", composer: "Suzuki", status: "in_progress", startedOn: addDays(T, -14), completedOn: null },
    { id: "r8", studentId: "s4", title: "Song of the Wind", composer: "Suzuki", status: "in_progress", startedOn: addDays(T, -20), completedOn: null },
  ];

  // Notes on some completed lessons (final + sent)
  const notes = {};
  const withNotes = lessons.filter((l) => l.status === "completed" && l.summarySentAt).sort((a, b) => b.date.localeCompare(a.date));
  const seen = {};
  for (const l of withNotes) {
    seen[l.studentId] = (seen[l.studentId] ?? 0) + 1;
    if (seen[l.studentId] > 3) continue;
    notes[l.id] = { status: "final", transcript: "…", bullets: "", finalizedAt: l.date, sentAt: l.date, data: sampleNotes(l.studentId, seen[l.studentId]) };
  }

  // Requests and pauses
  const kaiNext = lessons.filter((l) => l.studentId === "s2" && l.status === "scheduled" && l.date > T).sort((a, b) => a.date.localeCompare(b.date))[0];
  const requests = kaiNext ? [{ id: "q1", lessonId: kaiNext.id, familyId: "f2", status: "pending", proposedDate: addDays(kaiNext.date, 1), proposedTime: "17:30", reason: "Soccer tournament that afternoon", counterDate: null, counterTime: null, teacherNote: null, createdAt: addDays(T, -1), newLessonId: null }] : [];
  const pauses = [{ id: "z1", studentId: "s3", familyId: "f3", startsOn: addDays(T, 20), endsOn: addDays(T, 33), reason: "Family trip", status: "pending", result: null, createdAt: T }];

  // Outbox
  const notifications = [];
  for (const l of lessons.filter((x) => x.summarySentAt).slice(-8)) {
    const st = students.find((s) => s.id === l.studentId); const fam = families.find((f) => f.id === st.familyId); const par = parents.find((p) => p.familyId === fam.id && p.primary);
    notifications.push({ id: id("m"), event: "lesson_completed", channel: "email", recipient: par.email, subject: fam.language === "zh" ? `课堂总结：${st.name} ${l.date}` : `${st.name}'s lesson · ${l.date}`, status: "sent", error: null, createdAt: `${l.date} ${l.time}`, lessonId: l.id, familyId: fam.id, language: fam.language });
  }
  notifications.push({ id: id("m"), event: "lesson_reminder", channel: "sms", recipient: "+1 555 111 0002", subject: null, body: "Reminder: Kai's lesson tomorrow 5:00 PM", status: "sent", error: null, createdAt: `${addDays(T, -1)} 09:00`, lessonId: null, familyId: "f2", language: "en" });
  notifications.push({ id: id("m"), event: "session_low_balance", channel: "email", recipient: "li.wang@example.com", subject: "王小明：本期课包还剩 2 节", status: "failed", error: "Mailbox unavailable (450). Will retry.", createdAt: `${addDays(T, -2)} 13:00`, lessonId: null, familyId: "f3", language: "zh" });
  notifications.push({ id: id("m"), event: "reschedule_requested", channel: "email", recipient: "teacher@example.com", subject: "Reschedule request: Kai Nguyen", status: "sent", error: null, createdAt: `${addDays(T, -1)} 20:12`, lessonId: kaiNext?.id ?? null, familyId: "f2", language: "en" });

  return { settings, families, parents, students, lessons, sessions, repertoire, notes, requests, pauses, notifications, dayOverrides: [{ day: addDays(T, 3), location: "north_york" }], busy: [{ date: addDays(T, 2), start: "13:00", end: "15:00", title: "Orchestra rehearsal" }], portal: { familyId: "f1", lang: "en" } };
}

function sampleNotes(studentId, k) {
  const by = {
    s1: { message: "Emma had a focused lesson. Her A-string intonation is much steadier than last week and the first eight bars of Minuet No. 2 now hold together with the metronome.", messageZh: "", repertoire: [{ piece: "Minuet No. 2", composer: "J. S. Bach", section: "bars 1–8", status: "in_progress" }], wentWell: ["A-string intonation", "Steady tempo with the metronome"], practice: [{ task: "Slow A-string intonation", min: 10, days: 6, tip: "Listen for the ring on open A" }, { task: "Minuet No. 2 bars 1–8 with metronome (60)", min: 8, days: 5, tip: null }, { task: "Bow hold check in the mirror", min: 2, days: 7, tip: null }], technique: ["Left-hand frame on A string", "Straight bow in the upper half"], nextPlan: ["Minuet No. 2 bars 9–16", "Vibrato introduction"], uncertainties: [] },
    s2: { message: "Kai is close to performance-ready on the Seitz. The shifts to 3rd position are clean at slow tempo; speed comes next.", repertoire: [{ piece: "Concerto No. 2, 3rd mvt", composer: "F. Seitz", section: "whole movement", status: "polishing" }], wentWell: ["Clean shifts at slow tempo", "Good dynamics in the middle section"], practice: [{ task: "Shifting exercise, 1st–3rd position", min: 10, days: 6, tip: "Keep the thumb relaxed" }, { task: "Seitz 3rd mvt at 80% tempo", min: 15, days: 5, tip: null }], technique: ["Shifting", "Spiccato preparation"], nextPlan: ["Seitz at full tempo", "Vivaldi 1st mvt, opening"], uncertainties: ["I heard 'G major scale' but the plan said D major"] },
    s3: { message: "小明今天很专注，握弓姿势有进步，闪烁变奏 B 已经能完整拉下来。", repertoire: [{ piece: "Twinkle, Twinkle (Var. B)", composer: "Suzuki", section: null, status: "in_progress" }], wentWell: ["握弓姿势", "节奏稳定"], practice: [{ task: "闪烁变奏 B，慢速", min: 5, days: 6, tip: "每次先对着镜子检查握弓" }, { task: "空弦长弓", min: 3, days: 7, tip: null }], technique: ["Bow hold", "Open-string tone"], nextPlan: ["Twinkle variation C", "Lightly Row, first phrase"], uncertainties: [] },
    s4: { message: "小美的《风之歌》第一段已经很流畅，第二段的换弦还需要慢练。", repertoire: [{ piece: "Song of the Wind", composer: "Suzuki", section: "第一段", status: "in_progress" }], wentWell: ["第一段流畅", "音准稳定"], practice: [{ task: "《风之歌》第二段换弦，慢速", min: 8, days: 6, tip: "换弦前手腕先到位" }, { task: "D 大调音阶", min: 4, days: 6, tip: null }], technique: ["String crossing", "Left-hand fingers staying down"], nextPlan: ["Song of the Wind, 第二段", "O Come Little Children"], uncertainties: [] },
  };
  const base = by[studentId] ?? by.s1;
  const d = JSON.parse(JSON.stringify(base));
  d.totalMin = d.practice.reduce((a, p) => a + p.min, 0);
  if (k > 1) { const zh = /[一-鿿]/.test(d.message); d.message = d.message.replace(/[.。]$/, "") + (zh ? (k === 2 ? "（上一节）" : "（更早）") : k === 2 ? " (previous lesson)" : " (earlier lesson)"); }
  return d;
}

export const LOCATION_LABEL = { newmarket: "Newmarket", north_york: "North York", online: "Online" };
export const LOC_SHORT = { newmarket: "NM", north_york: "NY", online: "On" };
export const STATUS_LABEL = { scheduled: "Scheduled", completed: "Completed", no_show: "No-show", cancelled: "Cancelled", rescheduled: "Moved" };
export const STATUS_TONE = { scheduled: "brand", completed: "ok", no_show: "warn", cancelled: "muted", rescheduled: "muted" };
export const LABS = [
  { id: "quick_notes", title: "Quick notes", since: "Sep 2026", desc: "Record, one wait, check the email preview, send. Replaces the six-step notes page." },
  { id: "today_week", title: "Today week strip", since: "Sep 2026", desc: "The current week under today's lessons instead of the “Next 7 days” list." },
  { id: "simple_lesson", title: "Simpler lesson page", since: "Oct 2026", desc: "Key info first, tools behind “More”. Coming next." },
];
