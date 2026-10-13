// GitHub Pages(/projects/weekly/)용 백엔드: 서버 없이 브라우저에서 GitHub Contents API를 직접 호출합니다.
// 보고서는 비공개 저장소 GH.repo의 GH.dir/에 저장되고, 토큰은 이 브라우저의 localStorage에만 보관됩니다.
// 편집자: 해당 저장소 Contents Read and write 토큰 / 조회자: Contents Read-only 토큰
const GH={owner:'k-intruder',repo:'weekly-data',branch:'main',dir:'data'};
const GH_MODE=/\/projects\/weekly\//.test(location.pathname),TOKEN_KEY='weekly.githubToken';
const ghToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||''}catch{return ''}};
function setGhToken(v){try{v?localStorage.setItem(TOKEN_KEY,v):localStorage.removeItem(TOKEN_KEY)}catch{}}
const b64decode=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
function b64encode(s){const bytes=new TextEncoder().encode(s);let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(bin)}
function ghRequest(path,{method='GET',body,etag,root=false}={}){const t=ghToken(),headers={accept:'application/vnd.github+json'};if(t)headers.authorization='Bearer '+t;if(etag)headers['if-none-match']=etag;if(body)headers['content-type']='application/json';
 return fetch((root?'https://api.github.com':`https://api.github.com/repos/${GH.owner}/${GH.repo}`)+path,{method,cache:'no-store',headers,body:body&&JSON.stringify(body)})}
function ghError(res){if(res.status===401)return Error('GitHub 토큰이 만료되었거나 올바르지 않습니다.');if(res.status===409||res.status===422)return Error('다른 기기에서 먼저 저장했습니다. 새로고침 후 다시 시도하세요.');if(res.status===403)return Error(res.headers.get('x-ratelimit-remaining')==='0'?'GitHub API 요청 한도 초과. 잠시 후 다시 시도하세요.':'저장소 쓰기 권한이 없습니다.');return Error('GitHub 요청 실패 ('+res.status+')')}
async function ghFile(name){const res=await ghRequest(`/contents/${GH.dir}/${name}?ref=${GH.branch}`);if(res.status===404)return null;if(!res.ok)throw ghError(res);const f=await res.json();return{value:JSON.parse(b64decode(f.content)),sha:f.sha}}
async function ghPut(name,value,sha,message){const body={message,content:b64encode(JSON.stringify(value,null,2)+'\n'),branch:GH.branch};if(sha)body.sha=sha;const res=await ghRequest(`/contents/${GH.dir}/${name}`,{method:'PUT',body});if(!res.ok)throw ghError(res);return(await res.json()).content.sha}
let ghLogin='';
// app.js의 api()와 같은 응답 형태(me / weeks / report)를 돌려줍니다.
async function ghApi(path,opts={}){const [kind,date]=path.split('/');
 if(kind==='me'){const res=await ghRequest('');if(!res.ok){const e=Error(ghToken()?'이 토큰으로는 '+GH.owner+'/'+GH.repo+' 저장소에 접근할 수 없습니다.':'GitHub 토큰을 입력하세요.');e.needToken=true;throw e}const repo=await res.json();ghLogin='익명';if(ghToken()){const u=await ghRequest('/user',{root:true});if(u.ok)ghLogin=(await u.json()).login}return{email:ghLogin,role:repo.permissions?.push?'editor':'viewer'}}
 if(kind==='weeks'){const f=await ghFile('index.json');return{weeks:f?.value.weeks||[],sha:f?.sha}}
 if(kind==='report'&&opts.method==='PUT'){const {report,sha:base}=JSON.parse(opts.body);const current=await ghFile(date+'.json');if((current?.sha||null)!==base)throw Error('충돌: 서버의 보고서가 변경되었습니다. 새로고침 후 다시 시도하세요.');
  const sha=await ghPut(date+'.json',report,current?.sha,`report: ${date} updated by ${ghLogin}`);const index=await ghFile('index.json'),list=index?.value.weeks||[];
  if(!list.includes(date)){try{await ghPut('index.json',{weeks:[...list,date].sort()},index?.sha,`index: add ${date}`)}catch{return{saved:true,sha,warning:'보고서는 저장되었으나 주차 목록 갱신 실패. data/index.json을 확인하세요.'}}}return{saved:true,sha}}
 if(kind==='report'){const f=await ghFile(date+'.json');if(!f)throw Error('보고서 없음');return{report:f.value,sha:f.sha}}
 throw Error('지원하지 않는 요청')}
// 실시간 반영: data/ 경로의 최신 커밋을 ETag 조건부 요청으로 확인 (304는 요청 한도를 거의 쓰지 않음)
let ghEtag=null,ghHead=null;
async function ghChanged(){const res=await ghRequest(`/commits?sha=${GH.branch}&path=${GH.dir}&per_page=1`,{etag:ghEtag});if(res.status===304||!res.ok)return false;ghEtag=res.headers.get('etag');const head=(await res.json())[0]?.sha||null,changed=ghHead!==null&&head!==ghHead;ghHead=head;return changed}
