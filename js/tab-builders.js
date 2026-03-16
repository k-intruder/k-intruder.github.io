// tab-builders.js – 탭별 콘텐츠 빌더
// ──────────────────────────────────────────────────────────────────────

function is2025Template() {
  return (AppState.selectedTemplate || 'default') === 'default';
}

function buildTab0(area) {
  area.innerHTML = `
    <div class="section-title">1. 교수설계가이드 개요</div>
    ${field('개발 목적','development_purpose','textarea',{rows:4})}
    ${field('개발 배경','development_background_intro','textarea',{rows:5})}
    ${field('적용 교과목','course_name','input',{ph:'예) AI 프로그래밍 기초'})}
    ${field('적용 교과목(영문)','course_name_en','input',{ph:'예) AI Programming Basics'})}
    <div class="form-row-2">
      ${field('발행일','publish_date','input',{inputType:'date'})}
      ${field('학과명','department','input',{ph:'예) 컴퓨터소프트웨어과'})}
    </div>
    ${field('핵심 목표 요약','development_goal_summary','input',{ph:'예) AI·DX 기반 역량 강화'})}
    ${field('핵심 키워드','keywords','input',{ph:'예) AI·DX, 생성형AI, 프로젝트 기반 학습'})}
  `;
}

function buildTab1(area) {
  area.innerHTML = `
    <div class="section-title">2. 교과목 개요</div>
    <div class="form-row-2">
      ${field('교과목명','course_name','input',{ph:'예) AI 프로그래밍 기초'})}
      ${field('교과목명(영문)','course_name_en','input',{ph:'예) AI Programming Basics'})}
    </div>
    <div class="form-row-3">
      ${field('대상 학년','year','input',{ph:'예) 1학년'})}
      ${field('학기','semester','input',{ph:'예) 1학기'})}
      ${field('이수구분','course_type','select',{options:['전공선택','전공필수','교양선택','교양필수']})}
    </div>
    <div class="form-row-3">
      ${field('학점','credits','input',{inputType:'number',ph:'3'})}
      ${field('이론 시수','theory_hours','input',{inputType:'number',ph:'2'})}
      ${field('실습 시수','practice_hours','input',{inputType:'number',ph:'1'})}
    </div>
    ${field('주교재','textbook','input',{ph:'예) Python 프로그래밍 기초'})}
    ${field('NCS 직무분류','ncs_job','input',{ph:'예) 정보통신 > 정보기술개발'})}
    ${field('핵심 역량','core_competency','input',{ph:'예) 문제해결력, 디지털 리터러시'})}
    ${field('교과목 특성','course_description','textarea',{rows:5})}
    <div class="section-title">교과목 학습목표</div>
    ${arraySection('learning_goals','학습목표 목록','학습목표 추가','')}
    ${field('선수 과목','prerequisite','input',{ph:'예) 컴퓨터 기초'})}
    ${field('후속 연계 과목','follow_up','input',{ph:'예) 데이터분석 프로그래밍'})}
  `;
}

function buildTab2(area) {
  area.innerHTML = `
    <div class="section-title">3. AI·DX 기반 교육의 이해</div>
    ${field('AI·DX 기반 교육의 이해','ai_dx_understanding','textarea',{rows:12})}
  `;
}

function buildTab3(area) {
  area.innerHTML = `
    <div class="section-title">4. AI·DX 교과목 수업 설계</div>
    ${field('수업 설계 방향','integration_summary','textarea',{rows:4,ph:'예) 학습자 중심·역량 기반·디지털 통합 수업 운영 방향'})}
    <div class="section-title">학습활동 설계 원칙</div>
    ${arraySection('smart_methods','학습활동 설계 원칙 / 적용 교육방법','방법 추가','')}
    <div class="section-title">교육방법 적용 세부 가이드</div>
    ${arraySection('method_guides','교육방법 상세 가이드','가이드 추가','')}
  `;
}

function buildTab4(area) {
  area.innerHTML = `
    <div class="section-title">5. AI·DX 활용 학습 환경</div>
    ${arraySection('digital_tools','AI·DX 기반 학습도구 및 리소스 활용','도구 추가','')}
  `;
}

function buildTab5(area) {
  let html = `<div class="section-title">6. 주차별 수업 운영 계획</div>`;
  for (let i = 1; i <= 15; i++) {
    const badge = i===8 ? '<span class="accordion-badge midterm">중간평가</span>' :
                  i===15 ? '<span class="accordion-badge final">기말평가</span>' :
                  '<span class="accordion-badge">일반</span>';
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

function buildTab6(area) {
  area.innerHTML = `
    <div class="section-title">7. AI 활용 교수학습활동 설계</div>
    ${arraySection('activity_guides','AI 활용 교수학습활동 설계','활동 추가','')}
  `;
}

function buildTab7(area) {
  area.innerHTML = `
    <div class="section-title">8. 학습평가 및 환류 계획 설계</div>
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
  `;
}

function buildTab8(area) {
  area.innerHTML = `
    <div class="section-title">9. 교수자 수업 운영 가이드</div>
    ${field('교수자 수업 운영 가이드 (HTML)','instructor_guide','textarea',{rows:12})}
  `;
}

function buildTab9(area) {
  area.innerHTML = `
    <div class="section-title">10. AI 활용 수업 유의사항</div>
    ${field('AI 활용 수업 유의사항 (HTML)','ethics_warning','textarea',{rows:10})}
  `;
}

function buildTab10(area) {
  area.innerHTML = `
    <div class="section-title">11. 참고자료 및 부록</div>
    ${arraySection('appendix_sections','부록 섹션 목록','부록 추가','')}
  `;
}

function toggleAccordion(header) {
  const arrow = header.querySelector('.accordion-arrow');
  const body  = header.nextElementSibling;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  arrow.classList.toggle('open', !isOpen);
}

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
