# k-intruder.github.io

개인 프로젝트 포트폴리오 (GitHub Pages 정적 사이트).

```
index.html                포트폴리오 메인 (방문자 / 소유자 모드)
assets/auth.js            소유자 로그인 + 프로젝트 공개 여부 가드
assets/portfolio.{js,css} 메인 화면
data/projects.json        프로젝트 목록과 공개 여부 (visibility)
data/owner.json           소유자 비밀번호 검증값 (tools/set_owner_password.py로 생성)
projects/<id>/            프로젝트별 페이지와 데이터
projects/_template/       새 프로젝트용 템플릿
tools/                    로컬 서버, 비밀번호 설정 스크립트
```

## 처음 설정

```sh
python tools/set_owner_password.py   # data/owner.json 생성 (12자 이상)
python tools/range_server.py 8000    # http://127.0.0.1:8000/ 에서 확인
```

`data/owner.json`을 커밋해야 배포된 사이트에서 로그인할 수 있습니다. 비밀번호 자체는 저장되지 않습니다.

## 방문자 / 소유자 모드

- **방문자**: `visibility: "public"` 프로젝트만 목록에 보이고, 비공개 프로젝트 페이지로 직접 들어오면 메인으로 돌려보냅니다.
- **소유자**: 하단 `관리자` → 비밀번호 로그인. 모든 프로젝트가 공개/비공개 배지와 함께 보이고, 카드의 스위치로 공개 여부를 바꿀 수 있습니다.
  - 정적 사이트라 바로 저장되지 않습니다. 상단 `미반영 변경 N건` → `projects.json 다운로드` 후 `data/projects.json`을 덮어쓰고 커밋·푸시하세요.
  - `방문자 시점으로 보기`로 현재 배포 상태 그대로의 화면을 확인할 수 있습니다.
  - 로그인은 탭 단위(sessionStorage)로 유지됩니다. 새 탭에서는 다시 로그인해야 합니다.

## 새 프로젝트 추가

1. `projects/_template/`을 `projects/<id>/`로 복사하고 페이지를 작성합니다.
2. 프로젝트의 **모든 HTML 페이지** `<head>`에 가드를 넣습니다 (`data-guard`는 id와 동일):
   ```html
   <script src="../../assets/auth.js" data-guard="<id>"></script>
   ```
3. `data/projects.json`의 `projects` 배열에 항목을 추가합니다:
   ```json
   {
     "id": "<id>",
     "title": "프로젝트 제목",
     "summary": "한두 문장 소개",
     "period": "2026.10 – ",
     "status": "진행 중",
     "tags": ["..."],
     "highlights": ["..."],
     "path": "projects/<id>/",
     "visibility": "private"
   }
   ```
   처음엔 `private`로 올리고, 확인 후 소유자 모드에서 공개로 바꾸는 흐름을 권장합니다.

## 보안 모델 (중요)

이 사이트는 서버 없는 GitHub Pages라서 **접근 제어가 브라우저에서만 동작합니다.**

- 막아주는 것: 목록 노출, 일반적인 링크 접근, 비밀번호 없이 소유자 모드 진입
  (비밀번호는 PBKDF2-SHA256 310,000회로 검증하며, `owner.json`만으로는 세션을 위조할 수 없습니다).
- 막지 못하는 것: 공개 저장소의 파일은 URL을 알면 누구나 직접 받을 수 있습니다.
  `data/projects.json`의 비공개 항목 제목·설명, `projects/<id>/` 안의 HTML·데이터 모두 해당됩니다.

따라서 **정말 숨겨야 하는 자료(회사 데이터, 키, 내부 서버 주소 등)는 이 저장소에 커밋하지 마세요.**
진짜 비공개가 필요하면 비공개 저장소 + Cloudflare Pages/Access 같은 서버 측 인증으로 옮기는 것이 맞습니다.

## 방문차량 주차 분석: 매월 리포트 추가

**입·출차 원자료(xlsx)만 있을 때 (10월~ 기본 방식)**: 대시보드 생성 → 익명 처리·가드·검사 → KPI 반영을 한 번에 합니다.

```sh
python tools/build_parking_month.py "<11월 입출차기록.xlsx>" 2026-11 --title "2026년 11월"
python tools/build_parking_month.py "<2월 입출차기록.xlsx>" 2027-02 --title "2027년 2월" --exclude 2027-02-06:2027-02-09   # 명절 기간 제외
```

특정 날짜에 이례적인 방문이 있으면 `--focus-day`로 맨 아래에 별도 분석(시간대별 입차, 오전 06:00~11:59 · 오후 12:00~17:59 · 저녁 18:00~23:59 · 새벽 00:00~05:59, 세대별 방문 차량 대수)을 붙입니다.
공개 페이지에는 동 + 익명 번호만 나오고, 동·호수 명단은 `--private-out`으로 **저장소 밖에만** 따로 씁니다 (저장소 안 경로는 거부).

