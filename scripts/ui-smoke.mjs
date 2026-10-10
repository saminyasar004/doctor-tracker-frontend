/**
 * Interaction smoke test driven through headless Chrome.
 *
 * Exercises the real user journey against the real API: create a doctor from the
 * doctors page, confirm it appears in the list and can be searched for, open its
 * profile, then delete it from the row menu.
 *
 *   node scripts/ui-smoke.mjs [baseUrl]
 */
import { setTimeout as sleep } from "node:timers/promises";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const PORT = 9222;

const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
const target = await res.json();

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r, { once: true });
  ws.addEventListener("error", j, { once: true });
});

let id = 0;
const pending = new Map();
const listeners = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method) listeners.get(m.method)?.forEach((fn) => fn(m.params));
});

const send = (method, params = {}) => {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
};
const once = (method, ms = 15000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), ms);
    listeners.set(method, [
      (p) => {
        clearTimeout(t);
        resolve(p);
      },
    ]);
  });

await send("Page.enable");
await send("Runtime.enable");

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const detail = r.exceptionDetails.exception?.description ?? r.exceptionDetails.text;
    throw new Error(`${detail} :: ${expression.replace(/\s+/g, " ").slice(0, 160)}`);
  }
  return r.result?.value;
}

async function goto(url) {
  const loaded = once("Page.loadEventFired", 20000);
  await send("Page.navigate", { url });
  await loaded;
  await waitFor("document.querySelector('h1') !== null");
  await sleep(900);
}

/** Polls a JS predicate until it is truthy. */
async function waitFor(expression, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(`!!(${expression})`)) return true;
    await sleep(200);
  }
  throw new Error(`timed out waiting for: ${expression}`);
}

/**
 * Clicks the first element whose text matches, with a real mouse event.
 *
 * Coordinates are re-measured and verified with `elementFromPoint` right before
 * the click: a Radix overlay that scrolls or locks the body between measuring and
 * dispatching would otherwise send the click to whatever moved into that spot.
 */
async function clickText(selector, text) {
  const wanted = text.toLowerCase();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const point = await evaluate(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((e) => e.textContent.trim().toLowerCase().includes(${JSON.stringify(wanted)}));
      if (!el) return { missing: true };
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const at = document.elementFromPoint(x, y);
      const hit = !!at && (at === el || el.contains(at) || at.contains(el));
      return { x, y, hit, missing: false };
    })()`);

    if (point.missing) throw new Error(`no ${selector} containing "${text}"`);
    if (point.hit) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", {
          type,
          x: point.x,
          y: point.y,
          button: "left",
          clickCount: 1,
        });
      }
      return;
    }
    await sleep(250);
  }
  throw new Error(`could not click "${text}": the target moved out from under the pointer`);
}

/**
 * Clicks an element found by `measure`, re-measuring on every attempt and only
 * clicking when the pointer really lands on it.
 *
 * The re-measure matters: a sheet that is still animating, or an input the
 * browser scrolled into view, moves between measuring and clicking, and a stale
 * coordinate lands on the backdrop (closing the sheet) instead of the control.
 */
async function clickMeasured(measure, what) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const point = await evaluate(
      `(() => { const el = (${measure}); if (!el) return null; el.scrollIntoView({ block: "center", inline: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
    );
    if (!point) throw new Error(`no element for ${what}`);
    const covered = await evaluate(`(() => {
      const el = (${measure});
      const at = document.elementFromPoint(${point.x}, ${point.y});
      return !(at && (at === el || el.contains(at) || at.contains(el)));
    })()`);
    if (!covered) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", {
          type,
          x: point.x,
          y: point.y,
          button: "left",
          clickCount: 1,
        });
      }
      return;
    }
    await sleep(250);
  }
  throw new Error(`could not click ${what}: something covers it`);
}

