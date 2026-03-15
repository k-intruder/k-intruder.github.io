// storage.js – LocalStorage 저장/불러오기 + Toast 알림
// ──────────────────────────────────────────────────────────────────────
// 공개 함수: saveData(), loadData(), setSaveStatus(), toast()
// 저장 키: AppState.STORAGE_KEY ('guide_tool_v2')
// ──────────────────────────────────────────────────────────────────────

// ── LocalStorage ───────────────────────────────────────────────────
  function saveData() {
    try {
      const snapshot = collect();
      localStorage.setItem(AppState.STORAGE_KEY, JSON.stringify({data: snapshot, savedAt: new Date().toISOString()}));
    } catch(e) { setSaveStatus('error'); }
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(AppState.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  function setSaveStatus(s) {
    const el = document.getElementById('save-status');
    if (s === 'saved')  { el.textContent = '● 저장됨';    el.style.color = '#86efac'; }
    if (s === 'saving') { el.textContent = '● 저장 중...'; el.style.color = '#fde68a'; }
    if (s === 'error')  { el.textContent = '● 저장 실패';  el.style.color = '#fca5a5'; }
  }

  // ── Toast ──────────────────────────────────────────────────────────
  function toast(msg, type='info', duration=2500) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'slideOut .3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }