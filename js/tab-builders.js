// tab-builders.js – 탭별 콘텐츠 빌더
// ──────────────────────────────────────────────────────────────────────
// 공개 함수:
//   buildTab0(area)  – 📋 기본정보
//   buildTab1(area)  – 🎯 교과목 개요
//   buildTab2(area)  – 🧠 수업 설계 (SMART 교육방법)
//   buildTab3(area)  – 🔧 디지털 도구
//   buildTab4(area)  – 📅 주차별 계획 (15주 아코디언)
//   buildTab5(area)  – 🎭 학습활동
//   buildTab6(area)  – 📊 평가 설계 (출석/중간/기말/과제)
//   TABS             – [buildTab0, ..., buildTab6] 배열
//
// 헬퍼 함수:
//   toggleAccordion(btn)   – 아코디언 열기/닫기
//   updateRateTotal()      – 평가 비율 합계 갱신
// ──────────────────────────────────────────────────────────────────────

// ── Tab Builders ───────────────────────────────────────────────────
  function buildTab0(area) {
    area.innerHTML = `
      <div class="section-title">📋 교과목 기본 정보</div>
      ${field('교과목명 (한글)','course_name','input',{ph:'예) AI 프로그래밍 기초'})}
      ${field('교과목명 (영문)','course_name_en','input',{ph:'예) AI Programming Basics'})}
      ${field('발행일','publish_date','input',{inputType:'date'})}
      ${field('학과명','department','input',{ph:'예) AI소프트웨어학과'})}
      ${field('핵심 키워드','keywords','input',{ph:'예) AI, Python, DX, 코딩'})}
      <div class="form-row-2">
        ${field('대상 학년','year','input',{ph:'예) 1학년'})}
        ${field('학기','semester','input',{ph:'예) 1학기'})}
      </div>
      ${field('담당교수','professor_name','input')}
      ${field('주교재','textbook','input',{ph:'예) Python 프로그래밍 기초'})}
      <div class="section-title">📚 교과목 명세</div>
      ${field('이수구분','course_type','select',{options:['전공선택','전공필수','교양선택','교양필수']})}
      <div class="form-row-3">
        ${field('학점','credits','input',{inputType:'number',ph:'3'})}
        ${field('이론 시수','theory_hours','input',{inputType:'number',ph:'2'})}
        ${field('실습 시수','practice_hours','input',{inputType:'number',ph:'1'})}
      </div>
      ${field('NCS 직무분류','ncs_job','input',{ph:'예) 정보통신 > 정보기술개발'})}
      ${field('핵심 역량','core_competency','input',{ph:'예) 문제해결력, 디지털 리터러시'})}`;
  }

  function buildTab1(area) {
    area.innerHTML = `
      <div class="section-title">📝 교과목 설명</div>
      ${field('교과목 특성 설명','course_description','textarea',{rows:4})}
      ${field('선수 과목','prerequisite','input',{ph:'예) 컴퓨터 기초'})}
      ${field('후속 연계 과목','follow_up','input',{ph:'예) 데이터분석 프로그래밍'})}
      <div class="section-title">🎯 학습목표</div>
      ${arraySection('learning_goals','학습목표 목록','목표 추가','')}`;
    // restore handled separately in showTab
  }

  function buildTab2(area) {
    area.innerHTML = `
      <div class="section-title">🧠 SMART 교육방법 적용</div>
      <div class="array-hint">💡 SMART 분류(S/M/A/R/T)에서 교육방법을 선택하세요.</div>
      ${arraySection('smart_methods','SMART 교육방법','방법 추가','')}
      ${field('교육방법 통합 운영 요약','integration_summary','textarea',{rows:3})}
      <div class="section-title">📖 교육방법 상세 가이드 (4.4)</div>
      <div class="array-hint">💡 각 교육방법별 운영 단계와 지원체계를 상세히 입력하세요.</div>
      ${arraySection('method_guides','교육방법 가이드','가이드 추가','')}`;
  }

  function buildTab3(area) {
    area.innerHTML = `
      <div class="section-title">🔧 디지털 도구 목록</div>
      ${arraySection('digital_tools','필수 디지털 도구','도구 추가','')}`;
  }

  function buildTab4(area) {
    let html = '<div class="section-title">📅 주차별 수업 운영 계획</div>';
    for (let i = 1; i <= 15; i++) {
      const badge = i===8 ? '<span class="accordion-badge midterm">중간평가</span>' :
                    i===15 ? '<span class="accordion-badge final">기말평가</span>' :
                    '<span class="accordion-badge">일반</span>';
      // ★ field()에 실제 평가된 문자열 전달 (template literal 직접 사용)
      html += '<div class="accordion-item">'
        + '<div class="accordion-header" onclick="App.toggleAccordion(this)">'
        + '<span>' + i + '주차 ' + badge + '</span>'
        + '<span class="accordion-arrow">▼</span>'
        + '</div>'
        + '<div class="accordion-body">'
        + field('주제',          'week_'+i+'_topic',      'input',    {ph: i+'주차 주제'})
        + field('학습목표',      'week_'+i+'_goal',       'textarea', {rows:2})
        + field('학습 내용',     'week_'+i+'_content',    'textarea', {rows:3})
        + field('활용 도구',     'week_'+i+'_tools',      'input')
        + field('평가방법',      'week_'+i+'_assessment', 'input')
        + '</div></div>';
    }
    area.innerHTML = html;
  }

  function buildTab5(area) {
    area.innerHTML = `
      <div class="section-title">🎭 학습활동 운영 방법 (섹션 7)</div>
      <div class="array-hint">💡 각 학습활동별 운영 방법, 단계, 활용 도구를 입력하세요. 교육방법은 SMART 분류에서 선택합니다.</div>
      ${arraySection('activity_guides','학습활동 운영','활동 추가','')}
      <div class="section-title">🤝 AI 활용 협업 가이드</div>
      ${field('AI 활용 협업 가이드 (HTML)','collaboration_guide','textarea',{rows:4})}
      ${field('AI 윤리 가이드라인 (HTML)','ethics_warning','textarea',{rows:3})}`;
  }

  function buildTab6(area) {
    area.innerHTML = `
      <div class="section-title">📊 평가 비율 (합계 100%)</div>
      <div class="form-row-2">
        <div>
          <div class="form-label">출석 (%)</div>
          <input type="number" class="form-input" data-field="attendance_rate" min="0" max="100" oninput="App.updateRateTotal()">
        </div>
        <div>${field('출석 평가 도구','attendance_tool','input')}</div>
      </div>
      ${field('출석 평가 내용','attendance_description','input')}
      <div class="form-row-2">
        <div>
          <div class="form-label">중간고사 (%)</div>
          <input type="number" class="form-input" data-field="midterm_rate" min="0" max="100" oninput="App.updateRateTotal()">
        </div>
        <div>${field('중간 평가 도구','midterm_tool','input')}</div>
      </div>
      ${field('중간 평가 내용','midterm_description','input')}
      <div class="form-row-2">
        <div>
          <div class="form-label">기말고사 (%)</div>
          <input type="number" class="form-input" data-field="final_rate" min="0" max="100" oninput="App.updateRateTotal()">
        </div>
        <div>${field('기말 평가 도구','final_tool','input')}</div>
      </div>
      ${field('기말 평가 내용','final_description','input')}
      <div class="form-row-2">
        <div>
          <div class="form-label">과제/프로젝트 (%)</div>
          <input type="number" class="form-input" data-field="assignment_rate" min="0" max="100" oninput="App.updateRateTotal()">
        </div>
        <div>${field('과제 평가 도구','assignment_tool','input')}</div>
      </div>
      ${field('과제 평가 내용','assignment_description','input')}
      <div id="rate-total" class="rate-total rate-warn">합계: 0%</div>
      <div class="section-title">📎 참고자료 및 부록 (섹션 11)</div>
      <div class="array-hint">💡 참고문헌, 교육자료 목록, 체크리스트 등 부록 내용을 입력하세요.</div>
      ${arraySection('appendix_sections','부록 섹션 목록','부록 추가','')}`;
  }

  // ── Accordion ─────────────────────────────────────────────────────
  function toggleAccordion(header) {
    const arrow = header.querySelector('.accordion-arrow');
    const body  = header.nextElementSibling;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    arrow.classList.toggle('open', !isOpen);
  }

  // ── Rate total ────────────────────────────────────────────────────
  function updateRateTotal() {
    const fields = ['attendance_rate','midterm_rate','final_rate','assignment_rate'];
    let total = 0;
    fields.forEach(f => {
      const el = document.querySelector(`[data-field="${f}"]`);
      if (el) total += parseInt(el.value)||0;
    });
    const el = document.getElementById('rate-total');
    if (!el) return;
    el.textContent = `합계: ${total}%`;
    el.className = `rate-total ${total===100 ? 'rate-ok' : 'rate-warn'}`;
    scheduleRender();
  }