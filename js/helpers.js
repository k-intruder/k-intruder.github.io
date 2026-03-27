// helpers.js – Handlebars 헬퍼 등록 & 템플릿 컴파일
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: registerHelpers(), compileTemplate()
// AppState.compiled 에 컴파일된 템플릿 저장
// ──────────────────────────────────────────────────────────────────────

const TEMPLATE_FILES = {
  default: 'template/preview-2025.hbs.html?v=20260327-v10',
  nondev: 'template/preview-2025-nondev.hbs.html?v=20260327-v10',
  ncsblue: 'template/preview-2023_2024.hbs.html?v=20260327-v10',
  ncsblue_nondev: 'template/preview-2023_2024-nondev.hbs.html?v=20260327-v10'
};

const TEMPLATE_LABELS = {
  default: '2025년 개발 수업형 템플릿',
  nondev: '2025년 비개발 수업형 템플릿',
  ncsblue: '2023·2024년 개발 수업형 템플릿',
  ncsblue_nondev: '2023·2024년 비개발 수업형 템플릿'
};

function normalizeTemplateKey(templateName = AppState?.selectedTemplate) {
  if (templateName === 'ncsblue_nondev' || templateName === 'ncsblue-nondev') return 'ncsblue_nondev';
  if (templateName === 'ncsblue') return 'ncsblue';
  if (templateName === 'nondev') return 'nondev';
  return 'default';
}

function getTemplateLabel(templateName = AppState.selectedTemplate) {
  const key = normalizeTemplateKey(templateName);
  return TEMPLATE_LABELS[key] || TEMPLATE_LABELS.default;
}

