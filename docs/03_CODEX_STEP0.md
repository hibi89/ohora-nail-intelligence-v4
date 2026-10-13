# Codex STEP 0 실행 지시 — 독립 새 프로젝트

## 절대 경로 조건
- 신규 프로젝트 루트는 `E:\codexPractice\ohora_v4`이다. 모든 파일 작성·Git 초기화·패키지 설치는 이 폴더에서만 수행하라.
- `E:\dashboard2`는 **읽기 전용 분석 대상**이다. 코드를 수정하지 않고 필요한 구조만 참고. `.env.local`의 키 원문을 읽어 출력하거나 복사하지 말 것. 아예 디렉터리를 복사/이동하지 말 것.
- 이전에 배포한 v3/학원 n8n은 절대 변경 금지.

## 지금 STEP 0에서 할 일
1. 현재 작업 디렉터리를 확인한다. 경로가 다르면 위 신규 폴더로만 이동한다.
2. `OHORA_v4_NEW_PROJECT_KICKOFF.zip`이 루트에 있다면 압축을 신규 루트에 풀어라. ZIP 내부 최상단 폴더를 고려해 `docs/`와 `reference/`가 루트 바로 아래 있게 정리한다. 이미 압축이 풀려 있으면 중복 복사하지 않는다.
3. README, `docs/00_GOALS_AND_RULES.md`, `docs/01_REFERENCE_AUDIT.md`, `docs/02_DATA_CONTRACT.md`, `docs/04_ACCEPTANCE_TESTS.md`를 전부 읽어라.
4. `reference/ohora_target_1672x941.png` 크기가 실제로 1672×941인지 확인하고 화면을 직접 분석하라.
5. `E:\dashboard2`의 다음 파일만 읽기 전용 검토한다: `package.json`, `server/ohora-api.js`, `src/ohoraData.js`, `vite.config.*`, `docs/N8N_API_INTEGRATION.md`, `.gitignore`. 기존 파일이 없으면 그 사실을 보고하고 작업을 멈추지 말고 대안 제시.
6. 안전한 신규 Git 저장소를 현 루트에서만 초기화하고 `.gitignore`에 `.env*` (단 `.env.example` 허용), `node_modules/`, `dist/`, `data/private/`, 테스트 저장된 raw 및 로그를 제외한다. 기존 `dashboard2`의 Git 이력이나 작업 브랜치는 건드리지 마라.
7. 확정된 시각 참조를 영역별 위치, 카드 넓이/높이, 색상/서체, 탭/버튼/사진요소로 더 정밀하게 나눈 `docs/V4_PIXEL_SPEC.md`를 작성하라.
8. 실제 API는 지금 키가 필요한 방법으로 억지 호출하지 말고, 낮 프로젝트의 데이터 매핑 코드를 검토해 화면↔원본 필드 간 `docs/V4_DATA_MAPPING_DRAFT.md`를 작성하라. 확인한 사항과 추정 사항을 구분한다.
9. 백엔드 프록시 코드를 어떻게 **새 프로젝트에서 재구현/안전하게 이식**할 것인지 파일별 계획을 `docs/V4_IMPLEMENTATION_PLAN.md`에 작성하라. 비밀정보 이식은 사용자 승인 전 금지.
10. STEP 0 보고: [참조 이미지 해부표/재사용 대상/데이터 매핑/확인 필요한 미결정·질문/다음 구현에 걸릴 시간]. 이후 사용자 승인을 기다려라.

## 구현 금지
- 아직 React/Vite 스캐폴드·UI 컴포넌트·네트워크 API 코드 전체 구현, 신규 패키지 설치, 배포를 하지 않는다. 계획과 Git 구조만 준비한다.
- 실제 API 키를 채팅이나 로그로 출력하지 않는다.
- 스크린샷 한 장을 전체 배경으로 표시하거나 레퍼런스 허구 수치를 보존하는 UI 계획을 세우지 않는다.
