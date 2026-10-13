# OHORA v4 — STEP 1 데이터 계약 초안

## 1. 입력 응답과 근거 범위

분석 입력은 로컬 프록시 응답의 `data.analysis` 객체다. 실제 스냅샷 봉투는 다음 구조를 가진다(값과 민감한 식별자는 생략).

```text
response
├─ data
│  ├─ source
│  │  └─ updatedAt
│  ├─ analysis
│  │  ├─ schema_version / generated_at / analysis_model
│  │  ├─ observations[]
│  │  ├─ aiSuccessCount / aiTotalCount
│  │  └─ analyzedSlideCount / totalImageCount
│  └─ fetchedAt
└─ cache: { stale: boolean, cached: boolean }
```

검증 스냅샷은 `schema_version=OHORA_V3_DATA_FIRST`, `generated_at=2026-10-12T12:14:26.977Z`, `source.updatedAt=2026-10-12T12:14:38.246Z`이고, 캐시 플래그는 `stale=false`, `cached=false`다. 이 스키마명은 이번 파일에서 관측된 값이지 앞으로의 모든 응답에 대한 버전 호환 보장은 아니다. 알 수 없는 필드와 추가 필드는 보존하거나 무시할 수 있어야 한다.

## 2. 정규화 엔터티

### 게시물 (`Post`)

| 정규 필드 | 원천 경로 | 검증된 타입/규칙 | 계약 메모 |
|---|---|---|---|
| `postId` | `observations[].id` | 문자열, 24/24 고유 | 기본 키. 문자열로 정규화하되 원문 값을 문서·로그에 쓰지 않는다. |
| `caption` | `observations[].caption` | 문자열 24/24 | 검색 입력 후보. 공개 로그에 남기지 않는다. |
| `timestamp` | `observations[].timestamp` | ISO 형식 문자열 24/24 파싱 가능 | 내부 비교는 UTC 순간값. UI 표시 시간대와 경계 포함 규칙은 미결정. |
| `permalink` | `observations[].permalink` | URL 24/24, 관측 호스트 Instagram | 안전한 HTTP(S) 링크만 허용. URL 호스트를 플랫폼 명시 필드로 간주하지 않는다. |
| `mediaType` | `observations[].media_type` | 응답에 존재 | 게시물/자산 미디어 타입 의미가 다를 수 있어 그대로 별도 저장한다. |
| `imageCount` | `observations[].image_count` | 정수로 관측 | 이번 스냅샷에서는 AI 슬라이드 수와 일치. 전체 자산 수로 대체하지 않는다. |
| `isCarousel` | `observations[].is_carousel` | 불리언, 24/24 | 자산 2개 이상 여부와 일치했다. |
| `postIsDesign` | `observations[].ai.is_design_post` | 불리언, 24/24 | 캐러셀 내 슬라이드의 디자인 여부를 대표한다고 가정하지 않는다. |
| `likes`, `comments`, `followers` | 동일 이름의 게시물 필드 | 정수. 각각 23/24, 24/24, 24/24 유효 | 결측은 `null` 유지. 0으로 대체하지 않는다. |
| `engagementRatePct` | `observations[].engagement` | 실수 23/24 유효 | `(likes+comments)/followers*100`으로 23/23 일치. 단위는 현재 스냅샷에서 퍼센트. 원본과 재계산 값은 분리한다. |
| `platform`, `shares` | 해당 필드 없음 | 24/24 미제공 | 만들거나 추정하지 않는다. 허용 목록 기반 호스트 파생은 별도 제품 결정. |

### 미디어 자산 (`Asset`)과 AI 슬라이드 (`SlideAnalysis`)

