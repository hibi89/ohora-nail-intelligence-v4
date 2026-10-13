# OHORA v4 — 지표 정의 및 분모

이 정의는 STEP 2에서 사용자가 승인한 KPI 기준을 코드로 계산한 것이다. 숫자를 상수로 저장하지 않고 정규 JSON 데이터에서 재계산한다. 기본 날짜 필터는 현재 스냅샷의 전체 관측 날짜 범위이며 UI에서 선택한 범위는 양끝 UTC 날짜 포함으로 적용한다.

## KPI

| KPI | 코드 키 | 분자/분모 | 범위·포함/제외 | 현재 스냅샷 값 |
|---|---|---|---|---:|
| Total Analyzed Posts | analyzed-posts | 선택 범위에서 AI 슬라이드가 하나 이상 있는 고유 postId 수. 분모 없음. | 날짜 범위에 속한 게시물만 포함. 슬라이드와 이미지 매칭 실패가 발생해도 AI 결과 게시물 계수와 매칭 계수는 별도 보고한다. | 24 |
| Trending Designs | design-slides | is_design_post === true인 슬라이드 수. 분모 없음. | 슬라이드 단위. 시간적 상승을 뜻하지 않으며 성장률 필드는 null. | 87 |
| Active Colors | active-colors | 디자인 슬라이드 색상 배열에서 고유 color 라벨 수. 분모 없음. | 선택 범위의 디자인 슬라이드만 포함. 색상 미분류 슬라이드는 종류 수에 추가하지 않는다. | 18 |
| Top Tags | top-tags | 고유 (category, tag) 쌍의 수. 분모 없음. | 여섯 차원(color/technique/texture/motif/season/use)을 포함. 같은 문자가 다른 차원에 있으면 서로 다른 태그다. | 58 |

레퍼런스의 Trending Designs KPI 라벨을 유지하더라도 코드 값은 디자인 슬라이드 수다. 87은 상승/성장 건수가 아니다. 비교 delta는 근거 데이터가 있을 때까지 제공하지 않는다.

## 참여율

### 게시물별 값

원천 observation.engagement를 퍼센트 단위로 보존한다. 검증 스냅샷의 유효 게시물 23건 전부에서 다음 공식과 정확히 일치했다.

    perPostEngagementPct = (likes + comments) / followers * 100

followers <= 0, null 또는 비정상 입력은 공식 재계산에서 제외한다. 정규 모델은 원천 참여율과 별도 계산 참여율을 나란히 둔다. 기본 UI/차트는 원천 참여율을 사용하고, 값이 없으면 0으로 대체하지 않는다.

### 기본 평균 — 단순 평균

    simpleMeanPct = sum(valid perPostEngagementPct) / count(valid perPostEngagementPct)

- 게시물마다 동일한 가중치를 부여한다.
- 분모는 유효한 원천 참여율이 있는 게시물 수다.
- 현재 23/24 유효, 기본 평균은 1.0582736731% (표시 반올림은 화면에서 수행).
- ViewModel은 평균, simpleMeanSampleSize=23, simpleMeanEligiblePostCount=24를 함께 반환한다.

### 별도 합산 가중률

    weightedPct = sum(likes + comments) / sum(followers) * 100

- 분모/분자 모두 likes, comments, followers가 유효하고 followers가 양수인 게시물만 포함한다.
- 현재 포함 게시물 23, 총 참여 합계/팔로워 합계 기준 값은 0.3567306525%다.
- 이 값은 단순 평균을 대체하지 않고 별도 필드로 제공한다. followers가 게시 시점 값인지 확인되지 않아 사업상 도달 가중률 등으로 표현하지 않는다.

## 태그·색상 분포

| 집계 | 수식 | 현재 값 | 포함 기준 |
|---|---|---:|---|
| 관측 색상 종류 | 고유 color 라벨의 집합 크기 | 18 | 고유 label, 이미지 단위가 아님 |
| 색상 출현 | 각 슬라이드 색 배열에서 항목 수 합 | 294 | 한 이미지에 여러 색이면 각 라벨을 1회 출현으로 계산 |
| 차원 구분 태그 종류 | 고유 (category, value) 쌍 수 | 58 | 6개 차원 모두 포함 |
| 전체 태그 출현 | 모든 차원의 슬라이드별 배열 길이 합 | 643 | 빈 배열은 출현에 더하지 않지만 커버리지 분모에는 해당 슬라이드를 포함 |

