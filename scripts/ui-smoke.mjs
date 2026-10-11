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
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

/* ----------------------------------------------------------- API coverage ---
 * Every request the browser makes is recorded and, at the end, diffed against the
 * API's own OpenAPI document. That turns "every endpoint is wired" into something
 * measured rather than assumed.
 */
const apiHits = new Map();
const apiHitsKey = (key) => [...apiHits.keys()].includes(key);
const normalise = (url) => {
  const path = url.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
  const method = "GET";
  return `${method} ${path.replace(/[a-z0-9]{20,}/gi, "{id}")}`;
};
const recordApi = (p) => {
  const url = p.request?.url ?? "";
  if (!url.includes("/api/") && !url.includes("/health")) return;
  const entry = normalise(url);
  if (!apiHits.has(entry)) apiHits.set(entry, { methods: new Set(), url });
};
listeners.set("Network.requestWillBeSent", [recordApi]);
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method !== "Network.requestWillBeSent") return;
  const url = m.params.request?.url ?? "";
  if (!url.includes("/api/") && !url.includes("/health")) return;
  const key = `${m.params.request.method} ${url
    .split("?")[0]
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[a-z0-9]{20,}/gi, "{id}")}`;
  apiHits.set(key, { methods: new Set([m.params.request.method]), url });
});
await send("Network.enable");

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

/**
 * Like {@link fill} but clears the field first.
 *
 * `Input.insertText` appends to the current value, so a prefilled field such as the
 * age on an edit sheet would otherwise become "3344" and fail validation.
 */
async function replaceField(labelText, value) {
  await clickMeasured(controlFor(labelText), `field "${labelText}"`);
  for (const { modifiers, key, code, vk } of [
    { modifiers: 2, key: "a", code: "KeyA", vk: 65 },
    { key: "Delete", code: "Delete", vk: 46 },
  ]) {
    await send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      modifiers,
      key,
      code,
      windowsVirtualKeyCode: vk,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      modifiers,
      key,
      code,
      windowsVirtualKeyCode: vk,
    });
  }
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
    const wanted = ${JSON.stringify(option)};
    return {
      target: wanted === null ? 0 : items.findIndex((o) => o.textContent.trim() === wanted),
      total: items.length,
    };
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
  if (option !== null && !picked.toLowerCase().includes(option.toLowerCase())) {
    throw new Error(`select "${option}" landed on "${picked}"`);
  }
}

/**
 * Completes every required patient field, so the form actually submits.
 *
 * `GET /patients/filter-options` feeds the condition list and the doctor picker;
 * `null` as an option picks the first entry, which is enough for a journey that only
 * needs *a* valid assignment.
 */
