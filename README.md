# 📚 교수설계가이드 작성 툴

업로드한 템플릿 HTML을 기반으로 교수설계 가이드를 작성할 수 있는 완전한 웹 기반 툴입니다.

## ✨ 주요 기능

### 1. 완전한 데이터 입력 인터페이스
- **6개 탭 구성**
  - 📋 기본정보: 교과목명, 학과, 교수, 학점 등
  - 🎯 교과목: 특성, 학습목표(배열), 선수/후속과목
  - 🧠 수업설계: SMART 교육방법, 교육방법 가이드(중첩배열), ADDIE 모델
  - 🔧 도구: 디지털 도구(배열, 색상 선택 가능)
  - 📅 주차계획: 1~15주차 아코디언 (8주=중간평가, 15주=기말평가)
  - 📊 평가: 평가 비율(합계 100% 실시간 검증), 부록

### 2. 실시간 미리보기
- **좌우 분할 레이아웃**
  - 왼쪽 420px: 입력 폼
  - 오른쪽: A4 문서 스타일 미리보기
- **Handlebars 템플릿 엔진**으로 실시간 렌더링
- **300ms debounce**로 성능 최적화
- **Blob URL 방식**으로 CDN 리소스 정상 로드

### 3. localStorage 자동 저장
- 모든 입력 데이터 자동 저장
- 페이지 새로고침 후 자동 복원
- 저장 상태 실시간 표시 (저장됨/저장 중)
- 수동 저장/초기화 버튼

### 4. 3가지 내보내기 기능 ✨ NEW!

#### 🖨️ PDF로 내보내기
- 새 창(popup)에서 렌더링된 HTML 열기
- 브라우저 인쇄 다이얼로그 자동 실행
- 사용자가 "PDF로 저장" 선택
- `@media print` 최적화로 깔끔한 출력

**작동 방식:**
```js
새 창 열기 → HTML 삽입 → 리소스 로드 대기 → print() 호출
→ 브라우저 인쇄 다이얼로그 → "PDF로 저장" 선택
```

#### 📄 HTML로 다운로드
- 렌더링된 완전한 HTML 파일 다운로드
- 파일명: `{교과목명}_교수설계가이드.html`
- 독립 실행 가능 (CDN 포함)
- 다른 사람과 공유 가능

#### 📝 Word(.doc)로 다운로드
- Word 호환 HTML 형식으로 다운로드
- 파일명: `{교과목명}_교수설계가이드.doc`
- Microsoft Word 및 한글(HWP)에서 열기 가능
- XML 선언 포함으로 호환성 최적화

**Word 호환성:**
- `xmlns:o='urn:schemas-microsoft-com:office:office'` 선언
- BOM(`\ufeff`) 포함으로 인코딩 문제 해결
- A4 페이지 설정 포함

### 5. 평가 비율 실시간 검증
- 출석 + 중간 + 기말 + 과제 = 실시간 합계 계산
- 100% 달성 시 초록색 ✓
- 미달/초과 시 노란색 ⚠️ 경고

### 6. 배열 및 중첩 배열 관리
- **동적 추가/삭제** UI
  - 학습목표, SMART 교육방법, 디지털 도구, 부록
- **중첩 배열** 지원
  - 교육방법 가이드 → 운영 단계, 지원 체계 각각 관리

### 7. 주차별 아코디언
- 1~15주차 클릭으로 펼침/접기
- 8주차: 🔴 중간평가 뱃지
- 15주차: 🔴 기말평가 뱃지
- 주제 미입력 시 "미입력" 표시

## 🎯 사용 방법

### 1. 시작하기
```bash
# 브라우저에서 index.html 열기
open index.html
```

### 2. 데이터 입력
1. **기본정보 탭**부터 순서대로 입력
2. **배열 항목**은 "+ 추가" 버튼으로 동적 추가
3. **주차계획**은 아코디언 클릭으로 펼쳐서 입력
4. **평가 비율**은 합계 100% 맞추기

### 3. 내보내기
**내보내기 ▾** 버튼 클릭 후 원하는 형식 선택:

| 형식 | 용도 | 특징 |
|------|------|------|
| 🖨️ PDF | 최종 문서 배포 | 브라우저 인쇄 기능 활용 |
| 📄 HTML | 웹 공유, 아카이브 | 독립 실행 가능 |
| 📝 Word | 편집 가능 문서 | Word/한글에서 열기 |

### 4. 데이터 관리
- **자동 저장**: 입력 후 300ms 자동 저장
- **수동 저장**: 💾 저장 버튼 클릭
- **초기화**: 🗑️ 초기화 버튼 (확인 후 실행)

## 📊 구현된 변수 (전체)

