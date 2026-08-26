#!/bin/zsh
#
# 에이전트 한 명을 이 기계에서 근무시킨다.
#
#   scripts/local/work.sh scout        정기 근무
#   scripts/local/work.sh quill 12     이슈 12번을 지시로 받아 근무
#
# .github/workflows/_agent.yml과 같은 일을 한다. 다른 점은 저장소가 이미
# 여기 있다는 것 하나뿐이라, 시작할 때 원격을 따라잡고 끝나면 밀어 넣는다.
#
# 인증: GitHub은 gh(`gh auth setup-git`), Claude는 이 기계의 로그인 세션을
# 그대로 쓴다. CLAUDE_CODE_OAUTH_TOKEN이 필요 없다.

set -uo pipefail

# launchd는 PATH를 거의 안 물려준다. 로그인 셸의 경로를 직접 깐다.
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

ROOT="${0:A:h}/../.."
cd "$ROOT" || exit 1

AGENT="${1:?사용법: work.sh <에이전트 id> [이슈 번호]}"
ISSUE="${2:-0}"

meta() { node -e "
  const a = require('./crew.json').agents.find(x => x.id === '$AGENT');
  if (!a) { console.error('crew.json에 $AGENT 가 없습니다'); process.exit(1); }
  console.log(a['$1'] ?? '');
"; }

EMOJI="$(meta emoji)"   || exit 1
REVIEW="$(meta review)" || exit 1
DATE="$(TZ=Asia/Seoul date +%Y-%m-%d)"

LOGDIR="$HOME/Library/Logs/ai_crew"
mkdir -p "$LOGDIR"
exec > >(tee -a "$LOGDIR/$AGENT.log") 2>&1
echo "════ $(date '+%Y-%m-%d %H:%M:%S %Z')  $EMOJI $AGENT  이슈=$ISSUE ════"

# ── 같은 에이전트가 겹쳐 도는 것을 막는다 (Actions의 concurrency 자리) ──
LOCK="/tmp/ai_crew-$AGENT.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  # 25분을 넘긴 잠금은 죽은 프로세스가 남긴 것으로 본다
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +25 2>/dev/null)" ]; then
    echo "· 오래된 잠금을 걷어냅니다"; rmdir "$LOCK" 2>/dev/null; mkdir "$LOCK" || exit 1
  else
    echo "· 이미 근무 중입니다. 건너뜁니다."; exit 0
  fi
fi
cleanup_lock() { rmdir "$LOCK" 2>/dev/null; }

# ── 실패해도 "작업 중"으로 굳지 않게 표시를 걷어낸다 ──
failed() {
  echo "✗ 근무 실패"
  git checkout main >/dev/null 2>&1
  if node scripts/build-state.mjs >/dev/null 2>&1; then
    git add site/state.json
    git diff --staged --quiet || { git commit -qm "$EMOJI $AGENT 근무 실패 — 상태 정리"; git push -q; }
  fi
  [ "$ISSUE" != "0" ] && gh issue comment "$ISSUE" --body \
    "$EMOJI **$AGENT** 근무가 실패했습니다. 이슈는 열어둡니다.

로그: \`~/Library/Logs/ai_crew/$AGENT.log\` (mini)"
  cleanup_lock
  exit 1
}
trap failed ERR
trap cleanup_lock EXIT

git config user.name  "ai_crew[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# ── 원격 따라잡기 (Actions의 checkout 자리) ──
git checkout -q main
git pull -q --rebase --autostash origin main
echo "· 원격 동기화: $(git log --oneline -1)"

# ── 출근 표시 ──
node scripts/build-state.mjs --start "$AGENT" >/dev/null
git add site/state.json
git diff --staged --quiet || { git commit -qm "$EMOJI $AGENT 출근"; git push -q; }

# ── 이슈 지시 읽기 ──
export AGENT_INSTRUCTION_FILE="" AGENT_SUFFIX=""
if [ "$ISSUE" != "0" ]; then
  mkdir -p .ci
  gh issue view "$ISSUE" --json title,body --template '# {{.title}}{{"\n\n"}}{{.body}}' > .ci/instruction.md
  export AGENT_INSTRUCTION_FILE=".ci/instruction.md" AGENT_SUFFIX="-i$ISSUE"
  echo "· 지시 $(wc -c < .ci/instruction.md | tr -d ' ')자"
fi

# ── 근무 ──
node scripts/run-agent.mjs "$AGENT"

# ── 결과 반영 ──
if [ "$REVIEW" = "pull-request" ] && [ "$ISSUE" = "0" ]; then
  # 사람이 읽고 병합한다. 그때까지 오피스에는 결과물이 없는 게 맞는 표시다.
  BRANCH="$AGENT/$DATE"
  git checkout -qb "$BRANCH"
  git add work/ "agents/$AGENT/memory.md"
  if git diff --staged --quiet; then
    echo "· 산출물 변경 없음 — PR을 만들지 않습니다"
    git checkout -q main
  else
    git commit -qm "$EMOJI $AGENT: $DATE"
    git push -q -u origin "$BRANCH"
    gh pr create --title "$EMOJI $AGENT: $DATE" --base main --head "$BRANCH" \
      --body "mini에서 자동 생성된 초안입니다. 읽어보고 병합하거나 닫아주세요.

- 에이전트: \`$AGENT\`
- 로그: \`~/Library/Logs/ai_crew/$AGENT.log\` (mini)"
    git checkout -q main
  fi
  node scripts/build-state.mjs --clear >/dev/null
  git add site/state.json
  git diff --staged --quiet || { git commit -qm "$EMOJI $AGENT 퇴근"; git push -q; }
else
  git add work/ archive/ "agents/$AGENT/memory.md"
  git diff --staged --quiet && echo "· 산출물 변경 없음" \
    || git commit -qm "$EMOJI $AGENT: $DATE"
  # state.json은 산출물이 커밋된 뒤에 만들어야 커밋 시각이 잡힌다
  node scripts/build-state.mjs >/dev/null
  git add site/state.json
  git diff --staged --quiet || git commit -qm "$EMOJI $AGENT 퇴근"
  git push -q
fi

# ── 점검 결과가 있으면 이슈로 ──
if [ -s .ci/issue.md ]; then
  gh issue create --title "$EMOJI $AGENT 점검: $DATE" --body-file .ci/issue.md
fi

# ── 지시받은 이슈에 결과를 돌려준다 ──
if [ "$ISSUE" != "0" ]; then
  FILE="$(cat .ci/last-output.txt 2>/dev/null || true)"
  [ -f "$FILE" ] || FILE=""
  {
    echo "$EMOJI **$AGENT** 근무를 마쳤습니다. *(mini)*"
    echo
    if [ -n "$FILE" ]; then
      echo "산출물: [\`$FILE\`](https://github.com/heekeunlee/ai_crew/blob/main/$FILE)"
      echo
      echo "<details><summary>미리보기</summary>"
      echo
      head -c 3000 "$FILE"
      echo
      echo "</details>"
    else
      echo "산출물 파일이 생성되지 않았습니다."
    fi
  } > /tmp/ai_crew-reply.md
  gh issue comment "$ISSUE" --body-file /tmp/ai_crew-reply.md
  gh issue close "$ISSUE" --reason completed
fi

echo "✓ $EMOJI $AGENT 근무 완료  $(date '+%H:%M:%S')"
