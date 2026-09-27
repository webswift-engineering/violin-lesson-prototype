import { esc } from "../ui.js";
import * as S from "../store.js";
import { href, go } from "../router.js";

export function login() {
  const st = S.get().settings;
  const html = `<div style="max-width:24rem;margin:40px auto"><h1 class="tc">${esc(st.studioName)}</h1><p class="tc muted small mt1">Sign in</p>
    <div class="card p4 mt6 col"><div class="b">Teacher</div><input class="input" placeholder="Email" value="teacher@example.com"><input class="input" type="password" placeholder="Password" value="password"><button class="btn btn-primary w" id="t-login">Sign in</button></div>
    <div class="card p4 mt4 col"><div class="b">Parent</div><p class="muted small">Enter the email your teacher has on file; we email you a sign-in link.</p><input class="input" placeholder="Parent email" value="amy.chen@example.com" id="p-email"><button class="btn btn-outline w" id="p-login">Send magic link</button><p class="xs muted" id="p-msg"></p></div>
    <p class="tc xs muted mt6">Prototype: both buttons sign you in immediately.</p></div>`;
  return { html, mount(root) {
    root.querySelector("#t-login").addEventListener("click", () => go("/today"));
    root.querySelector("#p-login").addEventListener("click", () => { const email = root.querySelector("#p-email").value.trim(); const p = S.get().parents.find((x) => x.email === email); if (!p) { root.querySelector("#p-msg").textContent = "That email is not on file. Ask your teacher to add it."; return; } S.setPortal({ familyId: p.familyId, lang: S.family(p.familyId).language }); go("/portal"); });
  } };
}
export { href };