### 단순 문자열 (40+개)
- 기본정보: `course_name`, `course_name_en`, `publish_date`, `department`, `keywords`
- 교과 정보: `year`, `semester`, `professor_name`, `textbook`
- 명세: `course_type`, `credits`, `theory_hours`, `practice_hours`, `ncs_job`, `core_competency`
- 교과 개요: `course_description`, `prerequisite`, `follow_up`
- 수업 설계: `integration_summary`, ADDIE 5개 필드
- 평가: 4개 항목 × 3개 필드 = 12개

### 주차별 변수 (75개)
- `week_N_topic`, `week_N_goal`, `week_N_content`, `week_N_tools`, `week_N_assessment`
- N = 1 ~ 15

### 배열 변수 (6종)
1. **learning_goals** (문자열 배열)
2. **smart_methods** (`method_name`, `description`, `tools`)
3. **method_guides** (중첩 배열)
   - `operation_steps[]`: `step_name`, `activities`, `instructor_role`, `tools`
   - `support_framework[]`: `element`, `methods`, `tools`
4. **digital_tools** (`category`, `color`, `name`, `description`, `usage`)
5. **appendix_sections** (`section_title`, `section_content`)

## 🏗️ 기술 스택

- **순수 Vanilla JavaScript** (외부 의존성 최소화)
- **Handlebars.js** (CDN) - 템플릿 엔진
- **localStorage** - 데이터 영속성
- **Blob URL** - iframe 미리보기
- **@media print** - PDF 최적화

## 🎨 데이터 흐름

```
입력 폼 (왼쪽)
  ↓ onchange/oninput
app.data 객체 업데이트
  ↓ 300ms debounce
Handlebars 렌더링
  ↓ 주차 배열 변환 (week_N_* → weeks[])
Blob 생성 → URL.createObjectURL()
  ↓
iframe.src 업데이트
  ↓
실시간 미리보기 (오른쪽)
  ↓ 자동
localStorage 저장
```

## 🚀 내보내기 상세

### PDF 내보내기 구현
```js
exportPDF() {
  const html = this.getCurrentRenderedHtml();
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print(); // 브라우저 인쇄 다이얼로그
    }, 500);
  };
}
```

### HTML 다운로드 구현
```js
downloadHTML() {
  const html = this.getCurrentRenderedHtml();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${courseName}_교수설계가이드.html`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Word(.doc) 다운로드 구현
```js
downloadDOCX() {
  const bodyContent = extractBodyContent(html);
  
  const wordHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'>
    <head>
      <meta charset='utf-8'>
      <style>/* A4 최적화 스타일 */</style>
    </head>
    <body>${bodyContent}</body>
    </html>
  `;
  
  const blob = new Blob(['\ufeff' + wordHtml], {
    type: 'application/vnd.ms-word;charset=utf-8'
  });
  
  // 다운로드 로직...
}
```

## 📦 파일 구조

```
.
├── index.html    (62KB) - 완전한 단일 HTML 파일
└── README.md     - 이 문서
```

## 💡 특별 기능

1. **색상 선택기**: 디지털 도구의 테두리 색상 `<input type="color">`
2. **중첩 배열 UI**: 교육방법 가이드 내부의 운영 단계, 지원 체계
3. **평가 비율 검증**: 실시간 합계 계산 및 시각적 피드백
4. **주차 뱃지**: 8주차(중간평가), 15주차(기말평가) 자동 표시
5. **Blob URL 방식**: iframe에서 CDN 리소스 정상 로드
6. **드롭다운 메뉴**: 내보내기 3가지 옵션 UI

## 🎯 권장 워크플로우

1. **기본정보 입력** (교과목명, 학과, 교수 등)
2. **교과목 탭** → 학습목표 추가
3. **수업설계 탭** → SMART 교육방법 추가 → 교육방법 가이드 작성
4. **도구 탭** → 디지털 도구 추가
5. **주차계획 탭** → 1~15주차 상세 입력
6. **평가 탭** → 평가 비율(합계 100%) 입력
7. **내보내기** → PDF/HTML/Word 중 선택

## ⚠️ 알려진 제한사항

1. **activity_guides 미구현**: Section 7의 상세 프로세스 입력 UI 없음
   - 템플릿에는 존재하나 데이터 입력 인터페이스 미제공
   - 필요시 추가 구현 가능

2. **이미지 업로드 없음**: 텍스트 기반만 지원

3. **단일 사용자**: localStorage 기반 로컬 저장만 가능

4. **Word 변환 한계**: 완벽한 DOCX가 아닌 Word 호환 HTML
   - 복잡한 레이아웃은 일부 깨질 수 있음
   - 기본 텍스트, 표, 제목은 완벽하게 지원

## 🎉 완성!

모든 기능이 **단일 HTML 파일**에 완벽하게 구현되어 있어 즉시 사용 가능합니다!

**바로 사용 가능!** 브라우저에서 `index.html`을 열어보세요! 🚀

---

**개발**: 2024년 교수설계가이드 작성 툴  
**버전**: 2.0 (PDF/HTML/Word 내보내기 추가)  
**라이선스**: MIT
