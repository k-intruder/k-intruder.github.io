const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const decode=s=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
async function authenticate(req,env){
 const jwt=req.headers.get('cf-access-jwt-assertion');if(!jwt)throw {status:401,message:'Cloudflare Access 로그인이 필요합니다.'};
 const [h,p,s,...rest]=jwt.split('.');if(rest.length||!s)throw {status:401,message:'잘못된 인증 정보'};
 const header=decode(h),payload=decode(p);if(header.alg!=='RS256'||!header.kid)throw {status:401,message:'인증 알고리즘 오류'};
 const team=env.CF_ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//,'').replace(/\/$/,'');
 if(!team||!env.CF_ACCESS_AUD||payload.iss!==`https://${team}`||!(Array.isArray(payload.aud)?payload.aud:[payload.aud]).includes(env.CF_ACCESS_AUD)||payload.exp<=Date.now()/1000||payload.nbf>Date.now()/1000)throw {status:403,message:'인증 검증 실패'};
 const keys=await fetch(`https://${team}/cdn-cgi/access/certs`).then(r=>r.json());const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw {status:403,message:'인증 키 오류'};
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes,new TextEncoder().encode(h+'.'+p)))throw {status:403,message:'인증 서명 오류'};
 const email=String(payload.email||'').toLowerCase();const allowed=(env.ALLOWED_EMAILS||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(!allowed.includes(email))throw {status:403,message:'허용되지 않은 계정'};
 return {email,role:email===String(env.EDITOR_EMAIL||'').toLowerCase()?'editor':'viewer'};
}
async function gh(env,path,method='GET',body){const owner=env.GH_OWNER,repo=env.GH_REPO,branch=env.GH_BRANCH||'main';if(!owner||!repo||!env.GITHUB_TOKEN)throw {status:500,message:'GitHub 환경변수 미설정'};
 const url=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`+(method==='GET'?`?ref=${encodeURIComponent(branch)}`:'');
 const res=await fetch(url,{method,headers:{'authorization':`Bearer ${env.GITHUB_TOKEN}`,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'stellarvision-weekly-v3','content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(res.status===404)return null;const out=await res.json().catch(()=>({}));if(!res.ok)throw {status:res.status===409||res.status===422?409:502,message:res.status===409||res.status===422?'다른 사용자가 먼저 저장했습니다. 새로고침 후 다시 시도하세요.':'GitHub 요청 실패 ('+res.status+')'};return out;
}
function fromBase64(content){const bin=atob(content.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))}
function toBase64(s){const bytes=new TextEncoder().encode(s);let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(bin)}
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
function validReport(r){return r&&typeof r.summary==='string'&&r.summary.length<=10000&&Array.isArray(r.tasks)&&r.tasks.length<=200&&r.tasks.every(t=>t&&typeof t.id==='string'&&t.id.length<=100&&typeof t.name==='string'&&t.name.length<=100&&['done','progress','waiting','blocked'].includes(t.status)&&['owner','detail','next','decision'].every(k=>typeof t[k]==='string'&&t[k].length<=10000))}
export async function onRequest({request,env}){try{const user=await authenticate(request,env);const u=new URL(request.url);const seg=u.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);if(seg[0]==='me'&&request.method==='GET')return json(user);
 if(seg[0]==='weeks'&&request.method==='GET'){const file=await gh(env,'data/index.json');if(!file)return json({weeks:[]});const value=JSON.parse(fromBase64(file.content));return json({weeks:value.weeks||[],sha:file.sha})}
 if(seg[0]==='report'&&seg[1]&&validDate(seg[1])){const date=seg[1],path=`data/${date}.json`;
 if(request.method==='GET'){const f=await gh(env,path);if(!f)return json({error:'보고서 없음'},404);return json({report:JSON.parse(fromBase64(f.content)),sha:f.sha})}
 if(request.method==='PUT'){if(user.role!=='editor')return json({error:'조회 권한만 있습니다.'},403);const body=await request.json();if(!validReport(body.report)||!(body.sha===null||typeof body.sha==='string'))return json({error:'보고서 형식 오류'},400);
 const indexFile=await gh(env,'data/index.json');const index=indexFile?JSON.parse(fromBase64(indexFile.content)):{weeks:[]};const exists=(index.weeks||[]).includes(date);const current=await gh(env,path);if((current?.sha||null)!==body.sha)return json({error:'충돌: 서버의 보고서가 변경되었습니다. 새로고침 후 다시 시도하세요.'},409);
 const branch=env.GH_BRANCH||'main';const result=await gh(env,path,'PUT',{message:`report: ${date} updated by ${user.email}`,content:toBase64(JSON.stringify(body.report,null,2)+'\n'),sha:current?.sha,branch});
 if(!exists){const updated=[...(index.weeks||[]),date].sort();try{await gh(env,'data/index.json','PUT',{message:`index: add ${date}`,content:toBase64(JSON.stringify({weeks:updated},null,2)+'\n'),sha:indexFile?.sha,branch})}catch(e){return json({saved:true,sha:result.content?.sha,warning:'보고서는 저장되었으나 주차 목록 갱신 실패. 관리자가 data/index.json을 확인해야 합니다.'})}}
 return json({saved:true,sha:result.content?.sha})}}
 return json({error:'지원하지 않는 요청'},404)
 }catch(e){return json({error:e.message||'서버 오류'},e.status||500)}}
