# OHORA Nail Intelligence v4 — STEP 3 미해결 사항

## STEP 3에서 확정해 구현한 표현

- 날짜는 Asia/Seoul 달력 날짜로 표시·필터하고, 첫 로딩은 전체 관측 기간이다. Overview를 별도 최근 7일로 두지 않는다.
- 다섯 디자인 카드는 `Most Observed Designs` 빈도 순위이며 성장률/시장 인기도를 뜻하지 않는다. 조합 동률은 라벨 알파벳/문자 순으로 정렬한다.
- 조합 도넛은 조건을 만족한 73개 디자인 슬라이드를 분모로 한다. top 5는 9/73 = 12.3%, 나머지는 64/73 = 87.7%다. 조합 차원 부족 디자인 슬라이드 14/87은 패널 주석에 알린다.
- Today's Insight는 선택 범위 최다 조합과 `count / eligible design slides`만 표시한다. 비교·인과·성장·매출 문구는 없다.
- 검색은 캡션과 여섯 AI 태그 차원에 적용한다. 지표, 표, 차트, 카드에 동일한 검색/기간 filter를 적용한다. 표의 `Design posts only`/`Matched thumbnail available`은 표 내부 표시 filter다.
- 명시 플랫폼 필드가 없어 `—`를 쓴다. Shares는 컬럼과 수치를 만들지 않는다.
- 장식 사진은 분석 사진과 분리된 네 개 생성 슬롯으로 연결했으며, 생성은 대기 상태다.

## 제품/데이터 판단이 남은 항목

### 1. 게시물 판정과 혼합 캐러셀 필터

표의 `Design posts only`는 원본 게시물 수준 `is_design_post`를 사용한다. 실제 데이터에는 게시물 판정과 다른 결과가 섞인 디자인/비디자인 슬라이드가 두 게시물 존재한다. 현재 UI는 게시물 단위 분류를 보존하며 “디자인 슬라이드가 하나 이상 포함된 게시물” 기준으로 재해석하지 않는다. 사용자가 표 필터 의미를 변경하려면 STEP 4에서 결정해야 한다.

### 2. Insight 최소 표본 기준

현재 insight는 선택된 범위의 최다 조합을 표시하며 count와 분모를 함께 보인다. 매우 좁은 기간에서도 후보가 존재하면 표시할 수 있다. 업무용 insight 최소 표본 수를 요구하는지 미정이며, 정할 경우 그 미만은 빈 상태/기간 확대 제안으로 바꿀 수 있다.

### 3. 이미지 권리·가용성

- 생성할 장식 자산: `ohora-v4-hero-banner-wide-v1.webp` (965×154), `ohora-v4-sidebar-story-portrait-v1.webp` (192×385), `ohora-v4-today-insight-wide-v1.webp` (422×154), `ohora-v4-signature-combinations-portrait-v1.webp` (126×204).
- 모두 `pending-generation`이다. 실제 OHORA 상표/제품 재현이나 이미지 생성은 별도 승인이 필요하다.
- 분석 원본 이미지 URL은 브라우저가 직접 요청한다. 현재 QA에서 실제 이미지 한 건은 로드됐지만 CDN URL 만료·네트워크 제한·장기 hotlink 권리/운영 보장은 확인하지 않았다. 필요하면 허용된 로컬 캐시 정책을 정해야 한다.
- 원본 폰트 파일/정확한 폰트명도 없다. 외부 font CDN을 연결하지 않았다.

### 4. 정적 UI 표현 한계

`Social Monitoring`과 `Saved Collections`는 `SOON` 비활성 메뉴다. 프로필·알림은 로컬 snapshot 안내만 제공한다. Excel Download는 STEP 4 승인 전까지 비활성이다. 화면상 기능이 있는 것처럼 표시하지 않는다.

## STEP 4 전에 정해야 할 내용

- Excel 파일 범위: 시트·행 단위·컬럼·날짜/검색 적용·null 표기·캡션/URL 포함·파일 보존 정책.
- 표에서 게시물 수준 디자인 판정과 혼합 슬라이드 필터를 어떻게 설명하거나 분리할지.
- Engagement 외부 노출/내보내기 및 follower count·원본 링크의 허용 범위.
- 플랫폼을 데이터 원천에 추가할지, 현재처럼 빈 값으로 둘지. 현재 permalink host 기반 후보는 배지로 표시하지 않는다.
- 운영 환경에서 사용할 서버 API, 인증/권한, 캐시/갱신 정책, 호스팅 경계를 새로 설계하고 별도 승인받는다. V4 개발 endpoint는 `npm run dev`에서만 켜지고 `npm run preview`/정적 build에서 동작하지 않는다.

STEP 4, 이미지 생성, 외부 배포는 이번 작업에서 시작하지 않았다. 이 문서는 구현 결과를 검토할 수 있도록 남긴 판단 목록이며, 아직 요청자 승인이 필요한 기능을 승인으로 간주하지 않는다.
