import * as S from "../../store.js";
import { LOCATION_LABEL } from "../../data.js";
import { esc, chip, statusChip, pageHeader, section, coll, empty, field, calendarHtml, mountCalendar, openLessonSheet, openMoveConfirm, openAddLesson, openFindTime, openMoveLesson, toast, loc, closeSheet, openSheet } from "../../ui.js";
import { today, addDays, fmt12, fmtDate, money, DOW_LONG, monthGrid, weekOf, cmp } from "../../dates.js";
import { href, go } from "../../router.js";

export function list(route) {
  const all = route.query.all === "1"; const st = S.get();
  const students = st.students.filter((s) => all || s.active).sort((a, b) => a.name.localeCompare(b.name));
  const T = today();
  const html = `${route.query.deleted ? `<div class="note note-info mb3">${esc(route.query.deleted)}</div>` : ""}${pageHeader("Students", { subtitle: `${students.length} ${all ? "total" : "active"} · <a class="brand" href="${href(all ? "/students" : "/students?all=1")}">${all ? "active only" : "show inactive"}</a>`, action: `<a class="btn btn-primary btn-sm" href="${href("/students/new")}">+ Add</a>` })}
    ${students.length ? `<div class="card list">${students.map((s) => { const bal = S.balance(s.id); const next = S.lessonsOf(s.id).filter((l) => l.status === "scheduled" && l.date >= T)[0]; const fam = S.family(s.familyId); return `<a class="li" href="${href(`/students/${s.id}`)}"><div><div class="med">${esc(s.name)} ${s.active ? "" : chip("muted", "inactive")}</div><div class="xs muted">${esc(fam.name)} · ${fam.language === "zh" ? "中文" : "English"} · ${s.weekday !== null ? `${DOW_LONG[s.weekday].slice(0, 3)} ${fmt12(s.time)}` : "no weekly slot"} · ${loc(s.location)}</div></div><div class="right"><div>${chip(bal.tone, bal.text)}</div><div class="xs muted mt1">${next ? `Next ${fmtDate(next.date)}` : "—"}</div></div></a>`; }).join("")}</div>` : empty("No students yet")}`;
  return { html };
}

/**
 * Student page, round 3 (owner, 2026-10-01: "too many menus, too big for a new user"):
 * the summary, two big actions, the calendar, then ONE tab row (Packages · Repertoire · Family).
 * Things done a few times a year (generate, pause, backfill, send schedule) sit behind "⋯ More".
 * Past lessons moved to Lesson records, which already lists every lesson.
 */
