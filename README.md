# ai_crew

GitHub Actions에서 — 또는 집에 있는 맥에서 — 일하는 AI 크루.

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
  lib/schedule.mjs         cron에서 다음 실행 시각 (순수 함수)
  lib/state.mjs            상태 판정·요약 추출 (순수 함수)
  *.test.mjs               lib/ 모듈별 단위 테스트 5종
  local/work.sh            에이전트 한 명을 이 기계에서 근무시킨다
  local/poll.sh            이슈 칸반 폴링 (on-issue.yml 자리)
  local/install.mjs        crew.json 근무표를 launchd로 옮긴다
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

## 어디서 도는가 — Actions와 로컬, 둘 다 됩니다

에이전트 실행은 두 경로 중 하나를 고르면 됩니다. **동시에 켜두면 안 됩니다** —
같은 날 같은 산출물을 두 번 쓰게 됩니다.

| | GitHub Actions | 로컬 (`scripts/local/`) |
|---|---|---|
| 예약 | 워크플로 cron (UTC) | launchd (KST) |
| 인증 | `CLAUDE_CODE_OAUTH_TOKEN` 시크릿 | 그 기계의 `claude` 로그인 세션 |
| 지시 이슈 | 라벨 이벤트로 즉시 | 2분마다 폴링 |
| 로그 | Actions 웹 | `~/Library/Logs/ai_crew/` |
| 죽는 경우 | 거의 없음 | 그 기계가 꺼지면 근무가 빠짐 |

Pages 배포(`pages.yml`)와 테스트(`test.yml`)는 어느 쪽을 쓰든 Actions에 남깁니다.
로컬에서 돌려도 결과를 밀어 넣으면 오피스는 계속 공개 주소로 열립니다.

### 로컬로 옮기기 (macOS)

```bash
node scripts/local/install.mjs           # crew.json 근무표 → launchd 등록
node scripts/local/install.mjs --print   # 등록 전에 내용만 확인
node scripts/local/install.mjs --remove  # 전부 걷어내기

gh workflow disable scout.yml quill.yml curator.yml mechanic.yml on-issue.yml
```

`work.sh`는 `_agent.yml`과 같은 일을 합니다 — 출근 표시, 근무, 커밋 또는 PR,
이슈 등록, 실패 시 표시 정리. 다른 점은 저장소가 이미 그 기계에 있으니
checkout 대신 `git pull --rebase`로 시작한다는 것뿐입니다.

되돌리려면 `--remove` 하고 `gh workflow enable` 하면 됩니다.

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

### 화면에 있는 것 중 진짜 데이터로 움직이는 것

| | |
|---|---|
| 창밖 하늘 · 벽시계 | 실제 한국 시각 (밤엔 창밖 건물에 불이 켜집니다) |
| 책장의 책 | 누적 산출물 1건 = 책 1권 |
| 벽 액자 막대그래프 | 최근 7일 산출물 |
| 트로피 | 10 / 50 / 100건 달성 |
| 화이트보드 | 회의 중일 때 각자 낸 결과물 |
| 프린터 | 새 산출물이 커밋되면 종이가 나옵니다 |
| 게시판 빨간 핀 | 처리 안 된 이슈 지시 |

고양이와 계절 장식(12월 트리, 여름 선풍기)만 순수한 장식입니다.

각 캐릭터에는 **이름표가 따라다니고**, 머리 장식(캡·묶은머리·안경·헤드셋)이
로스터 순서대로 달라 멀리서도 누가 누구인지 구분됩니다. 책상의 흐린 이름은
자리 주인을 알려주는 명패일 뿐, 지금 거기 있다는 뜻이 아닙니다.

일하지 않는 동안에는 사무실을 돌아다니고, **탕비실**에서 커피를 마시거나,
둘 이상이 놀고 있으면 가끔 회의 탁자에 모입니다. 창밖 하늘과 벽시계는 **실제 한국 시각**을 따르고,
밤에는 책상 스탠드가 켜집니다.

말풍선의 결과물 요약·다음 근무까지 남은 시간·대기 중인 지시는 실제 데이터이고,
`…` `☕` 같은 짧은 것만 분위기용입니다. 없는 사실을 지어내지는 않습니다.

### 숨은 것들

화면에서 <kbd>?</kbd>를 누르거나 오른쪽 위 <b>?</b> 버튼을 누르면 목록이 나옵니다.

| | |
|---|---|
| <kbd>←</kbd> <kbd>→</kbd> | 직원 넘기기 |
| <kbd>C</kbd> · 탕비실 클릭 | 커피 타임 — 다들 탕비실로 모입니다 |
| 화분 클릭 | 화분이 자랍니다 (이 브라우저에만 남음) |
| 벽시계 클릭 | 지금 한국 시각 |
| **직원 전원을 8초 안에 탭** | 🎉 전원 호출 → 파티 모드 (휴대폰용) |
| 휴대폰 흔들기 | 파티 모드 (도움말에서 켜기) |
| ↑↑↓↓←→←→BA | 파티 모드 (키보드용) |

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
