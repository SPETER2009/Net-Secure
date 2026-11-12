"use strict";

// Leave empty when the backend serves this page (default).
// If the frontend is hosted separately, set it to your backend URL, e.g.
// "https://your-backend.onrender.com" (and set CORS_ORIGINS on the backend).
const API_BASE = "";

const MIN_DEVICES = 2;
const MAX_DEVICES = 12;

const SAMPLE = {
  devices: ["PC1", "PC2", "Server1", "Server2", "Router"],
  matrix: [
    [0, 50, 200, 10, 100],
    [50, 0, 30, 5, 80],
    [200, 30, 0, 150, 300],
    [10, 5, 150, 0, 60],
    [100, 80, 300, 60, 0],
  ],
};

const PALETTE = [
  "#2563eb", "#e8590c", "#2f9e44", "#9c36b5", "#d6336c", "#0c8599",
  "#f08c00", "#5c7cfa", "#66a80f", "#862e9c", "#c92a2a", "#495057",
];

const state = { devices: [], matrix: [] };
const charts = {};
let lastData = null;

const $ = (id) => document.getElementById(id);

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/* ------------------------------------------------------------------ */
/* State + matrix editor                                               */
/* ------------------------------------------------------------------ */

function setState(devices, matrix) {
  state.devices = [...devices];
  state.matrix = matrix.map((row) => [...row]);
  renderMatrix();
}

function isValidValue(v) {
  return Number.isFinite(v) && v >= 0;
}

function renderMatrix() {
  const table = $("matrix");
  table.replaceChildren();
  const n = state.devices.length;

  // header row: editable device names
  const headRow = table.createTHead().insertRow();
  headRow.appendChild(el("th"));
  state.devices.forEach((name, j) => {
    const th = el("th");
    th.scope = "col";
    const wrap = el("div", undefined, "name-cell");

    const input = el("input", undefined, "name-input");
    input.type = "text";
    input.value = name;
    input.maxLength = 20;
    input.setAttribute("aria-label", `Name of device ${j + 1}`);
    input.addEventListener("input", () => {
      state.devices[j] = input.value;
      const label = table.querySelector(`.row-label[data-idx="${j}"]`);
      if (label) label.textContent = input.value;
    });
    wrap.appendChild(input);

    if (n > MIN_DEVICES) {
      const remove = el("button", "×", "remove");
      remove.type = "button";
      remove.title = `Remove ${name}`;
      remove.setAttribute("aria-label", `Remove device ${j + 1}`);
      remove.addEventListener("click", () => removeDevice(j));
      wrap.appendChild(remove);
    }
    th.appendChild(wrap);
    headRow.appendChild(th);
  });

  // body: one row per device
  const body = table.createTBody();
  for (let i = 0; i < n; i++) {
    const row = body.insertRow();
    const rowHead = el("th");
    rowHead.scope = "row";
    const label = el("span", state.devices[i], "row-label");
    label.dataset.idx = String(i);
    rowHead.appendChild(label);
    row.appendChild(rowHead);

    for (let j = 0; j < n; j++) {
      const td = row.insertCell();
      const input = el("input", undefined, "cell");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.inputMode = "decimal";
      input.dataset.r = String(i);
      input.dataset.c = String(j);
      input.setAttribute("aria-label", `Traffic from device ${i + 1} to device ${j + 1}`);

      if (i === j) {
        input.value = "0";
        input.disabled = true;
        input.classList.add("diag");
      } else {
        input.value = String(state.matrix[i][j]);
        input.addEventListener("input", () => onCellInput(input, i, j));
      }
      td.appendChild(input);
    }
  }
}

function onCellInput(input, i, j) {
  const raw = input.value;
  const value = raw === "" ? 0 : Number(raw);
  state.matrix[i][j] = value;
  input.classList.toggle("invalid", !isValidValue(value));

  if ($("symmetric").checked) {
    state.matrix[j][i] = value;
    const mirror = $("matrix").querySelector(`input[data-r="${j}"][data-c="${i}"]`);
    if (mirror) {
      mirror.value = raw;
      mirror.classList.toggle("invalid", !isValidValue(value));
    }
  }
}

