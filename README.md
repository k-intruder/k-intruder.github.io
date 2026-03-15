# 교수설계가이드 작성 툴 – 파일 구조

## 📁 폴더 구조

```
guide-tool/
│
├── index.html                  ← 🏠 진입점 (인터페이스 HTML)
│
├── css/
│   └── style.css               ← 🎨 전체 스타일 (반응형 포함)
│
├── template/
│   └── preview.hbs.html        ← 👁️ 실시간 미리보기 Handlebars 템플릿
│
├── js/
│   ├── state.js                ← 📦 공유 상태 (window.AppState)
│   ├── helpers.js              ← 🔧 Handlebars 헬퍼 + 템플릿 컴파일
│   ├── collect.js              ← 📥 DOM → JSON 데이터 수집
│   ├── preview.js              ← 👁️ ★ 실시간 미리보기 렌더링
│   ├── storage.js              ← 💾 LocalStorage + Toast 알림
│   ├── tabs.js                 ← 📑 탭 내비게이션 + 필드 복원
│   ├── form-fields.js          ← 🏗️ 입력 필드 & 배열 항목 생성
│   ├── tab-builders.js         ← 🏗️ buildTab0~6 탭 콘텐츠 빌더
│   ├── export.js               ← 📤 PDF / HTML / DOCX 내보내기
│   └── app.js                  ← 🚀 초기화 + 이벤트 + 모바일 + JSON I/O
│
└── template.json               ← 📋 예시 데이터 (JSON 불러오기 테스트용)
```

## 🚀 실행 방법

⚠️ `file://` 프로토콜로 직접 열기는 CORS 오류 발생 → **반드시 서버 필요**

```bash
# Python 내장 서버
cd guide-tool/
python3 -m http.server 8080
# → http://localhost:8080

# Node.js
npx serve .
# → http://localhost:3000
```

## 📊 JS 모듈 로드 순서

```
Handlebars (CDN)
  └─ state.js          ← 공유 상태 초기화 (AppState)
       └─ helpers.js   ← Handlebars 헬퍼 등록
            └─ collect.js    ← DOM 데이터 수집
                 └─ preview.js    ← ★ 실시간 미리보기
                      └─ storage.js  ← 저장/불러오기
                           └─ tabs.js      ← 탭 전환
                                └─ form-fields.js ← 필드 빌더
                                     └─ tab-builders.js ← 탭 콘텐츠
                                          └─ export.js  ← 내보내기
                                               └─ app.js ← 진입점
```

## ⚡ 실시간 미리보기 동작 흐름

```
사용자 입력 (폼 필드 수정)
  → _onChange() / scheduleRender()    [app.js / preview.js]
      → 300ms 디바운스 대기
        → collect()                   [collect.js]
            → DOM의 모든 [data-field] 값 수집
              → AppState.compiled(data)    [helpers.js]
                  → Handlebars 템플릿 렌더링
                    → Blob URL 생성          [preview.js]
                        → iframe.src 갱신
                          → 미리보기 화면 업데이트
```

## 📋 공유 상태 (AppState)

`js/state.js`에서 `window.AppState`로 노출되는 공유 상태:

| 변수 | 타입 | 설명 |
|------|------|------|
| `AppState.STORAGE_KEY` | string | localStorage 키 |
| `AppState.data` | object | 현재 폼 데이터 |
| `AppState.compiled` | function | 컴파일된 Handlebars 함수 |
| `AppState.renderTimer` | number | 미리보기 디바운스 타이머 |
| `AppState.saveTimer` | number | 자동저장 디바운스 타이머 |
| `AppState.currentTab` | number | 현재 활성 탭 인덱스 |
| `AppState.blobUrl` | string | 현재 미리보기 Blob URL |
| `AppState.docxLib` | object | 동적 로드된 docx.js 라이브러리 |
