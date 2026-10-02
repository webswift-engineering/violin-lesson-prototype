// Family report (round 4): one student's progress over a period, written in the family's language, with charts.
// The teacher previews it (teacher/report), adds a comment, then sends the link, copies it for WeChat or saves a PDF.
// The family opens the same page (parent/report). Charts are inline SVG / HTML; every chart has a table view.
import * as S from "../store.js";
import { esc, heatmapHtml, mountHeatmap, defaultDetail, toast, pageHeader, empty, field } from "../ui.js";
import { today, addDays, fmtDate, fmt12, money, pad } from "../dates.js";
import { href, go } from "../router.js";

const L = {
  en: {
    title: "Progress report", periods: { "12m": "Last 12 months", year: "This year", all: "All time" }, teacher: "From your teacher", generated: "Prepared",
    taken: "Lessons taken", rate: "Attendance", pieces: "Pieces completed", practice: "Practice plan", perDay: "min/day",
    monthly: "Lessons each month", monthlySub: "Completed, absent and cancelled lessons", completed: "Completed", absent: "Absent", cancelled: "Cancelled / paused", month: "Month", total: "Total",
    table: "Show as table", consistency: "Lesson by lesson", consistencySub: "Every lesson day in the last 52 weeks",
    repertoire: "Repertoire", repertoireSub: "When each piece was started and finished", learning: "Learning / polishing", done: "Completed", since: "since", until: "until", now: "now", noPieces: "No pieces recorded yet.",
    plan: "This week's practice", planSub: "From the latest lesson notes", noPlan: "No practice plan yet.",
    pkg: "Lesson package", left: (n, t) => `${n} of ${t} lessons left`, paid: "paid", unpaid: "payment pending", history: "Earlier packages",
    next: "Next lesson", none: "—", pdf: "Save as PDF", back: "Back", emptyPeriod: "No lessons in this period yet.",
  },
  zh: {
    title: "学习报告", periods: { "12m": "最近 12 个月", year: "今年", all: "全部" }, teacher: "老师的话", generated: "生成日期",
    taken: "已上课", rate: "出勤率", pieces: "已完成曲目", practice: "练习计划", perDay: "分钟/天",
    monthly: "每月上课情况", monthlySub: "已上、缺席和取消的课", completed: "已上", absent: "缺席", cancelled: "取消 / 暂停", month: "月份", total: "合计",
    table: "以表格查看", consistency: "每一节课", consistencySub: "最近 52 周的每个上课日",
    repertoire: "曲目进度", repertoireSub: "每首曲子开始和完成的时间", learning: "学习中 / 打磨中", done: "已完成", since: "开始于", until: "完成于", now: "至今", noPieces: "还没有曲目记录。",
    plan: "本周练习", planSub: "来自最近一次课堂笔记", noPlan: "还没有练习计划。",
    pkg: "课包", left: (n, t) => `还剩 ${n} 节（共 ${t} 节）`, paid: "已付款", unpaid: "待付款", history: "以往课包",
    next: "下一节课", none: "—", pdf: "保存为 PDF", back: "返回", emptyPeriod: "这段时间还没有课。",
  },
};
const MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], zh: [...Array(12)].map((_, i) => `${i + 1}月`) };
const ym = (d) => d.slice(0, 7);
const monthLabel = (m, lang) => (lang === "zh" ? `${m.slice(2, 4)}年${Number(m.slice(5))}月` : `${MON.en[Number(m.slice(5)) - 1]} ’${m.slice(2, 4)}`);
const dateL = (d, lang, style = "mdy") => (lang === "zh" ? fmtDate(d, "zh-md") + (style === "mdy" ? ` ${d.slice(0, 4)}` : "") : fmtDate(d, style));

export function periodFrom(period, T) {
  if (period === "year") return `${T.slice(0, 4)}-01-01`;
  if (period === "all") return "0000-00-00";
  return addDays(T, -365);
}

