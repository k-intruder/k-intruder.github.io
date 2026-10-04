(function () {
  const DRAFT_KEY = 'portfolio.visibilityDraft';
  const VISIBILITY_LABEL = {public: '공개', private: '비공개'};

  const $ = (selector) => document.querySelector(selector);
  const grid = $('#projectGrid');
  const ownerBar = $('#ownerBar');
  const previewToggle = $('#previewToggle');
  const draftButton = $('#draftButton');
  const loginDialog = $('#loginDialog');
  const draftDialog = $('#draftDialog');

  let registry = {profile: {}, projects: []};
  let owner = false;
  let draft = readDraft();

  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch (e) { return {}; }
  }

  function writeDraft() {
    try {
      if (Object.keys(draft).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* draft stays in memory only */ }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function effectiveVisibility(project) {
    return draft[project.id] || project.visibility;
  }

  function isPublishedPublic(project) {
    return project.visibility === 'public';
  }

  function pendingChanges() {
    return registry.projects.filter((p) => draft[p.id] && draft[p.id] !== p.visibility);
  }

  function renderProfile() {
    const profile = registry.profile || {};
    if (profile.name) {
      $('#profileName').textContent = profile.name;
      document.title = `${profile.name} Portfolio`;
    }
    if (profile.headline) $('#profileHeadline').textContent = profile.headline;
    $('#profileIntro').textContent = profile.intro || '';
    const links = $('#profileLinks');
    links.replaceChildren(...(profile.links || []).map((link) => {
      const item = el('li');
      const anchor = el('a', null, link.label);
      anchor.href = link.url;
      anchor.rel = 'noreferrer';
      item.append(anchor);
      return item;
    }));
  }

  function renderCard(project, ownerView) {
    const visibility = effectiveVisibility(project);
    const card = el('article', 'project-card');
    card.dataset.visibility = visibility;

    const meta = el('div', 'card-meta');
    if (project.status) meta.append(el('span', 'pill', project.status));
    if (project.period) meta.append(el('span', 'period', project.period));
    if (ownerView) {
      const badge = el('span', `vis-badge vis-${visibility}`, VISIBILITY_LABEL[visibility] || visibility);
      if (draft[project.id] && draft[project.id] !== project.visibility) {
        badge.textContent += ' (미반영)';
        badge.classList.add('vis-pending');
      }
      meta.append(badge);
    }
    card.append(meta);

    const title = el('h3', 'card-title');
    const link = el('a', null, project.title);
    link.href = project.path;
    title.append(link);
    card.append(title);

    if (project.summary) card.append(el('p', 'card-summary', project.summary));

    if (project.highlights && project.highlights.length) {
      const list = el('ul', 'card-highlights');
      project.highlights.forEach((text) => list.append(el('li', null, text)));
      card.append(list);
    }

    if (project.tags && project.tags.length) {
      const tags = el('ul', 'card-tags');
      tags.setAttribute('aria-label', '기술 태그');
      project.tags.forEach((tag) => tags.append(el('li', null, tag)));
      card.append(tags);
    }

    const footer = el('div', 'card-footer');
    const open = el('a', 'card-open', '프로젝트 보기 →');
    open.href = project.path;
    footer.append(open);

    if (ownerView) {
      const toggle = el('label', 'vis-switch');
      const input = el('input');
      input.type = 'checkbox';
      input.checked = visibility === 'public';
      input.setAttribute('aria-label', `${project.title} 공개`);
      input.addEventListener('change', () => setVisibility(project, input.checked ? 'public' : 'private'));
      toggle.append(input, el('span', 'vis-track'), el('span', 'vis-text', '공개'));
      footer.append(toggle);
    }
    card.append(footer);
    return card;
  }

  function render() {
    const ownerView = owner && !previewToggle.checked;
    // Visitor view (and owner preview) shows only what is published in projects.json.
    const visible = ownerView ? registry.projects : registry.projects.filter(isPublishedPublic);

    grid.replaceChildren(...visible.map((p) => renderCard(p, ownerView)));
    $('#emptyState').hidden = visible.length > 0;

    const publicCount = registry.projects.filter(isPublishedPublic).length;
    $('#projectCount').textContent = ownerView
      ? `전체 ${registry.projects.length} · 공개 ${publicCount}`
      : `${visible.length}`;

    ownerBar.hidden = !owner;
    document.body.classList.toggle('is-owner', owner);
    $('#ownerLoginButton').hidden = owner;

    const changes = pendingChanges().length;
    draftButton.hidden = !owner || changes === 0;
    draftButton.textContent = `미반영 변경 ${changes}건`;
  }

  function setVisibility(project, visibility) {
    if (visibility === project.visibility) delete draft[project.id];
    else draft[project.id] = visibility;
    writeDraft();
    render();
  }

  function buildExport() {
    const projects = registry.projects.map((p) => ({...p, visibility: effectiveVisibility(p)}));
    return JSON.stringify({...registry, projects}, null, 2) + '\n';
  }

  function openDraftDialog() {
    const list = $('#draftList');
    list.replaceChildren(...pendingChanges().map((p) => {
      const item = el('li');
      item.append(
        el('strong', null, p.title),
        el('span', null, `${VISIBILITY_LABEL[p.visibility]} → ${VISIBILITY_LABEL[draft[p.id]]}`)
      );
      return item;
    }));
    draftDialog.showModal();
  }

  async function refreshOwner() {
    owner = await SiteAuth.isOwner();
    render();
  }

  // --- events -------------------------------------------------------------

  $('#ownerLoginButton').addEventListener('click', () => {
    $('#loginError').hidden = true;
    $('#passwordInput').value = '';
    loginDialog.showModal();
  });

  $('#loginCancel').addEventListener('click', () => loginDialog.close());

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = $('#loginSubmit');
    const error = $('#loginError');
    submit.disabled = true;
    error.hidden = true;
    try {
      const ok = await SiteAuth.login($('#passwordInput').value);
      if (!ok) throw new Error('비밀번호가 올바르지 않습니다.');
      loginDialog.close();
      await refreshOwner();
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      submit.disabled = false;
      $('#passwordInput').value = '';
    }
  });

  $('#logoutButton').addEventListener('click', () => {
    SiteAuth.logout();
    previewToggle.checked = false;
    refreshOwner();
  });

  previewToggle.addEventListener('change', render);
  draftButton.addEventListener('click', openDraftDialog);
  $('#draftClose').addEventListener('click', () => draftDialog.close());

  $('#draftDiscard').addEventListener('click', () => {
    draft = {};
    writeDraft();
    draftDialog.close();
    render();
  });

  $('#draftCopy').addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(buildExport());
      event.target.textContent = '복사됨';
    } catch (e) {
      event.target.textContent = '복사 실패';
    }
    setTimeout(() => { event.target.textContent = 'JSON 복사'; }, 1600);
  });

  $('#draftDownload').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([buildExport()], {type: 'application/json'}));
    const anchor = el('a');
    anchor.href = url;
    anchor.download = 'projects.json';
    anchor.click();
    URL.revokeObjectURL(url);
  });

  // --- boot ---------------------------------------------------------------

  $('#year').textContent = new Date().getFullYear();
  const params = new URLSearchParams(location.search);
  if (params.has('denied')) {
    $('#deniedNotice').hidden = false;
    history.replaceState(null, '', location.pathname);
  }

  Promise.all([SiteAuth.loadProjects(), SiteAuth.isOwner()])
    .then(([data, isOwner]) => {
      registry = data;
      owner = isOwner;
      // Drop draft entries for projects that no longer exist or already match.
      Object.keys(draft).forEach((id) => {
        const project = registry.projects.find((p) => p.id === id);
        if (!project || project.visibility === draft[id]) delete draft[id];
      });
      writeDraft();
      renderProfile();
      render();
    })
    .catch((error) => {
      console.error(error);
      $('#loadError').hidden = false;
    });
})();
