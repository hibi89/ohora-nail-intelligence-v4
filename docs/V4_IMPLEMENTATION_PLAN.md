# OHORA Nail Intelligence v4 — 구현 계획 및 진행 상태

## STEP 3 완료 상태

STEP 0 설계, STEP 1 데이터 검증, STEP 2 정규화/selector, STEP 3 첫 UI 구현과 QA를 완료했다. React + Vite UI와 로컬 snapshot 개발 API가 동작한다. 상세 구현 파일과 검증 사실은 [STEP 3 구현 보고서](V4_STEP3_IMPLEMENTATION.md), 화면 검수는 [STEP 3 시각 QA](V4_STEP3_VISUAL_QA.md)를 기준으로 한다.

현재 STEP 3 데이터 경로는 로컬 개발에 한정된다. `npm run dev`의 `GET /api/ohora-dashboard`가 서버 측에서 비공개 JSON을 읽어 정규화 allowlist를 반환한다. n8n, dashboard2, 키, 운영 API, 배포 환경은 연결하지 않았다. STEP 4 이후 운영 API/권한은 별도 설계와 승인 대상이다.

## STEP 0 운영 데이터 흐름 제안 (구현 전 제안으로 보존)

아래는 당시 운영 연동의 후보였으며 현재 구현 상태를 설명하지 않는다.

```text
브라우저 UI
  → same-origin GET /api/ohora-analysis
  → v4 서버리스 핸들러 (server-only N8N_API_KEY)
  → 승인된 n8n Data Table GET
  → 응답 봉투/스키마 검증
  → normalizeRawV3 (한 번만 정규화)
  → buildDashboardView (순수 집계/필터/차트 모델)
  → 카드·표·차트·Excel이 같은 canonical model 사용
```

읽기 API만 호출하고 분석 workflow를 실행하지 않는다. UI에서 refresh, 표 필터링, Excel 생성을 눌러도 새 n8n 분석이 시작되지 않는다. 브라우저에는 n8n URL/키/인증 헤더를 전달하지 않는다.

## STEP 0 파일별 계획 (구현 위치는 STEP 3 보고서 참조)

아래 표는 초기 제안 목록이다. 실제 파일명/현재 책임은 새 앱 구조에 맞춰 달라졌으며, 구현 현황은 [STEP 3 구현 보고서](V4_STEP3_IMPLEMENTATION.md)에 기록한다.

