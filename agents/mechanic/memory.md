# 기억

근무를 마칠 때마다 스스로 갱신합니다. 사람이 직접 고쳐도 됩니다.

## 이미 다룬 주제

<!-- 최근 항목이 위로 쌓입니다. 30줄이 넘으면 오래된 것부터 지웁니다. -->
- 2026-08-26 (Actions→mini 이전 점검) poll.sh: 잠금-스킵 이슈를 seen으로 잘못 기록(영구 유실 위험), 모르는 에이전트 라벨에 이슈 댓글 안 함 / work.sh: 완료 댓글에 "heekeunlee/ai_crew" 하드코딩 / README:105 "책상=Actions" 문구가 낡음 — 경로 하드코딩 자체는 깨끗함
- 2026-08-26 워크플로 5개 파일에서 actions/checkout·setup-node·configure-pages·upload-pages-artifact·deploy-pages 버전이 최신 대비 1~3 메이저 뒤처진 것 발견 (문서·설정·테스트는 이상 없음)
- 2026-08-26 splitSections가 마커를 부분 문자열로 찾아 본문이 잘리고 나머지가 기억으로 흘러드는 버그를 발견 — 줄 단위 정확 매칭으로 고치고 회귀 테스트 3개를 넣어 해결됨
- 2026-08-24 README 구조도에 lib/schedule.mjs 누락, 테스트 5종을 4종으로 기재
- 2026-08-23 README 구조도에 lib/output.mjs·lib/sections.mjs 누락, 워크플로 permissions 과다 부여 (이후 반영 확인)
