# OHORA v3 JSON → v4 UI 데이터 매핑 초안

> 이 파일은 STEP 0의 사전 초안이다. 실제 STEP 1 관측 수치와 데이터 계약은 `V4_DATA_AUDIT.md` / `V4_DATA_CONTRACT.md`를, 승인된 KPI 정의와 현재 selector 계약은 `V4_METRIC_DEFINITIONS.md`를 따른다.

## 근거와 한계

**확인한 근거:** `E:\dashboard2\src\ohoraData.js`, `server\ohora-api.js`, `docs\N8N_API_INTEGRATION.md`, 킥오프의 데이터 계약과 README를 읽었다. `dashboard2`의 지정 파일들은 이 단계에서 읽기만 했다. 기존 연동 문서는 2026-10-13 재시작 검증 시점에 `OHORA_V3_DATA_FIRST`, 게시물 24개, 이미지 97개, AI 게시물 성공 24/24, 디자인 23/비디자인 1이라고 기록한다. 캐시 `updatedAt`은 문서상 2026-10-12 12:14:38 UTC다. 이 수치는 당시 응답에 대한 문서 기록이며 현재 데이터 확인값이 아니다.

**아직 검증하지 않음:** STEP 0에서는 n8n API를 호출하지 않았고 실제 캐시 JSON 원문도 열지 않았다. API 키 파일을 열거나 키를 복사하지 않았다. 따라서 필드의 전체 타입/분포/누락률, ID 중복, 슬라이드 인덱스 일치율, 오늘 시점의 건수는 미확정이다.

## 읽기 전용 API 경로와 응답 봉투

기존 프록시가 코드에서 처리하는 브라우저 경로는 `GET /api/ohora-analysis`다. 기존 코드의 성공 응답 형태는 다음과 같다.

```text
{
  data: {
    source: { tableName, tableId, cacheKey, updatedAt, rowCount },
    analysis: { ...OHORA_V3_DATA_FIRST JSON... },
    fetchedAt
  },
  cache: { stale, cached },
  warning?: { code, message }
}
```

오류 응답은 `{ error: { code, message } }` 형태다. API는 n8n 워크플로를 실행하지 않고 특정 Data Table의 메타데이터/행을 GET으로 읽어 캐시 행의 `html`을 파싱한다. 현재 프록시 코드에는 HTTPS 호스트·테이블 ID·테이블 이름 확인, cache key 필터, 최대 10페이지(페이지당 최대 100행), 12초 timeout, 성공 응답 60초 캐시, 마지막 성공값 15분 stale fallback이 있다. 새 프로젝트의 실제 호스팅에서 같은 동작이 자동으로 제공된다고 가정하지 않는다.

## 필드별 초안