export function detail(route) {
  const s = S.student(route.params.id); if (!s) return { html: empty("Student not found") };
  const T = today(); const fam = S.family(s.familyId); const parents = S.parentsOf(fam.id); const sessions = S.sessionsOf(s.id); const active = S.activeSession(s.id);
  const lessons = S.lessonsOf(s.id); const upcoming = lessons.filter((l) => l.status === "scheduled" && l.date >= T);
  const next = upcoming[0]; const rep = S.get().repertoire.filter((r) => r.studentId === s.id);
  const lastNotesLesson = lessons.filter((l) => S.notesOf(l.id)?.status === "final").pop(); const lastNotes = lastNotesLesson ? S.notesOf(lastNotesLesson.id) : null;
  const inPackage = active ? upcoming.filter((l) => l.sessionId === active.id).length : 0; const open = active ? Math.max(0, active.total - active.used - inPackage) : 0;
  const view = route.query.view === "week" ? "week" : "month"; const anchor = route.query.date ?? T; const rows = view === "month" ? monthGrid(anchor) : [weekOf(anchor)];
  const calLessons = lessons.filter((l) => l.date >= rows[0][0] && l.date <= rows[rows.length - 1][6] && l.status !== "rescheduled");
  const tab = ["packages", "repertoire", "family"].includes(route.query.tab) ? route.query.tab : "packages";
  const tabLink = (t) => href(`/students/${s.id}?tab=${t}${route.query.view ? `&view=${route.query.view}` : ""}${route.query.date ? `&date=${route.query.date}` : ""}`);

  const panels = {
    packages: `<div class="card list">${sessions.slice().reverse().map((b) => `<div class="li"><div><div class="med">Package #${b.seq} ${b.status === "active" ? chip("brand", "active") : chip("muted", "completed")}</div><div class="xs muted">${b.used} of ${b.total} used · ${money(b.priceCents)} · started ${fmtDate(b.startedAt, "mdy")}</div></div><button class="btn btn-sm ${b.paid ? "btn-outline" : "btn-primary"}" data-paid="${b.id}">${b.paid ? "Paid ✓" : "Mark paid"}</button></div>`).join("") || `<div class="li muted small">No packages yet.</div>`}</div><button class="btn btn-ghost btn-sm mt2" id="ns-open">+ Start a package</button>`,
    repertoire: `<div class="card list">${rep.map((r) => `<div class="li"><div><div class="med">${esc(r.title)} <span class="muted">${esc(r.composer ?? "")}</span></div><div class="xs muted">since ${fmtDate(r.startedOn, "md")}${r.completedOn ? ` · done ${fmtDate(r.completedOn, "md")}` : ""}</div></div><div class="row"><select class="input input-sm" data-rep="${r.id}"><option value="in_progress" ${r.status === "in_progress" ? "selected" : ""}>Learning</option><option value="polishing" ${r.status === "polishing" ? "selected" : ""}>Polishing</option><option value="completed" ${r.status === "completed" ? "selected" : ""}>Completed</option></select><button class="link xs danger" data-rm-rep="${r.id}" aria-label="Remove ${esc(r.title)}">×</button></div></div>`).join("") || `<div class="li muted small">Nothing yet. Lesson notes add pieces, or add one here.</div>`}</div><div class="row mt2"><input class="input" id="nr-title" placeholder="Piece"><input class="input" id="nr-comp" placeholder="Composer"><button class="btn btn-outline btn-sm" id="nr-add">Add</button></div>`,
    family: `<div class="card list">${parents.map((p) => `<div class="li"><div><div class="med">${esc(p.name)} ${p.primary ? chip("brand", "primary") : ""}</div><div class="xs muted">${esc(p.email)}${p.phone ? ` · ${esc(p.phone)}` : ""}</div></div>${parents.length > 1 ? `<button class="link xs danger" data-rm-parent="${p.id}">Remove</button>` : ""}</div>`).join("")}</div>
      <div class="xs muted mt2">${esc(fam.name)} · messages in ${fam.language === "zh" ? "中文" : "English"}${fam.smsOptIn ? " · SMS on" : ""}</div>
      <div class="row wrap mt2"><button class="btn btn-ghost btn-sm" id="fam-open">Edit family</button><button class="btn btn-ghost btn-sm" id="np-open">+ Add parent</button></div>`,
  };

  const html = `${pageHeader(s.name, { subtitle: `${esc(s.level ?? "")} · age ${s.age} · ${s.size} · ${s.durationMin} min<br>${money(s.rateCents)}/lesson · ${loc(s.location)}${s.weekday !== null ? ` · ${DOW_LONG[s.weekday]}s ${fmt12(s.time)}` : ""}`, back: "/students", action: `<a class="btn btn-outline btn-sm" href="${href(`/students/${s.id}/edit`)}">Edit</a>` })}
    <div class="card p4 col">
      <div class="row between wrap" style="align-items:flex-start">
        <div><div class="muted small">Package ${active ? `#${active.seq}` : ""}</div><div class="b" style="font-size:1.2rem">${active ? `${active.total - active.used} of ${active.total} left` : "No active package"}</div>${active ? `<div class="bar mt1" style="width:10rem"><i style="width:${(active.used / active.total) * 100}%"></i></div><div class="xs muted mt1">${inPackage} booked · ${open} still to book · ${active.paid ? chip("ok", "paid") : chip("danger", "unpaid")}</div>` : ""}</div>
        <div class="right"><div class="muted small">Next lesson</div><div class="b">${next ? `<a href="${href(`/lessons/${next.id}`)}">${fmtDate(next.date)}<br>${fmt12(next.time)}</a>` : "—"}</div></div>
      </div>
      ${lastNotes ? `<div><div class="muted small">Practice plan</div><ul style="list-style:disc;padding-left:20px" class="small">${lastNotes.data.practice.map((p) => `<li>${esc(p.task)} · ${p.min} min/day</li>`).join("")}</ul><a class="xs brand" href="${href(`/lessons/${lastNotesLesson.id}/notes`)}">Last notes →</a></div>` : ""}
      ${s.notes ? `<div class="xs muted" style="white-space:pre-wrap">📝 ${esc(s.notes)}</div>` : ""}
    </div>
    <div class="grid2 mt3"><a class="btn btn-primary" href="${href(`/students/${s.id}/records?period=ytd`)}">📋 Lesson records</a><button class="btn btn-accent" id="move-lesson" ${upcoming.length ? "" : "disabled"}>⇄ Move a lesson</button></div>
    ${section("Schedule", calendarHtml({ view, anchor, basePath: `/students/${s.id}`, lessons: calLessons, lockStudent: s, compact: true }))}
    <div class="section"><div class="row between wrap"><div class="seg">${[["packages", `Packages · ${sessions.length}`], ["repertoire", `Repertoire · ${rep.length}`], ["family", "Family"]].map(([k, l]) => `<a class="${tab === k ? "on" : ""}" href="${tabLink(k)}">${l}</a>`).join("")}</div><button class="btn btn-ghost btn-sm" id="more">⋯ More</button></div><div class="mt3">${panels[tab]}</div></div>`;

  return { html, mount(root) {
    const q = (id) => root.querySelector(id);
    mountCalendar(root, { lessons: calLessons, lockStudent: s, onLesson: (l) => openLessonSheet(l), onAdd: (d) => openAddLesson(d, s), onMove: (l, d) => openMoveConfirm(l, d), onFind: () => openFindTime(s) });
    q("#move-lesson").addEventListener("click", () => openMoveLesson(s));
    root.querySelectorAll("[data-paid]").forEach((b) => b.addEventListener("click", () => { S.togglePaid(b.dataset.paid); toast(S.session(b.dataset.paid).paid ? "Marked paid · receipt emailed" : "Marked unpaid"); }));
    root.querySelectorAll("[data-rep]").forEach((sel) => sel.addEventListener("change", () => S.upsertRepertoire(s.id, { id: sel.dataset.rep, status: sel.value, completedOn: sel.value === "completed" ? T : null })));
    root.querySelectorAll("[data-rm-rep]").forEach((b) => b.addEventListener("click", () => S.deleteRepertoire(b.dataset.rmRep)));
    q("#nr-add")?.addEventListener("click", () => { if (!q("#nr-title").value) return; S.upsertRepertoire(s.id, { title: q("#nr-title").value, composer: q("#nr-comp").value, status: "in_progress" }); });
    root.querySelectorAll("[data-rm-parent]").forEach((b) => b.addEventListener("click", () => { if (!confirm("Remove this parent?")) return; const r = S.removeParent(b.dataset.rmParent); if (r?.error) toast(r.error, "warn"); }));
    q("#ns-open")?.addEventListener("click", () => openSheet("Start a package", `<div class="col">${field("Price for 10 lessons ($)", `<input class="input" id="ns-price" type="number" value="${(s.rateCents * 10) / 100}">`)}<button class="btn btn-primary w" id="ns-go">Start package</button></div>`, (sh) => sh.querySelector("#ns-go").addEventListener("click", () => { S.newSession(s.id, Number(sh.querySelector("#ns-price").value) * 100); toast("Package started"); })));
    q("#fam-open")?.addEventListener("click", () => openSheet("Family", `<div class="col">${field("Family name", `<input class="input" value="${esc(fam.name)}" id="fam-name">`)}${field("Email / SMS language", `<select class="input" id="fam-lang"><option value="en" ${fam.language === "en" ? "selected" : ""}>English</option><option value="zh" ${fam.language === "zh" ? "selected" : ""}>中文</option></select>`)}<label class="check"><input type="checkbox" id="fam-sms" ${fam.smsOptIn ? "checked" : ""}> Send SMS too</label><button class="btn btn-primary w" id="fam-save">Save family</button></div>`, (sh) => sh.querySelector("#fam-save").addEventListener("click", () => { S.saveFamily(fam.id, { name: sh.querySelector("#fam-name").value, language: sh.querySelector("#fam-lang").value, smsOptIn: sh.querySelector("#fam-sms").checked }); toast("Family saved"); })));
    q("#np-open")?.addEventListener("click", () => openSheet("Add parent", `<div class="col">${field("Name", `<input class="input" id="np-name">`)}${field("Email (their sign-in)", `<input class="input" id="np-email" type="email">`)}${field("Phone", `<input class="input" id="np-phone" type="tel">`)}<button class="btn btn-primary w" id="np-add">Add parent</button></div>`, (sh) => sh.querySelector("#np-add").addEventListener("click", () => { const v = (id) => sh.querySelector(id).value.trim(); if (!v("#np-name") || !v("#np-email")) return toast("Name and email are required", "warn"); S.addParent(fam.id, v("#np-name"), v("#np-email"), v("#np-phone")); toast("Parent added"); })));
    q("#more").addEventListener("click", () => openMoreActions(s, fam, parents, active));
  } };
}

/** The rarely used student actions, one sheet each. */
function openMoreActions(s, fam, parents, active) {
  const T = today();
  const items = [
    ["gen", "Generate lessons from the weekly slot", s.weekday === null ? "Set a weekly day and time first (Edit)" : `${DOW_LONG[s.weekday]}s ${fmt12(s.time)}`],
    ["pause", "Pause lessons", "Skip a few weeks and add them back at the end"],
    ["backfill", "Record a past lesson", "From before this app; no emails"],
    ["schedule", "Send the schedule to the parent", active ? `Package #${active.seq}` : "No active package"],
    ["mail", "Email the parent", parents[0]?.email ?? ""],
  ];
  openSheet("More for " + s.name, `<div class="card list">${items.map(([k, t, hint]) => `<button class="li w" style="background:none;border:0;text-align:left" data-act="${k}" ${(k === "gen" && s.weekday === null) || (k === "schedule" && !active) ? "disabled" : ""}><div><div class="med">${t}</div><div class="xs muted">${esc(hint)}</div></div><span class="muted">›</span></button>`).join("")}</div>`, (sh) => sh.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.act;
    if (k === "gen") openSheet("Generate lessons", `<div class="col">${field("How many", `<input class="input" id="gen-n" type="number" value="10" min="1" max="52">`)}${field("Starting from", `<input class="input" id="gen-from" type="date" value="${T}">`)}<label class="check"><input type="checkbox" id="gen-notify" checked> Email + SMS the schedule to the parent afterwards</label><button class="btn btn-primary w" id="gen-go">Generate</button></div>`, (r) => r.querySelector("#gen-go").addEventListener("click", () => { const notify = r.querySelector("#gen-notify").checked; const n = S.generateLessons(s.id, Number(r.querySelector("#gen-n").value), r.querySelector("#gen-from").value, notify); toast(`${n} lessons added${notify ? " · schedule emailed" : ""}`); }));
    if (k === "pause") openSheet("Pause lessons", `<p class="muted small mb2">Lessons in the window are cancelled without using the package, and the same number is added after the current schedule.</p><div class="grid2">${field("From", `<input class="input" type="date" id="pz-from" value="${addDays(T, 7)}">`)}${field("To", `<input class="input" type="date" id="pz-to" value="${addDays(T, 20)}">`)}</div><div id="pz-preview" class="small muted mt2"></div><button class="btn btn-primary w mt2" id="pz-go">Pause</button>`, (r) => { const q = (id) => r.querySelector(id); const pz = () => { const ls = S.pausePreview(s.id, q("#pz-from").value, q("#pz-to").value); q("#pz-preview").textContent = ls.length ? `${ls.length} lesson${ls.length === 1 ? "" : "s"} skipped and added back: ${ls.map((l) => fmtDate(l.date, "md")).join(", ")}` : "No lessons fall in this window."; }; q("#pz-from").addEventListener("input", pz); q("#pz-to").addEventListener("input", pz); pz(); q("#pz-go").addEventListener("click", () => { const res = S.applyPause(s.id, q("#pz-from").value, q("#pz-to").value); toast(`Paused: ${res.cancelled} skipped, ${res.created} added · family emailed`); }); });
    if (k === "backfill") openSheet("Record a past lesson", `<p class="muted small mb2">For a lesson before this app. No emails are sent.</p><div class="grid2">${field("Date", `<input class="input" type="date" id="bf-date" value="${addDays(T, -10)}" max="${T}">`)}${field("Time", `<input class="input" type="time" id="bf-time" value="${s.time ?? "16:00"}">`)}</div>${field("Status", `<select class="input" id="bf-status"><option value="completed">Completed</option><option value="no_show">No-show</option><option value="cancelled">Cancelled</option></select>`)}<button class="btn btn-primary w mt2" id="bf-go">Record</button>`, (r) => r.querySelector("#bf-go").addEventListener("click", () => { S.backfill(s.id, r.querySelector("#bf-date").value, r.querySelector("#bf-time").value, r.querySelector("#bf-status").value); toast("Recorded (no emails)"); }));
    if (k === "schedule") { closeSheet(); S.notifyFamily(fam.id, "schedule_published", `${s.name}'s lesson schedule — package #${active.seq}`, `${s.name} 的课程安排 — 第 ${active.seq} 期课包`, null, true); toast(`Schedule emailed${fam.smsOptIn ? " + SMS" : ""} to ${fam.name}`); }
    if (k === "mail") { closeSheet(); window.open?.(`mailto:${parents[0]?.email}`); toast(`Opens your mail app to ${parents[0]?.email}`); }
  })));
}