| 경로 | 책임 |
|---|---|
| `package.json` | React/Vite 실행 스크립트와 실제 필요한 라이브러리만 추가. XLSX 라이브러리 및 차트 옵션은 기능 검토 뒤 선택 |
| `vite.config.js` | 개발 서버에서 `/api/ohora-analysis`를 로컬 서버 핸들러에 연결. 프로덕션 코드와 동일한 핵심 fetch/검증 로직을 공유 |
| `index.html` | React 마운트 지점, 접근성/문서 메타데이터. 레퍼런스 PNG를 페이지 배경으로 넣지 않음 |
| `api/ohora-analysis.js` | Vercel용 same-origin GET 서버리스 경로. 메서드 검사, 허용된 upstream 고정, 자격 증명 유무, timeout, 안전한 오류와 응답 헤더 |
| `server/ohora-upstream.js` | 승인된 n8n Data Table을 읽는 공용 서버 모듈. credential은 함수 인자로 안전하게 전달, HTTPS/host/table/key 검증, cursor 상한, JSON parsing, timeout, 제한된 in-memory cache |
| `src/main.jsx` | React 엔트리, 앱 마운트 |
| `src/App.jsx` | 로딩·성공·stale 경고·오류·빈 분석 상태, 최초 GET 및 명시적 새로고침 조율 |
| `src/api/ohoraClient.js` | same-origin fetch, HTTP/error envelope 해석, 취소/재시도 UX 지원. 비밀 설정은 없음 |
| `src/data/ohoraSchema.js` | 런타임 입력 검증과 허용 schema/version 정의. 실제 계약 검토 뒤 JS/JSDoc 또는 TypeScript 선택 |
| `src/data/normalizeOhoraV3.js` | 게시물/슬라이드/이미지/AI/태그·색상을 canonical model로 정규화. ID·index exact matching, null 보존, 미매칭·중복 품질 보고 |
| `src/data/selectors.js` / `src/data/buildDashboardViewModel.js` | KPI·조합·태그 분포·날짜 버킷·insight selector와 UI 소비 ViewModel. 표시와 XLSX가 공유하는 순수 규칙 |
| `src/data/filterDashboard.js` | 검색, 기간, 분류, 태그 조건을 canonical model에 적용 |
| `src/components/AppShell.jsx` | sidebar, topbar, 메인 영역의 화면 구조와 선택 메뉴 |
| `src/components/HeroBanner.jsx` | 히어로 이미지·문구. 별도 권리 확인된/승인된 이미지 사용 |
| `src/components/InsightCard.jsx` | 근거와 표본 수를 함께 제시하는 데이터 기반 요약 및 빈 상태 |
| `src/components/KpiGrid.jsx` | 네 KPI 타일. 데이터 계약에서 확정한 뜻과 기간을 표시 |
| `src/components/TrendingDesigns.jsx` | 상위 이미지/태그 카드 5개. 데이터가 부족하면 카드 수보다 빈 상태를 우선 |
| `src/components/CombinationTrends.jsx` | 비율 분모 검증을 거친 donut, 범례와 기타 항목 |
| `src/components/AnalyzedPostsTable.jsx` | 정렬·선택·필터·페이지/행 표시, 원문/사진 링크, Excel 버튼 |
| `src/components/AnalysisOverview.jsx` | Trend/Color/Tag 탭, 기간 선택, 접근 가능한 chart tooltip/legend |
| `src/components/ImageViewer.jsx` | 선택한 실제 사진과 게시물 permalink를 보여주는 상세/모달. 공개 URL 정책 준수 |
| `src/components/LoadState.jsx` | 로딩, 재시도 가능한 오류, 분석 없음, stale 자료 경고 |
| `src/styles/tokens.css` | 실측 바탕/잉크/테두리/강조색, 간격, radius, type scale |
| `src/styles/layout.css` | 1672×941 기준 sidebar·topbar·grid, 이후 좁은 폭 대응 |
| `src/styles/components.css` | 카드, 메뉴, 표, 탭, 차트와 focus/hover/disabled 상태 |
| `src/assets/decorative/` + `src/config/decorativeAssets.js` | 정책 A에 따른 별도 생성 이미지와 슬롯 manifest. 분석 JSON 이미지와 분리 |
| `scripts/verify-step2-snapshot.mjs` / `test/data-layer.test.js` | 비공개 스냅샷의 민감정보 없는 통합 검증 및 데이터 계층 단위 테스트 |
| `src/export/buildXlsx.js` | 화면 canonical model로 5개 시트 생성. 기존 시트명(디자인 인사이트, 게시물, 이미지, 캐러셀, 분석 품질)은 제안이며 컬럼 계약 승인 전에는 구현하지 않음 |
| `docs/V4_PIXEL_SPEC.md` | 확정 화면 geometry/color/type 및 비교 순서 |
| `docs/V4_DATA_MAPPING_DRAFT.md` | schema, 지표 정의와 데이터 품질 계약 |
| `docs/V4_IMPLEMENTATION_PLAN.md` | 이 단계 계획 및 승인/위험 기록 |

모듈 수가 작은 앱이라도 데이터 계약, 계산, 렌더링을 분리한다. UI와 표·Excel 계산이 각각 별도 집계 공식을 갖지 않게 한다. STEP 2에서는 의존성 없이 실행 가능한 ESM JavaScript, JSDoc 계약, 런타임 검증과 Node 내장 테스트를 사용한다. UI가 추가될 때 TypeScript 전환 필요성을 다시 검토한다.

