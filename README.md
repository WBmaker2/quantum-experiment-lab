# 양자 실험 설계실 (quantum-experiment-lab)

‘한 번에는 점 하나인데, 반복하면 왜 간섭무늬가 나타날까?’ — 개별 검출 사건과 누적 확률분포를 구분하는 고등학교 심화 물리·수학 25분 활동 웹앱. P0 범위.

- 설계: [11-quantum-experiment-lab.md](./11-quantum-experiment-lab.md) · 공통 원칙: [00-shared-design-principles.md](./00-shared-design-principles.md)
- 검증 기록: [docs/VERIFICATION.md](./docs/VERIFICATION.md) · 배포 절차: [docs/DEPLOY.md](./docs/DEPLOY.md) · 변경 내역: [docs/UPDATELOG.md](./docs/UPDATELOG.md)

## 실행

의존성이 없다. Node 18 이상만 있으면 된다.

```sh
npm run serve   # http://localhost:8137/index.html
npm test        # 엔진 회귀 테스트 9건
npm run check   # 전 파일 문법 검사
```

배포는 정적 파일 그대로 올리면 된다 (빌드 없음). 상대 경로만 써서 저장소 하위 경로에서도 동작한다.

## 구조

```text
index.html / styles.css / app.js   화면·조작 (Swiss 밝은 UI, 320–1280px)
engine/amplitudes.js               두 경로 진폭 모형 (순수 함수)
engine/distribution.js             정규화·CDF·검증 (순수 함수)
engine/sampler.js                  seed 재현 샘플러 (순수 함수)
engine/experiments.js              실행 레코드·비교 지표
tests/engine.test.mjs              P0 완료기준 회귀 테스트
docs/                              UPDATELOG·VERIFICATION·DEPLOY·qa 캡처
```

`engine/`은 DOM·Canvas에 손대지 않는다. 파일은 500줄을 넘기 전에 나눈다.

## P0 범위 (완료 기준 충족)

- 모드: 한 슬릿 / 간섭 유지 / 간섭 소실, κ∈[0.5,4], φ∈[−π,π], N∈{1,100,1000,10000}, seed 재현
- 예측 → 장치·누적 → 조건 비교(A·B, 같은 N) → 기록 저장·JSON 내보내기
- 상태 뱃지 ready → sampling → paused/completed, 조건 변경 시 실행 분리, 조건·seed·N 항상 표시
- Canvas 실패 시 SVG·표 대체, 키보드 조작, reduced-motion 정적 테두리, 업데이트 내역 다이얼로그

자세한 판정 결과는 [docs/VERIFICATION.md](./docs/VERIFICATION.md). P1(부분 간섭 γ, 실제 슬릿 근사)은 범위 밖이다.

## 기록 포맷

`schemaVersion, appId, createdAt, scenarioId, parameters, seed, observations, prediction, explanation`.
localStorage에는 개인 식별 정보 없이 실험 기록만 둔다. 저장 불가 시 세션 표시 + JSON 내보내기.
