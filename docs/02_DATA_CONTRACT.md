# 실제 데이터 ↔ UI 계약 초안 (JSON 파일 검증 후 확정)

## 확인된 기존 방식(낮 실습 Codex 보고 기반)
- n8n v3 분석 결과 스키마: `OHORA_V3_DATA_FIRST`; 기존 읽기 전용 프록시: `GET /api/ohora-analysis`.
- 원본 분석 결과 저장: 테이블 `이해인_OHORA_dashboard_cache`, cache key `ohora_analysis_v3_json`, 열 `html`의 JSON 문자열.
- 과거 보고 수치: posts 24, images 97, AI posts 24/24, 디자인 게시물 23 / 비디자인 1; 실제 v4 실행에서 최신 조회를 다시 검증할 것.
- 예상 경로: `observations[]`, `image_assets[]`, `ai.slides[]`, `ai.color[]/technique[]/texture[]/motif[]`, `visual_evidence`, `timestamp`, `caption`, `permalink`, `likes`, `comments`, `followers`.
- 실제 키 구조와 타입은 단정하지 말고 낮 실습의 `src/ohoraData.js`, 서버 구현, 운영 응답 검증에서 확정.

| UI | 기본 데이터 | 규칙/미결정 |
|---|---|---|
| Total Analyzed Posts | observations 고유 ID 수 | 24 예상. 조회 결과 기준 |
| Trending Designs | 동일 이미지 내 대표 조합 | '트렌딩'은 시계열 상승 의미이므로 근거 부족 시 '관측된 조합'으로 제목 바꿀지 검토 |
| Active Colors | 이미지별 color 태그 | 고유값 수 (294개의 태그 출현 수와 구분) |
| Top Tags | image 별 technique, texture, motif 등 | 고유 라벨 수, 컬러 중복 포함 정책 미확정 |
| Today's Insight | 대표 조합의 관측수와 반응 | 경쟁사 대비, 2.3배, 기간증감은 측정 없으면 주장 금지 |
| Trending cards x5 | image_assets + 정확히 동일 index의 ai.slides | 사진과 AI 태그 오연결 금지; 별도 display name 가능 |
| Combination Donut | 이미지별 대표 조합 | 전체에서 중복 없는 분모. 100% 합계/Other 처리 |
| Analyzed Posts | post-level observations + 이미지 갤러리 | 없는 likes/comments를 0으로 치환하지 않음 |
| Analysis Overview 3탭 | 날짜별 posts/observed engagement, 컬러, 태그 | 수집된 날짜까지만; 임의 7일 가짜 추세 금지 |
| Excel | 동일 canonical/derived model | 5개 시트: 디자인인사이트, 게시물분석, 이미지분석, 캐러셀분석, 분석품질 |

## 개발 계약
1. `server` fetch는 n8n API 키를 받는 서버 전용 로직으로 한정. 브라우저에는 same-origin GET JSON만.
2. `normalizeRawV3`는 데이터 검증/정규화, `buildDashboardView`는 순수 통계 계산, React 컴포넌트는 렌더링만.
3. 실데이터 없으면 경고/재시도/빈 상태, 가짜 수치로 fallback 금지.
4. 슬라이드 매칭은 (post_id, image_index)를 조합한 안정 ID. JSON 출력에서 확인한 인덱스 기반 처리.
5. SNAPSHOT은 비밀값 제거 후 `data/private/`(Git ignore)에 두고, 공개 정적 번들에 무단 포함 금지.
6. 공개 Vercel 배포 시 서버리스 프록시와 공개 가능 데이터 범위를 따로 검증.