## 단계 및 승인 게이트

| 단계 | 작업과 산출물 | 진행 조건 |
|---|---|---|
| STEP 0 — 착수 설계 | 킥오프 자료, 새 저장소, 픽셀 명세와 초기 계획 | 완료 |
| STEP 1 — 데이터 계약 | 실제 JSON 구조와 무결성 감사, UI 매핑 초안 | 완료 |
| STEP 2 — 데이터 계층 | canonical normalizer, selectors/ViewModel, QA와 테스트 | 완료 |
| STEP 3 — 로컬 UI와 데이터 연결 | reference geometry, 실제 JSON, 검색·날짜·탭·상세·표, dev-only API | 완료. 장식 이미지·Excel은 별도 항목으로 남음 |
| STEP 4 — 확장 기능·정책 | Excel 계약/출력, 남은 제품 결정, 필요한 범위의 기능 확장 | 아직 시작하지 않음. 사용자 승인 대기 |
| 운영/배포 준비 | 운영용 API, 권한/호스팅/노출 정책 및 배포 | 별도 설계·승인 전에는 시작하지 않음 |

STEP 3 시각·기능 검수는 [시각 QA](V4_STEP3_VISUAL_QA.md)와 [미해결 사항](V4_STEP3_OPEN_ISSUES.md)에 남겼다. 과거 STEP 0/1 제안 문구는 현재 코드/정책 설명에 우선하지 않는다.

## STEP 0 당시 확인한 사실과 추정/미결정 분리 (역사 기록)

다음 하위 항목은 초기 착수 시점의 상태를 기록한 것이다. 최신 구현/검증 사실을 보려면 STEP 1/2 audit와 STEP 3 보고서를 참조한다.

### 읽은 코드·문서에서 확인

- `dashboard2`는 React 19 / Vite 7 JavaScript 프로젝트다. 현재 adapter는 `observations`, post AI classification, `ai.slides`와 `image_assets`, 태그 분포, 이미지 조합, 평균 반응, 날짜 범위, image/post 목록을 만든다.
- 기존 API 미들웨어는 `GET /api/ohora-analysis` 이외 메서드를 405로 처리하며 API 키가 없으면 503을 돌려준다. Vite dev와 preview에 등록된다.
- 기존 서버는 승인된 n8n HTTPS 호스트와 고정된 Data Table을 조회한다. 캐시 행을 찾고 `html` JSON을 파싱한다. n8n 키는 서버 요청 header로 전달된다.
- 기존 build/preview 형태는 정적 HTML 생성에 미들웨어 프리뷰를 더한 로컬 구조다. 정적 파일만 배포하면 프록시는 생기지 않는다.
- 킥오프 문서는 Vercel을 목표로 하고 사용자 승인 전 API key transfer를 금지한다. 키 만료일은 연동 문서에 2026-10-20으로 기록되어 있다. 키 원문은 열거나 복사하지 않았다.
- reference PNG 외 개별 사진·폰트 자산은 킥오프 자료 목록에 없다.

### 아직 추정 또는 결정 필요

- 현 시점 최신 데이터 수와 필드 타입, timestamp 누락률, slide/image exact match 비율
- `engagement`와 `followers`의 단위/산식, 이미지 참여도와 게시물 반응 간 연결 규칙
- KPI의 “Trending” 기준, 비교 기간, Active Colors/Top Tags 계수 및 Insight 알고리즘
- captions, 플랫폼, asset 링크가 실제 JSON에 있는지와 외부 공개 허용 범위
- hero/사이드바/조합의 사진 출처와 라이선스, 한글 및 영문에서 가장 근접한 폰트
- serverless 런타임의 실제 환경 변수/라우팅/응답 크기 정책과 cache 동작
- 사용자가 요구하는 최종 반응형 브레이크포인트와 표 모바일 표시 방식

## 기술·제품 위험 및 완화안

