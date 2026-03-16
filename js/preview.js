// preview.js – 실시간 미리보기 렌더링
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: renderPreview(), scheduleRender(), setPreviewStatus()
// ──────────────────────────────────────────────────────────────────────

function getPreviewSectionIdByTab(tabIndex) {
  const map = {
    0: 's1',
    1: 's2',
    2: 's3',
    3: 's4',
    4: 's5',
    5: 's6',
    6: 's7',
    7: 's8',
    8: 's9',
    9: 's10',
    10: 's11'
  };
  return map[tabIndex] || 's1';
}

function getPreviewIframeRefs() {
  const iframe = document.getElementById('preview-iframe');
  if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return null;
  return { iframe, win: iframe.contentWindow, doc: iframe.contentDocument };
}

function detectCurrentPreviewSection() {
  const refs = getPreviewIframeRefs();
  if (!refs) return null;

  try {
    const { win, doc } = refs;
    const sections = [...doc.querySelectorAll('.page[id^="s"]')];
    if (!sections.length) return null;

    const scrollY = win.scrollY || 0;
    let current = sections[0];

    for (const sec of sections) {
      const top = sec.offsetTop || 0;
      if (top <= scrollY + 24) {
        current = sec;
      } else {
        break;
      }
    }

    return current ? current.id : null;
  } catch (e) {
    console.warn('detectCurrentPreviewSection error:', e);
    return null;
  }
}

function saveCurrentPreviewPosition() {
  const refs = getPreviewIframeRefs();
  if (!refs) return;

  try {
    const { win } = refs;
    AppState.previewScrollY = win.scrollY || 0;
    AppState.previewCurrentSection = detectCurrentPreviewSection() || AppState.previewCurrentSection || 's1';
  } catch (e) {
    console.warn('saveCurrentPreviewPosition error:', e);
  }
}

function scrollPreviewToTopValue(top, smooth = false) {
  const refs = getPreviewIframeRefs();
  if (!refs) return;

  try {
    refs.win.scrollTo({
      top: Math.max(0, top || 0),
      behavior: smooth ? 'smooth' : 'auto'
    });
  } catch (e) {
    console.warn('scrollPreviewToTopValue error:', e);
  }
}

function scrollPreviewToSection(sectionId, smooth = true) {
  const refs = getPreviewIframeRefs();
  if (!refs) return;

  try {
    const { doc, win } = refs;
    const target = doc.getElementById(sectionId);
    if (!target) return;

    const top = target.offsetTop || 0;
    win.scrollTo({
      top,
      behavior: smooth ? 'smooth' : 'auto'
    });

    AppState.previewCurrentSection = sectionId;
    AppState.previewScrollY = top;
  } catch (e) {
    console.warn('scrollPreviewToSection error:', e);
  }
}

function ensurePreviewHighlightStyle() {
  const refs = getPreviewIframeRefs();
  if (!refs) return;

  const { doc } = refs;
  if (doc.getElementById('preview-highlight-style')) return;

  const style = doc.createElement('style');
  style.id = 'preview-highlight-style';
  style.textContent = `
    .preview-focus-highlight {
      outline: 3px solid #f59e0b;
      outline-offset: 6px;
      border-radius: 8px;
      background: linear-gradient(90deg, rgba(245,158,11,0.18), rgba(245,158,11,0.04));
      transition: all 0.18s ease;
      box-shadow: 0 0 0 6px rgba(245,158,11,0.08);
    }
  `;
  doc.head.appendChild(style);
}

function clearPreviewHighlights() {
  const refs = getPreviewIframeRefs();
  if (!refs) return;

  refs.doc.querySelectorAll('.preview-focus-highlight').forEach(el => {
    el.classList.remove('preview-focus-highlight');
  });
}

function highlightPreviewAnchor(anchorId) {
  const refs = getPreviewIframeRefs();
  if (!refs) return;

  ensurePreviewHighlightStyle();
  clearPreviewHighlights();

  const target = refs.doc.getElementById(anchorId);
  if (!target) return;

  target.classList.add('preview-focus-highlight');
}