/** Everything the report shows, computed once. "Taken" = completed lessons (as everywhere else). */
export function reportData(studentId, period) {
  const T = today(); const s = S.student(studentId); const fam = S.family(s.familyId);
  const from = periodFrom(period, T);
  const all = S.lessonsOf(studentId).filter((l) => l.status !== "rescheduled");
  const held = all.filter((l) => l.date <= T);
  const inP = held.filter((l) => l.date >= from);
  const c = inP.filter((l) => l.status === "completed").length, n = inP.filter((l) => l.status === "no_show").length, x = inP.filter((l) => l.status === "cancelled").length;
  // months: the period's months, at most the last 12
  const first = period === "all" ? (inP.map((l) => ym(l.date)).sort()[0] ?? ym(T)) : ym(from);
  const months = []; for (let m = ym(T); m >= first && months.length < 12; m = prevMonth(m)) months.unshift(m);
  const byMonth = months.map((m) => { const ls = inP.filter((l) => ym(l.date) === m); return { m, completed: ls.filter((l) => l.status === "completed").length, absent: ls.filter((l) => l.status === "no_show").length, cancelled: ls.filter((l) => l.status === "cancelled").length }; });
  const rep = S.get().repertoire.filter((r) => r.studentId === studentId && (r.completedOn ?? T) >= from).sort((a, b) => a.startedOn.localeCompare(b.startedOn));
  const lastNotes = all.filter((l) => S.notesOf(l.id)?.status === "final").map((l) => S.notesOf(l.id)).pop() ?? null;
  const next = all.find((l) => l.status === "scheduled" && l.date >= T) ?? null;
  return { s, fam, lang: fam.language, T, from, period, c, n, x, rate: c + n ? Math.round((c / (c + n)) * 100) : null, byMonth, rep, practice: lastNotes?.data.practice ?? [], totalMin: lastNotes?.data.totalMin ?? 0, sessions: S.sessionsOf(studentId).slice().reverse(), bal: S.balance(studentId), next, held };
}
function prevMonth(m) { const y = Number(m.slice(0, 4)), mo = Number(m.slice(5)); return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; }

// ---------- charts ----------
/** Stacked columns per month: completed (solid), absent (hatched, so it never relies on colour alone), cancelled (hollow outline). */
function monthlySvg(d, t, W = 600) {
  const H = 200, padL = 26, padB = 24, padT = 12; const plotH = H - padB - padT; const n = d.byMonth.length;
  const max = Math.max(1, ...d.byMonth.map((b) => b.completed + b.absent + b.cancelled));
  const step = max <= 5 ? 1 : max <= 10 ? 2 : 5; const top = Math.ceil(max / step) * step;
  const y = (v) => padT + plotH - (v / top) * plotH; const slot = (W - padL) / n; const bw = Math.min(24, slot * 0.6);
  const seg = (x, y0, h, cls, roundTop) => (h <= 0 ? "" : roundTop ? `<path class="${cls}" d="M${x},${y0 + h} V${y0 + 4} Q${x},${y0} ${x + 4},${y0} H${x + bw - 4} Q${x + bw},${y0} ${x + bw},${y0 + 4} V${y0 + h} Z"/>` : `<rect class="${cls}" x="${x}" y="${y0}" width="${bw}" height="${h}"/>`);
  let grid = ""; for (let v = 0; v <= top; v += step) grid += `<line class="grid" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${padL - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  let cols = "", labels = "", hits = "";
  d.byMonth.forEach((b, i) => {
    const x = padL + slot * i + (slot - bw) / 2; let base = y(0); const parts = [["completed", b.completed, "c-done"], ["absent", b.absent, "c-absent"], ["cancelled", b.cancelled, "c-cx"]].filter((p) => p[1] > 0);
    parts.forEach(([, v, cls], k) => { const h = (v / top) * plotH; const gap = k ? 2 : 0; cols += seg(x, base - h + gap, h - gap, cls, k === parts.length - 1); base -= h; });
    const every = Math.ceil(52 / slot); const showLabel = (n - 1 - i) % every === 0; // keep labels ~52px apart, always label the latest month
    if (showLabel) labels += `<text class="tick" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${monthLabel(b.m, d.lang)}</text>`;
    hits += `<rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}" data-i="${i}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t.monthly)}"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="5" class="hatch-line"/></pattern></defs>${grid}${cols}${labels}${hits}</svg>`;
}
function monthlyChart(d, t) {
  const legend = `<div class="legend"><span class="lg"><i class="swatch c-done"></i><span>${t.completed}</span></span><span class="lg"><i class="swatch c-absent"></i><span>${t.absent}</span></span><span class="lg"><i class="swatch c-cx"></i><span>${t.cancelled}</span></span></div>`;
  const table = `<details class="mt2"><summary class="xs brand" style="cursor:pointer">${t.table}</summary><div class="tbl-wrap mt2"><table class="tbl"><thead><tr><th>${t.month}</th><th>${t.completed}</th><th>${t.absent}</th><th>${t.cancelled}</th></tr></thead><tbody>${d.byMonth.map((b) => `<tr><td>${monthLabel(b.m, d.lang)}</td><td>${b.completed}</td><td>${b.absent}</td><td>${b.cancelled}</td></tr>`).join("")}<tr><td><b>${t.total}</b></td><td><b>${d.c}</b></td><td><b>${d.n}</b></td><td><b>${d.x}</b></td></tr></tbody></table></div></details>`;
  return `<div class="chart" data-monthly>${legend}<div class="chart-box">${monthlySvg(d, t)}<div class="chart-tip" hidden></div></div>${table}</div>`;
}
function mountMonthly(root, d, t) {
  const box = root.querySelector("[data-monthly] .chart-box"); if (!box) return; const tip = box.querySelector(".chart-tip");
  // draw at the box's real width so text stays at its true size on a phone
  const w = Math.round(box.clientWidth); if (w > 0) box.querySelector("svg").outerHTML = monthlySvg(d, t, w);
  box.querySelectorAll(".hit").forEach((h) => {
    const show = () => { const b = d.byMonth[Number(h.dataset.i)]; tip.innerHTML = `<b>${monthLabel(b.m, d.lang)}</b><br>${t.completed} ${b.completed}<br>${t.absent} ${b.absent}<br>${t.cancelled} ${b.cancelled}`; tip.hidden = false; const r = h.getBoundingClientRect(), w = box.getBoundingClientRect(); const half = tip.offsetWidth / 2; tip.style.left = `${Math.min(Math.max(r.left - w.left + r.width / 2, half), w.width - half)}px`; box.querySelectorAll(".hit.on").forEach((x) => x.classList.remove("on")); h.classList.add("on"); };
    h.addEventListener("mouseenter", show); h.addEventListener("click", show);
    h.addEventListener("mouseleave", () => { tip.hidden = true; h.classList.remove("on"); });
  });
}

