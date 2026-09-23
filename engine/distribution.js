// distribution.ts port — 정규화·CDF. 순수 함수.
import { MODEL } from "./amplitudes.js";

export function normalize(raw) {
  let sum = 0;
  for (let i = 0; i < raw.length; i++) {
    if (!Number.isFinite(raw[i]) || raw[i] < 0) throw new Error("raw 가중치가 올바르지 않습니다.");
    sum += raw[i];
  }
  if (!(sum > 0) || !Number.isFinite(sum)) throw new Error("정규화 합이 0 또는 비유한 값이라 샘플링을 중단합니다.");
  const p = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) p[i] = raw[i] / sum;
  // 검증: 합 1 (오차 1e-12 목표)
  let check = 0;
  for (let i = 0; i < p.length; i++) check += p[i];
  if (Math.abs(check - 1) > 1e-12) throw new Error("정규화 검증 실패");
  const cdf = new Float64Array(raw.length);
  let acc = 0;
  for (let i = 0; i < p.length; i++) { acc += p[i]; cdf[i] = acc; }
  cdf[cdf.length - 1] = 1; // 마지막 값 1 고정
  return { probabilities: p, cumulative: cdf, sum };
}

export function validateDistribution(probabilities, cumulative) {
  for (const v of probabilities) if (!(v >= 0) || !Number.isFinite(v)) return false;
  let s = 0;
  for (const v of probabilities) s += v;
  if (Math.abs(s - 1) > 1e-12) return false;
  if (Math.abs(cumulative[cumulative.length - 1] - 1) > 1e-12) return false;
  return true;
}

export function distributionStats(xs, probabilities) {
  let maxI = 0;
  for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[maxI]) maxI = i;
  const centerI = Math.floor(probabilities.length / 2);
  return { maxIndex: maxI, maxX: xs[maxI], maxP: probabilities[maxI], centerP: probabilities[centerI], centerIndex: centerI };
}
void MODEL;
