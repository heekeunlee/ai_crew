# ai_crew

GitHub Actions에서 일하는 AI 크루. 서버 없이 저장소 하나로 돌아갑니다.

**현재 2단계** — 리서처(`scout`) 한 명 + 2D 픽셀 오피스 화면.

오피스: https://heekeunlee.github.io/ai_crew/

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
  lib/state.mjs            상태 판정 (순수 함수)
  build-state.mjs          site/state.json 생성기
work/scout/                산출물이 쌓이는 곳
site/
  index.html               오피스 화면
  office.js                canvas 픽셀 렌더러
  state.json               자동 생성 — 직접 고치지 않음
.github/workflows/
  scout.yml                cron 출근 + 수동 실행
  test.yml                 푸시할 때마다 점검
  pages.yml                오피스 배포
```

## 오피스 화면

캐릭터가 **서 있는 위치가 곧 상태**입니다.

| 위치 | 뜻 |
|---|---|
| 책상 | Actions가 지금 돌고 있음 (모니터 켜짐) |
| 게시판 앞 | 최근 6시간 안에 결과물을 커밋함 |
| 소파 | 대기 |

근무 표시는 30분이 지나면 스스로 만료되므로, 워크플로가 중간에 죽어도
「작업 중」으로 굳지 않습니다. 화면은 `state.json` 하나만 읽고 1분마다 갱신합니다.
로스터를 그대로 읽어 그리므로 **에이전트를 늘려도 렌더러는 손댈 필요가 없습니다.**

```bash
npm run state         # state.json 다시 만들기
cd site && python3 -m http.server 8080    # 로컬에서 화면 보기
```

## 인증 — API 크레딧이 들지 않습니다

Anthropic API 키가 아니라 **Claude 구독**으로 돌아갑니다.
모델 호출은 Claude Code를 headless(`claude -p`)로 띄워서 합니다.

- 로컬: 이미 `claude`에 로그인돼 있으면 그대로 됩니다
- Actions: `CLAUDE_CODE_OAUTH_TOKEN` 시크릿이 필요합니다

외부 npm 패키지 의존성은 없습니다.

## 아무것도 안 쓰고 먼저 확인하기

```bash
npm run scout:dry     # Claude 호출 없음. 파일이 제대로 생기는지만 본다
npm test              # 기억 병합 로직 단위 테스트
```

## 실제로 한 번 돌려보기

```bash
npm run scout
```

`work/scout/`에 오늘 날짜 파일이 생기면 성공입니다.

## GitHub에 올린 뒤 해야 할 일

1. 로컬에서 토큰을 발급합니다.
   ```bash
   claude setup-token
   ```
2. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CLAUDE_CODE_OAUTH_TOKEN`
   - Secret: 1단계에서 나온 토큰

   공개 저장소여도 시크릿 값은 노출되지 않습니다.
3. **Actions 탭 → 리서처 근무 → Run workflow**로 한 번 수동 실행해봅니다.
4. 잘 돌면 그다음부터는 매일 아침 알아서 커밋됩니다.

> 구독 사용량을 쓰므로, 평소 Claude를 많이 쓰시는 날엔 한도에 영향이 있을 수 있습니다.
> 토큰은 만료되면 `claude setup-token`으로 다시 발급해 시크릿을 갱신하세요.

## 주제 바꾸기

`crew.json`의 `topics` 배열만 고치면 됩니다. 다른 파일은 건드릴 필요 없습니다.

## 공개 저장소 주의사항

- `pull_request_target` 트리거는 쓰지 않습니다. 포크에서 온 코드에 시크릿이 넘어갑니다.
- 워크플로 권한은 `contents: read`가 기본이고, 커밋이 필요한 잡에만 `write`를 줍니다.
- `crew.json`의 `maxBudgetUsd`가 폭주 방지 상한입니다 (환산 기준).

## 다음 단계

- 3단계 — 라이터·아키비스트·메카닉 추가 (crew.json에 항목만 추가)
- 4단계 — 이슈 라벨로 지시 내리기 (칸반)