| v4 화면/모델 | 기존 JSON/어댑터 경로 | 현재 코드에서 확인한 처리 | 남은 검증·결정 |
|---|---|---|---|
| 원본 분석 | `response.data.analysis` | `buildOhoraDashboard(analysis, source)`가 분석 객체를 받음 | 응답 봉투와 오류/stale 응답을 실제 호출 전에 fixture 또는 승인된 응답으로 검증 |
| 스키마 버전 | `analysis.schema_version` | 문자열이면 `schemaVersion`, 예상 값은 `OHORA_V3_DATA_FIRST` | 지원 버전, 호환 정책, 중단 기준 확정 |
| 생성·갱신 시각 | `analysis.generated_at`, `source.updatedAt` | `generatedAt`, `updatedAt`, 관찰 timestamp 기반 날짜 범위 | UTC/로컬 표시 규칙, 데이터 신선도 배지 규칙 |
| 분석 게시물 | `analysis.observations[]` | 배열을 게시물로 취급하며 길이를 `postCount`로 사용 | 고유 게시물 식별자 경로와 중복 제거 규칙; 현재 길이 카운트는 중복 검증 전 |
| 게시물 ID | `observation.id` 우선, 없으면 permalink 또는 배열 위치 | 이미지 key 및 table row key 생성 시 `id || permalink || index` | 비어 있는 ID, 동일 permalink, index 불안정에 대비한 canonical key 확정 |
| 게시물 링크 | `observation.permalink` | `instagram.com` 또는 하위 도메인의 HTTP(S)만 통과 | 다른 출처를 허용할지, 원문이 공개 가능한지 확인 |
| 게시물 시각 | `observation.timestamp` | 문자열 중 parse 가능한 값을 날짜 범위에 반영 | ISO 형식, 시간대, 날짜 필터 끝점 포함 여부 |
| 반응 지표 | `likes`, `comments`, `engagement` | 유한 숫자만 사용, 누락값은 `null`, 평균은 값이 존재하는 항목만 대상으로 별도 분모 유지 | `engagement`가 수/비율/정의된 점수 중 무엇인지 확인; `followers` 기준의 산식과 시점도 미확정 |
| 이미지 수 | `observation.image_count`; top-level `totalImageCount` | top-level 값을 우선, 없으면 게시물 `image_count` 합산 | 애셋 수·슬라이드 수·이미지 수의 차이와 중복 정책 |
| 이미지 애셋 | `observation.image_assets[]` | 슬라이드 결과의 URL을 보충하는 용도로 사용 | 애셋의 타입/URL 가용기간/원본 순서 필드 확인 |
| AI 슬라이드 | `observation.ai.slides[]`, 없으면 `observation.slides[]` | AI slides가 비어 있지 않으면 우선 사용 | 양쪽 배열 동시 존재·부분 결과·빈 배열의 의미 확정 |
| 슬라이드 키·사진 | `slide.index`, `asset.index`, `slide.image_url`, `asset.image_url` | 숫자로 같은 index의 asset을 먼저 찾고 없으면 같은 배열 위치 asset을 사용; slide URL을 우선 | 배열 위치 대체 매칭은 사진 오연결 위험. v4는 정확한 index 매칭을 우선하고 불일치는 명시적 미매칭/품질 경고로 남기는 방안 제안 |
| 슬라이드 분류 | `slide.is_design_post`, fallback `observation.ai.is_design_post` | 불리언만 분류에 사용 | post-level 분류와 image-level 분류 불일치 시 표시·집계 원칙 |
| 이미지 태그 | 슬라이드 `color`, `technique`, `texture`, `motif`, `season`, `use` | 문자열은 `|`, 쉼표, `，`, `、` 구분, 배열은 재귀 평탄화/중복 제거 | 실제 타입/태그 구분자, 다국어 동의어·대소문자·한글 표기 정규화 확정 |
| 태그 분포 | 각 이미지 결과의 태그 필드 | 태그 **출현 횟수** 내림차순. 이미지 하나의 서로 다른 값은 각 1회씩 센다 | KPI `Active Colors`는 고유 색 라벨 수인지 이미지 출현수인지 결정. 고유 라벨과 총 출현수를 분리 표기하는 방안 |
| 조합 | 이미지의 `color + technique + motif` | 세 그룹 중 2개 이상이 채워져야 조합 생성, 각 그룹 내부 태그를 ` + `로 합치고 상위 6개 반환 | 정렬 안정성, 그룹 조합 정의, 2개 그룹만 있는 이미지, 기타(Other) 분모와 퍼센트 합계 정의 |
| 성공·품질 | `aiSuccessCount`, `aiTotalCount`, `analyzedSlideCount`, `aiWarnings`, `problems`, `accountsAttempted`, `demo` | 상위 집계 값이 숫자면 fallback 계산보다 우선하는 기존 어댑터 경로 확인 | `demo`가 참일 때 실데이터 화면 진입 차단, 성공/전체의 집계 기준, 오류 상세 노출 범위 |
| 캡션·플랫폼 | 초안 문서에는 `caption` 언급이 있으나 기존 어댑터 출력에서 렌더되지 않음. 플랫폼 경로는 어댑터에서 읽지 않음 | 표 screenshot에는 플랫폼 아이콘과 Caption/Keywords가 있음 | 실제 JSON의 필드명/유무를 확인하기 전에는 임의 플랫폼, 캡션, TikTok 로고를 표시하지 않음 |

## v4 화면 매핑 제안

