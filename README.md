# ai_crew

GitHub Actions에서 일하는 AI 크루. 서버 없이 저장소 하나로 돌아갑니다.

**현재 1단계** — 리서처(`scout`) 한 명, 화면 없음.

## 지금 되는 것

매일 07:00 KST에 리서처가 깨어나 정해진 주제의 새 소식을 검색하고,
요약본을 `work/scout/YYYY-MM-DD.md`로 커밋합니다.
어제 다룬 주제는 `agents/scout/memory.md`를 읽고 건너뜁니다.

```
crew.json                  로스터 단일 원본 — 주제·모델·근무시간
agents/scout/
  SOUL.md                  성격·말투·금지사항
  TASK.md                  근무 지시와 출력 형식
  memory.md                누적 기억 (에이전트가 스스로 갱신)
scripts/
  run-agent.mjs            실행기
  lib/memory.mjs           기억 병합 (순수 함수)
  memory.test.mjs          단위 테스트
work/scout/                산출물이 쌓이는 곳
.github/workflows/
  scout.yml                cron 출근 + 수동 실행
  test.yml                 푸시할 때마다 점검
```

## 설치

```bash
npm install
```

## API 키 없이 먼저 확인하기

```bash
npm run scout:dry     # 토큰 0원. 파일이 제대로 생기는지만 본다
npm test              # 기억 병합 로직 단위 테스트
```

## 실제로 한 번 돌려보기

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run scout
```

`work/scout/`에 오늘 날짜 파일이 생기면 성공입니다.

## GitHub에 올린 뒤 해야 할 일

1. **Settings → Secrets and variables → Actions**에서
   `ANTHROPIC_API_KEY`를 등록합니다. (공개 저장소여도 시크릿은 노출되지 않습니다)
2. **Actions 탭 → 리서처 근무 → Run workflow**로 한 번 수동 실행해봅니다.
3. 잘 돌면 그다음부터는 매일 아침 알아서 커밋됩니다.

## 주제 바꾸기

`crew.json`의 `topics` 배열만 고치면 됩니다. 다른 파일은 건드릴 필요 없습니다.

## 공개 저장소 주의사항

- `pull_request_target` 트리거는 쓰지 않습니다. 포크에서 온 코드에 시크릿이 넘어갑니다.
- 워크플로 권한은 `contents: read`가 기본이고, 커밋이 필요한 잡에만 `write`를 줍니다.
- Anthropic 콘솔에서 지출 한도와 알림을 걸어두세요.

## 다음 단계

- 2단계 — `state.json` + 2D 픽셀 오피스 화면 (GitHub Pages)
- 3단계 — 라이터·아키비스트·메카닉 추가
- 4단계 — 이슈 라벨로 지시 내리기 (칸반)
