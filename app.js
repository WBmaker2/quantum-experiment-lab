import { MODEL, rawWeights } from "./engine/amplitudes.js";
import { normalize, validateDistribution, distributionStats } from "./engine/distribution.js";
import { mulberry32, sampleChunk } from "./engine/sampler.js";
import { SCHEMA, describeParams, maeEmpirical } from "./engine/experiments.js";
import { FRAUNHOFER, fraunhoferWeights } from "./engine/fraunhofer.js";

// ---------- 상태 ----------
const $ = (id) => document.getElementById(id);
const state = { current: null, runA: null, runB: null, cancelled: false, paused: false, prediction: null };
let runSeq = 0;

// ---------- 입력 동기화 ----------
const kappaNum = $("kappaNum"), kappaRange = $("kappaRange");
const phaseNum = $("phaseNum"), phaseRange = $("phaseRange");
kappaNum.addEventListener("input", () => { kappaRange.value = kappaNum.value; syncMissionCond(); });
kappaRange.addEventListener("input", () => { kappaNum.value = kappaRange.value; syncMissionCond(); });
phaseNum.addEventListener("input", () => { phaseRange.value = phaseNum.value; });
phaseRange.addEventListener("input", () => { phaseNum.value = phaseRange.value; });
$("modeSel").addEventListener("change", () => { syncGammaField(); syncMissionCond(); });
const gammaNum = $("gammaNum"), gammaRange = $("gammaRange");
gammaNum.addEventListener("input", () => { gammaRange.value = gammaNum.value; });
gammaRange.addEventListener("input", () => { gammaNum.value = gammaRange.value; });
function syncGammaField() { $("gammaField").hidden = $("modeSel").value !== "partial"; }
syncGammaField();

function syncMissionCond() {
  const mv = $("modeSel").value;
  const m = mv === "interference" ? "간섭 유지" : mv === "no-interference" ? "간섭 소실" : mv === "partial" ? `부분 간섭(γ=${gammaNum.value})` : "한 슬릿";
  $("missionCond").textContent = `${m} · κ=${Number(kappaNum.value || 0).toFixed(1)} · φ=${Number(phaseNum.value || 0).toFixed(2)}`;
}
syncMissionCond();

// ---------- 예측 ----------
$("predictForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  state.prediction = { choice: fd.get("prediction"), reason: $("predictReason").value.trim() };
  $("predictSaved").textContent = `예측 저장됨: ${choiceKo(state.prediction.choice)} — 다음 단계에서 실행해 비교하세요.`;
});
function choiceKo(c) {
  return { "center-max": "가운데가 높은 간섭무늬", "center-min": "가운데가 낮은 간섭무늬", "two-bumps": "두 봉우리의 합", unsure: "잘 모르겠다" }[c] || c;
}

// 실행 상태 뱃지: ready → sampling → paused/completed (설계 §4 상태 분리 표시)
function setState(state, label) {
  const el = $("runState");
  el.dataset.state = state;
  el.textContent = label;
}

// ---------- 검증 ----------
// 교과 검토 F4: 고등학생 가독용 — 0.0001 이상은 소수 4자리, 미만만 지수 표기
function fmtProb(p) { return p >= 1e-4 ? p.toFixed(4) : p.toExponential(1); }