async function fillPatientForm(name, age) {
  await fill("full name", name);
  await fill("age", age);
  await fill("phone", "+15550123");
  await selectOption("gender", "Male");
  await selectOption("condition", "Migraine");
  if (await evaluate(`!!${controlFor("assigned doctor")}`)) {
    await selectOption("assigned doctor", null);
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

// ------------------------------------------------- uploads (POST /uploads) ---
// The avatar picker must upload through the API rather than embedding a data URL,
// because the doctor/patient DTOs validate `avatarUrl` as an absolute http(s) URL.
const UPLOAD_FIXTURE = join(tmpdir(), "ui-smoke-avatar.png");
await writeFile(
  UPLOAD_FIXTURE,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8//8/AzJgYkAD" +
      "M0YqUf9EQtGKFToNZUqMCJHoUSPUAAAAAElFTkSuQmCC",
    "base64",
  ),
);

await goto(`${baseUrl}/patients`);
await evaluate(`(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Add patient"));
  btn?.click();
  return !!btn;
})()`);
await waitFor(`document.body.innerText.includes("Full name")`);

const uploadRequests = [];
listeners.set("Network.requestWillBeSent", [
  (p) => {
    if (p.request.url.includes("/uploads/image"))
      uploadRequests.push(`${p.request.method} ${p.request.url}`);
  },
]);
await send("Network.enable");

// Attach a real file to the picker's <input type="file"> so the component performs
// the multipart POST itself, exactly as a user picking a photo would.
const attached = await evaluate(`(() => {
  const input = document.querySelector('input[type=file]');
  if (!input) return null;
  input.dataset.smokeId = "avatar-input";
  return true;
})()`);
check("patient form exposes an avatar file input", attached === true);

const { root } = await send("DOM.getDocument", { depth: -1 });
const { nodeId } = await send("DOM.querySelector", {
  nodeId: root.nodeId,
  selector: 'input[data-smoke-id="avatar-input"]',
});
if (nodeId) {
  await send("DOM.setFileInputFiles", { files: [UPLOAD_FIXTURE], nodeId });
}

await waitFor(
  `(() => { const img = document.querySelector('img[alt="Avatar preview"]'); return !!img && /^https?:/.test(img.src); })()`,
  20000,
);
const avatarSrc = await evaluate(`document.querySelector('img[alt="Avatar preview"]')?.src ?? ""`);
check(
  "POST /uploads/image runs from the picker and stores a hosted image",
  uploadRequests.some((r) => r.startsWith("POST")) && avatarSrc.startsWith("http"),
  avatarSrc.slice(0, 80),
);
check("avatar is a real URL, not a data URL", !avatarSrc.startsWith("data:"));

const avatarLoads = await evaluate(
  `(async () => { const img = document.querySelector('img[alt="Avatar preview"]'); if (!img?.src) return false; try { const r = await fetch(img.src, { method: "GET" }); return r.ok; } catch { return false; } })()`,
);
check("uploaded avatar URL actually resolves", avatarLoads === true);

// Removing the photo must call DELETE /uploads/image for the stored asset.
const removed = await evaluate(`(() => {
  const btn = document.querySelector('button[aria-label="Remove photo"]');
  if (!btn) return false;
  btn.click();
  return true;
})()`);
check("remove-photo control is present", removed === true);
await sleep(1500);
check(
  "DELETE /uploads/image runs when the photo is removed",
  uploadRequests.some((r) => r.startsWith("DELETE")),
  uploadRequests.join(" | ") || "no upload requests seen",
);

// -------------------------------------------- patient profile (GET /patients/:id) ---
await goto(`${baseUrl}/patients`);
await waitFor(`document.querySelector("tbody tr")`);
const patientId = await evaluate(`(() => {
  const link = document.querySelector('a[href^="/patients/"]');
  return link ? link.getAttribute("href").split("/").pop() : null;
})()`);
check("patient rows link to the profile route", !!patientId, patientId ?? "no link");

if (patientId) {
  // Client-side navigation does not fire a page load, so wait for the route itself.
  await goto(`${baseUrl}/patients/${patientId}`);
  await waitFor(`location.pathname.endsWith(${JSON.stringify(`/patients/${patientId}`)})`, 15000);
  await waitFor(`document.querySelector("h1")`, 15000);
  await sleep(600);
  const profile = await evaluate(`document.body.innerText`);
  check("GET /patients/:id renders the profile", !profile.includes("Could not load this patient"));
  check("profile shows the care section", /Care|Assigned doctor|Unassigned/.test(profile));

  const stillThere = await (
    await fetch(`${API}/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${auth.data.accessToken}` },
    })
  ).json();
  check(
    "profile shows the same record the API returns",
    profile.includes(stillThere.data.name),
    stillThere.data.name,
  );
}

// ---------------------------------------------- session revalidation (/auth/me) ---
const meCalls = [];
listeners.set("Network.requestWillBeSent", [
  (p) => {
    if (p.request.url.includes("/auth/me")) meCalls.push(p.request.url);
  },
]);
await send("Network.enable");
await goto(`${baseUrl}/dashboard`);
await waitFor(`document.querySelector("h1")`);
await sleep(1200);
check(
  "GET /auth/me is called to revalidate the session",
  meCalls.length > 0,
  `${meCalls.length} call(s)`,
);

// ---------------------------------------------------------- health (GET /health) ---
const health = await evaluate(`(async () => {
  const base = ${JSON.stringify(API)}.split("/api/v")[0];
  const res = await fetch(base + "/health");
  const body = await res.json();
  return { ok: res.ok, status: body && body.data && body.data.status, database: body && body.data && body.data.database };
})()`);
check(
  "GET /health is reachable and reports the database",
  health.ok && health.status === "ok" && health.database === "up",
  `status=${health.status} database=${health.database}`,
);