function studentForm(s, isNew) {
  const fam = s ? S.family(s.familyId) : null; const families = S.get().families;
  return `<div class="card p4 col">
    <div class="grid2">${field("Name", `<input class="input" id="f-name" value="${esc(s?.name ?? "")}">`)}${field("Level", `<input class="input" id="f-level" value="${esc(s?.level ?? "")}" placeholder="Suzuki Book 2">`)}</div>
    <div class="grid3">${field("Age", `<input class="input" id="f-age" type="number" value="${s?.age ?? ""}">`)}${field("Violin size", `<select class="input" id="f-size">${["1/16", "1/10", "1/8", "1/4", "1/2", "3/4", "4/4"].map((z) => `<option ${s?.size === z ? "selected" : ""}>${z}</option>`).join("")}</select>`)}${field("Location", `<select class="input" id="f-loc">${Object.entries(LOCATION_LABEL).map(([k, v]) => `<option value="${k}" ${(s?.location ?? "north_york") === k ? "selected" : ""}>${v}</option>`).join("")}</select>`)}</div>
    <div class="grid3">${field("Lesson minutes", `<input class="input" id="f-dur" type="number" value="${s?.durationMin ?? 45}" step="5">`)}${field("Fee per lesson ($)", `<input class="input" id="f-rate" type="number" value="${(s?.rateCents ?? 6500) / 100}">`)}${field("Weekly slot", `<div class="row"><select class="input" id="f-wd"><option value="">—</option>${DOW_LONG.map((d, i) => `<option value="${i}" ${s?.weekday === i ? "selected" : ""}>${d.slice(0, 3)}</option>`).join("")}</select><input class="input" id="f-time" type="time" value="${s?.time ?? ""}"></div>`)}</div>
    <label class="check"><input type="checkbox" id="f-active" ${s?.active ?? true ? "checked" : ""}> Active student</label>
    <label class="check"><input type="checkbox" id="f-auto" ${s?.autoCreate ?? true ? "checked" : ""}> Open the next package automatically when one closes</label>
    ${field("Private notes (teacher only)", `<textarea class="input" id="f-notes">${esc(s?.notes ?? "")}</textarea>`)}
    ${isNew ? `<div class="b mt2">Family</div>${field("Family", `<select class="input" id="f-fam"><option value="">New family…</option>${families.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}</select>`)}<div id="newfam" class="col"><div class="grid2">${field("Family name", `<input class="input" id="nf-name" placeholder="Chen family">`)}${field("Email / SMS language", `<select class="input" id="nf-lang"><option value="en">English</option><option value="zh">中文</option></select>`)}</div><div class="grid3">${field("Parent name", `<input class="input" id="nf-pname">`)}${field("Parent email (their sign-in)", `<input class="input" id="nf-email">`)}${field("Phone", `<input class="input" id="nf-phone">`)}</div><label class="check"><input type="checkbox" id="nf-sms"> Send SMS too</label></div>` : `<p class="xs muted">Family: ${esc(fam.name)} (edit on the student page)</p>`}
    <p class="danger small" id="f-err"></p><button class="btn btn-primary w" id="f-save">${isNew ? "Add student" : "Save changes"}</button></div>`;
}
function readForm(root) { const q = (id) => root.querySelector(id); const wd = q("#f-wd").value; return { name: q("#f-name").value.trim(), level: q("#f-level").value, age: Number(q("#f-age").value) || null, size: q("#f-size").value, location: q("#f-loc").value, durationMin: Number(q("#f-dur").value) || 45, rateCents: Math.round(Number(q("#f-rate").value) * 100), weekday: wd === "" ? null : Number(wd), time: q("#f-time").value || null, active: q("#f-active").checked, autoCreate: q("#f-auto").checked, notes: q("#f-notes").value }; }