function addDevice() {
  const n = state.devices.length;
  if (n >= MAX_DEVICES) {
    showError(`You can add up to ${MAX_DEVICES} devices.`);
    return;
  }
  hideError();
  let k = n + 1;
  while (state.devices.includes(`Device ${k}`)) k++;
  state.devices.push(`Device ${k}`);
  state.matrix.forEach((row) => row.push(0));
  state.matrix.push(new Array(n + 1).fill(0));
  renderMatrix();
}

function removeDevice(idx) {
  if (state.devices.length <= MIN_DEVICES) return;
  state.devices.splice(idx, 1);
  state.matrix.splice(idx, 1);
  state.matrix.forEach((row) => row.splice(idx, 1));
  renderMatrix();
}

function randomize() {
  const n = state.devices.length;
  const sym = $("symmetric").checked;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { state.matrix[i][j] = 0; continue; }
      if (sym && j < i) { state.matrix[i][j] = state.matrix[j][i]; continue; }
      state.matrix[i][j] = Math.round(Math.random() * 30) * 10;
    }
  }
  renderMatrix();
}

function clearMatrix() {
  const n = state.devices.length;
  state.matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  renderMatrix();
}

/* ------------------------------------------------------------------ */
/* CSV import / export                                                 */
/* ------------------------------------------------------------------ */

function exportCsv() {
  const names = state.devices.map((s) => s.trim());
  const lines = ["," + names.join(",")];
  state.matrix.forEach((row, i) => lines.push([names[i], ...row].join(",")));
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "traffic-matrix.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
  if (rows.length < 2) throw new Error("The CSV needs at least 2 rows.");

  const isNum = (s) => s !== "" && Number.isFinite(Number(s));
  const hasHeader = rows[0].some((cell) => !isNum(cell));

  let names;
  let data;
  if (hasHeader) {
    const n = rows.length - 1;
    names = rows[0].slice(rows[0].length - n);
    data = rows.slice(1).map((row) => row.slice(row.length - n).map(Number));
  } else {
    const n = rows.length;
    names = Array.from({ length: n }, (_, i) => `Device ${i + 1}`);
    data = rows.map((row) => row.map(Number));
  }

  const n = names.length;
  if (n > MAX_DEVICES) throw new Error(`At most ${MAX_DEVICES} devices are supported.`);
  if (data.length !== n || data.some((row) => row.length !== n)) {
    throw new Error("The CSV must contain a square (N x N) grid of numbers.");
  }
  if (data.some((row) => row.some((v) => !isValidValue(v)))) {
    throw new Error("The CSV contains values that are not numbers of at least 0.");
  }
  return { devices: names, matrix: data };
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { devices, matrix } = parseCsv(String(reader.result));
      hideError();
      setState(devices, matrix);
    } catch (err) {
      showError(err.message);
    }
  };
  reader.onerror = () => showError("Could not read that file.");
  reader.readAsText(file);
}

/* ------------------------------------------------------------------ */
/* Talking to the backend                                              */
/* ------------------------------------------------------------------ */

function showError(message) {
  const box = $("error");
  box.textContent = message;
  box.hidden = false;
}

function hideError() {
  $("error").hidden = true;
}

function setBusy(busy) {
  $("analyze").disabled = busy;
  $("status").textContent = busy ? "Analyzing..." : "";
}

function extractError(data) {
  if (!data || data.detail === undefined) return null;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg).join("; ");
  return null;
}

async function analyze() {
  hideError();
  const names = state.devices.map((s) => s.trim());

  if (names.some((s) => !s)) return showError("Every device needs a name.");
  if (new Set(names.map((s) => s.toLowerCase())).size !== names.length) {
    return showError("Device names must be unique.");
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      if (!isValidValue(state.matrix[i][j])) {
        return showError(`Traffic values must be numbers of at least 0 (check ${names[i]} to ${names[j]}).`);
      }
    }
  }
  if (!state.matrix.some((row) => row.some((v) => v > 0))) {
    return showError("All traffic values are zero. Enter some traffic first.");
  }

  setBusy(true);
  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devices: names, matrix: state.matrix }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(extractError(data) || `Server error (${res.status}).`);
    lastData = data;
    renderResults(data);
  } catch (err) {
    showError(
      err instanceof TypeError
        ? "Could not reach the server. Is the backend running?"
        : err.message
    );
  } finally {
    setBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    text: get("--text-muted"),
    grid: get("--border"),
    accent: get("--accent"),
    muted: get("--bar-muted"),
  };
}

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