// ------------------------------------- doctor edit + nested patient endpoints ---
// Exercises PATCH /doctors/{id}, POST and DELETE /doctors/{id}/patients.
await goto(`${baseUrl}/doctors`);
await waitFor(`document.querySelector("tbody tr")`);
const doctorId = await evaluate(`(() => {
  const link = document.querySelector('a[href^="/doctors/"]');
  return link ? link.getAttribute("href").split("/").pop() : null;
})()`);
check("doctor rows link to the profile route", !!doctorId, doctorId ?? "no link");

if (doctorId) {
  await goto(`${baseUrl}/doctors/${doctorId}`);
  await waitFor(`document.body.innerText.includes("Patients")`);
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Edit");
    btn?.click();
    return !!btn;
  })()`);
  await waitFor(`document.body.innerText.includes("Full name")`);
  await replaceField("full name", `Dr. Edited ${stamp}`);
  await clickText("form button", "Save changes");
  await sleep(2500);
  const renamed = await (
    await fetch(`${API}/doctors/${doctorId}`, {
      headers: { Authorization: `Bearer ${auth.data.accessToken}` },
    })
  ).json();
  check(
    "PATCH /doctors/:id persists the rename",
    renamed.data?.name === `Dr. Edited ${stamp}`,
    renamed.data?.name,
  );

  // add a patient to this doctor through the nested route
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.innerText.includes("Add patient"));
    btn?.click();
    return !!btn;
  })()`);
  await waitFor(`document.body.innerText.includes("Full name")`);
  await fillPatientForm(`Nested Patient ${stamp}`, "41");
  await clickText("form button", "Add patient");
  await sleep(2500);

  const nested = await (
    await fetch(`${API}/doctors/${doctorId}/patients?search=Nested%20Patient%20${stamp}`, {
      headers: { Authorization: `Bearer ${auth.data.accessToken}` },
    })
  ).json();
  const nestedPatient = nested.data?.[0];
  check(
    "POST /doctors/:id/patients attaches the patient",
    !!nestedPatient,
    nested.data?.length ?? 0,
  );

  if (nestedPatient) {
    // remove it again through the row action menu
    await goto(`${baseUrl}/doctors/${doctorId}?q=Nested+Patient+${stamp}`);
    await waitFor(`document.querySelector("tbody tr")`);
    // Radix opens the menu on pointerdown, so a synthetic .click() is ignored.
    await clickMeasured(
      `document.querySelector('button[aria-label^="Actions for"]')`,
      "row actions menu",
    );
    await sleep(700);
    await clickText("[role=menuitem]", "Remove");
    await sleep(600);
    await clickText("[role=alertdialog] button", "Delete");
    await sleep(2000);
    const after = await (
      await fetch(`${API}/doctors/${doctorId}/patients?search=Nested%20Patient%20${stamp}`, {
        headers: { Authorization: `Bearer ${auth.data.accessToken}` },
      })
    ).json();
    check(
      "DELETE /doctors/:id/patients/:patientId detaches the patient",
      (after.data?.length ?? 0) === 0,
      `${after.data?.length ?? 0} left`,
    );
  }
}

// --------------------------------------------- patient create / edit / delete ---
// POST /patients, PATCH /patients/:id and DELETE /patients/:id.
await goto(`${baseUrl}/patients`);
await evaluate(`(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Add patient"));
  btn?.click();
  return !!btn;
})()`);
await waitFor(`document.body.innerText.includes("Full name")`);
await fillPatientForm(`CRUD Patient ${stamp}`, "33");
await clickText("form button", "Create patient");
await sleep(2500);

const created = await (
  await fetch(`${API}/patients?search=CRUD%20Patient%20${stamp}`, {
    headers: { Authorization: `Bearer ${auth.data.accessToken}` },
  })
).json();
const crudPatient = created.data?.[0];
check("POST /patients creates a record", !!crudPatient, created.data?.length ?? 0);

