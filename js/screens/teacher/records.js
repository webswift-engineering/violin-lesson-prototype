// Lesson records: a student's complete history with a Lifetime / Year to date / Month report.
import * as S from "../../store.js";
import { esc, chip, statusChip, pageHeader, section, empty, toast, loc, heatmapHtml, mountHeatmap, openSheet, closeSheet } from "../../ui.js";
import { today, fmt12, fmtDate, money, parse, pad } from "../../dates.js";
import { href } from "../../router.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = (k) => k.slice(0, 7);
const ymLabel = (m) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const shiftYm = (m, n) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

export function periodRange(period, month, T) {
  if (period === "lifetime") return { from: "0000-00-00", to: "9999-12-31", label: "Lifetime" };
  if (period === "month") return { from: `${month}-01`, to: `${month}-31`, label: ymLabel(month) };
  return { from: `${T.slice(0, 4)}-01-01`, to: T, label: `Year to date (${T.slice(0, 4)})` };
}
export function report(lessons) {
  const r = { taken: 0, no_show: 0, cancelled: 0, moved: 0, fees: 0, packages: new Set(), byMonth: {} };
  for (const l of lessons) {
    const m = (r.byMonth[ym(l.date)] ??= { taken: 0, no_show: 0, cancelled: 0, fees: 0 });
    if (l.status === "completed") { r.taken++; m.taken++; r.fees += l.feeCents; m.fees += l.feeCents; }
    if (l.status === "no_show") { r.no_show++; m.no_show++; r.fees += l.feeCents; m.fees += l.feeCents; }
    if (l.status === "cancelled") { r.cancelled++; m.cancelled++; }
    if (l.movedFrom) r.moved++;
    if (l.sessionId) r.packages.add(l.sessionId);
  }
  r.rate = r.taken + r.no_show ? Math.round((r.taken / (r.taken + r.no_show)) * 100) : null;
  return r;
}