/** JS expression locating the control attached to a form label. */
const controlFor = (labelText) =>
  `(() => {
    const wanted = ${JSON.stringify(labelText.toLowerCase())};
    const dialogs = [...document.querySelectorAll("[role=dialog]")];
    const scopes = [...dialogs, document];
    for (const scope of scopes) {
      const label = [...scope.querySelectorAll("label")].find((l) =>
        l.textContent.trim().toLowerCase().startsWith(wanted));
      if (label) {
        const byId = document.getElementById(label.getAttribute("for"));
        if (byId) return byId;
      }
    }
    return scopes
      .flatMap((scope) => [...scope.querySelectorAll("[aria-label]")])
      .find((el) => (el.getAttribute("aria-label") ?? "").toLowerCase().includes(wanted)) ?? null;
  })()`;

/** Types into a labelled field the way a user does, so React's onChange fires. */
async function fill(labelText, value) {
  await clickMeasured(controlFor(labelText), `field "${labelText}"`);
  await send("Input.insertText", { text: value });
  await sleep(120);
}

/** Clicks the control of a labelled field (used for Radix Select triggers). */
async function clickField(labelText) {
  await clickMeasured(controlFor(labelText), `control "${labelText}"`);
}

/**
 * Opens a shadcn Select and picks an option by its visible text.
 *
 * Driven with arrow keys rather than typeahead or synthetic pointer events:
 * Radix selects on `pointerup` inside a portalled layer, and a synthetic click
 * there is treated as an outside interaction by the surrounding sheet.
 */
async function selectOption(labelText, option) {
  await clickField(labelText);
  await waitFor(`document.querySelector("[role=listbox]")`, 6000);

  const index = await evaluate(`(() => {
    const items = [...document.querySelectorAll("[role=listbox] [role=option]")];
    return { target: items.findIndex((o) => o.textContent.trim() === ${JSON.stringify(option)}), total: items.length };
  })()`);
  if (index.target < 0) throw new Error(`no option "${option}" (of ${index.total})`);

  const press = async (key, code, vk) => {
    await send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key,
      code,
      windowsVirtualKeyCode: vk,
    });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
  };
  for (let i = 0; i < index.target; i += 1) {
    await press("ArrowDown", "ArrowDown", 40);
    await sleep(80);
  }
  await press("Enter", "Enter", 13);
  await waitFor(`!document.querySelector("[role=listbox]")`, 6000);
  await sleep(200);

  const picked = await evaluate(
    `${controlFor(labelText)} ? ${controlFor(labelText)}.textContent.trim() : ""`,
  );
  if (!picked.toLowerCase().includes(option.toLowerCase())) {
    throw new Error(`select "${option}" landed on "${picked}"`);
  }
}

const checks = [];
const check = (name, ok, extra = "") => {
  checks.push({ name, ok });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);
};

// ---------------------------------------------------------------- sign in ----
const login = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@doctortracker.com", password: "Admin@12345" }),
});
const auth = await login.json();
await goto(baseUrl);
await evaluate(`localStorage.setItem("dt_access_token", ${JSON.stringify(auth.data.accessToken)});
  localStorage.setItem("dt_user", ${JSON.stringify(JSON.stringify(auth.data.user))}); "ok"`);

const stamp = Date.now();
const NAME = `Dr. UI Smoke ${stamp}`;

// --------------------------------------------------------- create a doctor ---
// Remove leftovers from an interrupted run so the totals are deterministic.
const stale = await (
  await fetch(`${API}/doctors?search=UI%20Smoke&limit=100`, {
    headers: { Authorization: `Bearer ${auth.data.accessToken}` },
  })
).json();
for (const doctor of stale.data ?? []) {
  await fetch(`${API}/doctors/${doctor.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auth.data.accessToken}` },
  });
}

await goto(`${baseUrl}/doctors`);
check(
  "doctors page renders the total from the API",
  await evaluate(`/\\d+ doctors? in the network/.test(document.body.innerText)`),
);

