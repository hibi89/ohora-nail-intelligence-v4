# OHORA v4 — 장식 이미지 자산 정책

## STEP 4-E/F 적용 상태

기준 레퍼런스에서 사용자가 추출한 네 개의 이미지를 `public/assets/`에 연결했다. 새 이미지를 생성하지 않았고, 분석 데이터에서 게시물 이미지를 장식용으로 재사용하지 않았다.

| UI 슬롯 | 제공된 원본 | 원본 크기 | 연결 자산 | 목표 영역 |
|---|---|---:|---|---:|
| Hero Banner | `e04-hero-banner.PNG` | 977×166 | `e04-hero-banner.png` | 965×154 |
| Sidebar Story | `e03-every-nail-tells-a-story.PNG` | 215×398 | `e03-every-nail-tells-a-story.png` | 192×385 |
| Today's Insight | `e01-todays-insight.PNG` | 431×167 | `e01-todays-insight-photo.png` | 우측 약 155×152 |
| Signature Combinations | `e02-signature-combinations.PNG` | 143×221 | `e02-signature-combinations.png` | 126×204 |

Today's Insight 파생 이미지는 원본의 `(left:284, top:7, width:147, height:152)` 영역만 잘라 만들었다. 원본 왼쪽에는 목업의 “2.3×” 참여율 문구가 있으므로 해당 파일은 `public/`에 복사하지 않았다. 파생 파일은 네일 사진과 그림으로 된 화살표만 포함하며, 화면의 인사이트 문구와 수치는 기존 React 데이터에서 계속 계산한다.

이미지에 이미 포함된 문구를 중복 출력하지 않는다. Hero의 브랜드/타이틀/슬로건, Sidebar Story의 카피, Signature 카드의 제목은 각 이미지가 담당한다. Insight는 사진만 사용하고 기존 동적 제목과 조합 내용을 표시한다. 각 슬롯은 `decorative-reference`, `ready`로 표시된다.

## 저장 위치와 타입 경계

```text
public/assets/
  e01-todays-insight-photo.png
  e02-signature-combinations.png
  e03-every-nail-tells-a-story.png
  e04-hero-banner.png
```

`src/config/decorativeAssets.js`가 네 파일, 대체 텍스트, 목표 영역, 완료 상태를 선언한다. `decorative-reference`는 화면 표현에만 쓰이며 게시물, AI 슬라이드, KPI, 검색/필터, 차트, Excel 시트에 포함되지 않는다. `analysis-source`는 별도 타입으로 유지해 실제 분석 이미지만 게시물 UI와 데이터 연결에 사용한다.

CSS는 각 슬롯의 고정 비율에 맞춰 `object-fit: cover`를 사용한다. e01은 원본 이미지 147×152에서 Insight 슬롯 안에 약 155×152로 표시되어 6% 미만만 확대된다. 다른 세 이미지는 원본 크기와 슬롯 비율 차이가 작아 프레이밍을 크게 확대하지 않는다.

## 검수 상태

- 네 연결 이미지 모두 1672×941 화면에서 로드됐다.
- e04, e03, e02의 원본 내 정적 문구와 React 텍스트를 중복 출력하지 않는다.
- e01 목업의 가상 `2.3×` 값은 화면 텍스트에 나타나지 않는다.
- 1672×941 데스크톱과 390×844 반응형 레이아웃에서 이미지를 확인했다.
- 최신 캡처와 회귀 결과는 [STEP 4-E/F 시각 QA](V4_STEP4EF_VISUAL_QA.md)에 기록한다.
