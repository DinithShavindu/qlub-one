/**
 * "Restaurant POS screen" — deliberately retro, single HTML page, vanilla JS, no build step.
 * It must look like the restaurant's own system, not like qlub.
 */
export function renderUi(): string {
  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>POS TERMINAL</title>
<style>
  :root { --fg:#9BE29B; --dim:#5f8f5f; --bg:#0E140E; --panel:#132013; --hot:#F2E86D; --bad:#FF7B6B; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font: 18px/1.4 "IBM Plex Mono","Courier New",monospace; }
  header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 16px; border-bottom:2px solid var(--dim); }
  h1 { font-size:20px; margin:0; letter-spacing:.08em; }
  .clock { color:var(--dim); }
  nav { display:flex; flex-wrap:wrap; gap:8px; padding:12px 16px; border-bottom:1px dashed var(--dim); }
  nav button, .btn { font:inherit; background:transparent; color:var(--fg); border:2px solid var(--dim); padding:8px 14px; cursor:pointer; min-height:44px; }
  nav button[aria-selected="true"] { background:var(--fg); color:var(--bg); border-color:var(--fg); }
  nav .badge { margin-left:8px; }
  .btn:hover, nav button:hover { border-color:var(--fg); }
  .btn.bad { color:var(--bad); border-color:var(--bad); }
  .btn.on { background:var(--bad); color:var(--bg); border-color:var(--bad); }
  main { display:grid; grid-template-columns: 1fr 340px; gap:16px; padding:16px; }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
  .checks { display:flex; flex-direction:column; gap:12px; }
  .check { border:2px solid var(--dim); background:var(--panel); padding:12px 14px; }
  .check.flash { animation: flash 1s steps(2) 4; }
  @keyframes flash { 50% { background:var(--fg); color:var(--bg); } }
  .row { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .num { font-size:24px; font-weight:bold; }
  .status { padding:2px 10px; border:2px solid currentColor; }
  .status.OPEN { color:var(--hot); } .status.PAID { color:var(--fg); } .status.IN_KITCHEN { color:var(--hot); }
  .status.DONE { color:var(--dim); } .status.VOID { color:var(--bad); }
  ul { margin:8px 0; padding-left:20px; }
  .remark { color:var(--hot); font-style:italic; }
  .tender { color:var(--dim); }
  .empty { color:var(--dim); padding:24px; border:2px dashed var(--dim); text-align:center; }
  aside { border:2px solid var(--dim); padding:12px 14px; align-self:start; }
  aside h2 { font-size:18px; margin:0 0 8px; }
  label { display:block; margin:10px 0 4px; }
  input[type=range] { width:100%; accent-color:var(--fg); }
  .actions { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
  .offline-banner { color:var(--bg); background:var(--bad); padding:6px 10px; margin-bottom:12px; font-weight:bold; }
  details summary { cursor:pointer; }
</style>
</head>
<body>
<header>
  <h1>▓ POS TERMINAL v2.3 ▓</h1>
  <span id="conn" class="clock">CONNECTING…</span>
  <span id="clock" class="clock"></span>
</header>
<nav id="tabs" role="tablist" aria-label="Restaurants"></nav>
<main>
  <section>
    <div id="offline"></div>
    <div class="row" style="margin-bottom:8px"><strong id="title"></strong><span id="summary" class="clock"></span></div>
    <div id="checks" class="checks" aria-live="polite"></div>
  </section>
  <aside>
    <details open>
      <summary><strong>CHAOS PANEL</strong></summary>
      <label for="latency">LATENCY: <span id="latVal"></span> ms</label>
      <input id="latency" type="range" min="0" max="6000" step="100" />
      <div class="actions">
        <button class="btn" id="failNext">FAIL NEXT REQUEST</button>
        <button class="btn bad" id="down">TAKE OFFLINE</button>
      </div>
      <p class="clock" id="chaosInfo"></p>
    </details>
  </aside>
</main>
<script>
const $ = (id) => document.getElementById(id);
let data = null, active = localStorage.getItem("pos-tab"), seen = new Set(), first = true;
let audio;
function ding() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = "square"; o.frequency.value = 1320; g.gain.value = 0.08;
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.18);
  } catch (e) {}
}
document.addEventListener("click", () => { if (audio && audio.state === "suspended") audio.resume(); }, { once: true });
setInterval(() => { $("clock").textContent = new Date().toLocaleTimeString("en-GB"); }, 1000);

