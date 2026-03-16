// helpers.js – Handlebars 헬퍼 등록 & 템플릿 컴파일
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: registerHelpers(), compileTemplate()
// AppState.compiled 에 컴파일된 템플릿 저장
// ──────────────────────────────────────────────────────────────────────

const TEMPLATE_FILES = {
  default: 'template/preview-2025.hbs.html',
  ncsblue: 'template/preview-2023_2024.hbs.html'
};

// ── Handlebars Helpers ─────────────────────────────────────────────
function registerHelpers() {
  Handlebars.registerHelper('add', (a, b) => (parseInt(a) || 0) + (parseInt(b) || 0));
  Handlebars.registerHelper('len', arr => arr ? arr.length : 0);
}

async function loadTemplateSource(templateName) {
  const key = templateName === 'ncsblue' ? 'ncsblue' : 'default';
  const cached = AppState.templateSources?.[key];
  if (cached) return cached;

  const filePath = TEMPLATE_FILES[key] || TEMPLATE_FILES.default;
  try {
    const res = await fetch(filePath, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const src = await res.text();
    AppState.templateSources = { ...(AppState.templateSources || {}), [key]: src };
    return src;
  } catch (e) {
    console.warn('External template load failed, fallback to embedded template:', key, e);
    const fallbackId = key === 'ncsblue' ? 'doc-template-ncsblue' : 'doc-template';
    const sourceEl = document.getElementById(fallbackId) || document.getElementById('doc-template');
    if (!sourceEl) throw e;
    const src = sourceEl.innerHTML;
    AppState.templateSources = { ...(AppState.templateSources || {}), [key]: src };
    return src;
  }
}

// ── Template compile ───────────────────────────────────────────────
async function compileTemplate(templateName = AppState.selectedTemplate) {
  try {
    const key = templateName === 'ncsblue' ? 'ncsblue' : 'default';
    const src = await loadTemplateSource(key);
    AppState.compiled = Handlebars.compile(src);
    return true;
  } catch(e) {
    console.error('Template compile error:', e);
    return false;
  }
}
