# OHORA v4 — STEP 2 데이터 계층

## 목적과 범위

STEP 2는 실제 OHORA v3 응답을 브라우저와 UI가 바로 쓸 수 있는 정규 모델과 ViewModel로 바꾸는 단계다. UI, 서버/API, 새 외부 호출, AI 재분석, 이미지 생성은 구현하지 않았다. 모든 현재 수치 검증은 Git에서 제외된 로컬 private snapshot을 사용했다.

## 흐름

private JSON (검증 스크립트 전용)
→ 응답 봉투/스키마 확인
→ Post / Slide / Asset / AI / Color / Tag 정규화
→ 결측·미매칭·경고·집계 비교를 포함한 dataQuality
→ KPI·카드·도넛·표·탭·기간 ViewModel
→ STEP 3 UI 소비

src/data 모듈은 브라우저에서 사용 가능한 순수 ESM이며 파일 시스템/API 호출이 없다. 실제 로컬 파일 접근은 scripts/verify-step2-snapshot.mjs에만 둔다. 해당 스크립트는 집계와 검증 상태만 출력하고 ID, 캡션, 이미지 URL 등 행 데이터를 출력하지 않는다.

## 파일별 역할

| 파일 | 역할 |
|---|---|
| src/data/ohoraTypes.js | 게시물·슬라이드·자산·품질·이미지 판별 타입의 JSDoc 계약과 태그 차원 상수 |
| src/data/ohoraSchema.js | data.analysis 봉투, 지원 schema version, observations 배열 검증. 오류 메시지에 원본 값을 넣지 않음 |
| src/data/normalizeOhoraV3.js | 응답 정규화, 날짜·URL·숫자·태그 검증, AI/미디어 연결과 품질 리포트 구성 |
| src/data/selectors.js | KPI, 디자인 조합, 참여율, 검색·기간 필터, 표·도넛·Analysis Overview ViewModel 계산 |
| src/data/buildDashboardViewModel.js | STEP 3에서 사용할 ViewModel builder 공개 진입점 |
| src/config/decorativeAssets.js | 네 개의 별도 생성 이미지 슬롯 manifest. 실제 이미지가 없어 src=null, pending-generation |
| scripts/verify-step2-snapshot.mjs | 비공개 snapshot을 읽고 민감한 원문 없이 동적 KPI/품질 요약을 검증 |
| test/data-layer.test.js | exact match, 불일치/중복 차단, 참여율, 장식/분석 이미지 분리, 실제 snapshot 통합 검증 |
| package.json | 외부 패키지 설치 없이 Node 내장 테스트와 snapshot 확인 명령 제공 |

JavaScript ESM과 JSDoc을 선택해 패키지 설치 없이 코드/fixture를 실행할 수 있게 했다. 런타임 schema validator가 입력을 검사하고 테스트가 계약을 확인한다. UI가 도입될 때 TypeScript 전환 또는 checkJs 활성화는 별도 검토할 수 있다.

## 정규화 규칙

- 게시물 ID는 정규화한 문자열이다. 슬라이드 키는 (postId, slideIndex) JSON tuple이고, 자산 ID는 제공된 assetId다.
- 게시물→자산/슬라이드는 같은 observation에 중첩된 부모 관계를 보존한다. 자산-슬라이드 연결은 같은 게시물의 정확한 정수 index가 유일할 때만 한다.
- URL이 양쪽에 존재하면 안전한 HTTP(S) URL로 정규화한 뒤 비교한다. URL이 다르면 url-mismatch, 인덱스가 중복되면 ambiguous-index, 게시물 ID가 중복되면 ambiguous-post-id 상태로 표시하고 자산 ID를 부여하지 않는다.
- 어떤 상황에서도 배열 위치 fallback은 없다. 슬라이드 미매칭은 오류, AI 결과가 없는 자산은 미매칭 자산 경고로 별도 집계한다.
- 원본 ai.slides 순서를 정규 모델에서 보존한다. 화면 정렬은 ViewModel에서만 명시적으로 수행한다.
- 분석 결과 aiResults[]는 게시물 단위 AI 판정/상태/증거/슬라이드 키를 담는다. 슬라이드 태그는 slides[]에 유지하고, colors[] 및 비색상 tags[]는 파생된 평탄화 레코드로 분리한다.
- 결측 수치값은 null로 남긴다. 숫자 문자열, 음수, 무한값은 유효 반응 수치로 자동 변환하지 않는다.
- 태그는 문자열 배열만 수용하고 trim 후 게시물-슬라이드-차원 안에서 중복 제거한다. 빈 배열은 그대로 빈 배열이며 임의 라벨을 생성하지 않는다.
- 날짜는 ISO UTC로 정규화한다. 전역 필터 기본 범위는 snapshot의 최초~최신 관측일(양끝 포함), Analysis Overview는 선택 범위에서 최신 관측일을 끝으로 하는 7일이다. 미관측 날짜를 0건으로 채우지 않는다.

