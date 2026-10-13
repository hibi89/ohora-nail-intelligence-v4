# OHORA v4 — STEP 2 검증 결과

## 실행 범위

- 입력: data/private/step1-response.json만 사용.
- 검증 코드: src/data/ohoraSchema.js, src/data/normalizeOhoraV3.js, src/data/selectors.js.
- 네트워크 요청, 기존 서버/프로젝트 실행, API 키 조회, n8n 수정, UI 구현, 이미지 생성 및 배포는 없었다.
- 원본 데이터 행은 테스트 출력/문서/로그로 내보내지 않았다. Git ignore 규칙이 private JSON을 제외함을 확인했다.

## 자동 검증

npm test
7 tests passed, 0 failed, 0 skipped

    npm run verify:step2
    status: pass

테스트는 exact index 매칭이 없을 때 배열 위치로 보충하지 않는지, duplicate index와 URL 충돌을 오류로 보고하는지, duplicate post ID가 연관을 막는지, 참여율 평균/가중 기준이 분리되는지, 장식/분석 이미지 타입이 분리되는지, 실제 private snapshot에서 승인 KPI와 분모가 재현되는지 확인한다.

## 실제 스냅샷 결과

| 확인값 | 결과 |
|---|---:|
| 지원 schema | OHORA_V3_DATA_FIRST |
| 게시물 / 고유 ID | 24 / 24 |
| AI 분석 게시물 | 24 |
| 슬라이드 | 97 |
| 이미지 자산 | 100 |
| exact-index/URL 매칭 성공 | 97 |
| 슬라이드 매칭 실패 | 0 |
| 분석 결과 없는 자산 | 3 |
| 디자인 / 비디자인 슬라이드 | 87 / 10 |
| 분석 게시물 KPI | 24 |
| 디자인 슬라이드 KPI | 87 |
| 관측 색상 KPI | 18 |
| 카테고리 구분 태그 KPI | 58 |
| 기본 참여율 단순 평균 | 1.0582736731%, 유효 23/24 |
| 별도 가중 참여율 | 0.3567306525%, 유효 23/24 |
| 기본 전역 기간 | 2026-10-01~2026-10-12 UTC |
| 기본 Overview 기간 | 2026-10-06~2026-10-12 UTC, 게시물 17건 |
| 상위 조합 도넛 임시 분모 | 73 적격 디자인 슬라이드, 합계 비율 100% |

기존 API 집계 aiSuccessCount, aiTotalCount, totalImageCount, analyzedSlideCount는 정규화된 관측/슬라이드와 각각 일치했다. 데이터 품질 warning 7종은 미분석 자산 3, 게시물/슬라이드 혼합 분류 2건, 결측 반응값, 명시적 플랫폼 부재, 공유 수 필드 부재, 한 게시물의 image_count와 자산 수 차이, 기간 커버리지 메타데이터 부재를 포함한다. 정규화 error는 0건, ViewModel 상태는 비차단 warning 7종으로 degraded다. 카테고리별 빈 배열은 각 tagCoverage로 별도 반환한다.

## 보안·무결성 점검

- git check-ignore -v data/private/step1-response.json 결과 .gitignore의 data/private/ 규칙이 적용된다.
- 검증 스크립트는 오류 객체/원본 ID/캡션/URL을 출력하지 않는다. 요약 필드만 출력한다.
- API 인증 정보는 읽지 않았으며 코드·문서에 추가하지 않았다.
- asset 매칭은 exact post ID + index 경로뿐이다. URL 충돌/중복 인덱스는 error가 되고 어떤 경우에도 배열 위치 fallback을 타지 않는다.

## 제한 및 다음 단계

- 테스트는 로컬 snapshot을 사용했으며 새 API 서버/프록시와 브라우저 이미지 URL 접근을 검증하지 않았다.
- JSDoc/런타임 validator를 적용했고 TypeScript compiler 기반 정적 검사는 추가하지 않았다.
- 도넛 분모는 ViewModel에 명시된 임시 규칙이다. 화면에 연결하기 전 승인해야 한다.
- 인사이트는 문구를 생성하지 않고 사실 후보만 반환한다. 문구 승인, 플랫폼 호스트 파생, shares 제거, 화면 시간대, Excel 컬럼 정책은 남은 제품 결정이다.
- 이 데이터 계층은 STEP 3 UI가 사용할 수 있다. 실제 데이터/API 경로를 화면에서 연결하는 작업은 별도 승인 단계다.
