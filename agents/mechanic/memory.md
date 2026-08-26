# 기억

근무를 마칠 때마다 스스로 갱신합니다. 사람이 직접 고쳐도 됩니다.

## 이미 다룬 주제

<!-- 최근 항목이 위로 쌓입니다. 30줄이 넘으면 오래된 것부터 지웁니다. -->
- 2026-08-26 `/`===ISSUE===`를 텍스트 어디에 있든 첫 번째 등장 위치로 찾습니다. 줄 시작에 온전한 마커로만 있는지는 확인하지 않습니다.
- 2026-08-26 메카닉 근무는 그 주 점검 주제가 하필 "워크플로 권한과 이슈 등록 조건"이었고, 보고서 본문 안에서 실제 마커 문자열 `` `===ISSUE===` ``를 예시로 인용하려 했습니다(`_agent.yml:118`의 `hashFiles('.ci/issue.md')` 조건 설명 중). 이 인용이 텍스트에서 진짜 부록 마커보다 먼저 등장하는 바람에:
- 2026-08-26 1. `text.indexOf("===ISSUE===")`가 이 인용을 "이슈 부록 시작"으로 오인해, `body`가 그 지점에서 잘려 나갔습니다. 실제로 `work/mechanic/2026-08-23.md`는 26번째 줄에서 `` `.ci/issue.md`는 응답에 ` ``로 문장이 안 닫힌 채 끝나고, "## 이상 없던 것" 절 전체가 통째로 사라졌습니다.
- 2026-08-26 2. 이후 실제로 나온 `===ISSUE===` 마커(진짜 이슈 체크리스트가 시작되는 지점)는 이미 "찾은 마커"로 소모되어 다시 인식되지 못했습니다. 그 결과 진짜 체크리스트(`## 🔧 메카닉 주간 점검 — 2026-08-23` 제목 + 체크박스 4개)가 `===MEMORY===` 섹션 안에 리터럴 텍스트로 그대로 딸려 들어갔고, `mergeMemory`(`scripts/lib/memory.mjs`)는 이 블록의 줄마다 하나씩 기억 항목으로 만들었습니다. 그 흔적이 지금도 `agents/mechanic/memory.md:10-15`에 6줄짜리 쓰레기로 남아 있습니다 — `- 2026-08-23 ===ISSUE===`, `- 2026-08-23 ## 🔧 메카닉 주간 점검 — 2026-08-23`, 체크박스 4줄.
- 2026-08-26 3. 반대로 `.ci/issue.md`(진짜 GitHub 이슈로 등록됐을 내용)에는 잘려나간 문장 나머지 + "이상 없던 것" 절 같은, 원래 이슈에 들어가면 안 되는 내용이 담겼을 것으로 보입니다. 그 주 실제로 올라간 이슈의 몸통이 의도한 체크리스트가 아니라 이 뒤섞인 텍스트였을 가능성이 높습니다.
- 2026-08-26 `scripts/sections.test.mjs`를 보면 이 경로(본문이 마커 문자열을 리터럴로 언급하는 경우)에 대한 테스트가 없습니다 — 8개 테스트 모두 마커가 실제 부록 구분자로만 쓰이는 "깨끗한" 입력만 다룹니다.
- 2026-08-26 **위치**
- 2026-08-26 근본 원인: `scripts/lib/sections.mjs:15-31` (특히 17번 줄 `text.indexOf(m)`)
- 2026-08-26 증거 1 (본문 잘림): `work/mechanic/2026-08-23.md:26`
- 2026-08-26 증거 2 (기억 오염, 아직 정리 안 됨): `agents/mechanic/memory.md:10-15`
- 2026-08-26 테스트 공백: `scripts/sections.test.mjs` (마커를 본문에서 리터럴로 인용하는 케이스 없음)
- 2026-08-26 **고치는 법**
- 2026-08-26 1. `splitSections`가 마커를 찾을 때 "줄 시작에 마커만 단독으로 있는 줄"만 인정하도록 바꿉니다. 예: `text.split("\n")`으로 줄 단위 순회하며 `line.trim() === mark`인 줄만 경계로 인정하거나, 정규식 `^===MARK===$`를 `m` 플래그로 매칭합니다. 부분 문자열 `indexOf`는 본문이 마커를 예시로 인용하는 순간 항상 이 문제를 재현합니다.
- 2026-08-26 2. `scripts/sections.test.mjs`에 "본문이 마커 문자열을 리터럴로 언급하지만 실제 마커는 그 뒤에 온다" 케이스를 추가해 회귀를 막습니다.
- 2026-08-26 3. `agents/mechanic/memory.md:10-15`의 6줄은 수동으로 지워야 합니다 — 코드를 고쳐도 이미 파일에 박힌 쓰레기는 저절로 없어지지 않습니다.
- 2026-08-26 4. 2026-08-23에 실제로 올라간 GitHub 이슈(있다면)의 본문을 확인해, 의도한 체크리스트 대신 잘린 텍스트가 올라갔는지 점검할 가치가 있습니다.
- 2026-08-26 ### `scripts/local/`이 README 어디에도 설명돼 있지 않음
- 2026-08-26 `scripts/local/install.mjs`, `work.sh`, `poll.sh` 세 파일은 GitHub Actions 없이 로컬 기기(launchd, macOS)에서 크루를 돌리는 독립된 실행 경로입니다. `crew.json`을 읽어 launchd 작업을 등록하고, `_agent.yml`이 하는 일(출근 표시·근무·커밋/PR·이슈 폴링·실패 시 정리)을 셸 스크립트로 그대로 복제합니다.
- 2026-08-26 `README.md`는 저장소를 "GitHub Actions에서 일하는 AI 크루. 서버 없이 저장소 하나로 돌아갑니다"(1-3번 줄)로 소개하고, "GitHub에 올린 뒤 해야 할 일" 절도 Actions 기준으로만 설명합니다. `scripts/local`이라는 문자열은 README 전체에 한 번도 나오지 않습니다 — `.gitignore`에도 없어 실제로 저장소에 커밋된 파일인데도 구조도(README.md:29-55)에서 완전히 빠져 있습니다.
- 2026-08-26 이 정도 분량(3개 파일, `_agent.yml` 전체 로직 중복)이면 우연히 빠뜨린 게 아니라 아예 문서화 대상에서 누락된 서브시스템으로 보입니다. 이 스크립트를 처음 보는 사람은 왜 존재하는지, Actions 경로와 어떻게 다른지 알 방법이 없습니다.
- 2026-08-26 **위치** `README.md` 전체 (구조도 `README.md:29-55`, 소개 `README.md:1-5`)
- 2026-08-26 **고치는 법** README에 짧은 절을 추가합니다 — "로컬(맥) 실행" 같은 제목으로 `scripts/local/`이 하는 일(같은 crew.json을 launchd로 스케줄링, `CLAUDE_CODE_OAUTH_TOKEN` 없이 로그인 세션 재사용, `poll.sh`가 `on-issue.yml` 대신 이슈를 2분마다 폴링)과 사용법(`node scripts/local/install.mjs`)을 한두 문단으로 설명하거나, 구조도에 세 파일을 추가합니다. 개인 인프라라 문서화 대상이 아니라면 그 의도를 코드 주석에라도 남겨야 다음 사람이 "이거 죽은 코드인가?" 하고 헷갈리지 않습니다.
- 2026-08-26 ## 이상 없던 것
- 2026-08-26 README의 `npm run scout`, `npm run scout:dry`, `npm test`, `npm run state` 명령 — `package.json:8-11`의 scripts와 일치
- 2026-08-26 `.github/workflows/` 어디에도 `pull_request_target` 없음
- 2026-08-26 워크플로 permissions — `scout.yml`·`curator.yml`은 `contents: write`만, `quill.yml`은 `+ pull-requests: write`, `mechanic.yml`은 `+ issues: write`만 부여. `on-issue.yml`도 `prep`은 `issues: write`, `work`는 `contents/issues: write`로 적절히 좁혀져 있음
- 2026-08-26 액션 버전 — `checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4` 모두 최신 메이저
- 2026-08-26 `work/` 누적 — `work/scout` 6개(정기 5 + 이슈 1), `work/quill` 2개(이슈만, 정기 산출물은 PR 병합 전이라 미반영), `work/mechanic` 2개. 관리 가능한 수준
- 2026-08-26 `agents/*/memory.md` 항목 수 — scout 6개, quill 2개, curator 12개, mechanic 8개(그중 6개는 위 발견 1의 쓰레기) 모두 30줄 상한 이내
- 2026-08-26 `crew.json`의 4개 에이전트(scout, quill, curator, mechanic) 모두 `agents/<id>/` 폴더와 `.github/workflows/<id>.yml`이 대응. 워크플로에 등록 안 된 에이전트 없음
- 2026-08-26 `output` 경로 — `work/scout`, `work/quill`, `archive`(`archive/INDEX.md` 존재하고 최신 갱신됨), `work/mechanic` 전부 실제로 쓰임
- 2026-08-26 `scripts/lib/`의 5개 모듈(memory, output, schedule, sections, state) 모두 대응하는 테스트 파일 존재 (다만 sections.test.mjs의 커버리지 공백은 위 발견 1 참고)
- 2026-08-26 ===MEMORY===
- 2026-08-26 scripts/lib/sections.mjs의 indexOf 기반 마커 탐색이 본문에 마커 문자열이 리터럴로 언급될 때 본문 잘림+기억 오염을 일으킴을 발견 (증거: work/mechanic/2026-08-23.md 잘림, agents/mechanic/memory.md:10-15 쓰레기). scripts/local/ 서브시스템(launchd 로컬 실행)이 README에 전혀 문서화 안 됨. 지난번 지적한 lib/schedule.mjs README 누락은 아직 안 고쳐졌으나 재보고 생략.
- 2026-08-26 ===ISSUE===
- 2026-08-26 ## 🔧 메카닉 주간 점검 — 2026-08-26
- 2026-08-26 [ ] **`splitSections` 마커 탐색 하드닝** — `scripts/lib/sections.mjs:17`의 `text.indexOf(m)`을 줄 단위 정확 매칭(`^===MARK===$`)으로 바꿔, 본문이 마커 문자열을 예시로 인용할 때 오탐하지 않게 한다. 회귀 테스트도 `scripts/sections.test.mjs`에 추가한다.
- 2026-08-26 [ ] **`agents/mechanic/memory.md` 정리** — 10-15번 줄(2026-08-23 `===ISSUE===`, 제목, 체크박스 4개가 기억 항목으로 잘못 들어간 것)을 수동으로 지운다.
- 2026-08-26 [ ] **2026-08-23 GitHub 이슈 내용 확인** — 그 주 메카닉이 올린 실제 이슈 본문이 의도한 체크리스트 대신 잘린 텍스트였는지 확인하고, 필요하면 정정 댓글을 단다.
- 2026-08-26 [ ] **README에 `scripts/local/` 설명 추가** — `install.mjs`/`work.sh`/`poll.sh`가 무엇을 하는지(launchd 기반 로컬 실행, Actions 경로와의 차이) 한두 문단으로 문서화하거나 구조도에 포함시킨다.