/** One row per piece: a bar from start to finish (or to today, lighter, while still learning). */
function repertoireChart(d, t) {
  if (!d.rep.length) return `<p class="muted small">${t.noPieces}</p>`;
  const start = d.rep.reduce((a, r) => (r.startedOn < a ? r.startedOn : a), d.from > "0000" ? d.from : d.rep[0].startedOn);
  const span = Math.max(1, (Date.parse(d.T) - Date.parse(start)) / 864e5);
  const pos = (k) => Math.max(0, Math.min(100, ((Date.parse(k) - Date.parse(start)) / 864e5 / span) * 100));
  return `<div class="legend"><span class="lg"><i class="swatch r-done"></i><span>${t.done}</span></span><span class="lg"><i class="swatch r-learn"></i><span>${t.learning}</span></span></div><div class="gantt">${d.rep.map((r) => { const a = pos(r.startedOn), b = pos(r.completedOn ?? d.T); const done = r.status === "completed"; const when = `${t.since} ${dateL(r.startedOn, d.lang, "md")}${done ? ` · ${t.until} ${dateL(r.completedOn, d.lang, "md")}` : ` · ${t.now}`}`; return `<div class="g-row"><div class="g-name"><div class="small med">${esc(r.title)}</div><div class="xs muted">${esc(when)}</div></div><div class="g-track" title="${esc(`${r.title} · ${when}`)}"><i class="${done ? "r-done" : "r-learn"}" style="left:${a}%;width:${Math.max(2, b - a)}%"></i></div></div>`; }).join("")}</div><div class="g-axis xs muted"><span>${dateL(start, d.lang)}</span><span>${dateL(d.T, d.lang)}</span></div>`;
}

