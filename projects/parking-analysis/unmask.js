/*
 * 호수 표시 토글 (기본: 익명).
 *
 * The page carries <script type="application/json" id="unitVault"> with the 익명 → 호수
 * mapping encrypted to the key pair in data/unit_key.json (see tools/unit_vault.py).
 * Choosing "호수 표시" asks for the owner password, unwraps the private key in the
 * browser and decrypts the mapping. Nothing is stored; reloading the page masks again.
 *
 * Mapping payload: { arrays: { NAME: { "익명 006": {unit, label} } }, cells: { "익명 34": "703호" } }
 *   arrays: top-level `const NAME = [...]` data arrays, patched in place, then the page's own
 *           privacy checkbox (vault.toggle) is flipped so its renderer redraws.
 *   cells:  elements with data-unit="익명 34" get their text swapped.
 */
(function () {
  const vaultEl = document.getElementById('unitVault');
  if (!vaultEl) return;
  const script = document.currentScript;
  const KEY_URL = new URL('../../data/unit_key.json', script.src);
  const vault = JSON.parse(vaultEl.textContent);
  const enc = new TextEncoder();
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  let mapping = null;
  let revealed = false;
  const originals = new Map();

  async function decrypt(password) {
    const response = await fetch(KEY_URL, {cache: 'no-store'});
    if (!response.ok) throw new Error('호수 열람 키(data/unit_key.json)를 찾을 수 없습니다.');
    const k = await response.json();
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const wrap = await crypto.subtle.deriveKey(
      {name: 'PBKDF2', hash: 'SHA-256', salt: b64(k.salt), iterations: k.iterations},
      material, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    let pkcs8;
    try {
      pkcs8 = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(k.iv)}, wrap, b64(k.privateKey));
    } catch (e) {
      throw new Error('비밀번호가 맞지 않습니다.');
    }
    const curve = {name: 'ECDH', namedCurve: 'P-256'};
    const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, curve, false, ['deriveBits']);
    const ephemeral = await crypto.subtle.importKey('raw', b64(vault.epk), curve, false, []);
    const shared = await crypto.subtle.deriveBits({name: 'ECDH', public: ephemeral}, privateKey, 256);
    const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      {name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('parking-unit-vault/v1')},
      hkdf, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(vault.iv)}, key, b64(vault.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function lookupArray(name) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
    try { return Function(`return typeof ${name} === 'undefined' ? null : ${name}`)(); } catch (e) { return null; }
  }

  function apply(show) {
    revealed = show;
    for (const [name, map] of Object.entries(mapping.arrays || {})) {
      const records = lookupArray(name);
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (!originals.has(record)) {
          if (!map[record.unit]) continue;
          originals.set(record, {unit: record.unit, label: record.label});
        }
        const anon = originals.get(record);
        const real = map[anon.unit];
        record.unit = show ? real.unit : anon.unit;
        if ('label' in record) record.label = show ? (real.label || anon.label) : anon.label;
      }
    }
    document.querySelectorAll('[data-unit]').forEach((el) => {
      const real = (mapping.cells || {})[el.dataset.unit];
      el.textContent = show && real ? real : el.dataset.unit;
    });
    document.querySelectorAll('[data-reveal-text]').forEach((el) => {
      if (!el.dataset.maskText) el.dataset.maskText = el.textContent;
      el.textContent = show ? el.dataset.revealText : el.dataset.maskText;
    });
    const toggle = vault.toggle && document.getElementById(vault.toggle);
    if (toggle) {
      toggle.checked = !show;
      toggle.dispatchEvent(new Event('change', {bubbles: true}));
    }
    document.dispatchEvent(new CustomEvent('unitmask:change', {detail: {revealed: show}}));
  }

  function buildControl() {
    const box = document.createElement('div');
    box.className = 'unit-toggle';
    box.innerHTML = `
      <span class="ut-label">호수</span>
      <label><input type="radio" name="unitMode" value="mask" checked> 익명</label>
      <label><input type="radio" name="unitMode" value="show"> 표시</label>
      <form class="ut-form" hidden>
        <input type="password" autocomplete="current-password" placeholder="비밀번호" aria-label="호수 표시 비밀번호">
        <button type="submit">확인</button>
        <button type="button" class="ut-cancel">취소</button>
        <span class="ut-msg" role="status"></span>
      </form>`;
    const style = document.createElement('style');
    style.textContent = `
      .unit-toggle{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto;font:600 13px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#e2e8f0}
      .unit-toggle .ut-label{color:#94a3b8}
      .unit-toggle label{display:inline-flex;gap:4px;align-items:center;cursor:pointer}
      .unit-toggle .ut-form{display:inline-flex;gap:6px;align-items:center}
      .unit-toggle .ut-form[hidden]{display:none}
      .unit-toggle input[type=password]{width:150px;padding:4px 8px;border:1px solid #334155;border-radius:6px;background:#0b1220;color:#e2e8f0;font:inherit}
      .unit-toggle button{padding:4px 10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#e2e8f0;font:inherit;cursor:pointer}
      .unit-toggle .ut-msg{color:#fca5a5;font-weight:500}
      .report-nav [data-print]{margin-left:0!important}
      @media print{.unit-toggle{display:none}}`;
    document.head.append(style);

    const nav = document.querySelector('.report-nav');
    const print = nav && nav.querySelector('[data-print]');
    if (print) nav.insertBefore(box, print);
    else if (nav) nav.append(box);
    else document.body.prepend(box);

    const [mask, show] = box.querySelectorAll('input[type=radio]');
    const form = box.querySelector('form');
    const input = form.querySelector('input');
    const msg = form.querySelector('.ut-msg');
    const cancel = () => { form.hidden = true; input.value = ''; msg.textContent = ''; mask.checked = !revealed; show.checked = revealed; };

    mask.addEventListener('change', () => { form.hidden = true; if (mapping) apply(false); });
    show.addEventListener('change', () => {
      if (mapping) { apply(true); return; }
      form.hidden = false; msg.textContent = ''; input.focus();
    });
    form.querySelector('.ut-cancel').addEventListener('click', cancel);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      msg.textContent = '확인 중…';
      try {
        mapping = await decrypt(input.value);
        form.hidden = true; input.value = ''; msg.textContent = '';
        apply(true);
      } catch (error) {
        msg.textContent = error.message || '해제하지 못했습니다.';
        input.select();
      }
    });

    // Hide the page's own 익명 checkbox; the radio above drives it.
    const own = vault.toggle && document.getElementById(vault.toggle);
    const ownLabel = own && own.closest('label');
    if (ownLabel) ownLabel.style.display = 'none';
  }

  window.ParkingUnmask = {
    async unlock(password) { mapping = await decrypt(password); apply(true); },
    mask() { if (mapping) apply(false); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildControl);
  else buildControl();
})();