| 정규 필드 | 원천 경로 | 규칙 |
|---|---|---|
| `assetId` | `observations[].image_assets[].id` | 100/100 존재하고 스냅샷 내 고유. 슬라이드 결과에는 이 ID가 없다. |
| `parentPostId` | 자산이 포함된 `observations[].id` | 자산에 별도 게시물 ID 필드가 없으므로 부모 중첩으로 설정한다. |
| `assetIndex` | `image_assets[].index` | 정수. 게시물 내 고유하고 오름차순. 원본 자산의 순서를 보존한다. |
| `assetMediaType` | `image_assets[].media_type` | 문자열. 총 80 `IMAGE`, 20 `VIDEO`. |
| `assetUrl` | `image_assets[].image_url` | URL 원문은 비공개 취급. 허용 프로토콜 검증 후 사용한다. HTTP 요청 성공 여부는 이 감사에서 검증하지 않았다. |
| `slideIndex` | `ai.slides[].index` | 정수. 게시물 내 고유하고 오름차순. |
| `slideUrl` | `ai.slides[].image_url` | 현재 97개 모두 정확 인덱스 자산 URL과 일치한다. |
| `isDesignSlide` | `ai.slides[].is_design_post` | 불리언 97/97. 게시물 분류와 별도로 보존한다. |
| `color[]`, `technique[]`, `texture[]`, `motif[]`, `season[]`, `use[]` | `ai.slides[]`의 동일 필드 | 97/97 배열 타입. 빈 배열은 미분류/미추출 상태로 유지한다. |
| `visualEvidence` | `ai.slides[].visual_evidence` | 비어 있지 않은 객체 97/97. 설명/검증용으로 유지한다. |

### 식별과 연결 규칙

1. 게시물 기본 키는 `postId`다. 분석 슬라이드 기본 키는 복합키 `(postId, slideIndex)`이며, 현재 97/97 유일하다.
2. 자산과 슬라이드는 같은 게시물 안에서만 `(postId, index)`로 결합한다. 연결 후 URL도 대조한다.
3. 정확 인덱스 매치가 없으면 배열 위치 fallback으로 붙이지 않는다. 슬라이드를 미연결로 남기고 품질 오류를 기록한다.
4. AI 슬라이드가 없는 자산 3개를 슬라이드로 변환하거나 앞뒤 사진의 결과로 채우지 않는다. 원시 자산 100개와 분석 결과 97개를 별도 계수한다.
5. 순서는 `index` 오름차순으로 보존한다. 인덱스 중복은 자동 중복 제거하지 않고 품질 오류로 처리한다.

## 3. 관측된 집계 의미

| 원천 필드 | 스냅샷 값 | 의미/주의 |
|---|---:|---|
| `aiSuccessCount` / `aiTotalCount` | 24 / 24 | 게시물 수준 집계로 보존. 슬라이드 성공 수와 동일한 지표가 아니다. |
| `totalImageCount` | 97 | 이 스냅샷에서는 `image_count` 합 및 분석 슬라이드 수와 일치. 자산 배열 수 100과는 다르다. |
| `analyzedSlideCount` | 97 | 실제 `ai.slides` 항목 수 97과 일치. |
| `is_design_post` (post) | 23 true, 1 false | 게시물 분류. 혼합 슬라이드 2개 게시물 확인. |
| `is_design_post` (slide) | 87 true, 10 false | 개별 이미지 수준 분류. 디자인 트렌드 카드 후보의 적합한 단위. |
| `engagement` | 유효 23, 결측 1 | 퍼센트. 게시물별 원본값과 집계값을 구별한다. 단순 평균은 유효 행 동일 가중, 가중률은 총 반응/총 팔로워로 별도 계산한다. |

태그 집계 시 배열 안 중복은 현재 0건이다. 그래도 일관된 카운팅을 위해 슬라이드-태그 단위 중복 제거 규칙을 명시한다. 한 슬라이드에 여러 색상/태그가 있으면 각 항목에 1회씩 출현으로 센다. 빈 배열은 분모에서 삭제하지 않고 커버리지 분모(분석 슬라이드 수)에 포함한다.

## 4. 캐시·오류·관측 시점

- 응답 `cache.stale=true`라면 “마지막 갱신 시각”을 구분해 표시하고 최신 데이터로 오인시키지 않는다. 현재 파일은 `false`다.
- `schema_version`을 확인하고, 지원하지 않는 형식/잘못된 배열은 오류 상태로 처리한다. 실패 값을 0이나 빈 인사이트로 조용히 바꾸지 않는다.
- `generated_at`, `source.updatedAt`, `fetchedAt`은 다른 시점 정보이므로 서로 대체하지 않는다.
- 현재 날짜 범위는 12일뿐이다. 전 기간 비교 KPI는 이전 창의 수집 범위가 확인되기 전 비활성/비표시로 둔다.
- 이 파일에는 계정 인증정보가 없고 키를 조회하지 않았다. `data/private/` 원본은 Git, 로그, 문서, 다운로드에 포함하지 않는다.
