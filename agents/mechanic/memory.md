# 기억

근무를 마칠 때마다 스스로 갱신합니다. 사람이 직접 고쳐도 됩니다.

## 이미 다룬 주제

<!-- 최근 항목이 위로 쌓입니다. 30줄이 넘으면 오래된 것부터 지웁니다. -->
- 2026-09-07 새 발견 없음(액션 버전 노후화 제외). checkout@v4·setup-node@v4·upload-pages-artifact@v3·configure-pages@v5·deploy-pages@v4가 08-26 최초 지적 후 3주째(08-26→08-31→09-07) 방치됨을 최신 태그(v7.0.1/v7.0.0/v5.0.0/v6.0.0/v5.0.1) 대조로 재확인, 예고한 대로 이슈 재등록. 그 외 README·scripts/lib 주석·테스트 커버리지·work 누적량·memory 30줄 상한·워크플로 permissions·pull_request_target·crew.json-agents 폴더 정합성 전부 이상 없음
- 2026-08-31 새 발견 없음. 08-26에 지적한 poll.sh(잠금-스킵 오기록, 모르는 라벨 무응답)·work.sh(저장소 하드코딩) 버그가 모두 고쳐진 것 확인. 액션 버전 노후화(checkout@v4·setup-node@v4·upload-pages-artifact@v3 등)는 아직 미해결로 남아있음 — 다음에도 계속 방치되면 다시 올릴 것
- 2026-08-26 (Actions→mini 이전 점검) poll.sh: 잠금-스킵 이슈를 seen으로 잘못 기록(영구 유실 위험), 모르는 에이전트 라벨에 이슈 댓글 안 함 / work.sh: 완료 댓글에 "heekeunlee/ai_crew" 하드코딩 / README:105 "책상=Actions" 문구가 낡음 — 경로 하드코딩 자체는 깨끗함
- 2026-08-26 워크플로 5개 파일에서 actions/checkout·setup-node·configure-pages·upload-pages-artifact·deploy-pages 버전이 최신 대비 1~3 메이저 뒤처진 것 발견 (문서·설정·테스트는 이상 없음)
- 2026-08-26 splitSections가 마커를 부분 문자열로 찾아 본문이 잘리고 나머지가 기억으로 흘러드는 버그를 발견 — 줄 단위 정확 매칭으로 고치고 회귀 테스트 3개를 넣어 해결됨
- 2026-08-24 README 구조도에 lib/schedule.mjs 누락, 테스트 5종을 4종으로 기재
- 2026-08-23 README 구조도에 lib/output.mjs·lib/sections.mjs 누락, 워크플로 permissions 과다 부여 (이후 반영 확인)
