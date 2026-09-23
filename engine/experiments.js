// experiments.ts port — 실행 레코드 생성. 순수 데이터 조립.
export const SCHEMA = {
  schemaVersion: 1,
  appId: "quantum-experiment-lab",
  intraBinMethod: "uniform-in-bin",
};

export function describeParams(p) {
  const modeKo = p.mode === "interference" ? "간섭 유지" : p.mode === "no-interference" ? "간섭 소실" : p.mode === "partial" ? `부분 간섭(γ=${p.gamma ?? "–"})` : "한 슬릿";
  return `${modeKo} · κ=${Number(p.kappa).toFixed(1)} · φ=${Number(p.phase).toFixed(2)}`;
}

export function maeEmpirical(counts, probabilities, n) {
  if (n <= 0) return NaN;
  let acc = 0;
  for (let i = 0; i < counts.length; i++) acc += Math.abs(counts[i] / n - probabilities[i]);
  return acc / counts.length;
}
