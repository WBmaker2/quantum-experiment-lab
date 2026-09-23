# 배포 직전 체크리스트

배포 자체는 이 문서 이후 별도 단계다. 승인 후 [검증 기록](./VERIFICATION.md) §6을 공개 URL에서 직접 수행한다.

## 전제

- 빌드 없음: 정적 파일 그대로 올린다. `index.html` 기준 상대 경로(`./styles.css`, `./app.js`, `./engine/…`)만 써서 저장소 하위 경로에서도 깨지지 않는다.
- 의존성 없음: `package.json`의 스크립트는 검사·테스트용이며 배포물에 포함하지 않아도 된다.

## 배포 전 (지금 상태)

- [x] `npm test` 9/9, `npm run check` 통과
- [x] Playwright 3종 뷰포트 + 키보드 + 콘솔·리소스 무결성 (증거 `docs/qa/`)
- [x] 상대 경로만 사용 (절대 경로·외부 폰트·외부 스크립트 없음)
- [x] localStorage 키 `quantum-experiment-lab:v1`, 개인 식별 정보 없음
- [x] 업데이트 내역(`docs/UPDATELOG.md`) 최신화, 화면 내 업데이트 내역 버튼 동작
- [x] 배포 주소·HVC 확인용 주소 확정 (확정 시 아래에 기입, 보고서에 클릭 가능한 링크로 제공)
- [x] 공개 범위·이용 조건·외부 자료 정리 (외부 자료 없음, 의존성 없음)

## 배포 주소

- 공개 URL: https://wbmaker2.github.io/quantum-experiment-lab/
- HVC 확인용 URL: https://wbmaker2.github.io/quantum-experiment-lab/ (동일, HVC 등록은 별도 범위)

## 배포 후 (2026-09-23 수행)

1. [x] 공개 URL에서 5개 화면 흐름(예측→N=1000 실행→완료) 직접 확인.
2. [x] 하위 경로(`/quantum-experiment-lab/`)에서 CSS·JS·엔진 4모듈 404 없이 로드, 실패 리소스 0, 콘솔 오류 0.
3. [ ] HVC 등록과 공개 갤러리 동기화는 별도 범위 (미수행).

## 금기 (배포 시에도 유지)

- 궤적 선·관찰자 눈 연출 이미지 추가 금지. 검출 점·그래프는 엔진 생성만 사용.
- 측정 수치·효과를 단정하는 문구 추가 금지 (예제 값은 설계 사례).