function readParams(nOverride) {
  const mode = $("modeSel").value;
  const kappa = Number(kappaNum.value);
  let phase = Number(phaseNum.value);
  const gamma = Number(gammaNum.value);
  const seed = Number($("seedNum").value);
  const n = nOverride ?? Number($("nSel").value);
  const err = $("formError");
  err.textContent = "";
  if (!Number.isFinite(kappa) || kappa < MODEL.kappaMin || kappa > MODEL.kappaMax) { err.textContent = "⚠ κ는 0.5 이상 4 이하의 숫자여야 합니다."; kappaNum.focus(); return null; }
  // π 근사 입력(예: 3.1416)은 ±0.001 허용 후 ±π로 보정하고, 그 밖은 오류로 안내한다.
  if (!Number.isFinite(phase) || phase < -Math.PI - 0.001 || phase > Math.PI + 0.001) { err.textContent = "⚠ φ는 −π(−3.1416) 이상 π(3.1416) 이하의 숫자여야 합니다."; phaseNum.focus(); return null; }
  phase = Math.max(-Math.PI, Math.min(Math.PI, phase));
  if (mode === "partial" && (!Number.isFinite(gamma) || gamma < 0 || gamma > 1)) { err.textContent = "⚠ γ는 0 이상 1 이하의 숫자여야 합니다."; gammaNum.focus(); return null; }
  if (!Number.isInteger(seed) || seed < 1 || seed > 99999999) { err.textContent = "⚠ seed는 1–99999999의 정수여야 합니다."; $("seedNum").focus(); return null; }
  if (![1, 100, 1000, 10000].includes(n)) { err.textContent = "⚠ N은 1, 100, 1000, 10000 중 하나여야 합니다."; return null; }
  return { mode, kappa, phase, seed, n, gamma: mode === "partial" ? gamma : undefined };
}

// ---------- 실행 ----------
$("controlForm").addEventListener("submit", (e) => { e.preventDefault(); void runAccumulation(); });
async function runAccumulation() {
  const p = readParams();
  if (!p) return;
  await executeRun(p);
}
$("singleBtn").addEventListener("click", () => { const p = readParams(1); if (p) void executeRun(p); });
$("cancelBtn").addEventListener("click", () => { state.cancelled = true; });
$("resetBtn").addEventListener("click", () => {
  state.cancelled = true; state.current = null;
  $("folioStrip").textContent = "대기 중 — 조건을 정하고 누적 실행을 누르세요";
  $("runStatus").textContent = "초기화되었습니다.";
  setState("ready", "○ 대기 중 (ready)");
  clearCanvas($("detectorCanvas")); clearCanvas($("probCanvas"));
  $("svgWrap").innerHTML = "";
  $("freqTable").querySelector("tbody").innerHTML = '<tr><td colspan="5">아직 실행이 없습니다.</td></tr>';
});

document.addEventListener("visibilitychange", () => {
  state.paused = document.hidden;
  if (document.hidden) {
    setState("paused", "⏸ 일시정지 (paused) — 탭이 숨겨져 계산을 멈췄습니다. 돌아오면 재개됩니다.");
  } else if (!$("cancelBtn").disabled) {
    setState("sampling", "◉ 계산 중 (sampling)");
  }
});

