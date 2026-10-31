# Canopy 태스킹 데이터 다운로드

Canopy 계정에서 조회 가능한 **전달 완료(DELIVERED) 태스킹 산출물**을 로컬에 저장합니다. 웹 화면에서 파일을 개별 또는 전체 일괄 저장할 수 있습니다. [STAC API v2](https://docs.canopy.umbra.space/docs/migrate-to-stac-api-v2)의 `umbra-sar` 항목을 끝까지 조회하고, `umbra:task_id`가 있는 항목을 표시합니다. 이 프로그램은 새 Task를 생성하지 않습니다.

## 웹 화면 실행 (권장)

1. [Canopy 계정 페이지](https://canopy.umbra.space/)에서 임시 access token을 복사합니다. [문서에 따르면](https://docs.canopy.umbra.space/docs/authentication) 이 토큰은 24시간 유효합니다.
2. PowerShell에서 이 폴더로 이동한 뒤 실행합니다.

   ```powershell
   python .\web_app.py
   ```

3. 브라우저에 열린 `http://127.0.0.1:8765/` 화면에서 토큰을 입력하고 **목록 불러오기**를 누릅니다.
4. 파일 행의 **저장**으로 개별 파일을, **전체 일괄 저장**으로 모든 파일을 이 컴퓨터의 `downloads` 폴더에 저장합니다. 저장된 파일은 **브라우저 다운로드**로도 개별 다운로드할 수 있습니다.

웹 서버는 `127.0.0.1`에서만 실행됩니다. 토큰은 서버 메모리에만 있고 브라우저 저장소나 파일에 기록되지 않습니다. 서버 종료 후에는 다시 입력해야 합니다. 저장 결과는 `downloads/manifest.csv`에 기록됩니다. 파일은 `downloads/<Task ID>/<STAC item ID>/` 구조로 저장되며, 안전한 파일명을 위해 각 폴더·파일 이름에 짧은 해시가 붙습니다. 재실행 시 이미 받은 파일은 건너뜁니다.

포트나 저장 위치를 바꾸려면 `python .\web_app.py --port 8766 --output D:\CanopyData`를 사용하세요. 종료는 실행한 PowerShell 창에서 `Ctrl+C`입니다.

## 명령줄에서 일괄 실행

웹 화면 없이 전체 파일을 받으려면 다음 명령을 실행하고 토큰 프롬프트에 붙여넣습니다.

```powershell
python .\canopy_download.py --output .\downloads
```

토큰을 명령줄 인수나 파일에 기록하지 마세요.

특정 Task만 받으려면 다음처럼 ID를 반복 입력하거나 한 줄에 ID 하나씩 적은 파일을 지정합니다.

```powershell
python .\canopy_download.py --task-id <TASK_ID_1> --task-id <TASK_ID_2>
python .\canopy_download.py --task-id-file .\task_ids.txt
```

## 범위와 유의사항

- Canopy 토큰으로 접근 가능한 STAC v2 항목 중 `umbra:task_id`가 있는 항목을 모두 받습니다. STAC 항목은 연결된 Collect가 `DELIVERED`가 된 뒤 생성됩니다. 아직 처리·전달 중인 Task는 다음 실행에서 받습니다.
- 파일 크기는 제품 유형에 따라 클 수 있습니다. 저장 공간과 네트워크 사용량을 확인하세요.
- API 검색의 `next` 링크를 따라 모든 페이지를 순회합니다. 각 STAC 항목을 다시 조회해 서명 URL을 받은 직후 다운로드합니다. 서명 URL이 403을 반환하면 해당 항목을 한 번 더 조회합니다.
- 검색 중 오류가 나도 이미 받은 파일은 남습니다. 오류를 해결한 뒤 다시 실행하면 됩니다.
- 현재 구현은 기존 파일이 0바이트보다 크면 건너뜁니다. 기존 파일의 해시 검증은 하지 않습니다.

## 검증

```powershell
python -m unittest -q
```

공식 문서: [STAC v2 마이그레이션](https://docs.canopy.umbra.space/docs/migrate-to-stac-api-v2), [STAC 검색 API](https://docs.canopy.umbra.space/reference/search_search_post-2), [인증](https://docs.canopy.umbra.space/docs/authenticate)