export function create() {
  return { html: pageHeader("New student", { back: "/students" }) + studentForm(null, true), mount(root) {
    const q = (id) => root.querySelector(id); q("#f-fam").addEventListener("change", () => q("#newfam").classList.toggle("hide", !!q("#f-fam").value));
    q("#f-save").addEventListener("click", () => { const p = readForm(root); if (!p.name) return (q("#f-err").textContent = "Name is required"); let fid = q("#f-fam").value; if (!fid) { if (!q("#nf-name").value || !q("#nf-pname").value || !q("#nf-email").value) return (q("#f-err").textContent = "Family name, parent name and parent email are required for a new family."); fid = S.newFamily(q("#nf-name").value, q("#nf-lang").value, q("#nf-pname").value, q("#nf-email").value, q("#nf-phone").value, q("#nf-sms").checked); } const id = S.saveStudent(null, { ...p, familyId: fid }); toast("Student added"); go(`/students/${id}`); });
  } };
}
export function edit(route) {
  const s = S.student(route.params.id); if (!s) return { html: empty("Student not found") };
  const siblings = S.studentsOfFamily(s.familyId).filter((x) => x.id !== s.id).length; const lessons = S.lessonsOf(s.id).length;
  const html = pageHeader(`Edit ${s.name}`, { back: `/students/${s.id}` }) + studentForm(s, false) + `<details class="coll mt8" style="border-color:rgb(var(--danger)/.4)"><summary class="danger">Delete this student</summary><div class="body col small"><p>This removes <b>${esc(s.name)}</b> permanently, together with ${lessons} lesson${lessons === 1 ? "" : "s"}, all packages, notes, recordings, repertoire and requests. Emails already sent stay in the outbox history.</p><p class="muted">${siblings ? `The family stays because ${siblings} other student${siblings === 1 ? "" : "s"} belong${siblings === 1 ? "s" : ""} to it.` : "This is the family's only student, so the family and its parent logins are removed as well. To keep the history but stop scheduling, untick “Active” above instead."}</p>${field("Type the student's name to confirm", `<input class="input" id="del-name" placeholder="${esc(s.name)}" autocomplete="off">`)}<p class="danger" id="del-err"></p><button class="btn btn-danger w" id="del-go">Delete ${esc(s.name)}</button></div></details>`;
  return { html, mount(root) {
    root.querySelector("#f-save").addEventListener("click", () => { const p = readForm(root); if (!p.name) return (root.querySelector("#f-err").textContent = "Name is required"); S.saveStudent(s.id, p); toast("Saved"); go(`/students/${s.id}`); });
    root.querySelector("#del-go").addEventListener("click", () => { if (root.querySelector("#del-name").value.trim().toLowerCase() !== s.name.toLowerCase()) return (root.querySelector("#del-err").textContent = `Type the student's name exactly (${s.name}) to confirm.`); const r = S.deleteStudent(s.id); go(`/students?deleted=${encodeURIComponent(`Deleted ${r.name} (${r.lessons} lessons, ${r.sessions} packages${r.familyDeleted ? "; the family and its parent logins were removed too" : ""}).`)}`); });
  } };
}
export { closeSheet, openSheet, cmp };