## ViewModel 계약

buildDashboardViewModel(model, options)는 아래 블록을 반환한다.

| 블록 | 포함 데이터 |
|---|---|
| sidebar | 7개 메뉴 ID/라벨, 현재 선택, sidebarStoryImage 슬롯 키 |
| hero | OHORA 타이틀·서브카피, 장식 슬롯, 전체 관측 기본 기간, 서술 승인을 기다리는 인사이트 후보 |
| filters | 검색 문자열, UTC 날짜 범위, 범위 기본 기준 |
| kpis | 동적 값 24/87/18/58과 각 수치의 이름·단위·공식. 비교 델타는 null |
| engagement | 기본 단순 평균, 유효 n/전체 n, 별도 가중률과 분자·분모 |
| trendingDesigns | 디자인 슬라이드 조합 빈도 상위 5개, exact-match 대표 이미지, 빈도 분모, 기간 증가율 null |
| combinationTrends | 상위 5개 + Others, count/분모/percentage, 자격 미달 디자인 슬라이드 수, 임시 분모 상태, signature 슬롯 |
| postsTable | 최신순 게시물 행, 태그/색/썸네일/반응/원문 링크, 미제공 Shares, 미승인 플랫폼 후보 provenance |
| analysisOverview | Trend Analysis, Color Distribution, Tag Coverage 탭. 날짜별 AI 태그 출현/게시물 참여율 평균, 색 분포, 태그 커버리지 |
| dataQuality | 전체 정규화 수, 매칭 성공·실패, 미매칭 자산, 분류, 필드 결측률, 태그 커버리지, 경고·오류 |

인사이트 ViewModel은 narrative=null이다. 현재 데이터로 안전하게 만들 수 있는 가장 많이 관측된 조합과 건수만 후보로 제공한다. 화면이 승인 전 성장·인과·경쟁사 문구를 생성하지 않도록 했다.

### 기본 기간

- 상단 전역 필터/KPI/표 기본: 실제 snapshot의 전체 관측 범위, 2026-10-01~2026-10-12 UTC.
- Analysis Overview 독립 기본: 2026-10-06~2026-10-12 UTC.
- 사용자 필터 양 끝은 포함한다. 날짜 표시를 Asia/Seoul 또는 브라우저 시간대로 바꾸는 일은 STEP 3에서 결정한다.

### 미확정 정책을 과장 없이 표현

- 도넛은 현재 조합 조건(색/기법/모티프 중 두 차원 이상)이 적용된 디자인 슬라이드를 분모로 삼는다. ViewModel의 basisStatus와 경고는 이 분모가 임시임을 표시한다.
- Trend Analysis의 실제 시계열 필드는 AI tag mentions로 이름 붙인다. 이를 레퍼런스의 일반 Total Mentions로 바꾸지 않는다.
- permalink host에서 도출한 Instagram/TikTok 후보는 approvedForDisplay=false다. 표의 명시 플랫폼 필드는 비어 있다.
- shares는 항상 null이다. 좋아요/댓글/참여율로 대체하지 않는다.
- 비교 KPI와 성장률은 null이다. 전 기간 커버리지 메타데이터가 확보되지 않았다.

## 사용 명령

- npm test
- npm run verify:step2

검증 명령은 현재 작업 디렉터리의 로컬 private snapshot만 읽는다. 원본을 복사하거나 출력·업로드하지 않는다.
