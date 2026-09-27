// Date helpers. The prototype uses the browser's local time as the "studio timezone".
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const pad = (n) => String(n).padStart(2, "0");
export const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => key(new Date());
export const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
export const addMonths = (k, n) => { const d = parse(k); d.setDate(1); d.setMonth(d.getMonth() + n); return key(d); };
export const weekday = (k) => parse(k).getDay();
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const cmp = (a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const isPast = (l) => l.date < today() || (l.date === today() && endTime(l.time, l.durationMin) < nowTime());
export const minutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const fromMinutes = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const endTime = (t, dur) => fromMinutes(minutes(t) + dur);

export const fmt12 = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };
export const fmtDate = (k, style = "short") => {
  const d = parse(k);
  if (style === "short") return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  if (style === "long") return `${DOW_LONG[d.getDay()]}, ${MON_LONG[d.getMonth()]} ${d.getDate()}`;
  if (style === "md") return `${MON[d.getMonth()]} ${d.getDate()}`;
  if (style === "mdy") return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (style === "month") return `${MON_LONG[d.getMonth()]} ${d.getFullYear()}`;
  if (style === "zh") return `${d.getMonth() + 1}月${d.getDate()}日 周${"日一二三四五六"[d.getDay()]}`;
  if (style === "zh-md") return `${d.getMonth() + 1}月${d.getDate()}日`;
  return k;
};
export const fmtDateTime = (k, t, lang = "en") => (lang === "zh" ? `${fmtDate(k, "zh")} ${t}` : `${fmtDate(k)} · ${fmt12(t)}`);
export const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function weekOf(k) { const d = parse(k); d.setDate(d.getDate() - d.getDay()); const out = []; for (let i = 0; i < 7; i++) { out.push(key(d)); d.setDate(d.getDate() + 1); } return out; }
export function monthGrid(k) {
  const d = parse(k); d.setDate(1);
  let cur = weekOf(key(d))[0];
  const rows = [];
  for (let r = 0; r < 6; r++) {
    const row = []; for (let i = 0; i < 7; i++) { row.push(cur); cur = addDays(cur, 1); }
    rows.push(row);
    if (parse(cur).getMonth() !== d.getMonth() && r >= 3) break;
  }
  return rows;
}
export const sameMonth = (a, b) => a.slice(0, 7) === b.slice(0, 7);
export const weekLabel = (days) => `${fmtDate(days[0], "md")} – ${fmtDate(days[6], "md")}`;