async function executeRun({ mode, kappa, phase, seed, n, gamma }) {
  state.cancelled = false;
  $("cancelBtn").disabled = false;
  $("runBtn").disabled = true; $("singleBtn").disabled = true;
  $("formError").textContent = "";
  const status = $("runStatus");
  setState("sampling", "◉ 계산 중 (sampling)");
  try {
    const { xs, raw } = rawWeights({ mode, kappa, phase, gamma: gamma ?? 1 });
    const { probabilities, cumulative } = normalize(raw);
    if (!validateDistribution(probabilities, cumulative)) throw new Error("분포 검증에 실패했습니다.");
    const stats = distributionStats(xs, probabilities);
    status.textContent = `계산 중… ${describeParams({ mode, kappa, phase, gamma })} · seed=${seed} · N=${n}`;
    $("folioStrip").textContent = `${describeParams({ mode, kappa, phase, gamma })} · seed=${seed} · N=${n} · 계산 중`;
    showProgress(0, n);
    const tStart = performance.now();
    const rng = mulberry32(seed);
    const counts = new Uint32Array(MODEL.bins);
    const samples = new Float64Array(n);
    const CHUNK = 1000;
    for (let s = 0; s < n; s += CHUNK) {
      if (state.cancelled) break; // 부분 결과는 버린다. 표시는 루프 뒤에서 한 번만.
      while (state.paused || document.hidden) await new Promise((r) => setTimeout(r, 120));
      const end = Math.min(s + CHUNK, n);
      sampleChunk({ cumulative, xMin: MODEL.xMin, xMax: MODEL.xMax, rng, counts, samples, start: s, end });
      showProgress(end, n);
      await new Promise((r) => setTimeout(r, 0)); // 입력 반응 100ms 내 유지를 위한 양보
    }
    // 마지막 청크 뒤에 취소된 경우도 같은 표시 (한 청크 실행의 취소 누락 방지)
    if (state.cancelled) {
      status.textContent = "취소되었습니다. 부분 결과는 버리고 새 실행으로 다시 시작하세요.";
      $("folioStrip").textContent = "취소됨 — 새 실행을 시작하세요";
      setState("cancelled", "✕ 취소됨 (cancelled)");
      return;
    }
    const mae = maeEmpirical(counts, probabilities, n);
    const run = {
      id: `run-${Date.now()}-${++runSeq}`,
      ...SCHEMA, modelVersion: MODEL.modelVersion, engineVersion: MODEL.engineVersion, scenarioVersion: MODEL.scenarioVersion,
      createdAt: new Date().toISOString(),
      parameters: { sigma: MODEL.sigma, kappa, phase, mode, gamma: mode === "partial" ? gamma : undefined, detectorRange: [MODEL.xMin, MODEL.xMax], bins: MODEL.bins },
      seed, N: n, counts: Array.from(counts), samples: Array.from(samples),
      theory: { maxX: stats.maxX, maxP: stats.maxP, centerP: stats.centerP },
      mae,
    };
    // 이론 전체는 재계산 가능하므로 레코드에는 요약만 저장, 렌더용 전체는 메모리에 유지
    state.current = { ...run, xs: Array.from(xs), probabilities: Array.from(probabilities) };
    renderRun(state.current);
    setState("completed", "● 완료 (completed) — 조건 비교나 기록으로 이동하세요");
    const calcMs = Math.round(performance.now() - tStart);
    status.textContent = `완료 — ${describeParams({ mode, kappa, phase, gamma })} · seed=${seed} · N=${n} · 중심 이론 P=${fmtProb(stats.centerP)} · 평균오차(MAE)=${fmtProb(mae)} · 계산 ${calcMs}ms`;
  } catch (e) {
    $("formError").textContent = e instanceof Error ? e.message : "실행 중 오류가 발생했습니다.";
  } finally {
    hideProgress();
    $("cancelBtn").disabled = true;
    $("runBtn").disabled = false; $("singleBtn").disabled = false;
    // gi-pulse는 다음 행동 하나에만: 비교 저장을 유도
    $("runBtn").classList.remove("gi-pulse");
    $("saveAbtn").classList.add("gi-pulse");
    setTimeout(() => { $("saveAbtn").classList.remove("gi-pulse"); $("runBtn").classList.add("gi-pulse"); }, 6000);
  }
}

function showProgress(done, total) {
  $("progressWrap").hidden = false;
  const pct = Math.round((done / total) * 100);
  $("progressBar").value = pct; $("progressBar").textContent = `${pct}%`;
  $("progressText").textContent = `${done.toLocaleString()}/${total.toLocaleString()} (${pct}%)`;
}
function hideProgress() { $("progressWrap").hidden = true; }

// ---------- 렌더 (DetectorView + ProbabilityPlot) ----------
function clearCanvas(c) { const ctx = c.getContext("2d"); if (ctx) { ctx.clearRect(0, 0, c.width, c.height); } }
function xToPx(x, w) { return ((x - MODEL.xMin) / (MODEL.xMax - MODEL.xMin)) * w; }

