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
    const d = getMergedData(); // ★ AppState.data + 현재 탭 DOM 병합
    try {
      const html = AppState.compiled(d);
      const iframe = document.getElementById('preview-iframe');
      // ★ srcdoc 사용: src 변경 없이 내용만 교체 → 스크롤 위치 유지
      // (Blob URL 방식은 매번 iframe reload를 일으켜 첫 페이지로 이동)
      if (iframe.contentDocument) {
        const scrollY = iframe.contentDocument.documentElement
                          ? (iframe.contentDocument.scrollingElement || iframe.contentDocument.documentElement).scrollTop
                          : 0;
        iframe.srcdoc = html;
        // 렌더 후 스크롤 위치 복원
        iframe.addEventListener('load', function onLoad() {
          iframe.removeEventListener('load', onLoad);
          try {
            const sc = iframe.contentDocument.scrollingElement || iframe.contentDocument.documentElement;
            if (sc) sc.scrollTop = scrollY;
          } catch(e) {}
        }, { once: true });
      } else {
        iframe.srcdoc = html;
      }
      // Blob URL cleanup (더 이상 사용 안 하지만 기존 것 정리)
      if (AppState.blobUrl) { URL.revokeObjectURL(AppState.blobUrl); AppState.blobUrl = null; }
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