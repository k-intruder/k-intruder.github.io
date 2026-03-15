// helpers.js – Handlebars 헬퍼 등록 & 템플릿 컴파일
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: registerHelpers(), compileTemplate()
// AppState.compiled 에 컴파일된 템플릿 저장
// ──────────────────────────────────────────────────────────────────────

// ── Handlebars Helpers ─────────────────────────────────────────────
  function registerHelpers() {
    Handlebars.registerHelper('add', (a, b) => (parseInt(a) || 0) + (parseInt(b) || 0));
    Handlebars.registerHelper('len', arr => arr ? arr.length : 0);
  }

  // ── Template compile ───────────────────────────────────────────────
  function compileTemplate() {
    try {
      const src = document.getElementById('doc-template').innerHTML;
      AppState.compiled = Handlebars.compile(src);
      return true;
    } catch(e) {
      console.error('Template compile error:', e);
      return false;
    }
  }