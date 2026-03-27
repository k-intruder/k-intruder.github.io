// app.js – 앱 초기화 & 공개 API
// ──────────────────────────────────────────────────────────────────────

function toggleExportMenu() {
  const m = document.getElementById('export-menu');
  m.style.display = m.style.display === 'none' || !m.style.display ? 'block' : 'none';
}
function hideExportMenu() { document.getElementById('export-menu').style.display='none'; }

function updateTemplateDisplay() {
  const el = document.getElementById('template-current-label');
  if (!el) return;
  el.textContent = `현재: ${getTemplateLabel()}`;
  el.setAttribute('data-template', normalizeTemplateKey(AppState.selectedTemplate));
}

document.addEventListener('click', e => { if (!e.target.closest('.export-wrap')) hideExportMenu(); });

function _addItem(name) {
  const wrap = document.querySelector(`[data-arr="${name}"] .array-items`);
  if (!wrap) return;
  if (name === 'learning_goals') addStringItem(wrap, name);
  else if (name === 'smart_methods') addSmartMethod(wrap);
  else if (name === 'method_guides') addMethodGuide(wrap);
  else if (name === 'digital_tools') addDigitalTool(wrap);
  else if (name === 'activity_guides') addActivityGuide(wrap);
  else if (name === 'appendix_sections') addAppendix(wrap);
  scheduleRender();
}

function _addNestedStep(btn) {
  const container = btn.closest('[data-nested="operation_steps"]').querySelector('.nested-items');
  _addNestedStepToEl(container);
  scheduleRender();
}
function _addNestedSupport(btn) {
  const container = btn.closest('[data-nested="support_framework"]').querySelector('.nested-items');
  _addNestedSupportToEl(container);
  scheduleRender();
}
function _onChange() { scheduleRender(); }

const TAB_LABELS_BY_TEMPLATE = {
  default: [
    '1. 교수설계가이드 개요',
    '2. 교과목 개요',
    '3. AI·DX 기반 교육의 이해',
    '4. AI·DX 교과목 수업 설계',
    '5. AI·DX 활용 학습 환경',
    '6. 주차별 수업 운영 계획',
    '7. AI 활용 교수학습활동 설계',
    '8. 학습평가 및 환류 계획 설계',
    '9. 교수자 수업 운영 가이드',
    '10. AI 활용 수업 유의사항',
    '11. 참고자료 및 부록'
  ],
  nondev: [
    '1. 교수설계가이드 개요',
    '2. 교과목 개요',
    '3. AI·DX 기반 교육의 이해',
    '4. AI·DX 교과목 수업 설계',
    '5. AI·DX 활용 학습 환경',
    '6. 주차별 수업 운영 계획',
    '7. AI 활용 교수학습활동 설계',
    '8. 학습평가 및 환류 계획 설계',
    '9. 교수자 수업 운영 가이드',
    '10. AI 활용 수업 유의사항',
    '11. 참고자료 및 부록'
  ],
  ncsblue: [
    '1. 교수학습지침서 개요',
    '2. 교과목 개요',
    '3. 디지털 전환(DX) 기반 교육 설계',
    '4. DX 기반 수업 설계',
    '5. 디지털 도구 활용 수업 운영',
    '6. 주차별 수업 운영 계획',
    '7. 학습활동 운영 방법',
    '8. 학습평가 및 환류 계획 설계',
    '9. 교수자 운영 가이드',
    '10. 수업 운영 시 유의사항',
    '11. 참고자료 및 부록'
  ],
  ncsblue_nondev: [
    '1. 교수학습지침서 개요',
    '2. 교과목 개요',
    '3. 디지털 전환(DX) 기반 교육 설계',
    '4. DX 기반 수업 설계',
    '5. 디지털 도구 활용 수업 운영',
    '6. 주차별 수업 운영 계획',
    '7. 학습활동 운영 방법',
    '8. 학습평가 및 환류 계획 설계',
    '9. 교수자 운영 가이드',
    '10. 수업 운영 시 유의사항',
    '11. 참고자료 및 부록'
  ]
};

function updateTabLabels() {
  const labels = TAB_LABELS_BY_TEMPLATE[normalizeTemplateKey(AppState.selectedTemplate)] || TAB_LABELS_BY_TEMPLATE.default;
  document.querySelectorAll('#tabs .tab-btn').forEach((btn, idx) => {
    if (labels[idx]) btn.textContent = labels[idx];
  });
}

function forceTabLabels() {
  const labels = TAB_LABELS_BY_TEMPLATE[normalizeTemplateKey(AppState.selectedTemplate)] || TAB_LABELS_BY_TEMPLATE.default;
  const tabWrap = document.getElementById('tabs');
  if (!tabWrap) return;
  const btns = tabWrap.querySelectorAll('.tab-btn');
  btns.forEach((btn, idx) => {
    if (labels[idx]) {
      btn.textContent = labels[idx];
      btn.setAttribute('data-label', labels[idx]);
      btn.setAttribute('title', labels[idx]);
    }
  });
}

