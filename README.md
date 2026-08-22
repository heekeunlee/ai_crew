# ai_crew

GitHub Actions에서 일하는 AI 크루. 서버 없이 저장소 하나로 돌아갑니다.

**현재 4단계** — 크루 4명 + 2D 픽셀 오피스 + 이슈로 지시 내리기.

오피스: https://heekeunlee.github.io/ai_crew/

## 크루

| | 담당 | 근무 | 산출 |
|---|---|---|---|
| 🔭 리서처 `scout` | 주제별 새 소식 수집 | 매일 07:00 | `work/scout/날짜.md` |
| ✍️ 라이터 `quill` | 주간 글 한 편 | 토 09:00 | **PR** (사람이 병합) |
| 🗂️ 아키비스트 `curator` | 색인 정리 | 매일 23:00 | `archive/INDEX.md` (덮어씀) |
| 🔧 메카닉 `mechanic` | 저장소 점검 | 월 09:00 | `work/mechanic/날짜.md` + 이슈 |

에이전트마다 다른 것은 전부 `crew.json`에 있습니다. 실행기는 네 명에게
같은 계약을 줍니다 — 프롬프트를 받고 마크다운을 돌려줍니다.

- `inputs` — 프롬프트에 끼워 넣을 기존 산출물 (라이터는 리서처 7일치를 읽습니다)
- `readsRepo` — 저장소를 직접 훑어야 하는가 (메카닉만 `true`, 쓰기는 막혀 있음)
- `outputMode` — `dated`(날짜별) / `single`(파일 하나를 덮어씀)
- `review` — `pull-request`면 main에 바로 넣지 않고 PR로 올립니다

**라이터만 PR로 나갑니다.** 병합 전까지 오피스에서는 산출물이 없는 것으로
보이는데, 그게 맞는 표시입니다 — 사람이 승인해야 발행된 것이니까요.

```
crew.json                  로스터 단일 원본 — 주제·모델·근무시간
agents/scout/
  SOUL.md                  성격·말투·금지사항
  TASK.md                  근무 지시와 출력 형식
  memory.md                누적 기억 (에이전트가 스스로 갱신)
scripts/
  run-agent.mjs            실행기 — 네 명 공통
  build-state.mjs          site/state.json 생성기
  lib/memory.mjs           기억 병합 (순수 함수)
  lib/output.mjs           모델 응답 서두 제거 (순수 함수)
  lib/sections.mjs         본문과 ===MEMORY=== / ===ISSUE=== 분리 (순수 함수)
  lib/state.mjs            상태 판정·요약 추출 (순수 함수)
  *.test.mjs               lib/ 모듈별 단위 테스트 4종
work/scout/                산출물이 쌓이는 곳
site/
  index.html               오피스 화면
  office.js                canvas 픽셀 렌더러
  state.json               자동 생성 — 직접 고치지 않음
.github/workflows/
  _agent.yml               공통 근무 워크플로 (네 명이 공유)
  scout.yml quill.yml      각 에이전트 스케줄
  curator.yml mechanic.yml
  on-issue.yml             이슈 라벨로 지시 받기
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
npm run scout:dry     # Claude 호출 없음. 배관만 확인 (.ci/dry/ 아래에만 씀)
npm test              # 단위 테스트
```

`DRY_RUN=1`은 진짜 산출물을 덮어쓰지 않습니다. 코드 경로는 그대로 타되
쓰기만 `.ci/dry/` 아래로 돌립니다.

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
- 워크플로 권한은 에이전트마다 **실제로 쓰는 것만** 줍니다.
  리서처·아키비스트는 `contents: write`, 라이터는 `+ pull-requests: write`,
  메카닉은 `+ issues: write`. 재사용 워크플로는 호출자보다 넓은 권한을
  가질 수 없으므로 선언은 호출하는 쪽 잡에 둡니다.
- `crew.json`의 `maxBudgetUsd`가 폭주 방지 상한입니다 (환산 기준).

## 이슈로 지시 내리기 (칸반)

정기 근무를 기다리지 않고 지금 시키고 싶을 때 씁니다.

1. 이슈를 하나 엽니다. **제목과 본문이 그대로 지시**가 됩니다.
2. `agent:scout` 같은 라벨을 붙입니다.
3. 해당 에이전트가 집어가서 일하고, 결과를 **댓글로 달고 이슈를 닫습니다.**

산출물은 `work/<id>/YYYY-MM-DD-i<이슈번호>.md`로 커밋됩니다.
꼬리를 붙이는 이유는 같은 날 정기 근무 파일을 덮어쓰지 않기 위해서입니다.

**이슈 = 칸반 카드**입니다. GitHub Projects 보드에 올리면 칸반 화면이
따로 만들 것 없이 생깁니다.

```
열림          → 대기 중인 지시
라벨 붙음      → 에이전트가 집어감 (오피스에서 책상으로 이동)
댓글 + 닫힘    → 완료
```

라이터는 정기 근무에서는 PR로 나가지만, **이슈로 지시받으면 main에 바로 커밋합니다.**
명시적으로 시킨 일이니 검토 단계를 한 번 건너뜁니다.

> 이슈 트리거는 **저장소 주인이 연 이슈만** 받습니다. 그러지 않으면
> 남이 이슈를 열어 구독 사용량을 태울 수 있습니다.

## 에이전트 추가하기

1. `crew.json`에 항목 추가
2. `agents/<id>/`에 `SOUL.md` · `TASK.md` · `memory.md`
3. `.github/workflows/<id>.yml` — `_agent.yml`을 부르는 10줄
4. `gh label create "agent:<id>"` — 이슈로 지시하려면

오피스 화면은 로스터를 읽어 그리므로 **`site/`는 손댈 필요가 없습니다.**

## 앞으로 해볼 만한 것

- 에이전트끼리 넘기기 (리서처가 발견한 것을 라이터 이슈로 자동 등록)
- 오피스 화면에 열린 이슈를 칸반으로 표시