function renderRun(run) {
  $("folioStrip").textContent = `${describeParams(run.parameters)} · seed=${run.seed} · N=${run.N} · ${new Date(run.createdAt).toLocaleString("ko-KR")} · ${run.id}`;
  renderDetector(run);
  renderProb(run);
  renderSvgFallback(run);
  renderTable(run);
}

function renderDetector(run) {
  const c = $("detectorCanvas");
  const ctx = c.getContext("2d");
  if (!ctx) { $("runStatus").textContent += " Canvas 2D를 사용할 수 없어 SVG·표 대체를 사용합니다."; return; }
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#111318"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, H - 24); ctx.lineTo(W - 8, H - 24); ctx.stroke(); // 검출면
  ctx.fillStyle = "#5B6472"; ctx.font = "11px sans-serif";
  for (let x = -10; x <= 10; x += 5) ctx.fillText(String(x), xToPx(x, W) - 6, H - 8);
  // 검출 사건 점 — y 지터는 가시성용, 궤적선 없음
  ctx.fillStyle = "#111318";
  const n = run.samples.length;
  const alpha = n > 2000 ? 0.35 : 0.8;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const px = xToPx(run.samples[i], W);
    const py = 14 + ((i * 2654435761) % 90); // 결정적 지터
    ctx.fillRect(px, py, n > 2000 ? 2 : 3, n > 2000 ? 2 : 3);
  }
  ctx.globalAlpha = 1;
}

function renderProb(run) {
  const c = $("probCanvas");
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const W = c.width, H = c.height, pad = 28;
  ctx.clearRect(0, 0, W, H);
  const maxP = Math.max(...run.probabilities);
  const yOf = (p) => H - pad - (p / maxP) * (H - pad * 2);
  // 히스토그램 (관측 빈도, 이론과 같은 단위)
  const bw = (W - pad * 2) / MODEL.bins;
  ctx.fillStyle = "#C9D2F5"; ctx.strokeStyle = "#002FA7"; ctx.lineWidth = 1;
  for (let i = 0; i < MODEL.bins; i++) {
    const f = run.counts[i] / run.N;
    if (f <= 0) continue;
    const h = (f / maxP) * (H - pad * 2);
    ctx.fillRect(pad + i * bw, H - pad - h, Math.max(1, bw), h);
  }
  // 이론 곡선
  ctx.strokeStyle = "#002FA7"; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < MODEL.bins; i++) {
    const px = pad + (i + 0.5) * bw, py = yOf(run.probabilities[i]);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = "#5B6472"; ctx.font = "11px sans-serif";
  ctx.fillText("P (검출된 사건의 위치 분포에 조건부)", 8, 14);
  ctx.fillText("x", W - 18, H - 8);
}

function renderSvgFallback(run) {
  // SVG는 이론 128점 + 히스토그램 64막대로 축소 (DOM 크기 제한)
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 640 200"); svg.setAttribute("width", "100%"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "이론 분포와 관측 빈도의 SVG 대체 그래프");
  const maxP = Math.max(...run.probabilities);
  let pts = "";
  for (let i = 0; i < 128; i++) {
    const idx = Math.floor((i / 128) * MODEL.bins);
    const px = 28 + (i / 128) * 584, py = 172 - (run.probabilities[idx] / maxP) * 144;
    pts += `${px.toFixed(1)},${py.toFixed(1)} `;
  }
  const pl = document.createElementNS(NS, "polyline");
  pl.setAttribute("points", pts); pl.setAttribute("fill", "none");
  pl.setAttribute("stroke", "#002FA7"); pl.setAttribute("stroke-width", "2");
  svg.appendChild(pl);
  $("svgWrap").innerHTML = "";
  $("svgWrap").appendChild(svg);
}

