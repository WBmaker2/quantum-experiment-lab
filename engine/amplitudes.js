// amplitudes.ts (JS port) — 순수 함수, DOM 의존 없음.
// WCAG 무관. 물리: 교육용 두 경로 진폭 모형. 슈뢰딩거 수치해석이 아님.
export const MODEL = {
  xMin: -10,
  xMax: 10,
  bins: 512,
  sigma: 3,
  kappaMin: 0.5,
  kappaMax: 4,
  modelVersion: "p0-1",
  engineVersion: "p0-1",
  scenarioVersion: "p0-1",
};

export function binCenters(bins = MODEL.bins, xMin = MODEL.xMin, xMax = MODEL.xMax) {
  const w = (xMax - xMin) / bins;
  const xs = new Float64Array(bins);
  for (let i = 0; i < bins; i++) xs[i] = xMin + (i + 0.5) * w;
  return xs;
}

function gauss(x, sigma) {
  return Math.exp(-(x * x) / (4 * sigma * sigma));
}

//psi1 = g*exp(i*kx/2), psi2 = g*exp(-i*kx/2 + i*phi)
export function rawWeights({ mode, kappa, phase, sigma = MODEL.sigma, bins = MODEL.bins }) {
  if (!Number.isFinite(kappa) || !Number.isFinite(phase) || !Number.isFinite(sigma)) {
    throw new Error("kappa/phase/sigma는 유한한 수여야 합니다.");
  }
  if (kappa < MODEL.kappaMin || kappa > MODEL.kappaMax) throw new Error("κ 범위를 벗어났습니다 (0.5–4).");
  if (phase < -Math.PI || phase > Math.PI) throw new Error("φ 범위를 벗어났습니다 (−π–π).");
  if (!["interference", "no-interference", "single"].includes(mode)) throw new Error("알 수 없는 모드입니다.");
  const xs = binCenters(bins);
  const raw = new Float64Array(bins);
  for (let i = 0; i < bins; i++) {
    const x = xs[i];
    const g = gauss(x, sigma);
    const g2 = g * g;
    if (mode === "single") {
      raw[i] = g2; // |psi1|^2
    } else if (mode === "no-interference") {
      raw[i] = 2 * g2; // |psi1|^2 + |psi2|^2
    } else {
      // |psi1+psi2|^2 = 2g^2 (1 + cos(kx - phi))
      raw[i] = 2 * g2 * (1 + Math.cos(kappa * x - phase));
    }
    if (!Number.isFinite(raw[i]) || raw[i] < 0) throw new Error("raw 가중치가 유한한 0 이상이 아닙니다.");
  }
  return { xs, raw };
}