function drawCharts(data) {
  const c = themeColors();
  const { devices, importance, reduced, history } = data;
  const topIdx = importance.indexOf(Math.max(...importance));
  const color = (i) => PALETTE[i % PALETTE.length];

  const axis = (title) => ({
    title: { display: !!title, text: title, color: c.text },
    ticks: { color: c.text },
    grid: { color: c.grid },
    border: { color: c.grid },
  });

  makeChart("chart-importance", {
    type: "bar",
    data: {
      labels: devices,
      datasets: [{
        label: "Importance (%)",
        data: importance.map((v) => +(v * 100).toFixed(2)),
        backgroundColor: devices.map((_, i) => (i === topIdx ? c.accent : c.muted)),
        borderRadius: 6,
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ...axis(), grid: { display: false } }, y: { ...axis("Share of importance (%)"), beginAtZero: true } },
    },
  });

  makeChart("chart-reduced", {
    type: "scatter",
    data: {
      datasets: devices.map((name, i) => ({
        label: name,
        data: [{ x: reduced[i][0], y: reduced[i][1] }],
        backgroundColor: color(i),
        pointRadius: 9,
        pointHoverRadius: 11,
      })),
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: c.text, usePointStyle: true } } },
      scales: { x: axis("Component 1"), y: axis("Component 2") },
    },
  });

  makeChart("chart-prediction", {
    type: "line",
    data: {
      labels: history.map((_, k) => `Step ${k}`),
      datasets: devices.map((name, i) => ({
        label: name,
        data: history.map((h) => +(h[i] * 100).toFixed(3)),
        borderColor: color(i),
        backgroundColor: color(i),
        tension: 0.3,
        pointRadius: 2,
      })),
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { color: c.text, usePointStyle: true } } },
      scales: { x: axis(), y: { ...axis("Share of total traffic (%)"), beginAtZero: true } },
    },
  });
}

function renderTable(data) {
  const { devices, importance, reduced, traffic_total: totals } = data;
  const topIdx = importance.indexOf(Math.max(...importance));
  const table = $("results-table");
  table.replaceChildren();

  const headRow = table.createTHead().insertRow();
  ["Device", "Importance", "Total traffic", "Component 1", "Component 2"].forEach((h) => {
    headRow.appendChild(el("th", h));
  });

  const body = table.createTBody();
  devices.forEach((name, i) => {
    const row = body.insertRow();
    if (i === topIdx) row.className = "top";
    [
      name,
      `${(importance[i] * 100).toFixed(2)}%`,
      totals[i].toLocaleString(undefined, { maximumFractionDigits: 1 }),
      reduced[i][0].toFixed(2),
      reduced[i][1].toFixed(2),
    ].forEach((text) => row.insertCell().textContent = text);
  });
}

function renderResults(data) {
  if (typeof Chart === "undefined") {
    showError("The charts library did not load. Check your internet connection and reload.");
    return;
  }
  const topIdx = data.importance.indexOf(Math.max(...data.importance));

  $("stat-top").textContent = data.top_device;
  $("stat-top-note").textContent = `${(data.importance[topIdx] * 100).toFixed(1)}% of the network's importance`;
  $("stat-kept").textContent = `${(data.kept_by_2d * 100).toFixed(1)}%`;
  $("stat-eig").textContent = data.eigenvalues[0].toLocaleString(undefined, { maximumFractionDigits: 1 });

  $("results").hidden = false;
  drawCharts(data);
  renderTable(data);
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------------------------------------------ */
/* Start-up                                                            */
/* ------------------------------------------------------------------ */

$("add-device").addEventListener("click", addDevice);
$("load-sample").addEventListener("click", () => { hideError(); setState(SAMPLE.devices, SAMPLE.matrix); });
$("randomize").addEventListener("click", () => { hideError(); randomize(); });
$("clear").addEventListener("click", () => { hideError(); clearMatrix(); });
$("export-csv").addEventListener("click", exportCsv);
$("import-csv").addEventListener("click", () => $("csv-file").click());
$("csv-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importCsv(file);
  e.target.value = "";
});
$("analyze").addEventListener("click", analyze);

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (lastData && typeof Chart !== "undefined") drawCharts(lastData);
});

setState(SAMPLE.devices, SAMPLE.matrix);
