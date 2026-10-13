# OHORA Nail Intelligence v4 — STEP 3 구현 보고서

## 범위와 상태

STEP 3 승인 지시에 따라 실제 OHORA v3 스냅샷을 사용하는 React + Vite 대시보드와 개발 전용 데이터 공급 계층을 구현했다. `E:\dashboard2`, n8n, DB, 인증정보, 외부 배포는 건드리지 않았다. API 키는 열거나 복사하지 않았다.

브라우저는 `GET /api/ohora-dashboard`만 호출한다. Vite 플러그인은 `serve`에서만 등록되며 서버 측에서 `data/private/step1-response.json`을 읽고 `normalizeOhoraV3`로 정규화한 뒤 필요한 필드만 반환한다. 요청은 loopback peer와 GET으로 제한한다. 프로덕션 산출물에는 이 개발 미들웨어가 등록되지 않는다. 원본 응답 envelope, 미매칭 자산 URL, 자격 증명은 브라우저 응답에 넣지 않는다. 게시물 ID/캡션/날짜/링크/디자인 분류/좋아요·댓글/보고 참여율, 별도 가중 참여율 계산용 follower count, 정확히 연결된 분석 이미지 URL, 태그, 제한된 visual evidence와 품질 요약만 전달한다. UI에서 쓰지 않는 slide-key 목록·미디어 유형·별도 재계산 참여율은 응답에서 제외한다.

실제 확인된 전체 범위는 고유 게시물 24건, AI 슬라이드 97장, 디자인 슬라이드 87장이다. 현재 전체 관측 기간의 KPI는 24 / 87 / 18 / 58이며 모두 JSON에서 계산한다. 파일에 숫자를 상수로 박아 넣지 않았다.

## UI 요소와 실제 데이터 계산

| UI | 원천/계산 | 상태와 해석 |
|---|---|---|
| Total Analyzed Posts | 분석 슬라이드가 1개 이상 연결된 고유 게시물 ID | 전체 범위 24. 게시물 수이지 이미지 수가 아님 |
| Observed Design Slides | 선택 범위에서 `is_design_post === true`인 AI 슬라이드 수 | 전체 87. 성장이 아닌 관측량 |
| Observed Colors | 디자인 슬라이드의 고유 color label | 전체 18. 임의 HEX 색상 변환은 하지 않음 |
| Classified Tag Types | 6개 카테고리와 tag 값을 조합한 고유 `(category, value)` 쌍 | 전체 58. 같은 단어가 다른 카테고리에 있으면 별개로 계산 |
| Today's Insight | 조합 적격 슬라이드 중 가장 많이 관측된 조합의 label/count와 73 적격 분모 | 전체 범위 후보의 관측수만 표기. 시장 비교/성장 주장은 아님 |
| Most Observed Designs | 디자인 슬라이드별 색·기법·모티프 조합 빈도 상위 5개, 라벨순 tie-break | 대표 썸네일은 정확히 매칭된 해당 게시물/슬라이드 이미지 |
| Design Combination Trends | 색·기법·모티프 중 2개 이상 분류된 디자인 슬라이드 73개 기준 top5 + Others | top5 9/73 = 12.3%, Others 64/73 = 87.7%. 14/87 디자인 슬라이드는 적격 차원 부족으로 분모 밖 |
| Analyzed Posts | 원본 observation의 caption/date/permalink/likes/comments/reported engagement와 동일 게시물 exact-match 썸네일/태그 | 누락값은 `—`/Rate unavailable로 남긴다. 플랫폼은 명시 필드가 없어서 `—`, shares 열 없음 |
| Trend Analysis | Asia/Seoul 관측일별 AI tag occurrence와 유효 게시물 engagement 단순 평균 | 관측일만 표시하고 수집되지 않은 날짜를 0으로 보간하지 않음 |
| Color Distribution | 선택 슬라이드의 color label occurrence 수 | KPI의 고유 색상 수와 다른 출현 횟수 |
| Tag Coverage | 각 태그 차원이 채워진 슬라이드 수 / 선택 슬라이드 수 | 태그 누락을 AI 오류/디자인 부재로 해석하지 않음 |
| 검색·날짜 범위 | caption + color/technique/texture/motif/season/use, Asia/Seoul 게시일 | 해당 선택 범위와 검색 조건을 카드·KPI·도넛·표·Overview에 공통 적용 |
| Excel Download | 아직 구현하지 않음 | STEP 4에서 스키마/개인정보 범위를 정할 때까지 disabled |

현재 engagement 기본 KPI 문구는 유효한 게시물별 원본 참여율의 단순 평균이며 1.0583%, 표본 `n=23/24`다. 합산 반응/팔로워 가중값 0.3567%는 계산 model에 분리 보존하지만 UI의 기본 평균으로 대체하거나 성장 수치처럼 쓰지 않는다.

## 구현 내용