태그 커버리지:

    coverage(category) = 해당 category 배열이 비어 있지 않은 슬라이드 수 / 전체 분석 슬라이드 수

| category | 값 있음 | 분모 | 커버리지 |
|---|---:|---:|---:|
| color | 87 | 97 | 89.69% |
| technique | 51 | 97 | 52.58% |
| texture | 86 | 97 | 88.66% |
| motif | 48 | 97 | 49.48% |
| season | 32 | 97 | 32.99% |
| use | 28 | 97 | 28.87% |

빈 배열은 AI 실패와 같지 않다. 분류 결과의 해당 태그가 없다는 의미로만 보존한다.

## 조합과 대표 디자인

기존 어댑터와 STEP 2 selector가 공유하는 조합 후보 정의:

1. is_design_post === true인 슬라이드만 후보 모집단으로 사용한다.
2. 차원은 color, technique, motif다.
3. 한 슬라이드에서 채워진 차원이 두 개 이상일 때 적격 조합 1건으로 센다.
4. 각 차원에 라벨이 여러 개면 해당 차원 안을 + 기호로 연결한다. 차원 그룹은 가운데 점으로 구분한다.
5. 빈도 내림차순, 표시명 오름차순으로 정렬하고 상위 5개를 카드/도넛 조각으로 선택한다. 대표 사진은 해당 조합의 exact-match 슬라이드 중 가장 작은 인덱스, 동률은 post ID 순으로 고른다.

현재 적격 슬라이드는 73/87, 고유 조합 69개다. 상위 5개 빈도는 3·2·2·1·1이므로 같은 빈도 내 정렬은 화면 순서를 결정하기 위한 규칙일 뿐 통계적 우위가 아니다.

도넛의 현재 명시적 임시 분모:

    combinationDenominator = eligible design slides with >= 2 populated combination categories
    top5Pct = topCombinationCount / combinationDenominator * 100
    othersCount = combinationDenominator - sum(top5 counts)

현재 분모 73, 상위 5개 합계 9(12.33%), Others 64(87.67%)다. 조합 자격 미달 디자인 슬라이드 14개는 도넛 바깥의 unclassifiedDesignSlideCount로 돌려준다. 이 분모는 임시이며 도넛 화면 연결 전에 사용자 승인이 필요하다.

## 날짜 및 Overview 차트

- 모든 타임스탬프는 UTC instant로 정규화한다. 필터 입력은 UTC YYYY-MM-DD, 양 끝 포함이다.
- 전역 기본은 전체 관측 범위(2026-10-01~2026-10-12); Overview 기본은 선택한 전역 범위 안에서 최신 관측 날짜 기준 최대 7일이다.
- 차트는 관측된 날짜 bucket만 만든다. 데이터가 없는 날짜를 0 게시물로 채우지 않는다.
- AI tag mentions는 해당 날짜 게시물에 포함된 분석 슬라이드의 여섯 태그 차원 출현 수다. 원천 mentions 필드와 다르므로 일반 언급량으로 부르지 않는다.
- 날짜별 참여율은 원천 per-post 참여율의 단순 평균이며 유효 게시물 표본 수를 함께 반환한다.
- Color Distribution은 차트용으로 색상 라벨별 출현 수를 제공한다. Tag Coverage는 위 공식으로 각 태그 차원의 적용률을 제공한다.

## 데이터 품질 분모

- 게시물 수, 이미지 자산 수, AI 슬라이드 수는 별도 계수다.
- 슬라이드 매칭 성공은 같은 게시물 내 exact integer index와 안전한 URL 검증을 통과한 결과다. 미매칭 슬라이드는 실패 수에, 분석 결과가 없는 자산은 orphan asset 수에 별도 기록한다.
- likes/comments/engagement 등의 결측률은 missing / total posts이며 null은 0으로 취급하지 않는다.
