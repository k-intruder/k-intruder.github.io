// preview.js – 실시간 미리보기 렌더링
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: renderPreview(), scheduleRender(), setPreviewStatus()
//
// ★ 실시간 미리보기 동작 흐름:
//   사용자 입력
//     → scheduleRender() [300ms 디바운스]
//       → collect()      [DOM 데이터 수집]
//         → AppState.compiled(d)  [Handlebars 렌더링]
//           → Blob URL   [iframe src 갱신]
//             → 미리보기 화면 업데이트
// ──────────────────────────────────────────────────────────────────────

// ── Render Preview ─────────────────────────────────────────────────
  function renderPreview() {
    if (!AppState.compiled) return;
    const d = collect();
    try {
      const html = AppState.compiled(d);
      if (AppState.blobUrl) URL.revokeObjectURL(AppState.blobUrl);
      const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
      AppState.blobUrl = URL.createObjectURL(blob);
      const iframe = document.getElementById('preview-iframe');
      iframe.src = AppState.blobUrl;
      setPreviewStatus('ok', '✅ 렌더링 완료');
    } catch(e) {
      console.error('Render error:', e);
      setPreviewStatus('err', '❌ 렌더링 오류');
    }
  }

  function setPreviewStatus(cls, msg) {
    const el = document.getElementById('preview-status');
    el.className = cls;
    el.textContent = msg;
  }

  function scheduleRender() {
    clearTimeout(AppState.renderTimer);
    AppState.renderTimer = setTimeout(renderPreview, 300);
    setSaveStatus('saving');
    clearTimeout(AppState.saveTimer);
    AppState.saveTimer = setTimeout(() => { saveData(); setSaveStatus('saved'); }, 600);
  }