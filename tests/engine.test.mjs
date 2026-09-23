// P0 완료기준(11-quantum-experiment-lab.md §10) 회귀 테스트. 의존성 없음: node --test tests/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODEL, rawWeights } from "../engine/amplitudes.js";
import { normalize, validateDistribution, distributionStats } from "../engine/distribution.js";
import { mulberry32, sampleChunk } from "../engine/sampler.js";
import { maeEmpirical } from "../engine/experiments.js";

const MODES = ["interference", "no-interference", "single"];

function dist(mode, kappa = 2, phase = 0) {
  const { xs, raw } = rawWeights({ mode, kappa, phase });
  const { probabilities, cumulative } = normalize(raw);
  return { xs, probabilities, cumulative };
}

describe("정규화 (합 1, 오차 1e-12 목표)", () => {
  for (const mode of MODES) {
    it(`${mode}: 확률≥0, 합 1, CDF 끝값 1`, () => {
      const { probabilities, cumulative } = dist(mode);
      for (const p of probabilities) assert.ok(p >= 0 && Number.isFinite(p));
      let s = 0;
      for (const p of probabilities) s += p;
      assert.ok(Math.abs(s - 1) <= 1e-12, `sum-1=${s - 1}`);
      assert.ok(Math.abs(cumulative[cumulative.length - 1] - 1) <= 1e-12);
      assert.equal(validateDistribution(probabilities, cumulative), true);
    });
  }
});

describe("위상 조건 (κ=2)", () => {
  it("φ=0 간섭 분포는 x=0 근처에서 중심 최대 (짝수 칸이라 중앙 2칸 공동 최대)", () => {
    const { probabilities } = dist("interference", 2, 0);
    let max = 0;
    for (const p of probabilities) max = Math.max(max, p);
    // 512칸은 중심 x=0을 255·256번 칸이 나눔. 두 칸이 함께 최대여야 한다.
    assert.equal(probabilities[255], max);
    assert.equal(probabilities[256], max);
  });
  it("φ=π 간섭 분포는 중심 최소", () => {
    const { xs, probabilities } = dist("interference", 2, Math.PI);
    const st = distributionStats(xs, probabilities);
    assert.ok(st.centerP < st.maxP / 100, `center=${st.centerP}, max=${st.maxP}`);
  });
  it("간섭 소실·한 슬릿은 φ와 무관", () => {
    for (const mode of ["no-interference", "single"]) {
      const a = dist(mode, 2, 0).probabilities;
      const b = dist(mode, 2, 1.5).probabilities;
      let max = 0;
      for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
      assert.equal(max, 0);
    }
  });
});

describe("seed 재현 (같은 seed 100회 = 1000회 앞 100회)", () => {
  it("난수 소비 규칙 고정", () => {
    const { cumulative } = dist("interference");
    const run = (seed, n) => {
      const rng = mulberry32(seed);
      const counts = new Uint32Array(MODEL.bins);
      const samples = new Float64Array(n);
      sampleChunk({ cumulative, xMin: MODEL.xMin, xMax: MODEL.xMax, rng, counts, samples, start: 0, end: n });
      return samples;
    };
    const s100 = run(42, 100);
    const s1000 = run(42, 1000);
    for (let i = 0; i < 100; i++) assert.equal(s100[i], s1000[i]);
  });
});

describe("빈도 통계는 다중 seed 기준 (작은 N을 이론과 맞추지 않음)", () => {
  it("평균 MAE가 N=100보다 N=10000에서 작음", () => {
    const { cumulative } = dist("interference");
    const seeds = [7, 42, 1234, 99991, 20260915];
    const meanMae = (n) => {
      let acc = 0;
      for (const seed of seeds) {
        const rng = mulberry32(seed);
        const counts = new Uint32Array(MODEL.bins);
        const samples = new Float64Array(n);
        sampleChunk({ cumulative, xMin: MODEL.xMin, xMax: MODEL.xMax, rng, counts, samples, start: 0, end: n });
        // 이론 분포 재계산 대신 누적분포에서 역산한 확률 사용
        const probs = new Float64Array(MODEL.bins);
        let prev = 0;
        for (let i = 0; i < MODEL.bins; i++) { probs[i] = cumulative[i] - prev; prev = cumulative[i]; }
        acc += maeEmpirical(counts, probs, n);
      }
      return acc / seeds.length;
    };
    const m100 = meanMae(100);
    const m10000 = meanMae(10000);
    assert.ok(m10000 < m100, `meanMAE(100)=${m100}, meanMAE(10000)=${m10000}`);
  });
});