if (crudPatient) {
  await goto(`${baseUrl}/patients/${crudPatient.id}`);
  await waitFor(`document.querySelector("h1")`);
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Edit");
    btn?.click();
    return !!btn;
  })()`);
  await waitFor(`document.body.innerText.includes("Full name")`);
  await replaceField("age", "44");
  await clickText("form button", "Save changes");
  await sleep(2500);
  const edited = await (
    await fetch(`${API}/patients/${crudPatient.id}`, {
      headers: { Authorization: `Bearer ${auth.data.accessToken}` },
    })
  ).json();
  check(
    "PATCH /patients/:id persists the change",
    edited.data?.age === 44,
    `age=${edited.data?.age}`,
  );

  await clickMeasured(
    `[...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "More actions")`,
    "more actions menu",
  );
  await sleep(500);
  await clickText("[role=menuitem]", "Delete patient");
  await sleep(500);
  await clickText("button", "Delete patient");
  await sleep(2500);
  const gone = await fetch(`${API}/patients/${crudPatient.id}`, {
    headers: { Authorization: `Bearer ${auth.data.accessToken}` },
  });
  check("DELETE /patients/:id removes the record", gone.status === 404, `status ${gone.status}`);
}

// ------------------------------------------------ token refresh + re-login ---
// The API accepts a valid httpOnly access cookie even when the bearer token is
// bogus, so the cookie itself has to go for the client to see a 401 and rotate.
// CDP can delete httpOnly cookies; the refresh cookie stays, which is exactly the
// real-world "access token expired mid-session" case.
await goto(`${baseUrl}/dashboard`);
await send("Network.deleteCookies", { name: "access_token", url: baseUrl });
await evaluate(`localStorage.setItem("dt_access_token", "expired.token.value"); "ok"`);
await goto(`${baseUrl}/doctors`);
await waitFor(
  `document.querySelector("tbody tr") || document.body.innerText.includes("Sign in")`,
  15000,
);
check(
  "expired access token rotates through POST /auth/refresh",
  apiHitsKey("POST /api/v1/auth/refresh"),
);

await clickMeasured(`document.querySelector('button[aria-label="Account menu"]')`, "account menu");
await sleep(700);
await clickText("[role=menuitem]", "Log out");
await sleep(2000);
await goto(`${baseUrl}/login`);
await waitFor(`document.body.innerText.includes("Sign in")`);
// sign in through the real form so POST /auth/login comes from the UI
await evaluate(`(() => {
  const set = (sel, val) => {
    const el = document.querySelector(sel);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set('input[type=email]', "admin@doctortracker.com");
  set('input[type=password]', "Admin@12345");
  document.querySelector('button[type=submit]').click();
  return "submitted";
})()`);
await sleep(3000);
check(
  "UI sign-in returns to the dashboard",
  (await evaluate(`location.pathname`)) === "/dashboard",
);

// ------------------------------------------------------- coverage report -----
const spec = await (await fetch(`${API.replace(/\/api\/v\d+$/, "")}/api/docs-json`)).json();
const declared = new Set();
for (const [path, ops] of Object.entries(spec.paths)) {
  const norm = path.replace(/[a-z0-9]{20,}/gi, "{id}");
  for (const method of Object.keys(ops)) declared.add(`${method.toUpperCase()} ${norm}`);
}
const seen = new Set(
  [...apiHits.keys()].map((k) => k.replace(/^(\w+) .*/, "$1 ").trim() + k.slice(k.indexOf(" "))),
);

const rows = [];
for (const d of declared) {
  const method = d.split(" ")[0];
  const path = d.slice(method.length + 1);
  const hit = [...apiHits.keys()].some((k) => {
    const [hm, hp] = [k.slice(0, k.indexOf(" ")), k.slice(k.indexOf(" ") + 1)];
    return (
      hm === method && (hp === path || hp.replace(/\{id\}/g, "") === path.replace(/\{[^}]+\}/g, ""))
    );
  });
  rows.push({ method, path, hit });
}
rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
console.log("\nAPI endpoint coverage (observed in the browser during this run)");
console.log("-".repeat(74));
for (const r of rows) {
  console.log(`  ${r.hit ? "ok  " : "GAP "} ${r.method.padEnd(6)} ${r.path}`);
}
const covered = rows.filter((r) => r.hit).length;
console.log("-".repeat(74));
console.log(`  covered ${covered}/${rows.length} endpoints`);
check(
  "every backend endpoint was exercised by the UI",
  covered === rows.length,
  `${covered}/${rows.length}`,
);

console.log(
  `\npassed: ${checks.filter((c) => c.ok).length}  failed: ${checks.filter((c) => !c.ok).length}`,
);
ws.close();
process.exit(checks.some((c) => !c.ok) ? 1 : 0);