```sh
python tools/build_parking_month.py "<10월 입출차기록.xlsx>" 2026-10 --title "2026년 10월" --focus-day 2026-10-27 --private-out "<G드라이브>/2026년_10월_..._내부용.html"
```

이전 월은 `reports.json`의 `kpi`로 비교 차트를 그립니다. 세대는 동 + 무작위 익명 번호로만 표시되고 호수·차량번호는 페이지에 쓰지 않습니다.

**이미 만든 대시보드 HTML을 올릴 때**:

```sh
python tools/add_parking_report.py "<대시보드.html>" 2026-10 --title "2026년 10월"
python tools/add_parking_report.py "<특별판.html>" 2027-seollal --title "2027 설 특별판" --type special --period "2027.02.06 – 02.09"
```

- 스크립트가 데이터 배열의 호수·차량번호·층을 지우고 무작위 익명 번호로 바꿉니다. 인라인 Plotly는 CDN으로 교체하고, 공개 여부 가드와 상단 내비게이션을 넣습니다.
- 동·호수나 차량번호처럼 보이는 문자열이 남아 있으면 **파일을 쓰지 않고 멈춥니다.** 원본 HTML 문구를 고친 뒤 다시 실행하세요.
- 월별 지표(`kpi`)는 원본 xlsx에서 계산해 `reports.json`에 넣습니다. 개요 페이지의 추이 차트와 80시간 근접(60~80h) 차트가 이 값으로 그려집니다.
  ```sh
  python tools/parking_kpi.py "<10월 방문주차사용현황.xlsx>" --slug 2026-10
  python tools/parking_kpi.py "<입출차기록.xlsx>" --exclude 2027-02-06:2027-02-09 --slug 2027-02   # 명절 기간 제외
  ```
  월별 집계 파일(동/호/사용량)과 입·출차 원자료(방문예약만 합산) 형식을 자동으로 구분합니다. 집계값만 저장하고 세대 정보는 저장하지 않습니다.
- 원본 xlsx나 익명 처리 전 HTML은 이 저장소에 넣지 마세요.
- **호수 표시 (소유자만)**: 리포트는 기본이 익명입니다. 상단 `호수 ○익명 ○표시`에서 `표시`를 고르고 소유자 비밀번호를 넣으면 실제 호수가 보입니다.
  - 실제 호수는 페이지 안에 **암호화된 상태로만** 들어갑니다 (`tools/unit_vault.py`, `unmask.js`). 숨김 처리만 하면 공개 저장소에서 원본을 그대로 받을 수 있어서 이렇게 합니다.
  - 처음 한 번, 일반 터미널(PowerShell)에서 키를 만들고 `data/unit_key.json`을 커밋합니다. 비밀번호를 묻습니다 (포트폴리오 로그인 비밀번호와 동일).
    ```sh
    pip install cryptography
    python tools/unit_vault.py setup
    ```
  - 키가 있으면 `add_parking_report.py`·`build_parking_month.py`가 자동으로 암호화된 호수를 넣습니다 (빌드할 때 비밀번호는 필요 없음).
  - 소유자 비밀번호를 바꾸면 `set_owner_password.py` 후 `unit_vault.py setup`을 다시 실행하세요 (현재·새 비밀번호를 묻고 기존 페이지는 그대로 동작).

## 주간 업무 대시보드 (`projects/weekly/`)

- `/projects/weekly/` 경로에서 열리면 `public/github.js`가 브라우저에서 GitHub API로 비공개 저장소 `k-intruder/weekly-data`의 `data/`를 직접 읽고 Commit합니다 (저장소 위치는 `github.js`의 `GH`).
- 화면의 `GitHub 토큰`에 fine-grained token을 넣습니다. 대상 저장소는 `weekly-data` 하나만, 편집자는 Contents: Read and write, 조회자는 Contents: Read-only. 토큰은 그 브라우저 localStorage에만 저장됩니다.
- `+ 다음 주 보고 생성`은 지난 주 내용을 복사해 바로 Commit하고, 열려 있는 다른 화면은 15초 안에 자동 반영됩니다 (변경사항을 편집 중이면 경고만 표시).
- 실제 보고 데이터 `projects/weekly/data/`는 `.gitignore`로 제외되어 있습니다. 이 공개 저장소에 커밋하지 마세요.
- Cloudflare Pages + Access 배포 방식은 `projects/weekly/README.md`를 참고하세요 (같은 화면이 `/api`를 사용).
