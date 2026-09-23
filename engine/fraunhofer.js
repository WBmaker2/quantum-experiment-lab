// fraunhofer.js (P1) — 원거리 이중슬릿 근사. 순수 함수, DOM 의존 없음.
// 근거: docs/P1-NOTES.md §2. I(θ) = cos²(π d sinθ/λ) · sinc²(π a sinθ/λ), θ ≈ y/L.
// x축은 실제 검출면 y(m)이며 모형 x와 물리적 스케일이 다르다 — 겹쳐 그리지 않는다.
export const FRAUNHOFER = {
  lambdaMinNm: 380,
  lambdaMaxNm: 780,
  sepMinMm: 0.05,
  sepMaxMm: 2,
  widthMinMm: 0.01,
  distMinM: 0.2,
  distMaxM: 5,
  halfRangeMm: 5,
  bins: 512,
  fresnelWarn: 0.1,
};

export function sinc(u) {
  if (u === 0) return 1;
  return Math.sin(u) / u;
}

export function fresnelNumber({ lambdaNm, slitWidthMm, distM }) {
  const a = slitWidthMm / 1000;
  const lambda = lambdaNm / 1e9;
  return (a * a) / (lambda * distM);
}

export function fraunhoferWeights({ lambdaNm = 650, slitSepMm = 0.5, slitWidthMm = 0.1, distM = 1.0, bins = FRAUNHOFER.bins } = {}) {
  for (const [k, v] of Object.entries({ lambdaNm, slitSepMm, slitWidthMm, distM })) {
    if (!Number.isFinite(v)) throw new Error(`${k}는 유한한 수여야 합니다.`);
  }
  if (lambdaNm < FRAUNHOFER.lambdaMinNm || lambdaNm > FRAUNHOFER.lambdaMaxNm) throw new Error("파장은 380–780 nm(가시광)여야 합니다.");
  if (slitSepMm < FRAUNHOFER.sepMinMm || slitSepMm > FRAUNHOFER.sepMaxMm) throw new Error("슬릿 간격은 0.05–2 mm여야 합니다.");
  if (slitWidthMm < FRAUNHOFER.widthMinMm || slitWidthMm > slitSepMm) throw new Error("슬릿 폭은 0.01 mm 이상, 간격 이하(겹치지 않음)여야 합니다.");
  if (distM < FRAUNHOFER.distMinM || distM > FRAUNHOFER.distMaxM) throw new Error("거리는 0.2–5 m여야 합니다.");
  const lambda = lambdaNm / 1e9;
  const d = slitSepMm / 1000;
  const a = slitWidthMm / 1000;
  const Y = FRAUNHOFER.halfRangeMm / 1000;
  const ys = new Float64Array(bins);
  const raw = new Float64Array(bins);
  for (let i = 0; i < bins; i++) {
    const y = -Y + ((i + 0.5) / bins) * 2 * Y;
    const s = y / distM; // sinθ ≈ y/L
    const fringe = Math.cos((Math.PI * d * s) / lambda);
    const env = sinc((Math.PI * a * s) / lambda);
    ys[i] = y * 1000; // mm 단위로 기록
    raw[i] = fringe * fringe * env * env;
    if (!Number.isFinite(raw[i]) || raw[i] < 0) throw new Error("근사 강도가 올바르지 않습니다.");
  }
  const fresnel = fresnelNumber({ lambdaNm, slitWidthMm, distM });
  return { ys, raw, fresnel, reliable: fresnel < FRAUNHOFER.fresnelWarn };
}
