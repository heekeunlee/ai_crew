# 기억

근무를 마칠 때마다 스스로 갱신합니다. 사람이 직접 고쳐도 됩니다.

## 이미 다룬 주제

<!-- 최근 항목이 위로 쌓입니다. 30줄이 넘으면 오래된 것부터 지웁니다. -->
- 2026-09-21 지난주(09-14) 지적한 mergeMemory 펜스 필터 버그가 09-21 확인 결과 여전히 미수정(scripts/lib/memory.mjs 12-22행 그대로, 회귀 테스트도 미추가)이고, 그 사이 09-19에 실제로 재발해 agents/curator/memory.md:10에 새 오염 항목("- 2026-09-19 ```")이 생겼다(기존 09-08 오염은 line 22에 그대로 남음) — 재발 증거로 이슈 다시 올림. 액션 버전 노후화는 이슈 #17이 열려있어(전 근무 기억 기준) 재등록 안 함. 그 외 README·work 누적·memory 30줄 상한·워크플로 permissions·pull_request_target·crew.json-agents 정합성·테스트 커버리지 전부 이상 없음
- 2026-09-14 {이번에 정리한 주제 수와 항목 수}
- 2026-09-14 ```
- 2026-09-14 이건 사람이 읽을 형식 설명용 펜스인데, 09-08 근무에서 모델이 자기 실제 출력 끝에 닫는 ` ``` `까지 그대로 따라 썼을 가능성이 높다. (다른 날짜 기억 항목들은 전부 정상 문장이라, 이 날만 튀는 게 이 가설과 맞는다.)
- 2026-09-14 2. `scripts/lib/sections.mjs`의 `splitSections`는 `===MEMORY===` 줄부터 다음 표식 또는 텍스트 끝까지를 그대로 잘라간다 — 안에 낀 ` ``` `를 걸러내는 로직이 없다.
- 2026-09-14 3. `scripts/lib/memory.mjs`의 `mergeMemory` (12-22행)는 노트를 줄 단위로 쪼갠 뒤 `filter(Boolean)`으로 **빈 줄만** 버리고, 앞의 `- `와 날짜 접두사만 벗겨낸다. ` ``` `처럼 하이픈도 날짜도 없는 줄은 그대로 통과해 `- ${today} ${l}` 꼴로 박힌다.
- 2026-09-14 `scripts/memory.test.mjs`에도 이런 "펜스 한 줄짜리 노이즈" 케이스에 대한 테스트가 없어서 재발해도 테스트가 잡아주지 않는다.
- 2026-09-14 **위치**
- 2026-09-14 `agents/curator/memory.md:14` (오염된 데이터)
- 2026-09-14 `scripts/lib/memory.mjs:12-22` (근본 원인 — 필터링 누락)
- 2026-09-14 `agents/curator/TASK.md:48-53` (모델이 흉내 낸 원인 소지)
- 2026-09-14 **고치는 법**
- 2026-09-14 `agents/curator/memory.md:14` 줄은 사람이 직접 지운다 (나는 쓰기 권한이 없다).
- 2026-09-14 `mergeMemory`의 라인 필터에 순수 펜스 줄(`/^`{3,}$/` 등)을 버리는 조건을 추가한다. 예: `.filter((l) => !/^`{3,}$/.test(l))`을 `filter(Boolean)` 근처에 끼워 넣는다.
- 2026-09-14 `scripts/memory.test.mjs`에 "노트에 ` ``` ` 단독 줄이 섞여도 항목이 되지 않는다" 회귀 테스트를 하나 추가한다.
- 2026-09-14 근본적으로는 `agents/*/TASK.md`의 마지막 블록 예시들이 전부 ` ``` ` 펜스로 감싸져 있어 같은 일이 다른 에이전트에서도 날 수 있다 — scout/quill/mechanic의 memory.md는 이번에 확인한 바로는 깨끗하지만, 필터를 고치는 게 TASK.md 네 개를 전부 고치는 것보다 싸고 확실하다.
- 2026-09-14 ## 이상 없음이 아니라 "이미 추적 중"인 것
- 2026-09-14 GitHub Actions 버전 노후화(`checkout@v4`→v7.0.1, `setup-node@v4`→v7.0.0, `deploy-pages@v4`→v5.0.1 등)는 08-26 최초 지적 이후 09-07까지 3주 연속 미해결이라 이슈 #17로 재등록했었다. 오늘 확인해보니 **#17이 아직 열려 있다** — 사람이 아직 처리하지 않은 것뿐, 추적이 끊긴 게 아니다. 같은 문제로 새 이슈를 또 올리지 않는다. 처리되거나 #17이 닫히는데도 버전이 그대로면 그때 다시 올린다.
- 2026-09-14 ## 이상 없던 것
- 2026-09-14 README 명령어(`npm run scout`, `scout:dry`, `state`, `test`) — `package.json` scripts와 전부 일치
- 2026-09-14 README 디렉터리 구조도 — `scripts/lib/*.mjs` 5종, `scripts/local/*` 3종, `.github/workflows/*` 8종 모두 실제 파일과 일치
- 2026-09-14 `work/` 누적량 — `work/scout` 22개, `work/quill` 2개, `work/mechanic` 4개. 매일 쌓이는 scout도 아직 관리 가능한 수준
- 2026-09-14 `agents/*/memory.md` 30줄 상한 — 4개 파일 모두 상한 이내 (오염 항목 1건 제외하면 내용도 정상)
- 2026-09-14 `.github/workflows/` — `pull_request_target` 쓰는 곳 없음, `permissions`는 각 워크플로가 실제 쓰는 권한만 선언 (`test.yml`/`on-issue.yml`의 `prep` 잡: `contents: read`, 각 에이전트 잡: 실제 필요한 것만)
- 2026-09-14 `crew.json`의 에이전트 4명 전부 `agents/<id>/` 폴더·워크플로 파일이 대응됨, `output`/`outputFile` 경로도 실제로 쓰임
- 2026-09-14 `scripts/lib/` 5개 모듈(`memory`, `output`, `schedule`, `sections`, `state`) 전부 대응하는 `*.test.mjs` 존재
- 2026-09-14 `scripts/local/work.sh`, `poll.sh` — 이전에 지적됐던 저장소 하드코딩·잠금 오기록 버그 모두 여전히 해결된 상태로 남아 있음
- 2026-09-14 ===MEMORY===
- 2026-09-14 agents/curator/memory.md:14에 코드펜스 "```" 단독 줄이 "- 2026-09-08 ```"로 잘못 박힌 것 발견 — scripts/lib/memory.mjs의 mergeMemory가 순수 펜스 줄을 걸러내지 않는 게 근본원인(agents/curator/TASK.md 예시가 ```로 감싸져 있어 모델이 닫는 펜스까지 출력한 것으로 추정), 이슈로 등록함. 액션 버전 노후화(checkout@v4 등)는 이슈 #17이 아직 열려 있어 재등록하지 않음. 그 외 README·work 누적·memory 30줄 상한·워크플로 permissions·pull_request_target·crew.json-agents 폴더 정합성·테스트 커버리지 전부 이상 없음
- 2026-09-07 새 발견 없음(액션 버전 노후화 제외). checkout@v4·setup-node@v4·upload-pages-artifact@v3·configure-pages@v5·deploy-pages@v4가 08-26 최초 지적 후 3주째(08-26→08-31→09-07) 방치됨을 최신 태그(v7.0.1/v7.0.0/v5.0.0/v6.0.0/v5.0.1) 대조로 재확인, 예고한 대로 이슈 재등록. 그 외 README·scripts/lib 주석·테스트 커버리지·work 누적량·memory 30줄 상한·워크플로 permissions·pull_request_target·crew.json-agents 폴더 정합성 전부 이상 없음