function getPreviewAnchorByField(fieldName) {
  const map = {
    development_purpose: 's1',
    development_background_intro: 's1',
    development_goal_summary: 's1',
    course_name: 'anchor-course-spec',
    course_name_en: 'anchor-course-spec',
    publish_date: 'anchor-course-spec',
    department: 'anchor-course-spec',
    year: 'anchor-course-spec',
    semester: 'anchor-course-spec',
    // professor_name: 'anchor-course-spec',
    textbook: 'anchor-course-spec',
    course_type: 'anchor-course-spec',
    credits: 'anchor-course-spec',
    theory_hours: 'anchor-course-spec',
    practice_hours: 'anchor-course-spec',
    ncs_job: 'anchor-course-spec',
    core_competency: 'anchor-course-spec',
    keywords: 'anchor-course-diff',
    course_description: 'anchor-course-desc',
    prerequisite: 'anchor-prerequisite',
    follow_up: 'anchor-prerequisite',
    ai_dx_understanding: 's3',
    integration_summary: 'anchor-design-direction',
    instructor_guide: 's9',
    collaboration_guide: 's9',
    ethics_warning: 's10',
    attendance_rate: 'anchor-evaluation-system',
    attendance_tool: 'anchor-evaluation-system',
    attendance_description: 'anchor-evaluation-system',
    midterm_rate: 'anchor-evaluation-system',
    midterm_tool: 'anchor-evaluation-system',
    midterm_description: 'anchor-evaluation-system',
    final_rate: 'anchor-evaluation-system',
    final_tool: 'anchor-evaluation-system',
    final_description: 'anchor-evaluation-system',
    assignment_rate: 'anchor-evaluation-system',
    assignment_tool: 'anchor-evaluation-system',
    assignment_description: 'anchor-evaluation-system',
  };

  if (fieldName && /^week_\d+_/.test(fieldName)) return 'anchor-weekly-plan';
  return map[fieldName] || null;
}

function getPreviewAnchorByArray(arrName) {
  const map = {
    learning_goals: 'anchor-learning-goals',
    smart_methods: 'anchor-smart-methods',
    method_guides: 'anchor-method-guides',
    digital_tools: 'anchor-digital-tools',
    activity_guides: 'anchor-activity-guides',
    appendix_sections: 'anchor-appendix',
  };
  return map[arrName] || null;
}

function highlightPreviewByInputTarget(el) {
  if (!el) return;

  const fieldName = el.dataset?.field;
  if (fieldName) {
    const anchorId = getPreviewAnchorByField(fieldName);
    if (anchorId) {
      highlightPreviewAnchor(anchorId);
      return;
    }
  }

  const arrayRoot = el.closest('[data-arr]');
  if (arrayRoot) {
    const arrName = arrayRoot.dataset.arr;
    const anchorId = getPreviewAnchorByArray(arrName);
    if (anchorId) highlightPreviewAnchor(anchorId);
  }
}

function renderPreview() {
  if (!AppState.compiled) return;

  const d = getMergedData();
  saveCurrentPreviewPosition();

  const beforeSection = AppState.previewCurrentSection || 's1';
  const beforeScrollY = AppState.previewScrollY || 0;
  const targetSection = AppState.previewScrollTarget || getPreviewSectionIdByTab(AppState.currentTab);

  try {
    const html = AppState.compiled(d);
    const iframe = document.getElementById('preview-iframe');

    iframe.srcdoc = html;

    iframe.addEventListener('load', function onLoad() {
      iframe.removeEventListener('load', onLoad);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            ensurePreviewHighlightStyle();

            if (!AppState.previewAutoScroll) return;

            if (beforeSection === targetSection) {
              scrollPreviewToTopValue(beforeScrollY, false);
              AppState.previewCurrentSection = beforeSection;
              AppState.previewScrollY = beforeScrollY;
            } else {
              scrollPreviewToSection(targetSection, true);
            }
          } catch (e) {
            console.warn('Preview load restore error:', e);
          }
        });
      });
    }, { once: true });

    if (AppState.blobUrl) {
      URL.revokeObjectURL(AppState.blobUrl);
      AppState.blobUrl = null;
    }

    setPreviewStatus('ok', '✅ 렌더링 완료');
  } catch (e) {
    console.error('Render error:', e);
    setPreviewStatus('err', '❌ 렌더링 오류');
  }
}

function setPreviewStatus(cls, msg) {
  const el = document.getElementById('preview-status');
  if (!el) return;
  el.className = cls;
  el.textContent = msg;
}

function scheduleRender() {
  clearTimeout(AppState.renderTimer);
  AppState.previewScrollTarget = getPreviewSectionIdByTab(AppState.currentTab);
  AppState.renderTimer = setTimeout(renderPreview, 250);

  setSaveStatus('saving');
  clearTimeout(AppState.saveTimer);
  AppState.saveTimer = setTimeout(() => {
    saveData();
    setSaveStatus('saved');
  }, 500);
}