| 위험 | 영향 | 제안 대응 |
|---|---|---|
| 레퍼런스의 독립 사진/폰트 원본 부재 | 픽셀 유사도와 asset 권리 판단 | 별도 사진 소스와 라이선스 확인 또는 생성 사진 승인; 폰트 실제 렌더링 비교 |
| 집계 정의 없이 화면의 예시 숫자 복제 | 실제 데이터와 상충하거나 성장/참여 허위 주장 | KPI 분모·기간·누락값 규칙을 STEP 1에서 승인; 산출 불가한 delta는 감춤 |
| `slide.index` 없음/중복 또는 asset과 불일치 | 썸네일에 다른 게시물 태그가 붙음 | exact key 매칭, 미매칭 상태/카운트 표시, 배열 위치를 묵시적 fallback으로 쓰지 않음 |
| image URL 또는 permalink 만료/권한 제한 | 빈 이미지와 깨진 원문 이동 | load failure fallback, 새 탭 안전 링크, 이미지 접근과 export 정책 구분 |
| Vite API 플러그인을 배포용으로 오인 | production 화면에서 데이터가 안 뜨거나 secret 보호 실패 | Vercel route를 독립 구현하고 배포 환경에서 직접 경로/번들 노출을 확인 |
| 임시 n8n 키 만료 | STEP 3 연결 및 운영 중단 | 2026-10-20 이전 재승인/대체 credential 필요. 만료를 사용자 오류로 알리고 키를 소스에 두지 않음 |
| 프로세스 내부 캐시의 serverless 제약 | 함수 인스턴스별 캐시가 달라 upstream 요청이 늘 수 있음 | 캐시를 부가 최적화로 취급하고 n8n rate/최신성 정책 확인; 별도 저장소는 필요 시 승인 후 검토 |
| 캐시 JSON의 Instagram URL/캡션 공개 | 데이터 노출 | 실제 필드를 확인하고 공개 범위·로그 마스킹·응답 필터 정책 결정 후 배포 |
| 이전 문서의 수치/메모가 오래됨 | 대시보드가 과거 상태를 현재로 보임 | generated/updated 시각을 노출하고 최신 GET 검증 전 숫자 고정 금지 |

## 예상 소요 시간

STEP 1 이후 실제 구현·검증은 **약 4.5–7 작업일**로 예상한다. 데이터 계약 확인 0.5–1일, 앱 레이아웃/에셋/픽셀 반복 보정 1.5–2.5일, 안전한 API와 정규화 0.75–1.25일, 검색/필터/차트/Excel 1–1.5일, 최종 화면·기능·보안 검증 0.75–1일 정도다. 이미지 확보, 키 갱신 승인, JSON 구조 수정 필요성에 따라 늘어날 수 있다. 이는 일정 약속이나 자동 실행 시간 보장이 아니다.

## STEP 0 완료 기준 기록

- 확인된 작업 경로: `E:\codexPractice\ohora_v4`.
- 킥오프 폴더는 이미 풀려 있었다. 그 안의 ZIP 파일은 루트에서 찾지 못해, 풀린 원본 폴더를 보존하고 그 자료를 루트 `docs/`, `reference/`, `README.md`로 배치했다.
- 새 루트에 Git 저장소를 초기화하고 `.env*`(단 `.env.example` 예외), `node_modules/`, `dist/`, `data/private/`, `data/raw/`, 테스트 산출물 및 로그를 ignore 처리했다.
- `E:\dashboard2`의 요청된 코드·문서는 읽었다. `.env.local`은 열지 않았다. 샌드박스 권한 오류로 기존 저장소 `.git`에 `git status`/HEAD 확인을 시도한 명령은 거부됐다. 읽기만 했으며 수정 명령은 실행하지 않았다.
- 세 문서의 초안/명세를 이 루트에 작성했다. 새 프로젝트에는 아직 React/Vite 코드, 패키지, 서버 API, 키, 데이터 스냅샷을 추가하지 않았다.
