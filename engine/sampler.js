// sampler.ts port — seed 재현 샘플러. 순수 함수 + RNG 스트림 고정.
// 같은 seed의 100회 결과는 1000회 실행 앞 100회와 일치: 샘플당 난수 2개(칸 선택+칸 내 위치)를 순서대로 소비.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickBin(cumulative, u) {
  let lo = 0, hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] > u) hi = mid; else lo = mid + 1;
  }
  return lo;
}

// 청크 단위 샘플링: 취소·진행률·탭 숨김 일시정지를 위해 호출자가 반복 호출.
export function sampleChunk({ cumulative, xMin, xMax, rng, counts, samples, start, end }) {
  const bins = cumulative.length;
  const w = (xMax - xMin) / bins;
  for (let s = start; s < end; s++) {
    const u = rng();
    const v = rng();
    const b = pickBin(cumulative, u);
    counts[b] += 1;
    samples[s] = (xMin + b * w) + v * w;
  }
}
