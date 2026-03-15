// form-fields.js – 입력 필드 & 배열 항목 생성 헬퍼
// ──────────────────────────────────────────────────────────────────────
// 공개 함수:
//   field(name, label, type, options)     – 단일 입력 필드
//   itemField(name, label, type)          – 배열 항목 내 필드
//   arraySection(title, arrName, addFn)   – 동적 배열 섹션
//   wrapItem(content, deleteBtn)          – 배열 항목 래퍼
//   addStringItem(wrap, name)             – 문자열 배열 항목 추가
//   buildSmartSelect(name, val)           – SMART 방법론 선택
//   addSmartMethod(wrap)                  – SMART 교육방법 항목 추가
//   addMethodGuide(wrap)                  – 교육방법 가이드 추가
//   addDigitalTool(wrap)                  – 디지털 도구 추가
//   addActivityGuide(wrap)                – 학습활동 가이드 추가
//   addAppendix(wrap)                     – 부록 섹션 추가
//   _addNestedStepToEl(el)               – 중첩 운영 단계 추가
//   _addNestedSupportToEl(el)            – 중첩 지원 프레임워크 추가
// ──────────────────────────────────────────────────────────────────────

// ── Field helper ──────────────────────────────────────────────────
  function field(label, fieldName, type='input', opts={}) {
    const tag = type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input';
    let inner = '';
    if (type === 'select') {
      inner = (opts.options||[]).map(o => `<option value="${o}">${o}</option>`).join('');
    }
    const cls = type === 'textarea' ? 'form-textarea' : type === 'select' ? 'form-select' : 'form-input';
    const extra = type === 'input' ? `type="${opts.inputType||'text'}"` : '';
    const rows = type === 'textarea' ? `rows="${opts.rows||3}"` : '';
    if (type === 'color') {
      return `<div class="form-row"><label class="form-label">${label}</label>
        <input type="color" class="form-input" data-field="${fieldName}" style="height:36px;padding:2px 4px;width:60px;"> </div>`;
    }
    return `<div class="form-row"><label class="form-label">${label}</label>
      <${tag} class="${cls}" data-field="${fieldName}" ${extra} ${rows}>${inner}</${tag}></div>`;
  }

  function itemField(label, fieldName, type='input', opts={}) {
    const tag = type === 'textarea' ? 'textarea' : 'input';
    const cls = type === 'textarea' ? 'form-textarea' : 'form-input';
    const extra = type === 'input' ? `type="${opts.inputType||'text'}"` : '';
    const rows = type === 'textarea' ? `rows="${opts.rows||2}"` : '';
    return `<div class="form-row"><label class="form-label">${label}</label>
      <${tag} class="${cls}" data-item-field="${fieldName}" ${extra} ${rows} placeholder="${opts.ph||''}" ></${tag}></div>`;
  }

  // ── Array helpers ─────────────────────────────────────────────────
  function arraySection(name, label, addLabel, innerHTML) {
    return `<div class="array-section" data-arr="${name}">
      <div class="array-header"><span class="array-label">${label}</span>
        <button class="btn-add" onclick="App._addItem('${name}')" type="button">+ ${addLabel}</button></div>
      <div class="array-items">${innerHTML}</div></div>`;
  }

  function wrapItem(idx, inner) {
    return `<div class="array-item">
      <div class="array-item-header">
        <span class="array-item-num">#${idx+1}</span>
        <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button>
      </div>${inner}</div>`;
  }

  function addStringItem(wrap, arrName, value='') {
    const idx = wrap.children.length;
    const div = document.createElement('div');
    div.className = 'array-item';
    div.innerHTML = `<div class="array-item-header">
      <span class="array-item-num">#${idx+1}</span>
      <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button></div>
      <input class="form-input" data-item-field="val" type="text" placeholder="학습목표 입력...">`;
    wrap.appendChild(div);
    if (value) div.querySelector('[data-item-field="val"]').value = value;
  }

  const SMART_OPTIONS = {
    'S (Sync)': ['블렌디드러닝','플립드러닝','소셜러닝'],
    'M (Mirroring)': ['캡스톤디자인','산업체협업교육','사례기반학습','현장학습'],
    'A (Affiliation)': ['협동학습','팀기반학습(TBL)','하브루타학습','토론학습'],
    'R (Reinforcement)': ['문제중심학습(PBL)','자기주도학습','실천학습(액션러닝)','게임기반학습','포트폴리오'],
    'T (Tied-up)': ['팀티칭','시뮬레이션기반학습(VR)','융합교육']
  };

  function buildSmartSelect(fieldName, selectedVal='') {
    let opts = `<option value="">-- 교육방법 선택 --</option>`;
    Object.entries(SMART_OPTIONS).forEach(([group, items]) => {
      opts += `<optgroup label="${group}">`;
      items.forEach(item => {
        const sel = item === selectedVal ? ' selected' : '';
        opts += `<option value="${item}"${sel}>${item}</option>`;
      });
      opts += `</optgroup>`;
    });
    return `<div class="form-row"><label class="form-label">교육방법명 (SMART 분류)</label>
      <select class="form-select" data-item-field="${fieldName}">${opts}</select></div>`;
  }

  function addSmartMethod(wrap, obj={}) {
    const idx = wrap.children.length;
    const div = document.createElement('div');
    div.className = 'array-item';
    div.innerHTML = `<div class="array-item-header">
      <span class="array-item-num">#${idx+1}</span>
      <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button></div>
      ${buildSmartSelect('method_name', obj.method_name||'')}
      ${itemField('구체적 실행 전략 (HTML 허용)','description','textarea',{rows:3})}
      ${itemField('활용 도구 및 시기','tools','input',{ph:'예) Replit, 3-5주차'})}`;
    wrap.appendChild(div);
    if (obj.method_name) {
      const sel = div.querySelector('[data-item-field="method_name"]');
      if (sel) sel.value = obj.method_name;
    }
    if (obj.description) div.querySelector('[data-item-field="description"]').value = obj.description;
    if (obj.tools) div.querySelector('[data-item-field="tools"]').value = obj.tools;
  }

  function addMethodGuide(wrap, obj={}) {
    const idx = wrap.children.length;
    const div = document.createElement('div');
    div.className = 'array-item';
    div.innerHTML = `<div class="array-item-header">
      <span class="array-item-num">#${idx+1}</span>
      <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button></div>
      ${buildSmartSelect('method_name', obj.method_name||'')}
      ${itemField('개요 (HTML 허용)','overview','textarea',{rows:3})}
      <div class="nested-array" data-nested="operation_steps">
        <div class="nested-label">📋 운영 단계
          <button class="btn-add" onclick="App._addNestedStep(this)" type="button">+ 단계 추가</button></div>
        <div class="nested-items"></div></div>
      <div class="nested-array" data-nested="support_framework">
        <div class="nested-label">🛠️ 지원 체계
          <button class="btn-add" onclick="App._addNestedSupport(this)" type="button">+ 지원요소 추가</button></div>
        <div class="nested-items"></div></div>
      ${itemField('적용 사례 (HTML 허용)','examples','textarea',{rows:2})}`;
    wrap.appendChild(div);
    if (obj.method_name) {
      const sel = div.querySelector('[data-item-field="method_name"]');
      if (sel) sel.value = obj.method_name;
    }
    if (obj.overview) div.querySelector('[data-item-field="overview"]').value = obj.overview;
    if (obj.examples) div.querySelector('[data-item-field="examples"]').value = obj.examples;
    if (obj.operation_steps) obj.operation_steps.forEach(s => _addNestedStepToEl(div.querySelector('[data-nested="operation_steps"] .nested-items'), s));
    if (obj.support_framework) obj.support_framework.forEach(s => _addNestedSupportToEl(div.querySelector('[data-nested="support_framework"] .nested-items'), s));
  }

  function _addNestedStepToEl(container, obj={}) {
    const d = document.createElement('div'); d.className = 'nested-item';
    d.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:4px">
      <button class="btn-del" onclick="this.closest('.nested-item').remove();App._onChange()" type="button">삭제</button></div>
      ${itemField('단계명','step_name','input',{ph:'예) 도입'})}
      ${itemField('활동 내용','activities','textarea',{rows:2})}
      ${itemField('교수자 역할','instructor_role','input')}
      ${itemField('디지털 도구','tools','input')}`;
    container.appendChild(d);
    if(obj.step_name) d.querySelector('[data-item-field="step_name"]').value=obj.step_name;
    if(obj.activities) d.querySelector('[data-item-field="activities"]').value=obj.activities;
    if(obj.instructor_role) d.querySelector('[data-item-field="instructor_role"]').value=obj.instructor_role;
    if(obj.tools) d.querySelector('[data-item-field="tools"]').value=obj.tools;
  }

  function _addNestedSupportToEl(container, obj={}) {
    const d = document.createElement('div'); d.className = 'nested-item';
    d.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:4px">
      <button class="btn-del" onclick="this.closest('.nested-item').remove();App._onChange()" type="button">삭제</button></div>
      ${itemField('지원 요소','element','input')}
      ${itemField('구체적 적용 방법','methods','textarea',{rows:2})}
      ${itemField('디지털 도구','tools','input')}`;
    container.appendChild(d);
    if(obj.element) d.querySelector('[data-item-field="element"]').value=obj.element;
    if(obj.methods) d.querySelector('[data-item-field="methods"]').value=obj.methods;
    if(obj.tools) d.querySelector('[data-item-field="tools"]').value=obj.tools;
  }

  function addDigitalTool(wrap, obj={}) {
    const idx = wrap.children.length;
    const div = document.createElement('div'); div.className = 'array-item';
    div.innerHTML = `<div class="array-item-header">
      <span class="array-item-num">#${idx+1}</span>
      <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button></div>
      ${itemField('카테고리','category','input',{ph:'예) 실습 환경'})}
      <div class="form-row-2">
        <div><label class="form-label">테두리 색상</label>
          <input type="color" class="form-input" data-item-field="color" style="height:36px;padding:2px 4px;width:100%;" value="#0066cc"></div>
        <div>${itemField('도구명','name','input',{ph:'예) Replit'})}</div></div>
      ${itemField('특징','description','input')}
      ${itemField('활용법 (HTML 허용)','usage','textarea',{rows:3})}`;
    wrap.appendChild(div);
    if(obj.category)    div.querySelector('[data-item-field="category"]').value=obj.category;
    if(obj.color)       div.querySelector('[data-item-field="color"]').value=obj.color;
    if(obj.name)        div.querySelector('[data-item-field="name"]').value=obj.name;
    if(obj.description) div.querySelector('[data-item-field="description"]').value=obj.description;
    if(obj.usage)       div.querySelector('[data-item-field="usage"]').value=obj.usage;
  }

  function addActivityGuide(wrap, obj={}) {
    const idx = wrap.children.length;
    const div = document.createElement('div'); div.className = 'array-item';
    div.innerHTML = `<div class="array-item-header">
      <span class="array-item-num">#${idx+1}</span>
      <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button></div>
      ${buildSmartSelect('method_name', obj.method_name||'')}
      ${itemField('단계','step','input')}
      ${itemField('활동 내용 (HTML)','content','textarea',{rows:3})}
      ${itemField('활용 도구','tools','input')}
      ${itemField('주차별 적용 (HTML)','weekly_tasks','textarea',{rows:2})}
      ${itemField('학습 지원 (HTML)','support_items','textarea',{rows:2})}
      ${itemField('추가 정보 (HTML)','additional_info','textarea',{rows:2})}`;
    wrap.appendChild(div);
    ['step','content','tools','weekly_tasks','support_items','additional_info'].forEach(f => {
      if(obj[f]) div.querySelector(`[data-item-field="${f}"]`).value=obj[f];
    });
    if(obj.method_name){const sel=div.querySelector('[data-item-field="method_name"]');if(sel)sel.value=obj.method_name;}
  }

  function addAppendix(wrap, obj={}) {
    const idx = wrap.children.length;
    const div = document.createElement('div'); div.className = 'array-item';
    div.innerHTML = `<div class="array-item-header">
      <span class="array-item-num">#${idx+1}</span>
      <button class="btn-del" onclick="this.closest('.array-item').remove();App._onChange()" type="button">삭제</button></div>
      ${itemField('섹션 제목','section_title','input')}
      ${itemField('내용 (HTML 허용)','section_content','textarea',{rows:4})}`;
    wrap.appendChild(div);
    if(obj.section_title)   div.querySelector('[data-item-field="section_title"]').value=obj.section_title;
    if(obj.section_content) div.querySelector('[data-item-field="section_content"]').value=obj.section_content;
  }