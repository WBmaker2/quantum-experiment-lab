# 생성 이미지 자산 (P0 6장)

- 흐름: 자산 목록(본 문서) → 소량 시험 → 일관성 검수 → 일괄 제작 → 압축 → 삽입 → 화면 검수. 공통 §5.
- 생성 경로: ego-browser로 Google Flow에서 생성. 모델·라이선스는 생성 시점 기록을 따른다.
- 절대 금기 (검수 탈락): 입자의 확정 궤적, 관찰자 눈이 무늬를 바꾸는 연출, 그래프·수치·수식·기호·간섭무늬를 이미지 안에 그리기. 그런 요소는 코드·검수 데이터로만 만든다.

## 공통 스타일

밝은 가상 양자 실험실 도입 삽화, 파스텔 톤, 단순한 광원과 검출 장치의 정물 느낌, 인물 없음, 문자·숫자 없음, 16:9.

## 자산 목록

| id | purpose | promptVersion | dimensions | semanticLabels | alt |
|---|---|---|---|---|---|
| lab-intro-1 | 도입: 빈 실험대와 광원·검출 장치 배치 소개 | p1 (아래) | 1280×720 | lab, bench, source | 밝은 실험대 위에 단순한 광원 상자와 검출 판이 놓인 도입 삽화 |
| lab-intro-2 | 도입: 슬릿 판 근경 (장치 구조 맥락) | p1 | 1280×720 | lab, slit-plate | 빛을 가리는 판에 세로 틈 두 개가 난 근경 삽화, 궤적 없음 |
| lab-intro-3 | 도입: 검출 판에 점 하나 (개별 사건DU) | p1 | 1280×720 | lab, detector-dot | 검출 판 위에 점 하나가 찍힌 삽화, 무늬·궤적 없음 |
| card-1 | 연구 카드: 한 슬릿 조건 | p1 | 800×600 | card, single-slit | 한 개의 틈이 난 슬릿 판 카드 삽화 |
| card-2 | 연구 카드: 두 슬릿 조건 | p1 | 800×600 | card, double-slit | 두 개의 틈이 난 슬릿 판 카드 삽화 |
| card-3 | 연구 카드: 위상 손잡이 조건 | p1 | 800×600 | card, phase-knob | 검출 장치 옆에 조정 손잡이가 달린 카드 삽화 |

## 프롬프트 p1 (6장 공통 앞부분 + 개별 뒷부분)

공통: `Bright virtual quantum lab intro illustration, pastel tones, simple light source box and detection panel still life on a clean bench, no people, no text, no numbers, no formulas, no particle trajectories, no interference pattern, soft daylight, flat clean style, 16:9`

- lab-intro-1 뒤: `wide shot of the whole bench arrangement`
- lab-intro-2 뒤: `close-up of a dark plate with two vertical slits, no light beams drawn`
- lab-intro-3 뒤: `detection panel with a single small dot, empty otherwise`
- card-1 뒤: `single-slit plate icon-like composition, square 4:3`
- card-2 뒤: `double-slit plate icon-like composition, square 4:3`
- card-3 뒤: `detection device with a simple adjustment knob beside it, square 4:3`

## 상태

- [x] 시험 생성 (lab-intro-1 2회) → 1차 탈락(광선 빔이 궤적 암시) → 2차 통과. 판정: 장치만 분리 배치, 빔·궤적·문자 없음. 검출판 도트 질감은 장식이며 데이터 아님.
- [x] 일괄 5장 전부 통과 (빔·궤적·문자·무늬 없음 확인). 실제 1200×896 JPEG, 63–94KB (카드 150KB·장면 500KB 이하 만족, WebP 변환 불필요).
- [x] 삽입: hero lab-intro-1 / 예측 lab-intro-2·3 / 비교 card-1·2·3. alt는 위 표, figcaption에 "측정값 아님" 명시.
- [x] 삽입 후 실제 화면 검수: 6장 전부 로드·alt 표시, lazy 동작, 390px 넘침 없음, 실패 리소스 0.

## 생성 기록

- modelUsed: Nano Banana 2 (Flow 표시명, 2026-09-23)
- licenseNote: Flow PRO 계정 생성물 — 아카이브 이용 조건과 동일 취급, 별도 표기 필요시 추가
- lab-intro-1: reviewStatus passed (1200×896, 63KB)
- 공통 프롬프트 가드 추가: "devices only, absolutely no light beams, no rays, no connecting lines"