- 레퍼런스의 고정 데스크톱 행 순서와 1672×941 좌표를 CSS Grid로 맞추고, 1440px·1280px·390px 레이아웃을 추가했다.
- 상단 검색은 캡션과 6개 태그 차원을 검색한다. 날짜 범위는 게시물·슬라이드에서 집계되는 모든 영역에 공통으로 적용되며 Asia/Seoul의 inclusive calendar date로 계산한다. 최초 범위는 전체 관측 기간이다.
- `Most Observed Designs` 다섯 카드는 빈도 순위와 정확히 매칭된 원본 슬라이드를 쓴다. 배열 순서 대체 연결은 없다. 동률은 라벨 순으로 결정한다.
- 도넛은 조합 분류가 가능한 디자인 슬라이드 73개를 분모로 계산하고, 자격이 없는 14/87 디자인 슬라이드를 주석으로 분리한다.
- 차트 탭 3개, 디자인 상세, 게시물 상세/캐러셀, 필터, 표 정렬과 내부 스크롤, 원본 게시물 새 탭 링크, 로딩·오류·빈 결과 상태를 구현했다.
- 원본 데이터에 없는 플랫폼은 `—`로 표시하고 Shares 열은 만들지 않았다. Excel 다운로드는 STEP 4까지 비활성화했다. Social Monitoring과 Saved Collections 메뉴도 `SOON`으로 표시하고 비활성화했다.
- Hero Banner, Sidebar Story, Today's Insight, Signature Combinations 슬롯을 `pending-generation` manifest와 CSS 플레이스홀더로 연결했다. 장식 슬롯에 분석 사진을 재사용하지 않았다.

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 데이터 로딩, 검색·날짜·탭 상태, 사이드바 이동, 상세 대화상자 |
| `src/api/ohoraClient.js` | 같은 출처의 로컬 개발 API 요청과 안전한 오류 처리 |
| `server/localSnapshotApi.js` | loopback GET 전용, 서버 측 snapshot 읽기, allowlist 응답 |
| `vite.config.js` | `serve`에서만 로컬 snapshot 미들웨어 등록 |
| `src/data/selectors.js` | STEP 2 정규화 model과 selector/ViewModel 재사용, 공통 기간 범위 및 표 순위 |
| `src/utils/dateFormat.js` | Asia/Seoul 날짜 라벨과 calendar-day 이동 |
| `src/components/DataPanels.jsx` | KPI, 관측 디자인 카드, 조합 도넛, 게시물 표와 상세 대화상자 |
| `src/components/AnalysisOverview.jsx` | Trend, Color, Tag Coverage 탭 |
| `src/components/DecorativePlaceholder.jsx` 및 `src/config/decorativeAssets.js` | 장식 슬롯과 생성 대기 상태 |
| `src/styles.css` | 참조 화면의 데스크톱 geometry, 플레이스홀더, 반응형 레이아웃 |
| `test/data-layer.test.js` | 정규화·selector·로컬 API contract 테스트 |
| `README.md` | 설치, 로컬 실행, 검증 명령과 데이터 보안 범위 |

## 실행

PowerShell에서 프로젝트 경로로 이동한 뒤:

```powershell
npm install
npm run dev
```

확인 주소: `http://127.0.0.1:5173/`. `npm run preview`는 정적 build만 제공하고 개발 전용 snapshot API는 제공하지 않는다.

## 확인 결과

- `npm test`: 9개 통과, 실패 0개.
- `npm run verify:step2`: 통과. 게시물 24, 고유 ID 24, 슬라이드 97, 원본 image_assets 100, 정확 매칭 97, 슬라이드 매칭 실패 0, 미연결 자산 3, 디자인/비디자인 슬라이드 87/10.
- 미연결 자산 3건은 분석 슬라이드가 아닌 VIDEO 자산이다. 이들은 카드/표의 디자인 이미지로 대체되지 않는다. 데이터 품질 원 경고 7건에 현재 선택된 도넛 basis 안내 1건을 더해 화면에 8 notices로 보인다.
- 기본 참여율: 단순 평균 1.0583%, 유효 23/24. 별도 가중 계산은 0.3567%, 23개 표본이며 화면 기본 평균과 섞지 않는다.
- 로컬 API GET: HTTP 200, 24 게시물·97 슬라이드, top-level `data`만 반환. raw envelope/source 키는 반환되지 않았다.
- `npm run build`: 성공. 번들에 정적 snapshot 파일을 복사하지 않았다.
- 브라우저 수동 확인: 태그 검색 13개 결과, 무결과 검색 상태, 날짜 범위 갱신 및 전체 기간 복원, 세 탭 전환, 디자인/게시물 상세, Escape 닫기, 원본 링크 속성, 23건 디자인 필터, 24건 복원, 날짜 정렬, 표 내부 스크롤을 확인했다. 원본 링크는 `https`, `instagram.com` 호스트, `target=_blank`, `rel=noopener noreferrer`를 확인했으며 외부 페이지는 열지 않았다.
- 브라우저 콘솔: 오류 0, 경고 0.

## 미완료 범위

네 장식 이미지는 별도 생성 승인이 필요해 만들지 않았다. Excel 기능, 플랫폼 필드 보강, 공유 수, 추가 메뉴, 운영용 API/인증/배포는 STEP 4 이후 결정한다. 상세 차이는 [STEP 3 시각 QA](V4_STEP3_VISUAL_QA.md), 남은 결정은 [STEP 3 미해결 사항](V4_STEP3_OPEN_ISSUES.md)에 적었다.
