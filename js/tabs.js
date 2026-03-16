// tabs.js – 탭 내비게이션 + 저장 데이터 복원
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: showTab(idx, btn), restoreFieldsFromData(d)
// TABS 배열: [buildTab0, buildTab1, ..., buildTab6]
// ──────────────────────────────────────────────────────────────────────

// ── Tab Forms ──────────────────────────────────────────────────────
function getTAB(idx) {
  const TABS = [buildTab0, buildTab1, buildTab2, buildTab3, buildTab4, buildTab5, buildTab6, buildTab7, buildTab8, buildTab9, buildTab10];
  return TABS[idx];
}

function bindTabAreaEvents(area) {
  area.addEventListener('input', scheduleRender);
  area.addEventListener('change', scheduleRender);
  area.addEventListener('focusin', (e) => {
    highlightPreviewByInputTarget(e.target);
  });
  area.addEventListener('click', (e) => {
    highlightPreviewByInputTarget(e.target);
  });
}

function showTab(idx, btn) {
  if (!AppState.isResetting) {
    AppState.data = getMergedData();
    saveData();
  }

  AppState.currentTab = idx;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const area = document.getElementById('form-area');
  area.innerHTML = '';
  getTAB(idx)(area);
  restoreFieldsFromData(AppState.data);
  bindTabAreaEvents(area);

  AppState.previewScrollTarget = getPreviewSectionIdByTab(idx);
  scheduleRender();
}

// ── Restore fields from saved data ────────────────────────────────
function restoreFieldsFromData(d) {
  if (!d) return;

  if (d.weeks && Array.isArray(d.weeks)) {
    d.weeks.forEach(w => {
      const n = w.weekNum;
      if (!n) return;
      if (d['week_'+n+'_topic']      === undefined) d['week_'+n+'_topic']      = w.topic      || '';
      if (d['week_'+n+'_goal']       === undefined) d['week_'+n+'_goal']       = w.goal       || '';
      if (d['week_'+n+'_content']    === undefined) d['week_'+n+'_content']    = w.content    || '';
      if (d['week_'+n+'_tools']      === undefined) d['week_'+n+'_tools']      = w.tools      || '';
      if (d['week_'+n+'_assessment'] === undefined) d['week_'+n+'_assessment'] = w.assessment || '';
    });
  }

  document.querySelectorAll('[data-field]').forEach(el => {
    if (d[el.dataset.field] !== undefined) el.value = d[el.dataset.field];
  });

  if (d.learning_goals && d.learning_goals.length) {
    const wrap = document.querySelector('[data-arr="learning_goals"] .array-items');
    if (wrap) {
      wrap.innerHTML = '';
      d.learning_goals.forEach((v) => addStringItem(wrap, 'learning_goals', v));
    }
  }

  if (d.smart_methods && d.smart_methods.length) {
    const wrap = document.querySelector('[data-arr="smart_methods"] .array-items');
    if (wrap) {
      wrap.innerHTML = '';
      d.smart_methods.forEach(obj => addSmartMethod(wrap, obj));
    }
  }

  if (d.method_guides && d.method_guides.length) {
    const wrap = document.querySelector('[data-arr="method_guides"] .array-items');
    if (wrap) {
      wrap.innerHTML = '';
      d.method_guides.forEach(obj => addMethodGuide(wrap, obj));
    }
  }

  if (d.digital_tools && d.digital_tools.length) {
    const wrap = document.querySelector('[data-arr="digital_tools"] .array-items');
    if (wrap) {
      wrap.innerHTML = '';
      d.digital_tools.forEach(obj => addDigitalTool(wrap, obj));
    }
  }

  if (d.appendix_sections && d.appendix_sections.length) {
    const wrap = document.querySelector('[data-arr="appendix_sections"] .array-items');
    if (wrap) {
      wrap.innerHTML = '';
      d.appendix_sections.forEach(obj => addAppendix(wrap, obj));
    }
  }

  if (d.activity_guides && d.activity_guides.length) {
    const wrap = document.querySelector('[data-arr="activity_guides"] .array-items');
    if (wrap) {
      wrap.innerHTML = '';
      d.activity_guides.forEach(obj => addActivityGuide(wrap, obj));
    }
  }

  if (typeof updateRateTotal === 'function') updateRateTotal();
}