await clickText("button", "Add doctor");
await waitFor(`document.querySelector("[data-slot=sheet-content], [role=dialog]")`);
await fill("full name", NAME);
await selectOption("specialization", "Cardiology");
console.log(
  "    [diag] after select:",
  await evaluate(
    `JSON.stringify({ url: location.pathname + location.search, dialogs: document.querySelectorAll("[role=dialog]").length, labels: [...document.querySelectorAll("label")].map((l) => l.textContent.trim()), body: document.body.innerText.slice(0, 120) })`,
  ),
);
await fill("hospital", "Interaction Test Hospital");
await fill("phone", "+15550001111");
await fill("email", `ui.smoke.${stamp}@clinic.com`);
await clickText("button", "create doctor");

await waitFor(`document.body.innerText.includes(${JSON.stringify(NAME)})`, 15000);
check(
  "created doctor shows in the table",
  await evaluate(`document.body.innerText.includes(${JSON.stringify(NAME)})`),
);

// --------------------------------------------------------------- search it ---
await fill("search doctors", "UI Smoke");
// The input is debounced (300 ms) and the query is server-side, so wait for the
// URL to pick the filter up before asserting on the result.
await waitFor(`location.search.includes("q=UI")`);
await waitFor(`document.querySelectorAll("tbody tr").length === 1`, 12000);
check(
  "search narrows to the new doctor",
  await evaluate(`/\\b1 doctor\\b/.test(document.body.innerText)`),
);
check("filters live in the URL", await evaluate(`location.search.includes("q=UI")`));

// --------------------------------------------------------------- open it ------
await clickText("a", NAME);
await waitFor(`document.body.innerText.includes("Intake per month")`);
check(
  "doctor profile loads",
  await evaluate(`document.body.innerText.includes("Interaction Test Hospital")`),
);
await waitFor(
  `document.body.innerText.includes("No patients assigned yet") || document.querySelectorAll("tbody tr").length > 0`,
  12000,
);
check(
  "new doctor has no patients yet",
  await evaluate(`document.body.innerText.includes("No patients assigned yet")`),
);

// ------------------------------------------------------------ delete it -------
await goto(`${baseUrl}/doctors?q=UI%20Smoke`);
await waitFor(`document.querySelector("tbody tr")`);
await clickMeasured(`document.querySelector('[aria-label^="Actions"]')`, "row actions menu");
await waitFor(`document.querySelector("[role=menu]")`, 6000);
await clickText("[role=menuitem]", "Delete");
await waitFor(`document.querySelector("[role=alertdialog]")`);
await clickText("[role=alertdialog] button", "Delete");
await waitFor(`!document.body.innerText.includes(${JSON.stringify(NAME)})`, 15000);
check(
  "doctor deleted from the list",
  !(await evaluate(`document.body.innerText.includes(${JSON.stringify(NAME)})`)),
);

// -------------------------------------------------- patient list behaviour ---
await goto(`${baseUrl}/patients?gender=FEMALE&condition=Diabetes`);
await waitFor(`document.querySelector("tbody tr")`);
const rowsAreFemale = await evaluate(
  `[...document.querySelectorAll("tbody tr")].every((r) => r.innerText.includes("Female"))`,
);
const rowsAreDiabetes = await evaluate(
  `[...document.querySelectorAll("tbody tr")].every((r) => r.innerText.includes("Diabetes"))`,
);
check("gender filter applied", rowsAreFemale);
check("condition filter applied", rowsAreDiabetes);

// search on the patients page goes through the same `q` -> `search` mapping
await goto(`${baseUrl}/patients`);
await fill("search patients", "Migraine");
await waitFor(`location.search.includes("q=Migraine")`);
await waitFor(
  `[...document.querySelectorAll("tbody tr")].length > 0 &&
   [...document.querySelectorAll("tbody tr")].every((r) => r.innerText.includes("Migraine"))`,
  12000,
);
check("patient search filters server-side", true);
await goto(`${baseUrl}/patients?limit=5&page=2`);
check(
  "patients pagination works",
  await evaluate(`document.body.innerText.includes("Showing 6 to 10")`),
);

console.log(
  `\npassed: ${checks.filter((c) => c.ok).length}  failed: ${checks.filter((c) => !c.ok).length}`,
);
ws.close();
process.exit(checks.some((c) => !c.ok) ? 1 : 0);
