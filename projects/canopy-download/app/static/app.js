const csrf = document.querySelector('meta[name="csrf-token"]').content;
const $ = (id) => document.getElementById(id);
let current = { phase: 'disconnected', assets: [], scanned_items: 0, completed: 0, total: 0, error: '' };
let page = 0;
const pageSize = 100;

async function post(path, payload) {
  const response = await fetch(path, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
}

async function refresh() {
  try {
    const response = await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('서버 연결이 끊겼습니다.');
    current = await response.json();
    render();
  } catch (error) {
    $('connection-state').textContent = error.message;
  }
}

function statusText(status) {
  return { available: '저장 전', saved: '저장 완료', failed: '실패' }[status] || status;
}

function dateText(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

function cell(text, className = '') {
  const element = document.createElement('td');
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

async function save(ids) {
  try {
    await post('/api/download', { ids });
    await refresh();
  } catch (error) {
    $('error-panel').textContent = error.message;
    $('error-panel').hidden = false;
  }
}

function render() {
  const assets = current.assets || [];
  const busy = current.phase === 'scanning' || current.phase === 'downloading';
  const saved = assets.filter((asset) => asset.status === 'saved').length;
  $('metric-tasks').textContent = current.phase === 'disconnected' ? '—' : new Set(assets.map((asset) => asset.task_id)).size.toLocaleString('ko-KR');
  $('metric-items').textContent = current.phase === 'disconnected' ? '—' : current.scanned_items.toLocaleString('ko-KR');
  $('metric-assets').textContent = current.phase === 'disconnected' ? '—' : assets.length.toLocaleString('ko-KR');
  $('metric-saved').textContent = current.phase === 'disconnected' ? '—' : saved.toLocaleString('ko-KR');
  $('output-path').textContent = current.output_dir || 'downloads';
  $('connect-button').disabled = busy;
  $('download-all').disabled = current.phase !== 'ready' || assets.length === 0;
  $('connection-state').textContent = {
    disconnected: '연결 대기 중', scanning: `목록 조회 중 · STAC 항목 ${current.scanned_items}건`,
    ready: '목록 조회 완료', downloading: '파일 저장 중', error: '조회 실패'
  }[current.phase] || current.phase;
  $('library-subtitle').textContent = current.phase === 'ready'
    ? '필요한 파일만 저장하거나 전체 일괄 저장을 시작할 수 있습니다.'
    : 'Canopy 계정을 연결하면 조회 가능한 파일이 여기에 표시됩니다.';

  $('error-panel').hidden = !current.error;
  if (current.error) $('error-panel').textContent = current.error;

  const progress = $('progress-panel');
  progress.hidden = !busy;
  if (busy) {
    $('progress-title').textContent = current.phase === 'scanning' ? '전달 완료 항목 조회 중' : '산출물 저장 중';
    $('progress-count').textContent = current.phase === 'scanning'
      ? `${current.scanned_items}개 항목 확인` : `${current.completed} / ${current.total}개 파일`;
    $('progress-fill').style.width = current.phase === 'scanning' ? '30%' : `${current.total ? 100 * current.completed / current.total : 0}%`;
    progress.classList.toggle('indeterminate', current.phase === 'scanning');
  }

  const query = $('search-input').value.trim().toLocaleLowerCase();
  const filter = $('status-filter').value;
  const filtered = assets.filter((asset) =>
    (filter === 'all' || asset.status === filter) &&
    (!query || `${asset.task_id} ${asset.item_id} ${asset.asset} ${asset.product}`.toLocaleLowerCase().includes(query))
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages - 1);
  $('result-count').textContent = `${filtered.length.toLocaleString('ko-KR')}개 파일`;
  $('page-label').textContent = `${page + 1} / ${pages}`;
  $('prev-page').disabled = page === 0;
  $('next-page').disabled = page >= pages - 1;

  const tbody = $('asset-rows');
  tbody.replaceChildren();
  $('empty-state').hidden = filtered.length > 0;
  if (!filtered.length) {
    $('empty-state').querySelector('p').textContent = assets.length ? '검색어나 상태 필터를 바꿔보세요.' : '토큰을 입력하고 목록을 불러오세요.';
  }
  for (const asset of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
    const row = document.createElement('tr');
    const task = cell(asset.task_id, 'mono task-id');
    task.title = asset.task_id;
    row.append(task);
    const filename = cell(asset.asset, 'filename');
    filename.title = asset.asset;
    row.append(filename);
    row.append(cell(asset.product, 'product'));
    row.append(cell(dateText(asset.datetime), 'date'));
    const statusCell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `status status-${asset.status}`;
    pill.textContent = statusText(asset.status);
    statusCell.append(pill);
    if (asset.error) statusCell.title = asset.error;
    row.append(statusCell);
    const action = document.createElement('td');
    action.className = 'actions';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'text-button';
    saveButton.textContent = asset.status === 'failed' ? '다시 저장' : asset.status === 'saved' ? '저장됨' : '저장';
    saveButton.disabled = busy || asset.status === 'saved' || current.phase !== 'ready';
    saveButton.addEventListener('click', () => save([asset.id]));
    action.append(saveButton);
    if (asset.status === 'saved') {
      const link = document.createElement('a');
      link.href = `/api/file/${encodeURIComponent(asset.id)}`;
      link.textContent = '브라우저 다운로드';
      link.className = 'file-link';
      action.append(link);
    }
    row.append(action);
    tbody.append(row);
  }
}

$('connect-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('token-input');
  try {
    await post('/api/connect', { token: input.value.trim() });
    input.value = '';
    $('error-panel').hidden = true;
    page = 0;
    await refresh();
  } catch (error) {
    $('error-panel').textContent = error.message;
    $('error-panel').hidden = false;
  }
});
$('download-all').addEventListener('click', () => save('all'));
$('search-input').addEventListener('input', () => { page = 0; render(); });
$('status-filter').addEventListener('change', () => { page = 0; render(); });
$('prev-page').addEventListener('click', () => { page--; render(); });
$('next-page').addEventListener('click', () => { page++; render(); });
refresh();
setInterval(refresh, 1500);
