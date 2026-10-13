# STELLARVISION Weekly Dashboard V3

## 아키텍처
- Cloudflare Pages: `public/` 정적 파일 배포
- Cloudflare Pages Functions: `functions/api/[[path]].js` 인증 및 GitHub API
- Cloudflare Access: 사이트 전체 접근 통제 (교수 / 대표 이메일만 허용)
- GitHub Private Repository: `data/YYYY-MM-DD.json`, `data/index.json` 이력 관리
- 교수: 편집 및 Commit / 대표: 조회 및 PDF

## 배포 순서
1. **GitHub Private Repository** 신규 생성 후 이 ZIP의 `stellarvision-v3/` 내부 파일을 저장소 루트에 업로드하고 main에 push.
2. GitHub에서 Fine-grained personal access token 생성: 해당 저장소에만 **Contents: Read and write** 권한. 토큰은 소스코드에 절대 넣지 않기. 운영 환경에서는 GitHub App 설치 토큰/짧은 수명 토큰 방식으로 고도화 권장.
3. Cloudflare Pages > Create project > GitHub 저장소 연결. Framework preset: None, Build command: 비움, **Build output directory: `public`**. `functions/` 폴더는 저장소 루트에 유지. Pages Functions가 활성화되는지 배포 로그에서 확인.
4. **사용자 지정 도메인** 연결 권장 (예: `weekly.example.com`). Cloudflare Zero Trust > Access > Applications > Add application > Self-hosted > 해당 도메인 전체 경로 `/*` 보호. 정책 Allow에 교수와 대표의 정확한 이메일 2개만 지정. OTP 또는 IdP MFA 활성화. Preview 도메인 및 기본 `*.pages.dev` 우회 접속도 반드시 차단하거나 비활성화. Access로 보호하지 못하는 공개 기본 도메인에는 민감정보 배포 금지.
5. Cloudflare Access 앱 설정에서 **Application AUD tag**, 팀 도메인(`your-team.cloudflareaccess.com`) 확인.
6. Cloudflare Pages > Settings > Variables and Secrets: 아래 값 등록. `GITHUB_TOKEN`은 **Secret**으로 등록.

| 변수 | 값 예시 |
|---|---|
| `GH_OWNER` | GitHub 조직 또는 사용자명 |
| `GH_REPO` | 저장소명 |
| `GH_BRANCH` | `main` |
| `GITHUB_TOKEN` | GitHub fine-grained PAT (Secret) |
| `CF_ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Access application AUD tag |
| `ALLOWED_EMAILS` | `prof@example.com,ceo@example.com` |
| `EDITOR_EMAIL` | `prof@example.com` |

7. Production 재배포 후 Access 로그인 → 대시보드 조회 → 업무 수정 → **GitHub에 저장 (Commit)** → GitHub `data/` 파일 갱신 확인.
8. 대표 이메일로 별도 브라우저 로그인 → 읽기 전용인지 확인. 인증되지 않은 브라우저에서 차단되는지 확인.

## 주의사항
- **GitHub Pages만으로는 이 구성을 안전하게 배포할 수 없습니다.** GitHub Pages는 인증·서버 측 GitHub 토큰 보호 기능이 없습니다.
- 반드시 GitHub 저장소는 **Private**로 만들고 Cloudflare Access를 **사이트 전체**에 적용하세요. API는 JWT의 서명·발급자·AUD·만료·이메일을 서버에서 검증하며, Access 정책도 별도 설정해야 합니다.
- Access 앱과 다른 호스트명/프리뷰 배포를 통해 우회하지 못하도록 모든 배포 호스트를 점검하세요.
- 브라우저 임시 변경은 Commit 전까지 서버에 저장되지 않습니다.
- 같은 주차를 동시에 수정하면 GitHub SHA 충돌(409)을 표시하며 자동 덮어쓰지 않습니다. JSON 백업 후 새로고침해 병합하세요.
- **새 주차 생성 시** 보고서 파일을 먼저 Commit하고 `data/index.json`을 별도로 Commit합니다. 두 번째 Commit이 실패하면 경고를 표시하므로 인덱스 파일을 점검하세요.
- GitHub API에는 요청 횟수 제한이 있습니다. 소규모 주간 업무 공유에는 적합하나 대규모 동시편집에는 DB 기반으로 전환하세요.
- 실제 암호·접속 토큰·고객 개인정보는 업무 내용에 입력하지 마세요.
- 테스트용 코드는 별도 도메인/저장소에서 검증 후 운영하세요.

## 로컬 실행
`public/` 정적 UI만 띄우면 `/api`는 동작하지 않습니다. Cloudflare Pages Functions 런타임에서 실행해야 하며, Wrangler로 테스트하려면 환경변수 및 Cloudflare Access JWT가 필요합니다. `npx wrangler pages dev public` (Node.js 설치 필요). 로컬의 Access JWT 없는 요청은 401이 정상입니다.

## 데이터 형식
`data/index.json`: `{ "weeks": ["2026-10-02"] }`

`data/2026-10-02.json`: `{ "summary": "...", "tasks": [{"id":"water", "name":"...", "status":"progress", "owner":"...", "detail":"...", "next":"...", "decision":"..."}] }`

## 보안 및 검증 체크리스트
- [ ] Private Repository
- [ ] Cloudflare Access 전체 사이트 및 API 경로 보호
- [ ] Pages 기본/프리뷰 URL 보호 또는 차단
- [ ] 정확한 이메일 allowlist 설정
- [ ] 교수 편집/대표 조회 분리 확인
- [ ] GitHub 토큰 Secret 등록 및 최소 권한
- [ ] 타인 브라우저 접근 거부 테스트
- [ ] 저장 충돌 테스트
- [ ] PDF 및 모바일 확인