async function load() {
  const r = await fetch("/ui/state"); data = await r.json();
  if (!active || !data.restaurants.find(x => x.posVendorId === active)) active = data.restaurants[0]?.posVendorId;
  const fresh = [];
  for (const rest of data.restaurants) for (const ch of rest.checks) {
    if (!seen.has(ch.checkId)) { seen.add(ch.checkId); if (!first) fresh.push(ch.checkId); }
  }
  if (fresh.length) ding();
  first = false;
  render(fresh);
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function render(fresh = []) {
  const tabs = $("tabs"); tabs.innerHTML = "";
  for (const r of data.restaurants) {
    const b = document.createElement("button");
    const open = r.checks.filter(c => c.status !== "DONE" && c.status !== "VOID").length;
    b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(r.posVendorId === active));
    b.innerHTML = esc(r.emoji + " " + r.displayName) + '<span class="badge">[' + open + ']</span>' + (r.chaos.down ? ' <span style="color:var(--bad)">OFFLINE</span>' : "");
    b.onclick = () => { active = r.posVendorId; localStorage.setItem("pos-tab", active); render(); };
    tabs.appendChild(b);
  }
  const r = data.restaurants.find(x => x.posVendorId === active); if (!r) return;
  $("title").textContent = r.emoji + " " + r.displayName.toUpperCase() + "  ·  " + r.posVendorId;
  const paid = r.checks.filter(c => c.status !== "VOID").reduce((a, c) => a + Number(c.paid), 0);
  $("summary").textContent = r.checks.length + " CHECKS · TENDERED " + paid.toFixed(2);
  $("offline").innerHTML = r.chaos.down ? '<div class="offline-banner">TERMINAL OFFLINE — ALL REQUESTS RETURN 503</div>' : "";
  const list = $("checks");
  if (!r.checks.length) { list.innerHTML = '<div class="empty">NO CHECKS YET. WAITING FOR ORDERS…</div>'; }
  else list.innerHTML = r.checks.map(c => \`
    <article class="check \${fresh.includes(c.checkId) ? "flash" : ""}">
      <div class="row"><span class="num">#\${c.checkNumber}</span><span>TABLE \${esc(c.tableName)}</span><span class="status \${c.status}">\${c.status}</span></div>
      <ul>\${c.items.map(i => \`<li>\${i.quantity} x \${esc(i.title)} <span class="clock">@ \${i.price}</span>\${i.remark ? \`<div class="remark">» \${esc(i.remark)}</div>\` : ""}</li>\`).join("")}</ul>
      <div class="row"><strong>TOTAL \${c.total}</strong><span>PAID \${c.paid}</span><span class="clock">\${new Date(c.createdAt).toLocaleTimeString("en-GB")}</span></div>
      \${c.tenders.map(t => \`<div class="tender">TENDER \${esc(t.tenderType)} \${t.amount} · \${esc(t.reference)}</div>\`).join("")}
      <div class="tender">EXT REF \${esc(c.externalRef)}</div>
      \${c.status === "PAID" || c.status === "OPEN" || c.status === "IN_KITCHEN" ? \`<div class="actions">
        \${c.status !== "IN_KITCHEN" ? \`<button class="btn" onclick="setStatus('\${r.posVendorId}','\${c.checkId}','IN_KITCHEN')">IN KITCHEN</button>\` : ""}
        <button class="btn" onclick="setStatus('\${r.posVendorId}','\${c.checkId}','DONE')">MARK DONE</button>
      </div>\` : ""}
    </article>\`).join("");
  const lat = r.chaos.latencyMs ?? data.envLatencyMs;
  $("latency").value = lat; $("latVal").textContent = lat + (r.chaos.latencyMs === null ? " (env)" : "");
  $("down").textContent = r.chaos.down ? "BRING ONLINE" : "TAKE OFFLINE";
  $("down").classList.toggle("on", r.chaos.down);
  $("chaosInfo").textContent = r.chaos.failNextRequests ? "NEXT " + r.chaos.failNextRequests + " REQUEST(S) WILL FAIL" : "";
}
async function chaos(body) {
  await fetch("/admin/chaos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ posVendorId: active, ...body }) });
  load();
}
async function setStatus(pv, id, status) {
  await fetch("/ui/checks/" + pv + "/" + id + "/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  load();
}
$("latency").addEventListener("input", e => { $("latVal").textContent = e.target.value; });
$("latency").addEventListener("change", e => chaos({ latencyMs: Number(e.target.value) }));
$("failNext").onclick = () => { const r = data.restaurants.find(x => x.posVendorId === active); chaos({ failNextRequests: (r.chaos.failNextRequests || 0) + 1 }); };
$("down").onclick = () => { const r = data.restaurants.find(x => x.posVendorId === active); chaos({ down: !r.chaos.down }); };

let poll;
function connect() {
  const es = new EventSource("/ui/stream");
  es.onopen = () => { $("conn").textContent = "● ONLINE"; clearInterval(poll); poll = null; load(); };
  es.addEventListener("change", () => load());
  es.onerror = () => { $("conn").textContent = "○ RECONNECTING"; if (!poll) poll = setInterval(load, 2000); };
}
load().then(connect);
</script>
</body>
</html>`;
}
