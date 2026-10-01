// Hash router. Routes mirror the live app's URLs so feedback can name them.
const ROUTES = [
  ["auth/login", "/login"],
  ["teacher/today", "/today"],
  ["teacher/students", "/students"],
  ["teacher/student-new", "/students/new"],
  ["teacher/student", "/students/:id"],
  ["teacher/student-edit", "/students/:id/edit"],
  ["teacher/records", "/students/:id/records"],
  ["teacher/requests", "/requests"],
  ["teacher/more", "/more"],
  ["teacher/calendar", "/calendar"],
  ["teacher/lessons", "/lessons"],
  ["teacher/lesson", "/lessons/:id"],
  ["teacher/notes", "/lessons/:id/notes"],
  ["teacher/sessions", "/sessions"],
  ["teacher/notifications", "/notifications"],
  ["teacher/reports", "/reports"],
  ["teacher/settings", "/settings"],
  ["parent/home", "/portal"],
  ["parent/student", "/portal/students/:id"],
  ["parent/pause", "/portal/students/:id/pause"],
  ["parent/package", "/portal/sessions/:id"],
  ["parent/note", "/portal/notes/:id"],
  ["parent/reschedule", "/portal/lessons/:id/reschedule"],
  ["parent/requests", "/portal/requests"],
];

export function current() {
  const raw = location.hash.replace(/^#/, "") || "/today";
  const [path, qs = ""] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  const parts = path.split("/").filter(Boolean);
  for (const [id, pattern] of ROUTES) {
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(":")) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { id, path, params, query };
  }
  return { id: "teacher/today", path: "/today", params: {}, query: {} };
}

export function go(path) { location.hash = path.startsWith("#") ? path : `#${path}`; }
export function href(path) { return `#${path}`; }
export function withQuery(path, q) { const s = new URLSearchParams(q).toString(); return s ? `${path}?${s}` : path; }