function renderTable(run) {
  const tb = $("freqTable").querySelector("tbody");
  const idx = run.probabilities.map((p, i) => i).sort((a, b) => run.probabilities[b] - run.probabilities[a]).slice(0, 24).sort((a, b) => a - b);
  const w = (MODEL.xMax - MODEL.xMin) / MODEL.bins;
  tb.innerHTML = idx.map((i) => {
    const cx = MODEL.xMin + (i + 0.5) * w;
    const f = run.counts[i] / run.N;
    return `<tr><td>${i}</td><td>${cx.toFixed(3)}</td><td>${fmtProb(run.probabilities[i])}</td><td>${run.counts[i]}</td><td>${fmtProb(f)}</td></tr>`;
  }).join("");
}

// ---------- 비교 ----------
$("saveAbtn").addEventListener("click", () => { if (!state.current) return $("compareWarn").textContent = "먼저 누적 실행을 완료하세요."; state.runA = state.current; paintCompare(); });
$("saveBbtn").addEventListener("click", () => { if (!state.current) return $("compareWarn").textContent = "먼저 누적 실행을 완료하세요."; state.runB = state.current; paintCompare(); });
$("compareClear").addEventListener("click", () => { state.runA = state.runB = null; paintCompare(); });

function runLine(r) {
  if (!r) return "비어 있음";
  return `${describeParams(r.parameters)} · seed=${r.seed} · N=${r.N} · 평균오차=${fmtProb(r.mae)}`;
}
function paintCompare() {
  $("runADesc").textContent = runLine(state.runA);
  $("runBDesc").textContent = runLine(state.runB);
  const tb = $("compareTable").querySelector("tbody");
  if (!state.runA || !state.runB) { tb.innerHTML = '<tr><td colspan="3">A와 B를 저장하면 비교표가 채워집니다.</td></tr>'; return; }
  const A = state.runA, B = state.runB;
  const rows = [
    ["모드", modeKo(A.parameters.mode), modeKo(B.parameters.mode)],
    ["κ", A.parameters.kappa, B.parameters.kappa],
    ["φ", Number(A.parameters.phase).toFixed(3), Number(B.parameters.phase).toFixed(3)],
    ["γ", A.parameters.gamma ?? "–", B.parameters.gamma ?? "–"],
    ["seed", A.seed, B.seed],
    ["N", A.N, B.N],
    ["중심 이론 P", fmtProb(A.theory.centerP), fmtProb(B.theory.centerP)],
    ["평균오차 MAE(관측–이론)", fmtProb(A.mae), fmtProb(B.mae)],
    ["생성 시각", new Date(A.createdAt).toLocaleString("ko-KR"), new Date(B.createdAt).toLocaleString("ko-KR")],
  ];
  tb.innerHTML = rows.map(([k, a, b]) => `<tr><th scope="row">${k}</th><td>${a}</td><td>${b}</td></tr>`).join("");
  $("compareWarn").textContent = A.N !== B.N
    ? `⚠ N이 다릅니다(A=${A.N}, B=${B.N}). 같은 시행 수로 다시 실행해 비교하세요.`
    : "같은 N 조건입니다. φ를 바꿨을 때 간섭 소실 모드는 분포가 그대로인지 확인하세요.";
}
function modeKo(m) { return m === "interference" ? "간섭 유지" : m === "no-interference" ? "간섭 소실" : m === "partial" ? "부분 간섭" : "한 슬릿"; }

