// state.js – 공유 상태 관리
// ──────────────────────────────────────────────────────────────
// 모든 JS 모듈이 이 객체를 통해 상태를 공유합니다.
// window._AppState 전역 객체로 노출됩니다.

(function() {
  'use strict';
  window._AppState = {
    STORAGE_KEY          : 'guide_tool_v2',
    data                 : {},
    compiled             : null,
    renderTimer          : null,
    saveTimer            : null,
    currentTab           : 0,
    blobUrl              : null,
    docxLib              : null,
    previewAutoScroll    : true,
    previewScrollTarget  : null,
    previewCurrentSection: null,
    previewScrollY       : 0,
    isResetting          : false,
    selectedTemplate     : 'default',
  };

  // 편의 접근자 (전역 노출)
  window.AppState = {
    get STORAGE_KEY() { return window._AppState.STORAGE_KEY; },

    get data()        { return window._AppState.data; },
    set data(v)       { window._AppState.data = v; },

    get compiled()    { return window._AppState.compiled; },
    set compiled(v)   { window._AppState.compiled = v; },

    get renderTimer() { return window._AppState.renderTimer; },
    set renderTimer(v){ window._AppState.renderTimer = v; },

    get saveTimer()   { return window._AppState.saveTimer; },
    set saveTimer(v)  { window._AppState.saveTimer = v; },

    get currentTab()  { return window._AppState.currentTab; },
    set currentTab(v) { window._AppState.currentTab = v; },

    get blobUrl()     { return window._AppState.blobUrl; },
    set blobUrl(v)    { window._AppState.blobUrl = v; },

    get docxLib()     { return window._AppState.docxLib; },
    set docxLib(v)    { window._AppState.docxLib = v; },

    get previewAutoScroll()    { return window._AppState.previewAutoScroll; },
    set previewAutoScroll(v)   { window._AppState.previewAutoScroll = v; },

    get previewScrollTarget()  { return window._AppState.previewScrollTarget; },
    set previewScrollTarget(v) { window._AppState.previewScrollTarget = v; },

    get previewCurrentSection()  { return window._AppState.previewCurrentSection; },
    set previewCurrentSection(v) { window._AppState.previewCurrentSection = v; },

    get previewScrollY()       { return window._AppState.previewScrollY; },
    set previewScrollY(v)      { window._AppState.previewScrollY = v; },

    get isResetting()          { return window._AppState.isResetting; },
    set isResetting(v)         { window._AppState.isResetting = v; },

    get selectedTemplate()     { return window._AppState.selectedTemplate; },
    set selectedTemplate(v)    { window._AppState.selectedTemplate = v; },
  };
})();
