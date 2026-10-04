/*
 * Owner session + project visibility guard (static site, no server).
 *
 * - data/owner.json holds { salt, iterations, verifier }.
 *   verifier = SHA-256(PBKDF2-SHA256(password, salt, iterations)).
 * - On login the PBKDF2 output is kept in sessionStorage; owner checks re-hash it
 *   and compare with the verifier, so copying owner.json alone cannot fake a session.
 * - A page that includes this script with data-guard="<project id>" stays hidden
 *   until the project is confirmed public or the viewer is the owner (fails closed).
 *
 * NOTE: this is a client-side gate. Every file in a public GitHub Pages repo can
 * still be fetched by direct URL. See README.md "보안 모델".
 */
(function () {
  const script = document.currentScript;
  const ROOT = new URL('..', script.src).href;
  const SESSION_KEY = 'portfolio.ownerKey';

  const enc = new TextEncoder();

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function fromHex(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
  }

  async function sha256Hex(bytes) {
    return toHex(await crypto.subtle.digest('SHA-256', bytes));
  }

  function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function readSession() {
    try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }

  async function fetchJson(path) {
    const response = await fetch(new URL(path, ROOT), {cache: 'no-store'});
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  let ownerConfigPromise = null;
  function loadOwnerConfig() {
    if (!ownerConfigPromise) {
      ownerConfigPromise = fetchJson('data/owner.json').catch(() => null);
    }
    return ownerConfigPromise;
  }

  function loadProjects() {
    return fetchJson('data/projects.json');
  }

  async function isOwner() {
    const key = readSession();
    if (!key || !/^[0-9a-f]{64}$/.test(key)) return false;
    const config = await loadOwnerConfig();
    if (!config || !config.verifier) return false;
    return safeEqual(await sha256Hex(fromHex(key)), config.verifier);
  }

  async function login(password) {
    const config = await loadOwnerConfig();
    if (!config || !config.verifier) {
      throw new Error('owner.json이 설정되지 않았습니다. tools/set_owner_password.py를 먼저 실행하세요.');
    }
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      {name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(config.salt), iterations: config.iterations},
      material,
      256
    );
    if (!safeEqual(await sha256Hex(bits), config.verifier)) return false;
    try { sessionStorage.setItem(SESSION_KEY, toHex(bits)); } catch (e) { return false; }
    return true;
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function showOwnerBanner(project) {
    const banner = document.createElement('div');
    banner.className = 'owner-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = '<strong>비공개 프로젝트</strong><span>소유자 모드로 보는 중입니다. 방문자에게는 표시되지 않습니다.</span>';
    banner.querySelector('strong').textContent = `비공개 · ${project.title}`;
    Object.assign(banner.style, {
      position: 'fixed', right: '16px', top: '16px', zIndex: 10000, display: 'grid', gap: '2px',
      maxWidth: 'min(360px, calc(100% - 32px))', padding: '10px 14px', borderRadius: '8px',
      background: '#1f2937', color: '#f9fafb', font: '600 13px/1.45 system-ui, sans-serif',
      boxShadow: '0 10px 24px rgba(0,0,0,.25)'
    });
    banner.addEventListener('click', () => banner.remove());
    document.body.append(banner);
  }

  async function guard(projectId) {
    const root = document.documentElement;
    root.style.visibility = 'hidden';
    try {
      const [registry, owner] = await Promise.all([loadProjects(), isOwner()]);
      const project = (registry.projects || []).find((p) => p.id === projectId);
      const isPublic = project && project.visibility === 'public';
      if (!isPublic && !owner) throw new Error('private');
      root.style.visibility = '';
      if (!isPublic) {
        const show = () => showOwnerBanner(project || {title: projectId});
        if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
      }
    } catch (error) {
      location.replace(`${ROOT}?denied=${encodeURIComponent(projectId)}`);
    }
  }

  window.SiteAuth = {root: ROOT, login, logout, isOwner, loadOwnerConfig, loadProjects};

  const guardId = script.dataset.guard;
  if (guardId) guard(guardId);
})();