describe("입력 가드", () => {
  it("κ 범위 밖·φ 범위 밖·정규화 불가 시 중단", () => {
    assert.throws(() => rawWeights({ mode: "interference", kappa: 99, phase: 0 }));
    assert.throws(() => rawWeights({ mode: "interference", kappa: 2, phase: 99 }));
    assert.throws(() => normalize(new Float64Array(MODEL.bins))); // 합 0
    const bad = new Float64Array(MODEL.bins).fill(1);
    bad[3] = NaN;
    assert.throws(() => normalize(bad));
  });
});

describe("P1 · 부분 간섭 γ (근거 docs/P1-NOTES.md §1)", () => {
  const probs = (gamma) => {
    const { raw } = rawWeights({ mode: "partial", kappa: 2, phase: 0, gamma });
    return normalize(raw).probabilities;
  };
  it("γ=0은 간섭 소실, γ=1은 간섭 유지와 정규화 후 일치", () => {
    const ni = dist("no-interference", 2, 0).probabilities;
    const itf = dist("interference", 2, 0).probabilities;
    const g0 = probs(0), g1 = probs(1);
    for (let i = 0; i < MODEL.bins; i++) {
      assert.equal(g0[i], ni[i]);
      assert.equal(g1[i], itf[i]);
    }
  });
  it("γ 범위 밖이면 중단", () => {
    assert.throws(() => rawWeights({ mode: "partial", kappa: 2, phase: 0, gamma: -0.1 }));
    assert.throws(() => rawWeights({ mode: "partial", kappa: 2, phase: 0, gamma: 1.1 }));
  });
});

describe("P1 · 원거리 근사 (근거 docs/P1-NOTES.md §2)", () => {
  it("확률 ≥0·합 1·대칭", async () => {
    const { fraunhoferWeights } = await import("../engine/fraunhofer.js");
    const { ys, raw } = fraunhoferWeights({});
    const { probabilities, cumulative } = normalize(raw);
    let s = 0;
    for (const p of probabilities) { assert.ok(p >= 0 && Number.isFinite(p)); s += p; }
    assert.ok(Math.abs(s - 1) <= 1e-12, `sum-1=${s - 1}`);
    assert.ok(validateDistribution(probabilities, cumulative));
    for (let i = 0; i < MODEL.bins; i++) {
      assert.ok(Math.abs(ys[i] + ys[MODEL.bins - 1 - i]) < 1e-9);
      assert.ok(Math.abs(probabilities[i] - probabilities[MODEL.bins - 1 - i]) < 1e-12);
    }
  });
  it("기본값 Fresnel 수 ≈ 0.015로 신뢰", async () => {
    const { fresnelNumber, fraunhoferWeights } = await import("../engine/fraunhofer.js");
    const f = fresnelNumber({ lambdaNm: 650, slitWidthMm: 0.1, distM: 1 });
    assert.ok(Math.abs(f - 0.0154) < 0.001, `fresnel=${f}`);
    assert.equal(fraunhoferWeights({}).reliable, true);
  });
  it("입력 가드 (a>d·범위 밖)", async () => {
    const { fraunhoferWeights } = await import("../engine/fraunhofer.js");
    assert.throws(() => fraunhoferWeights({ slitWidthMm: 0.6, slitSepMm: 0.5 }));
    assert.throws(() => fraunhoferWeights({ lambdaNm: 300 }));
    assert.throws(() => fraunhoferWeights({ distM: 99 }));
  });
});