/** Minutes per day for each practice task, one series, value at the tip. */
function practiceChart(d, t) {
  if (!d.practice.length) return `<p class="muted small">${t.noPlan}</p>`;
  const max = Math.max(...d.practice.map((p) => p.min));
  return `<div class="hbars">${d.practice.map((p) => `<div class="hb-row"><div class="small">${esc(p.task)}${p.tip ? `<div class="xs muted">${esc(p.tip)}</div>` : ""}</div><div class="hb-track"><i style="width:${(p.min / max) * 100}%"></i><span class="small med">${p.min} ${t.perDay}</span></div></div>`).join("")}</div>`;
}

/** The report body (both the teacher preview and the family's page). */
export function reportHtml(d, comment) {
  const t = L[d.lang]; const tile = (v, k) => `<div class="tile"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  const pieces = d.rep.filter((r) => r.status === "completed").length;
  const b = d.bal.b;
  return `<article class="report" lang="${d.lang === "zh" ? "zh-CN" : "en"}">
    <header class="r-head"><div class="xs muted">${esc(S.get().settings.studioName)}</div><h1>${esc(d.s.name)} · ${t.title}</h1><div class="small muted">${t.periods[d.period]} · ${t.generated} ${dateL(d.T, d.lang)}</div></header>
    ${comment?.trim() ? `<section class="r-sec"><h2>${t.teacher}</h2><p style="white-space:pre-wrap">${esc(comment.trim())}</p><div class="xs muted">— ${esc(S.get().settings.teacherName)}</div></section>` : ""}
    <section class="r-sec"><div class="grid4">${tile(d.c, t.taken)}${tile(d.rate === null ? "—" : `${d.rate}%`, t.rate)}${tile(pieces, t.pieces)}${tile(d.totalMin ? `${d.totalMin}` : "—", `${t.practice} · ${t.perDay}`)}</div></section>
    <section class="r-sec"><h2>${t.monthly}</h2><div class="xs muted mb2">${t.monthlySub}</div>${d.c + d.n + d.x ? monthlyChart(d, t) : `<p class="muted small">${t.emptyPeriod}</p>`}</section>
    <section class="r-sec"><h2>${t.consistency}</h2><div class="xs muted mb2">${t.consistencySub}</div>${heatmapHtml(d.held, { lang: d.lang, hint: d.lang === "zh" ? "点击某一天查看详情。" : "Tap a day for details." })}</section>
    <section class="r-sec"><h2>${t.repertoire}</h2><div class="xs muted mb2">${t.repertoireSub}</div>${repertoireChart(d, t)}</section>
    <section class="r-sec"><h2>${t.plan}</h2><div class="xs muted mb2">${t.planSub}</div>${practiceChart(d, t)}</section>
    <section class="r-sec"><h2>${t.pkg}</h2>${b ? `<div class="row between"><b>#${b.seq} · ${t.left(d.bal.remaining, d.bal.total)}</b><span class="chip chip-${b.paid ? "ok" : "warn"}">${b.paid ? t.paid : t.unpaid}</span></div><div class="bar mt1"><i style="width:${(b.used / b.total) * 100}%"></i></div>` : `<p class="muted small">—</p>`}
      ${d.sessions.length > 1 ? `<div class="xs muted mt3">${t.history}</div><div class="list small">${d.sessions.filter((x) => x !== b).map((x) => `<div class="li" style="padding-inline:0"><span>#${x.seq} · ${x.used}/${x.total}</span><span class="muted">${money(x.priceCents)} · ${x.paid ? t.paid : t.unpaid}</span></div>`).join("")}</div>` : ""}
      <div class="mt3 small"><span class="muted">${t.next}:</span> <b>${d.next ? (d.lang === "zh" ? `${fmtDate(d.next.date, "zh")} ${d.next.time}` : `${fmtDate(d.next.date)} · ${fmt12(d.next.time)}`) : t.none}</b></div></section>
  </article>`;
}
export function mountReport(root, d) {
  const t = L[d.lang];
  mountMonthly(root, d, t);
  mountHeatmap(root, { lessons: d.held, lang: d.lang, detail: (day, ls) => defaultDetail(day, ls, d.lang === "zh", (l) => `/portal/notes/${l.id}`, (l) => `/portal/notes/${l.id}`) });
}

// ---------- teacher: preview, comment, send ----------
export function teacher(route) {
  const s = S.student(route.params.id); if (!s) return { html: empty("Student not found") };
  const period = ["12m", "year", "all"].includes(route.query.period) ? route.query.period : "12m";
  const d = reportData(s.id, period); const fam = d.fam; const zh = d.lang === "zh";
  const draftKey = `${s.id}`; const draft = (S.get().reportDrafts ?? {})[draftKey] ?? "";
  const link = (p) => href(`/students/${s.id}/report?period=${p}`);
  const html = `${pageHeader(`${s.name} · Report for the family`, { back: `/students/${s.id}/records`, subtitle: `Written in ${zh ? "中文" : "English"} for ${esc(fam.name)} · this is exactly what they will see` })}
    <div class="card p3 col mb3">
      <div class="row wrap between"><div class="seg">${[["12m", "Last 12 months"], ["year", "This year"], ["all", "All time"]].map(([k, l]) => `<a class="${period === k ? "on" : ""}" href="${link(k)}">${l}</a>`).join("")}</div></div>
      ${field(`Your comment (shown at the top, ${zh ? "write it in 中文" : "in English"})`, `<textarea class="input" id="rp-comment" rows="3" placeholder="${zh ? "例如：这学期进步很大，下学期准备考级。" : "e.g. Great progress this term; next term we prepare for the exam."}">${esc(draft)}</textarea>`)}
    </div>
    <div class="card p4" id="rp-body">${reportHtml(d, draft)}</div>
    <div class="sticky-foot grid3 mt3"><button class="btn btn-outline" id="rp-pdf">Save as PDF</button><button class="btn btn-outline" id="rp-wechat">Copy for WeChat</button><button class="btn btn-primary" id="rp-send">Send link</button></div>
    <p class="xs muted mt2">Send link emails ${esc(S.parentsOf(fam.id).map((p) => p.name).join(", "))} a link to this page. Copy for WeChat copies a short message with the link. Save as PDF prints this page.</p>`;
  return { html, mount(root) {
    mountReport(root, d);
    const ta = root.querySelector("#rp-comment"); let h;
    ta.addEventListener("input", () => { clearTimeout(h); h = setTimeout(() => { S.saveReportDraft(draftKey, ta.value); const body = root.querySelector("#rp-body"); body.innerHTML = reportHtml(d, ta.value); mountReport(body, d); }, 400); });
    const publish = () => S.publishReport(s.id, period, ta.value);
    const message = (r) => { const url = `${location.origin}${location.pathname}#/portal/reports/${r.id}`; return { url, subject: zh ? `${s.name} 的学习报告（${L.zh.periods[period]}）` : `${s.name}'s progress report (${L.en.periods[period]})`, text: zh ? `${S.parentsOf(fam.id)[0]?.name ?? ""}您好，这是 ${s.name} 的学习报告（${L.zh.periods[period]}）：${url}` : `Hi ${(S.parentsOf(fam.id)[0]?.name ?? "").split(" ")[0]}, here is ${s.name}'s progress report (${L.en.periods[period]}): ${url}` }; };
    root.querySelector("#rp-send").addEventListener("click", () => { const r = publish(); const m = message(r); S.sendReviewed(fam.id, "student_report", { subject: m.subject, text: m.text }); toast(`Report link emailed to ${fam.name}`); });
    root.querySelector("#rp-wechat").addEventListener("click", async () => { const r = publish(); const m = message(r); try { await navigator.clipboard.writeText(m.text); } catch { /* the outbox keeps the text */ } S.sendReviewed(fam.id, "student_report", { subject: m.subject, text: m.text, wechat: true }); toast("Copied · paste it into WeChat"); });
    root.querySelector("#rp-pdf").addEventListener("click", () => { S.saveReportDraft(draftKey, ta.value); window.print(); });
  } };
}

// ---------- family: the sent report ----------
export function parent(route) {
  const r = (S.get().reports ?? []).find((x) => x.id === route.params.id); if (!r || !S.student(r.studentId)) return { html: empty("Report not found") };
  const d = reportData(r.studentId, r.period); const t = L[d.lang];
  return { html: `<div class="row between mb3 no-print"><a class="small brand" href="${href("/portal")}">‹ ${t.back}</a><button class="btn btn-outline btn-sm" id="rp-pdf">${t.pdf}</button></div>${reportHtml(d, r.comment)}`, mount(root) { mountReport(root, d); root.querySelector("#rp-pdf").addEventListener("click", () => window.print()); } };
}
export { go };
