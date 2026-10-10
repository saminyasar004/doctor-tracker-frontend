/**
 * Headless-Chrome screenshot helper used to eyeball the finished screens.
 *
 * Drives the DevTools Protocol over the WebSocket built into Node (no extra
 * dependencies): logs in through the real API, then captures each route.
 *
 *   node scripts/shoot.mjs <baseUrl> <outDir> [route[:name] ...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const [, , baseUrl = "http://localhost:3000", outDir = "docs/screenshots", ...routes] =
  process.argv;
const ROUTES = routes.length
  ? routes
  : ["/login:login", "/dashboard:dashboard", "/doctors:doctors", "/patients:patients"];
const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const PORT = 9222;

async function target() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  return res.json();
}

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();
  #events = new Map();

  static async open(wsUrl) {
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdp.#ws.addEventListener("open", resolve, { once: true });
      cdp.#ws.addEventListener("error", reject, { once: true });
    });
    cdp.#ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && cdp.#pending.has(msg.id)) {
        const { resolve, reject } = cdp.#pending.get(msg.id);
        cdp.#pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        cdp.#events.get(msg.method)?.forEach((fn) => fn(msg.params));
      }
    });
    return cdp;
  }

  send(method, params = {}) {
    const id = ++this.#id;
    this.#ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
  }

  on(method, fn) {
    if (!this.#events.has(method)) this.#events.set(method, new Set());
    this.#events.get(method).add(fn);
  }

  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeout);
      this.on(method, (params) => {
        clearTimeout(timer);
        resolve(params);
      });
    });
  }

  close() {
    this.#ws.close();
  }
}

const t = await target();
const cdp = await Cdp.open(t.webSocketDebuggerUrl);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Network.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

await mkdir(outDir, { recursive: true });

// Collect console errors so a silent failure does not look like a good screenshot.
const problems = [];
cdp.on("Runtime.consoleAPICalled", (p) => {
  if (p.type === "error")
    problems.push(p.args.map((a) => a.value ?? a.description ?? "").join(" "));
});
cdp.on("Runtime.exceptionThrown", (p) => problems.push(p.exceptionDetails?.text ?? "exception"));

async function goto(url) {
  const loaded = cdp.once("Page.loadEventFired", 20000);
  await cdp.send("Page.navigate", { url });
  await loaded;
}

/** Waits until the network is quiet and no skeleton rows are left on screen. */
async function settle(ms = 1200) {
  let quiet = 0;
  cdp.on("Network.loadingFinished", () => {
    quiet = Date.now();
  });
  for (let i = 0; i < 60; i += 1) {
    await sleep(200);
    const skeletons = await evaluate(
      'document.querySelectorAll("[data-slot=skeleton], .animate-pulse").length',
    );
    if (skeletons === 0 && Date.now() - quiet > 500) break;
  }
  await sleep(ms);
}

async function evaluate(expression) {
  const res = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return res.result?.value;
}

async function shoot(name) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const file = `${outDir}/${name}.png`;
  await writeFile(file, Buffer.from(data, "base64"));
  const title = await evaluate("document.title");
  console.log(`  ${file}  (${title})`);
}

// 1. Sign in through the real API so the session cookies + token are in place.
const login = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@doctortracker.com", password: "Admin@12345" }),
});
if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`);
const auth = await login.json();
const token = auth.data.accessToken;
const user = auth.data.user;

await goto(baseUrl);
await evaluate(
  `localStorage.setItem("dt_access_token", ${JSON.stringify(token)});
   localStorage.setItem("dt_user", ${JSON.stringify(JSON.stringify({ ...user, avatarUrl: user.avatarUrl ?? undefined }))});
   "ok"`,
);

for (const spec of ROUTES) {
  const [route, name] = spec.split(":");
  const path = route === "/login" ? "/login" : route;
  await goto(`${baseUrl}${path}`);
  await settle();
  await shoot(name ?? route.replace(/\W+/g, "-").replace(/^-|-$/g, "") ?? "page");
}

if (problems.length) {
  console.log("\nconsole problems:");
  [...new Set(problems)].forEach((p) => console.log("  -", String(p).slice(0, 200)));
}

cdp.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