export function render(route) {
  const s = S.student(route.params.id); if (!s) return { html: empty("Student not found") };
  const T = today(); const period = ["lifetime", "ytd", "month"].includes(route.query.period) ? route.query.period : "ytd"; const month = /^\d{4}-\d{2}$/.test(route.query.month ?? "") ? route.query.month : ym(T);
  const range = periodRange(period, month, T);
  const all = S.lessonsOf(s.id).filter((l) => l.status !== "rescheduled" && l.date <= T);
  const rows = all.filter((l) => l.date >= range.from && l.date <= range.to).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const upcoming = S.lessonsOf(s.id).filter((l) => l.status === "scheduled" && l.date > T).length;
  const r = report(rows); const months = Object.keys(r.byMonth).sort().reverse();
  const seqOf = (id) => S.session(id)?.seq;
  const link = (p, m = month) => href(`/students/${s.id}/records?period=${p}&month=${m}`);
  const html = `${pageHeader(`${s.name} · Lesson records`, { back: `/students/${s.id}`, subtitle: `${all.length} lessons on record · ${upcoming} upcoming`, action: `<div class="row"><button class="btn btn-outline btn-sm" id="csv">Export CSV</button><button class="btn btn-outline btn-sm" id="mail">Email report</button></div>` })}
    <div class="row wrap between mb3"><div class="seg"><a class="${period === "lifetime" ? "on" : ""}" href="${link("lifetime")}">Lifetime</a><a class="${period === "ytd" ? "on" : ""}" href="${link("ytd")}">Year to date</a><a class="${period === "month" ? "on" : ""}" href="${link("month")}">Month</a></div>${period === "month" ? `<div class="row"><a class="btn btn-ghost btn-sm" href="${link("month", shiftYm(month, -1))}" aria-label="Previous month">‹</a><b>${ymLabel(month)}</b><a class="btn btn-ghost btn-sm" href="${link("month", shiftYm(month, 1))}" aria-label="Next month">›</a>${month !== ym(T) ? `<a class="btn btn-ghost btn-sm" href="${link("month", ym(T))}">This month</a>` : ""}</div>` : `<span class="muted small">${range.label}</span>`}</div>
    <div class="grid3"><div class="tile"><div class="v">${r.taken}</div><div class="k">Lessons taken</div></div><div class="tile"><div class="v">${r.rate === null ? "—" : r.rate + "%"}</div><div class="k">Attendance</div></div><div class="tile"><div class="v">${money(r.fees)}</div><div class="k">Fees (taken + no-show)</div></div><div class="tile"><div class="v">${r.no_show}</div><div class="k">No-shows</div></div><div class="tile"><div class="v">${r.cancelled}</div><div class="k">Cancelled / paused</div></div><div class="tile"><div class="v">${r.moved}</div><div class="k">Moved</div></div></div>
    ${months.length > 1 ? section("By month", `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th>Taken</th><th>No-show</th><th>Cancelled</th><th>Fees</th><th></th></tr></thead><tbody>${months.map((m) => `<tr><td>${ymLabel(m)}</td><td>${r.byMonth[m].taken}</td><td>${r.byMonth[m].no_show}</td><td>${r.byMonth[m].cancelled}</td><td>${money(r.byMonth[m].fees)}</td><td><a class="xs brand" href="${link("month", m)}">open →</a></td></tr>`).join("")}</tbody></table></div>`) : ""}
    ${section("Every lesson", rows.length ? `<div class="card list">${rows.map((l) => { const n = S.notesOf(l.id); return `<div class="li"><div><a class="med" href="${href(`/lessons/${l.id}`)}">${fmtDate(l.date, "mdy")} · ${fmt12(l.time)}</a><div class="xs muted">${l.durationMin} min · ${loc(l.location)}${l.sessionId ? ` · package #${seqOf(l.sessionId)}` : ""}${l.movedFrom ? ` · moved from ${esc(l.movedFrom)}` : ""}${l.note && l.note !== "Backfilled" ? ` · ${esc(l.note)}` : ""}${l.note === "Backfilled" ? " · backfilled" : ""}</div></div><div class="row">${n?.status === "final" ? `<a class="chip chip-brand" href="${href(`/lessons/${l.id}/notes`)}">notes</a>` : ""}${l.status === "cancelled" && l.note === "Paused" ? chip("muted", "Paused") : statusChip(l.status)}</div></div>`; }).join("")}</div>` : empty("No lessons in this period"), `<span class="muted small">${rows.length} in ${range.label.toLowerCase()}</span>`)}
    ${section("Last 52 weeks", `<div class="card p3">${heatmapHtml(all)}</div>`)}`;
  return { html, mount(root) {
    mountHeatmap(root, { lessons: all });
    root.querySelector("#csv").addEventListener("click", () => { const csv = ["date,time,minutes,location,status,package,fee,moved_from,note", ...rows.map((l) => [l.date, l.time, l.durationMin, l.location, l.status, l.sessionId ? seqOf(l.sessionId) : "", (l.feeCents / 100).toFixed(2), l.movedFrom ?? "", (l.note ?? "").replace(/,/g, " ")].join(","))].join("\n"); openSheet(`${s.name} · ${range.label}.csv`, `<p class="muted small mb2">The live app downloads this file. Prototype shows the text instead.</p><textarea class="input" style="min-height:16rem;font-family:ui-monospace,monospace;font-size:.75rem" readonly>${esc(csv)}</textarea><button class="btn btn-outline w mt2" id="copy">Copy</button>`, (sh) => sh.querySelector("#copy").addEventListener("click", () => { navigator.clipboard?.writeText(csv); toast("Copied"); closeSheet(); })); });
    root.querySelector("#mail").addEventListener("click", () => { const fam = S.family(s.familyId); S.notifyFamily(fam.id, "student_report", `${s.name}: lesson report · ${range.label}`, `${s.name}：课时报告 · ${range.label}`); toast(`Report emailed to ${fam.name}`); });
  } };
}
export { parse };
