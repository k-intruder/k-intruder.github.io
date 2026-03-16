// collect.js – DOM → JSON 데이터 수집
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: collect(), collectStringArray(), collectObjArray(), collectMethodGuides()
// 폼의 모든 [data-field] 요소 값을 JSON으로 변환
// ──────────────────────────────────────────────────────────────────────

function hasWeekInputsInDOM() {
  return !!(
    document.querySelector('[data-field="week_1_topic"]') ||
    document.querySelector('[data-field="week_1_goal"]') ||
    document.querySelector('[data-field="week_1_content"]') ||
    document.querySelector('[data-field="week_1_tools"]') ||
    document.querySelector('[data-field="week_1_assessment"]')
  );
}

// ── Collect data from DOM ──────────────────────────────────────────
function collect() {
  const d = {};

  // simple fields
  document.querySelectorAll('[data-field]').forEach(el => {
    d[el.dataset.field] = el.value || '';
  });

  // arrays
  d.learning_goals   = collectStringArray('learning_goals');
  d.smart_methods    = collectObjArray('smart_methods', ['method_name','description','tools']);
  d.method_guides    = collectMethodGuides();
  d.digital_tools    = collectObjArray('digital_tools', ['category','color','name','description','usage']);
  d.activity_guides  = collectObjArray('activity_guides',['method_name','step','content','tools','weekly_tasks','support_items','additional_info']);
  d.appendix_sections= collectObjArray('appendix_sections',['section_title','section_content']);

  // weeks → 주차 탭 DOM이 있을 때만 생성
  if (hasWeekInputsInDOM()) {
    d.weeks = [];
    for (let i = 1; i <= 15; i++) {
      d.weeks.push({
        weekNum: i,
        topic:      d[`week_${i}_topic`]      || '',
        goal:       d[`week_${i}_goal`]       || '',
        content:    d[`week_${i}_content`]    || '',
        tools:      d[`week_${i}_tools`]      || '',
        assessment: d[`week_${i}_assessment`] || '',
        is_midterm: i === 8,
        is_final:   i === 15
      });
    }
  }

  return d;
}

function collectStringArray(name) {
  return [...document.querySelectorAll(`[data-arr="${name}"] [data-item-field]`)]
    .map(el => el.value || '').filter(Boolean);
}

function collectObjArray(name, fields) {
  const items = document.querySelectorAll(`[data-arr="${name}"] .array-item`);
  return [...items].map(item => {
    const obj = {};
    fields.forEach(f => {
      const el = item.querySelector(`[data-item-field="${f}"]`);
      obj[f] = el ? el.value || '' : '';
    });
    return obj;
  });
}

function collectMethodGuides() {
  const items = document.querySelectorAll('[data-arr="method_guides"] .array-item');
  return [...items].map(item => {
    const obj = {
      method_name: item.querySelector('[data-item-field="method_name"]')?.value || '',
      overview:    item.querySelector('[data-item-field="overview"]')?.value || '',
      examples:    item.querySelector('[data-item-field="examples"]')?.value || '',
      operation_steps: [],
      support_framework: []
    };
    item.querySelectorAll('[data-nested="operation_steps"] .nested-item').forEach(ni => {
      obj.operation_steps.push({
        step_name:      ni.querySelector('[data-item-field="step_name"]')?.value || '',
        activities:     ni.querySelector('[data-item-field="activities"]')?.value || '',
        instructor_role:ni.querySelector('[data-item-field="instructor_role"]')?.value || '',
        tools:          ni.querySelector('[data-item-field="tools"]')?.value || ''
      });
    });
    item.querySelectorAll('[data-nested="support_framework"] .nested-item').forEach(ni => {
      obj.support_framework.push({
        element: ni.querySelector('[data-item-field="element"]')?.value || '',
        methods: ni.querySelector('[data-item-field="methods"]')?.value || '',
        tools:   ni.querySelector('[data-item-field="tools"]')?.value || ''
      });
    });
    return obj;
  });
}

// ── getMergedData ─────────────────────────────────────────────────
// export/preview 공용: AppState.data(저장됨) + 현재 DOM 병합
// 현재 탭에 없는 필드는 AppState.data 값을 유지
function getMergedData() {
  const saved = AppState.data || {};
  const domData = collect();
  const arrays = ['learning_goals','smart_methods','method_guides','digital_tools','activity_guides','appendix_sections'];
  const merged = Object.assign({}, saved);

  // simple fields
  Object.keys(domData).forEach(k => {
    if (arrays.includes(k) || k === 'weeks') return;
    const v = domData[k];
    if (v !== undefined && v !== '') merged[k] = v;
  });

  // common arrays
  arrays.forEach(arr => {
    const domArr = domData[arr];
    if (domArr && domArr.length > 0) {
      merged[arr] = domArr;
    } else if (saved[arr] && saved[arr].length > 0) {
      merged[arr] = saved[arr];
    }
  });

  // weeks: 주차 입력 DOM이 있을 때만 새로 재구성, 아니면 기존 값 유지
  if (hasWeekInputsInDOM()) {
    const weeks = [];
    for (let i = 1; i <= 15; i++) {
      const topic      = merged[`week_${i}_topic`] ?? domData[`week_${i}_topic`] ?? '';
      const goal       = merged[`week_${i}_goal`] ?? domData[`week_${i}_goal`] ?? '';
      const content    = merged[`week_${i}_content`] ?? domData[`week_${i}_content`] ?? '';
      const tools      = merged[`week_${i}_tools`] ?? domData[`week_${i}_tools`] ?? '';
      const assessment = merged[`week_${i}_assessment`] ?? domData[`week_${i}_assessment`] ?? '';

      weeks.push({
        weekNum: i,
        topic,
        goal,
        content,
        tools,
        assessment,
        is_midterm: i === 8,
        is_final:   i === 15
      });
    }
    merged.weeks = weeks;
  } else if (Array.isArray(saved.weeks)) {
    merged.weeks = saved.weeks.map(w => ({ ...w }));
  }

  return merged;
}