// ---------- 기록 ----------
const LS_KEY = "quantum-experiment-lab:v1";
function loadRecords() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function paintRecords() {
  const recs = loadRecords();
  const tb = $("recordTable").querySelector("tbody");
  if (!recs.length) { tb.innerHTML = '<tr><td colspan="4">저장된 기록이 없습니다.</td></tr>'; return; }
  tb.innerHTML = recs.map((r) => `<tr><td>${new Date(r.createdAt).toLocaleString("ko-KR")}</td><td>${describeParams(r.parameters)}${r.prediction ? ` · 예상:${choiceKo(r.prediction.choice)}` : ""}</td><td>${r.seed}·${r.N}</td><td>${escapeHtml(r.observations || "")} / 한계: ${escapeHtml(r.explanation || "")}</td></tr>`).join("");
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
$("recordForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const cur = state.current;
  if (!cur) { $("recordStatus").textContent = "먼저 누적 실행을 완료하세요."; return; }
  const rec = {
    schemaVersion: SCHEMA.schemaVersion, appId: SCHEMA.appId, createdAt: new Date().toISOString(),
    scenarioId: "double-slit-p0", parameters: cur.parameters, seed: cur.seed, N: cur.N,
    observations: $("obsInput").value.trim(), prediction: state.prediction, explanation: $("limitInput").value.trim(),
    counts: cur.counts,
  };
  try {
    const recs = loadRecords(); recs.unshift(rec);
    localStorage.setItem(LS_KEY, JSON.stringify(recs));
    $("recordStatus").textContent = "기록이 저장되었습니다 (개인 식별 정보 없음).";
  } catch { $("recordStatus").textContent = "저장 공간을 사용할 수 없어 현재 세션에만 표시합니다. JSON 내보내기를 사용하세요."; }
  paintRecords();
});
$("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify(loadRecords(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "quantum-experiment-lab-records.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("clearRecords").addEventListener("click", () => { localStorage.removeItem(LS_KEY); paintRecords(); $("recordStatus").textContent = "기록을 지웠습니다."; });
paintRecords();

// ---------- 업데이트 내역 + 시작 ----------
const dlg = $("updateDialog");
for (const id of ["updateLogBtnHeader", "updateLogBtnFooter"]) $(id).addEventListener("click", () => dlg.showModal());
$("startBtn").addEventListener("click", () => { document.getElementById("mission").scrollIntoView({ behavior: "smooth" }); });

// ---------- P1 · 원거리 근사 오버레이 (근거: docs/P1-NOTES.md §2) ----------
$("fraunForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const err = $("fraunError");
  err.textContent = "";
  try {
    const p = {
      lambdaNm: Number($("lambdaNum").value),
      slitSepMm: Number($("sepNum").value),
      slitWidthMm: Number($("widthNum").value),
      distM: Number($("distNum").value),
    };
    const { ys, raw, fresnel, reliable } = fraunhoferWeights(p);
    const { probabilities } = normalize(raw);
    renderFraun(ys, probabilities);
    $("fraunStatus").textContent =
      `근사 표시 — λ=${p.lambdaNm}nm · d=${p.slitSepMm}mm · a=${p.slitWidthMm}mm · L=${p.distM}m · Fresnel 수 ${fresnel.toFixed(4)}` +
      (reliable ? "" : " · ⚠ 근사 신뢰 낮음 (Fresnel 수 ≥ 0.1)");
  } catch (e2) {
    err.textContent = e2 instanceof Error ? `⚠ ${e2.message}` : "⚠ 근사 계산 중 오류가 발생했습니다.";
  }
});

function renderFraun(ys, probabilities) {
  const c = $("fraunCanvas");
  const ctx = c.getContext("2d");
  if (!ctx) { $("fraunError").textContent = "⚠ Canvas 2D를 사용할 수 없습니다."; return; }
  const W = c.width, H = c.height, pad = 30;
  ctx.clearRect(0, 0, W, H);
  const maxP = Math.max(...probabilities);
  const bw = (W - pad * 2) / probabilities.length;
  ctx.strokeStyle = "#002FA7"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
  for (let i = 0; i < probabilities.length; i++) {
    const px = pad + (i + 0.5) * bw;
    const py = H - pad - (probabilities[i] / maxP) * (H - pad * 2);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#5B6472"; ctx.font = "11px sans-serif";
  ctx.fillText("I (정규화, 검출면 y에 조건부)", 8, 14);
  ctx.fillText("-5", pad - 4, H - 8);
  ctx.fillText("y (mm)", W - 52, H - 8);
  ctx.fillText("+5", W - pad - 4, H - 8);
}
