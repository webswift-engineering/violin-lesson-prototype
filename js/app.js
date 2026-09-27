// Shell: prototype bar, teacher / parent layouts, routing, re-render on state change.
import * as S from "./store.js";
import * as R from "./router.js";
import { esc, closeSheet } from "./ui.js";
import * as today from "./screens/teacher/today.js";
import * as students from "./screens/teacher/students.js";
import * as requests from "./screens/teacher/requests.js";
import * as more from "./screens/teacher/more.js";
import * as calendar from "./screens/teacher/calendar.js";
import * as lessons from "./screens/teacher/lessons.js";
import * as notes from "./screens/teacher/notes.js";
import * as portal from "./screens/parent/portal.js";
import * as auth from "./screens/auth.js";

const SCREENS = {
  "auth/login": auth.login,
  "teacher/today": today.render,
  "teacher/students": students.list, "teacher/student": students.detail, "teacher/student-edit": students.edit, "teacher/student-new": students.create,
  "teacher/requests": requests.render,
  "teacher/more": more.menu, "teacher/sessions": more.sessions, "teacher/notifications": more.notifications, "teacher/reports": more.reports, "teacher/settings": more.settings,
  "teacher/calendar": calendar.render,
  "teacher/lessons": lessons.list, "teacher/lesson": lessons.detail,
  "teacher/notes": notes.render,
  "parent/home": portal.home, "parent/student": portal.student, "parent/pause": portal.pause, "parent/package": portal.pkg, "parent/note": portal.note, "parent/reschedule": portal.reschedule, "parent/requests": portal.requests,
};

const NAV = [["/today", "Today", "◉"], ["/students", "Students", "♪"], ["/requests", "Requests", "⇄"], ["/more", "More", "⋯"]];

function teacherShell(route, inner) {
  const a = S.attention();
  const active = (p) => route.path === p || route.path.startsWith(p + "/") || (p === "/more" && ["/calendar", "/lessons", "/sessions", "/notifications", "/reports", "/settings"].some((x) => route.path.startsWith(x))) ? "active" : "";
  const badge = (p) => (p === "/requests" && a.requests ? `<span class="badge">${a.requests}</span>` : "");
  const nav = (cls) => `<nav class="${cls}"><ul>${NAV.map(([p, l, ic]) => `<li><a class="${active(p)}" href="${R.href(p)}"><span class="ic">${ic}</span><span>${l}</span>${badge(p)}</a></li>`).join("")}</ul></nav>`;
  const chips = [
    a.overdue ? ["/lessons?filter=overdue", `${a.overdue} lesson${a.overdue > 1 ? "s" : ""} to mark`, "warn"] : null,
    a.notesMissing ? ["/lessons?filter=no-notes", `✎ ${a.notesMissing} lesson${a.notesMissing > 1 ? "s" : ""} need notes`, "accent"] : null,
    a.unsent ? ["/lessons?filter=unsent", `${a.unsent} summar${a.unsent > 1 ? "ies" : "y"} to send`, "brand"] : null,
    a.requests ? ["/requests", `${a.requests} request${a.requests > 1 ? "s" : ""}`, "danger"] : null,
    a.unpaid ? ["/sessions?filter=unpaid", `${a.unpaid} unpaid`, "danger"] : null,
    a.failed ? ["/notifications?status=failed", `${a.failed} email${a.failed > 1 ? "s" : ""} failed`, "danger"] : null,
  ].filter(Boolean);
  return `${nav("topnav desk-only")}${chips.length ? `<div class="attn">${chips.map(([h, t, tone]) => `<a class="chip chip-${tone}" href="${R.href(h)}">${esc(t)}</a>`).join("")}</div>` : ""}<main class="main">${inner}</main>${nav("bottomnav phone-only")}`;
}
function parentShell(route, inner) {
  const st = S.get(); const fam = S.family(st.portal.familyId); const p = S.parentsOf(fam.id)[0]; const zh = st.portal.lang === "zh";
  return `<header class="topnav"><div class="main" style="display:flex;justify-content:space-between;align-items:center;padding-block:10px"><a href="${R.href("/portal")}"><div class="b">${esc(st.settings.studioName)}</div><div class="xs muted">${zh ? "家长门户" : "Student portal"} · ${esc(p.name)}</div></a><a class="xs muted" href="${R.href("/login")}">${zh ? "退出登录" : "Sign out"}</a></div></header><main class="main">${inner}</main><p class="tc xs muted" style="padding-bottom:16px"><a class="brand" href="#">jillianyang.com</a></p>`;
}

export function render() {
  closeSheet();
  const route = R.current();
  const screen = SCREENS[route.id] ?? today.render;
  const out = screen(route);
  const isParent = route.id.startsWith("parent/"), isAuth = route.id.startsWith("auth/");
  const app = document.getElementById("app");
  app.innerHTML = isAuth ? `<main class="main">${out.html}</main>` : isParent ? parentShell(route, out.html) : teacherShell(route, out.html);
  document.getElementById("screen-id").textContent = route.id;
  document.getElementById("proto-lang-wrap").classList.toggle("hide", !isParent);
  document.getElementById("proto-role").textContent = isParent ? "Switch to teacher app" : "Switch to parent portal";
  document.getElementById("proto-lang").value = S.get().portal.lang;
  out.mount?.(app);
  const frame = document.querySelector(".frame"); if (frame) frame.scrollTop = 0; window.scrollTo(0, 0);
}

// prototype bar
const setFrame = (f) => { document.body.dataset.frame = f; document.getElementById("frame-phone").setAttribute("aria-pressed", String(f === "phone")); document.getElementById("frame-desktop").setAttribute("aria-pressed", String(f === "desktop")); try { localStorage.setItem("proto-frame", f); } catch { /* ignore */ } render(); };
document.getElementById("frame-phone").addEventListener("click", () => setFrame("phone"));
document.getElementById("frame-desktop").addEventListener("click", () => setFrame("desktop"));
document.getElementById("proto-role").addEventListener("click", () => R.go(R.current().id.startsWith("parent/") ? "/today" : "/portal"));
document.getElementById("proto-reset").addEventListener("click", () => { if (confirm("Reset the demo data to the sample studio?")) { S.reset(); R.go("/today"); } });
document.getElementById("proto-lang").addEventListener("change", (e) => S.setPortal({ lang: e.target.value }));
window.addEventListener("hashchange", render);
S.onChange(render);
let f = "desktop"; try { f = localStorage.getItem("proto-frame") || (window.innerWidth < 700 ? "phone" : "desktop"); } catch { /* ignore */ }
setFrame(f);
