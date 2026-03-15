// app.js – 앱 초기화 & 공개 API
// ──────────────────────────────────────────────────────────────────────
// 메인 진입점: init() → DOMContentLoaded 시 자동 호출
//
// 공개 함수 (App.xxx 로 접근):
//   init()                  – 앱 초기화
//   showTab(idx, btn)       – 탭 전환
//   saveNow()               – 즉시 저장
//   resetAll()              – 전체 초기화
//   exportPDF/HTML/DOCX()   – 내보내기
//   exportJSON()            – JSON 저장
//   importJSON()            – JSON 불러오기
//   togglePreview()         – 미리보기 접기/펼치기 (모바일)
//   _addItem(name)          – 동적 배열 항목 추가
//   _onChange()             – 입력 변경 이벤트
// ──────────────────────────────────────────────────────────────────────

// ── Public methods ─────────────────────────────────────────────────
  function toggleExportMenu() {
    const m=document.getElementById('export-menu');
    m.style.display = m.style.display==='none'||!m.style.display ? 'block':'none';
  }
  function hideExportMenu() { document.getElementById('export-menu').style.display='none'; }

  document.addEventListener('click',e=>{ if(!e.target.closest('.export-wrap')) hideExportMenu(); });

  // ── _addItem dispatcher ───────────────────────────────────────────
  function _addItem(name) {
    const wrap = document.querySelector(`[data-arr="${name}"] .array-items`);
    if(!wrap) return;
    if(name==='learning_goals') addStringItem(wrap, name);
    else if(name==='smart_methods') addSmartMethod(wrap);
    else if(name==='method_guides') addMethodGuide(wrap);
    else if(name==='digital_tools') addDigitalTool(wrap);
    else if(name==='activity_guides') addActivityGuide(wrap);
    else if(name==='appendix_sections') addAppendix(wrap);
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

  // ── Init ───────────────────────────────────────────────────────────
  function init() {
    registerHelpers();
    if (!compileTemplate()) {
      document.getElementById('preview-status').textContent = '❌ 템플릿 오류';
      return;
    }
    // load saved data
    const saved = loadData();
    if (saved && saved.data) {
      AppState.data = saved.data;
      const t = new Date(saved.savedAt);
      toast(`📂 저장된 데이터 복원 (${t.toLocaleString('ko-KR')})`, 'info', 3500);
    }
    // build first tab
    const area = document.getElementById('form-area');
    buildTab0(area);
    restoreFieldsFromData(AppState.data);
    area.addEventListener('input', scheduleRender);
    area.addEventListener('change', scheduleRender);
    // ★ 즉시 렌더링
    renderPreview();
    setSaveStatus('saved');
    // ★ 반응형 초기화
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
    localStorage.removeItem(AppState.STORAGE_KEY);
    AppState.data = {};
    showTab(0, document.querySelector('.tab-btn'));
    renderPreview();
    toast('🗑️ 초기화 완료','info');
  }

  // ── JSON Export ───────────────────────────────────────────────────
  function exportJSON() {
    const d = collect();
    // _meta 추가
    const output = {
      _meta: {
        version: '1.0',
        description: 'DX 기반 교수설계가이드 – 저장 데이터',
        saved_at: new Date().toISOString(),
        tool: 'DX 교수설계가이드 작성 도구'
      },
      ...d
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const courseName = (d.course_name || '교수설계가이드').replace(/[\\/:*?"<>|]/g, '_');
    const dateStr = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `${courseName}_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ JSON 저장 완료!', 'success');
  }

  function importJSON() {
    document.getElementById('json-file-input').value = ''; // reset so same file can re-trigger
    document.getElementById('json-file-input').click();
  }

  function _onJsonFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        // _meta 키 제거 후 data에 병합
        const { _meta, ...importedData } = parsed;
        // weeks 배열 → 평탄화 (week_N_topic 등 키로 변환)
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
        // localStorage에 저장
        localStorage.setItem(AppState.STORAGE_KEY, JSON.stringify({ data: importedData, savedAt: new Date().toISOString() }));
        AppState.data = importedData;
        // ★ 탭 0(기본정보)으로 이동 후 현재 탭 복원
        // → 모든 탭의 데이터가 localStorage에 저장되었으므로 탭 전환 시 자동 복원
        const tab0Btn = document.querySelectorAll('.tab-btn')[0];
        if (tab0Btn) showTab(0, tab0Btn);
        // 현재 활성 탭도 복원 (탭0이 아니었다면)
        const activeBtnIdx = [...document.querySelectorAll('.tab-btn')].findIndex(b => b.classList.contains('active'));
        const idx = activeBtnIdx >= 0 ? activeBtnIdx : 0;
        const activeBtn = document.querySelectorAll('.tab-btn')[idx];
        if (idx !== 0) showTab(idx, activeBtn);
        renderPreview();
        toast(`✅ "${file.name}" 불러오기 완료!`, 'success', 3000);
      } catch(err) {
        console.error('JSON import error:', err);
        toast('❌ JSON 파싱 오류: ' + err.message, 'error', 4000);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ── Mobile: Preview Toggle ────────────────────────────────────────
  function togglePreview() {
    const rp  = document.getElementById('right-panel');
    const btn = document.getElementById('preview-toggle-btn');
    const collapsed = rp.classList.toggle('collapsed');
    btn.textContent = collapsed ? '▼ 미리보기 펼치기' : '▲ 미리보기 접기';
  }

  // ── Mobile: handle resize ─────────────────────────────────────────
  function handleResize() {
    const isMobile = window.innerWidth <= 768;
    const rp = document.getElementById('right-panel');
    const btn = document.getElementById('preview-toggle-btn');
    if (!isMobile) {
      // desktop: always show preview, remove collapsed state
      rp.classList.remove('collapsed');
      if (btn) btn.style.display = 'none';
    } else {
      if (btn) btn.style.display = '';
    }
  }