| 화면 요소 | 데이터 규칙 초안 | 표시 시 주의 |
|---|---|---|
| Total Analyzed Posts | 중복 규칙을 확정한 `observations` 고유 게시물 수 | 과거 값 24를 상수로 넣지 않음 |
| Trending Designs | 슬라이드별 디자인 분류와 관측수로 선정 가능한 후보 | 기간 내 증가량이 없으면 “Trending”은 사실과 다를 수 있음. 관측 빈도 기반 “Observed Designs”로 바꾸거나 실제 기간 비교를 계산 |
| Active Colors | `color` 고유 라벨 수 또는 관측수 | 라벨 수와 총 태그 출현 횟수 중 하나를 명시 |
| Top Tags | `technique/texture/motif/season/use` 분포 | color를 포함할지, 중복 라벨을 합칠지 제품 계약에서 확정 |
| Today's Insight | 태그/조합별 관측 및 연결된 게시물 반응 요약 | 연관 표본 수를 함께 표시. 관측 상관을 인과나 경쟁사 비교처럼 표현하지 않음. 유효값 부족 시 정직한 안내문 |
| 디자인 카드 5개 | 정확히 매칭된 슬라이드 이미지, 태그, `permalink`, 선택적으로 해당 게시물 반응 | 임의 이름/좋아요·URL 생성 금지. 태그 라벨을 제목으로 쓰거나 승인된 규칙으로 제목 생성 |
| 조합 도넛 | 슬라이드별 조합 count와 명시된 분모 | 상위 조합 + 기타의 분모가 전체인지 유효 조합 이미지인지 표시하고 합계 검증 |
| 분석 게시물 표 | 게시물 단위 행과 연결된 썸네일/슬라이드, 캡션·색·태그 | 반응 필드 null은 0으로 출력하지 않음. 스크린샷의 여러 플랫폼은 JSON에서 확인될 때만 표시 |
| 분석 차트 | 유효 timestamp로 날짜 버킷을 만들고 관측 게시물/정의된 반응을 합산 | 수집되지 않은 날짜에 0을 만들지 않음. 기간 필터는 실제 범위 내 적용 |
| 날짜/검색/필터 | timestamp, 확인된 캡션/태그/분류 및 분류된 모델 | 원본에서 없는 플랫폼이나 설명 텍스트를 검색 대상으로 약속하지 않음 |
| Excel 5시트 | 같은 정규화 모델에서 디자인 인사이트, 게시물, 이미지, 캐러셀, 품질 데이터 생성 | 각 시트에 집계 분모와 null 설명 포함. 데이터 화면과 엑셀 수치 일치 |

## 지표 해석·안전 규칙

1. `null`/필드 부재와 숫자 0을 분리한다. 값이 없는 likes/comments/engagement는 평균 분모에서 제외하고 UI에서도 “정보 없음”으로 표기한다.
2. 고유 게시물 수, 실제 asset 수, AI 분석 슬라이드 수는 서로 다른 계수다. 한 KPI로 합치지 않는다.
3. 게시물과 슬라이드는 안정 식별자 `(post canonical ID, slide.index)`로 연결한다. 단순 배열 순서 fallback은 기본 사용하지 않는다. index가 누락·중복되면 연결하지 않고 데이터 품질 상태를 표시한다.
4. `Trending`, 전주 대비 증감, 참여율, “2.3배” 같은 비교 표현은 기간 경계·분모·누락·표본 수가 확정되고 해당 창 데이터가 있을 때만 쓴다. 그렇지 않으면 변화 영역을 숨기거나 관측 건수로 표현한다.
5. 현재 어댑터는 `image_assets`의 태그를 직접 읽지 않고 AI 슬라이드 태그를 사용한다. v4에서 태그가 빠졌을 때 asset 태그로 대체 가능한지 JSON을 확인한 뒤 계약한다.
6. 브라우저는 same-origin API만 호출하고, n8n 자격 증명은 서버 환경 변수에만 둔다. 캐시된 분석 JSON에 공개해도 되는 captions, 사진 URL, Instagram 링크가 들어 있는지 배포 범위 결정을 먼저 한다.

## STEP 1에서 확정할 질문

- 최신 실제 응답에서 `schema_version`, 타입, 고유 ID와 인덱스가 코드 기대와 일치하는가?
- `caption`, platform, `followers`, image URL, `visual_evidence`의 실제 JSON 위치와 누락률은 무엇인가?
- `engagement`의 단위/산식은 무엇인가? `likes/comments`와 서로 어떤 관계인가?
- “Trending Designs” 및 4개 KPI의 제품 정의/기간은 무엇인가? 기간 비교에 필요한 과거 자료가 충분한가?
- 이미지와 캡션을 웹에서 어떤 사용자 범위까지 공개할 수 있는가? 만료/접근 제한 시 대체는 무엇인가?
- `/api/ohora-analysis`의 2026-10-20 키 만료 이후 자격 증명을 누가 어떤 승인 절차로 갱신할 것인가?