function postProcessRenderedHtml(rawHtml) {
  if (!rawHtml) return rawHtml;

  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(rawHtml, 'text/html');
    const head = parsed.head || parsed.documentElement;
    const body = parsed.body || parsed.documentElement;

    if (head && !parsed.getElementById('runtime-page-enhancer-style')) {
      const style = parsed.createElement('style');
      style.id = 'runtime-page-enhancer-style';
      style.textContent = `
        @page{size:A4;margin:0;}
        .page{width:210mm;min-height:297mm !important;height:297mm !important;padding-bottom:28mm !important;box-sizing:border-box;position:relative;overflow:hidden;}
        .page-content{width:100%;}
        .page.page-continuation h1:first-child,.page.page-continuation h2:first-child,.page.page-continuation h3:first-child{margin-top:0;}
        .cover-page{padding-bottom:18mm !important;}
        .cover-page .cover-info{margin-bottom:8mm !important;}
        .continued-label{margin:0 0 10px;padding:0 0 8px;font-size:12.5pt;font-weight:700;line-height:1.35;color:var(--primary-color);border-bottom:1px dashed rgba(0,0,0,.18);}
        .toc-list a{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
        .toc-link-title{flex:1;}
        .toc-page-no{min-width:24px;text-align:right;font-weight:700;color:var(--primary-color);}
        .footer{position:absolute;left:14mm;right:14mm;bottom:8mm;margin-top:0 !important;padding-top:6px;height:auto !important;text-align:center;font-weight:700;letter-spacing:.08em;background:#fff;z-index:2;}
        table{break-inside:auto;page-break-inside:auto;}
        tr,img,.box,h1,h2,h3,h4{break-inside:avoid;page-break-inside:avoid;}
      `;
      head.appendChild(style);
    }

    if (body && !parsed.getElementById('runtime-page-enhancer-script')) {
      const script = parsed.createElement('script');
      script.id = 'runtime-page-enhancer-script';
      script.textContent = `
        (() => {
          if (window.__guidePaginationReady) return;
          window.__guidePaginationReady = true;

          function createShell(srcPage, keepId) {
            const page = srcPage.cloneNode(false);
            page.innerHTML = '';
            const sectionTitle = (srcPage.querySelector('h1')?.textContent || '').trim();
            if (!keepId) {
              page.removeAttribute('id');
              page.classList.add('page-continuation');
            }
            const content = document.createElement('div');
            content.className = 'page-content';
            if (!keepId && sectionTitle) {
              const continuedLabel = document.createElement('div');
              continuedLabel.className = 'continued-label';
              continuedLabel.textContent = sectionTitle + ' (계속)';
              content.appendChild(continuedLabel);
            }
            const footer = document.createElement('div');
            footer.className = 'footer';
            page.appendChild(content);
            page.appendChild(footer);
            return { page, content, footer };
          }

          function getAvailableHeight(page) {
            const cs = window.getComputedStyle(page);
            const padTop = parseFloat(cs.paddingTop) || 0;
            const padBottom = parseFloat(cs.paddingBottom) || 0;
            return page.clientHeight - padTop - padBottom;
          }

          function isOverflow(page, content, available) {
            return content.scrollHeight > available + 1;
          }

          function makeTableBase(table) {
            const base = table.cloneNode(false);
            const colgroups = table.querySelectorAll(':scope > colgroup');
            if (table.caption) base.appendChild(table.caption.cloneNode(true));
            colgroups.forEach(colgroup => base.appendChild(colgroup.cloneNode(true)));
            if (table.tHead) base.appendChild(table.tHead.cloneNode(true));
            const body = document.createElement('tbody');
            base.appendChild(body);
            return { base, body };
          }

          function getTableRows(table) {
            if (table.tBodies && table.tBodies.length) {
              return Array.from(table.tBodies).flatMap(tb => Array.from(tb.rows).map(row => row.cloneNode(true)));
            }
            const headerCount = table.tHead ? table.tHead.rows.length : 0;
            return Array.from(table.rows).slice(headerCount).map(row => row.cloneNode(true));
          }

          function splitTableNode(table, current, available) {
            const rows = getTableRows(table);
            if (!rows.length) return null;

            const first = makeTableBase(table);
            current.content.appendChild(first.base);
            let fitCount = 0;

            for (let i = 0; i < rows.length; i++) {
              first.body.appendChild(rows[i].cloneNode(true));
              if (isOverflow(current.page, current.content, available)) {
                first.body.removeChild(first.body.lastChild);
                break;
              }
              fitCount += 1;
            }

            current.content.removeChild(first.base);
            if (!fitCount) return null;

            let remainingNode = null;
            if (fitCount < rows.length) {
              const rest = makeTableBase(table);
              rows.slice(fitCount).forEach(row => rest.body.appendChild(row.cloneNode(true)));
              remainingNode = rest.base;
            }

            return { fittedNode: first.base, remainingNode };
          }

          function splitListNode(list, current, available) {
            const items = Array.from(list.children).filter(child => child.tagName === 'LI');
            if (!items.length) return null;

            const first = list.cloneNode(false);
            current.content.appendChild(first);
            let fitCount = 0;

            for (let i = 0; i < items.length; i++) {
              first.appendChild(items[i].cloneNode(true));
              if (isOverflow(current.page, current.content, available)) {
                first.removeChild(first.lastChild);
                break;
              }
              fitCount += 1;
            }

            current.content.removeChild(first);
            if (!fitCount) return null;

            let remainingNode = null;
            if (fitCount < items.length) {
              const rest = list.cloneNode(false);
              items.slice(fitCount).forEach(item => rest.appendChild(item.cloneNode(true)));
              remainingNode = rest;
            }

            return { fittedNode: first, remainingNode };
          }

          function splitNodeForPage(node, current, available) {
            if (!(node instanceof Element)) return null;
            if (node.tagName === 'TABLE') return splitTableNode(node, current, available);
            if (node.tagName === 'UL' || node.tagName === 'OL') return splitListNode(node, current, available);
            return null;
          }

          function paginateSourcePage(srcPage, measureHost) {
            const sourceNodes = Array.from(srcPage.childNodes)
              .filter(node => !(node.nodeType === 1 && node.classList && node.classList.contains('footer')))
              .map(node => node.cloneNode(true));

            const outPages = [];
            let current = createShell(srcPage, true);
            measureHost.appendChild(current.page);
            let available = getAvailableHeight(current.page);

            sourceNodes.forEach(node => {
              let workingNode = node;

              while (workingNode) {
                current.content.appendChild(workingNode);
                if (!isOverflow(current.page, current.content, available)) {
                  workingNode = null;
                  continue;
                }

                current.content.removeChild(workingNode);
                const split = splitNodeForPage(workingNode, current, available);

                if (split && split.fittedNode) {
                  current.content.appendChild(split.fittedNode);
                  outPages.push(current.page);
                  current = createShell(srcPage, false);
                  measureHost.appendChild(current.page);
                  available = getAvailableHeight(current.page);
                  workingNode = split.remainingNode;
                  continue;
                }

                if (current.content.childNodes.length === 0) {
                  current.content.appendChild(workingNode);
                  workingNode = null;
                  continue;
                }

                outPages.push(current.page);
                current = createShell(srcPage, false);
                measureHost.appendChild(current.page);
                available = getAvailableHeight(current.page);
              }
            });

            outPages.push(current.page);
            return outPages;
          }

          function updatePageReferences() {
            const pages = Array.from(document.querySelectorAll('.page'));
            const pageNoById = new Map();

            pages.forEach((page, idx) => {
              const pageNumber = idx + 1;
              if (page.id) pageNoById.set(page.id, pageNumber);

              let footer = page.querySelector(':scope > .footer');
              if (!footer) {
                footer = document.createElement('div');
                footer.className = 'footer';
                page.appendChild(footer);
              }
              footer.textContent = String(pageNumber);
              footer.setAttribute('data-page-number', String(pageNumber));
            });

            document.querySelectorAll('.toc-list a[href^="#"]').forEach(anchor => {
              const href = anchor.getAttribute('href') || '';
              const targetId = href.slice(1);
              const pageNumber = pageNoById.get(targetId);
              if (!pageNumber) return;

              const existingPageNo = anchor.querySelector('.toc-page-no');
              if (existingPageNo) {
                existingPageNo.textContent = String(pageNumber);
                return;
              }

              const titleWrapper = document.createElement('span');
              titleWrapper.className = 'toc-link-title';
              while (anchor.firstChild) titleWrapper.appendChild(anchor.firstChild);

              const pageNo = document.createElement('span');
              pageNo.className = 'toc-page-no';
              pageNo.textContent = String(pageNumber);

              anchor.appendChild(titleWrapper);
              anchor.appendChild(pageNo);
            });
          }

          function paginateAll() {
            const originalPages = Array.from(document.querySelectorAll('.page')).filter(page => !page.closest('#__guide_measure_host'));
            if (!originalPages.length) {
              updatePageReferences();
              return;
            }

            const measureHost = document.createElement('div');
            measureHost.id = '__guide_measure_host';
            measureHost.style.position = 'fixed';
            measureHost.style.left = '-99999px';
            measureHost.style.top = '0';
            measureHost.style.width = '210mm';
            measureHost.style.visibility = 'hidden';
            measureHost.style.pointerEvents = 'none';
            measureHost.style.zIndex = '-1';
            document.body.appendChild(measureHost);

            const fragment = document.createDocumentFragment();
            originalPages.forEach(srcPage => {
              const paged = paginateSourcePage(srcPage, measureHost);
              paged.forEach(page => fragment.appendChild(page));
            });

            const firstOriginal = originalPages[0];
            originalPages.forEach(page => page.remove());
            document.body.insertBefore(fragment, document.body.firstChild);
            measureHost.remove();
            updatePageReferences();
          }

          function runPagination() {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                paginateAll();
              });
            });
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runPagination, { once: true });
          } else {
            runPagination();
          }

          window.addEventListener('load', () => {
            window.setTimeout(() => {
              paginateAll();
            }, 80);
          }, { once: true });
        })();
      `;
      body.appendChild(script);
    }

    const pages = [...parsed.querySelectorAll('.page')];
    const pageNoById = new Map();

    pages.forEach((page, idx) => {
      const pageNumber = idx + 1;
      if (page.id) pageNoById.set(page.id, pageNumber);

      let footer = [...page.children].find(el => el.classList && el.classList.contains('footer'));
      if (!footer) {
        footer = parsed.createElement('div');
        footer.className = 'footer';
        page.appendChild(footer);
      }
      footer.textContent = String(pageNumber);
      footer.setAttribute('data-page-number', String(pageNumber));
    });

    parsed.querySelectorAll('.toc-list a[href^="#"]').forEach(anchor => {
      const href = anchor.getAttribute('href') || '';
      const targetId = href.slice(1);
      const pageNumber = pageNoById.get(targetId);
      if (!pageNumber) return;

      const existingPageNo = anchor.querySelector('.toc-page-no');
      if (existingPageNo) {
        existingPageNo.textContent = String(pageNumber);
        return;
      }

      const titleWrapper = parsed.createElement('span');
      titleWrapper.className = 'toc-link-title';
      while (anchor.firstChild) titleWrapper.appendChild(anchor.firstChild);

      const pageNo = parsed.createElement('span');
      pageNo.className = 'toc-page-no';
      pageNo.textContent = String(pageNumber);

      anchor.appendChild(titleWrapper);
      anchor.appendChild(pageNo);
    });

    return '<!DOCTYPE html>\n' + parsed.documentElement.outerHTML;
  } catch (e) {
    console.warn('postProcessRenderedHtml error:', e);
    return rawHtml;
  }
}

// ── Handlebars Helpers ─────────────────────────────────────────────
function registerHelpers() {
  Handlebars.registerHelper('add', (a, b) => (parseInt(a) || 0) + (parseInt(b) || 0));
  Handlebars.registerHelper('len', arr => arr ? arr.length : 0);
}

async function loadTemplateSource(templateName) {
  const key = normalizeTemplateKey(templateName);
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
    const fallbackMap = {
      default: 'doc-template',
      nondev: 'doc-template-nondev',
      ncsblue: 'doc-template-ncsblue',
      ncsblue_nondev: 'doc-template-ncsblue-nondev'
    };
    const fallbackId = fallbackMap[key] || 'doc-template';
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
    const key = normalizeTemplateKey(templateName);
    const src = await loadTemplateSource(key);
    AppState.compiled = Handlebars.compile(src);
    return true;
  } catch(e) {
    console.error('Template compile error:', e);
    return false;
  }
}