async function init() {
  registerHelpers();
  if (!(await compileTemplate())) {
    document.getElementById('preview-status').textContent = '❌ 템플릿 오류';
    return;
  }

  const saved = loadData();
  if (saved && saved.data) {
    AppState.data = saved.data;
    AppState.selectedTemplate = normalizeTemplateKey(saved.template || saved.data?.selected_template || 'default');
    const selector = document.getElementById('template-selector');
    if (selector) selector.value = AppState.selectedTemplate;
    updateTabLabels();
    forceTabLabels();
    updateTemplateDisplay();
    await compileTemplate();
    const t = new Date(saved.savedAt);
    toast(`📂 저장된 데이터 복원 (${t.toLocaleString('ko-KR')})`, 'info', 3500);
  }

  updateTabLabels();
  updateTemplateDisplay();

  const area = document.getElementById('form-area');
  buildTab0(area);
  restoreFieldsFromData(AppState.data);
  bindTabAreaEvents(area);

  AppState.currentTab = 0;
  AppState.previewScrollTarget = getPreviewSectionIdByTab(0);
  renderPreview();
  setSaveStatus('saved');

  handleResize();
  window.addEventListener('resize', handleResize);
}

function saveNow() {
  saveData();
  setSaveStatus('saved');
  toast('✅ 저장 완료!','success');
}

function resetAll() {
  if (!confirm('모든 입력 데이터를 초기화할까요?')) return;

  AppState.isResetting = true;
  try {
    localStorage.removeItem(AppState.STORAGE_KEY);
    AppState.data = {};
    AppState.previewScrollTarget = 's1';
    AppState.previewCurrentSection = 's1';
    AppState.previewScrollY = 0;

    const firstBtn = document.querySelector('.tab-btn');
    showTab(0, firstBtn);
    renderPreview();
    setSaveStatus('saved');
    toast('🗑️ 초기화 완료','info');
  } finally {
    AppState.isResetting = false;
  }
}

function exportJSON() {
  const d = getMergedData();
  const output = {
    _meta: {
      version: '1.0',
      description: 'DX 기반 교수설계가이드 – 저장 데이터',
      saved_at: new Date().toISOString(),
      tool: 'DX 교수설계가이드 작성 도구',
      template: AppState.selectedTemplate || 'default'
    },
    ...d
  };
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const courseName = (d.course_name || '교수설계가이드').replace(/[\/:*?"<>|]/g, '_');
  const dateStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `${courseName}_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ JSON 저장 완료!', 'success');
}

function importJSON() {
  document.getElementById('json-file-input').value = '';
  document.getElementById('json-file-input').click();
}

function _onJsonFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const { _meta, ...importedData } = parsed;
      if (importedData.weeks && Array.isArray(importedData.weeks)) {
        importedData.weeks.forEach(w => {
          const n = w.weekNum;
          if (!n) return;
          importedData[`week_${n}_topic`]      = w.topic      || '';
          importedData[`week_${n}_goal`]       = w.goal       || '';
          importedData[`week_${n}_content`]    = w.content    || '';
          importedData[`week_${n}_tools`]      = w.tools      || '';
          importedData[`week_${n}_assessment`] = w.assessment || '';
        });
      }
      AppState.selectedTemplate = normalizeTemplateKey(_meta?.template || importedData.selected_template || AppState.selectedTemplate || 'default');
      const selector = document.getElementById('template-selector');
      if (selector) selector.value = AppState.selectedTemplate;
      updateTabLabels();
      forceTabLabels();
      updateTemplateDisplay();
      await compileTemplate();

      localStorage.setItem(AppState.STORAGE_KEY, JSON.stringify({ data: importedData, savedAt: new Date().toISOString(), template: AppState.selectedTemplate }));
      AppState.data = importedData;

      const allBtns = [...document.querySelectorAll('.tab-btn')];
      const prevIdx = allBtns.findIndex(b => b.classList.contains('active'));
      const prevTab = prevIdx >= 0 ? prevIdx : 0;
      updateTabLabels();
      forceTabLabels();
      updateTemplateDisplay();
      const tab0Btn = allBtns[0];
      if (tab0Btn) showTab(0, tab0Btn);
      if (prevTab !== 0 && allBtns[prevTab]) showTab(prevTab, allBtns[prevTab]);
      renderPreview();
      toast(`✅ "${file.name}" 불러오기 완료!`, 'success', 3000);
    } catch(err) {
      console.error('JSON import error:', err);
      toast('❌ JSON 파싱 오류: ' + err.message, 'error', 4000);
    }
  };
  reader.readAsText(file, 'utf-8');
}


async function changeTemplate(templateName) {
  const nextTemplate = normalizeTemplateKey(templateName);
  AppState.selectedTemplate = nextTemplate;
  updateTabLabels();
  forceTabLabels();
  updateTemplateDisplay();
  await compileTemplate();
  const activeBtn = document.querySelectorAll('.tab-btn')[AppState.currentTab] || document.querySelector('.tab-btn.active');
  if (activeBtn) showTab(AppState.currentTab || 0, activeBtn);
  saveData();
  renderPreview();
  toast(`템플릿 변경: ${getTemplateLabel(nextTemplate)}`, 'info', 1800);
}

function togglePreview() {
  const rp = document.getElementById('right-panel');
  const btn = document.getElementById('preview-toggle-btn');
  const collapsed = rp.classList.toggle('collapsed');
  btn.textContent = collapsed ? '▼ 미리보기 펼치기' : '▲ 미리보기 접기';
}

function handleResize() {
  const isMobile = window.innerWidth <= 768;
  const rp = document.getElementById('right-panel');
  const btn = document.getElementById('preview-toggle-btn');
  if (!isMobile) {
    rp.classList.remove('collapsed');
    if (btn) btn.style.display = 'none';
  } else {
    if (btn) btn.style.display = '';
  }
}
