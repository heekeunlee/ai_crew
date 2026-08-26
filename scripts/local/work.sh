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
# 이미 근무 중이라 아무것도 안 하고 물러났음을 알리는 종료 코드
BUSY=75
LOCK="${TMPDIR:-/tmp}/ai_crew-$AGENT.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  # 경과 시간만 재면 오래 걸리는 근무를 죽은 것으로 오해해 두 벌이 같이 돈다.
  # 잠금을 만든 프로세스가 아직 살아 있는지를 본다.
  OWNER_PID="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$OWNER_PID" ] && kill -0 "$OWNER_PID" 2>/dev/null; then
    # 75로 나간다. 부른 쪽(poll.sh)이 "아직 안 했다"와 "실패했다"를 갈라야 한다.
    echo "· 이미 근무 중입니다 (pid $OWNER_PID). 건너뜁니다."; exit $BUSY
  fi
  # pid를 적기 직전에 끼어든 것일 수 있다. 갓 만들어진 잠금은 살아 있다고 본다.
  if [ -z "$OWNER_PID" ] && [ -z "$(find "$LOCK" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
    echo "· 방금 만들어진 잠금입니다. 건너뜁니다."; exit $BUSY
  fi
  echo "· 주인 없는 잠금을 걷어냅니다"
  rm -rf "$LOCK"; mkdir "$LOCK" || exit 1
fi
echo $$ > "$LOCK/pid"
TICK_PID=""
cleanup_lock() {
  [ -n "$TICK_PID" ] && kill "$TICK_PID" 2>/dev/null
  [ -n "${LOCK:-}" ] && rm -rf "$LOCK" 2>/dev/null
}

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

- 근무 로그: \`~/Library/Logs/ai_crew/$AGENT.log\`
- 실패 전문: \`~/Library/Logs/ai_crew/$AGENT.last-failure.txt\`

*(둘 다 mini에 있습니다)*"
  cleanup_lock
  exit 1
}
trap failed ERR
trap cleanup_lock EXIT

# Actions는 근무마다 저장소를 새로 받아 .ci/가 늘 비어 있다. 여기는 그 폴더가
# 계속 남는다. 지난 근무의 .ci/issue.md를 치우지 않으면 다음 에이전트가 그걸
# 자기 것으로 알고 다시 올린다 — 실제로 리서처가 메카닉의 점검을 이슈로 올렸다.
rm -f .ci/issue.md .ci/last-output.txt .ci/instruction.md

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
# claude -p는 답을 다 만들 때까지 한 글자도 내보내지 않는다. 몇 분씩 걸리는데
# 화면이 조용하면 사람은 멈춘 줄 안다. 살아 있다는 신호를 30초마다 찍는다.
echo "· 근무 시작 — 모델이 답할 때까지 출력이 없습니다 (보통 2~6분)"
START=$(date +%s)

node scripts/run-agent.mjs "$AGENT" &
WORK_PID=$!

{
  while kill -0 "$WORK_PID" 2>/dev/null; do
    sleep 30
    kill -0 "$WORK_PID" 2>/dev/null || break
    E=$(( $(date +%s) - START ))
    printf "  … 근무 중 %d분 %02d초\n" $((E / 60)) $((E % 60))
  done
} &
TICK_PID=$!

wait "$WORK_PID"        # 실패하면 ERR 트랩이 받는다
kill "$TICK_PID" 2>/dev/null; TICK_PID=""

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
if [ -s .ci/issue.md ] && [ "$(meta issues)" = "true" ]; then
  gh issue create --title "$EMOJI $AGENT 점검: $DATE" --body-file .ci/issue.md
fi

# ── 지시받은 이슈에 결과를 돌려준다 ──
if [ "$ISSUE" != "0" ]; then
  FILE="$(cat .ci/last-output.txt 2>/dev/null || true)"
  [ -f "$FILE" ] || FILE=""
  REPLY="${TMPDIR:-/tmp}/ai_crew-reply-$ISSUE.md"
  {
    echo "$EMOJI **$AGENT** 근무를 마쳤습니다. *(mini)*"
    echo
    if [ -n "$FILE" ]; then
      REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
      echo "산출물: [\`$FILE\`](https://github.com/$REPO/blob/main/$FILE)"
      echo
      echo "<details><summary>미리보기</summary>"
      echo
      head -c 3000 "$FILE"
      echo
      echo "</details>"
    else
      echo "산출물 파일이 생성되지 않았습니다."
    fi
  } > "$REPLY"
  gh issue comment "$ISSUE" --body-file "$REPLY"
  rm -f "$REPLY"

  # 산출물이 없다는 것은 지시가 이행되지 않았다는 뜻이다. 여기서 닫으면
  # "완료"로 표시된 채 아무도 손대지 않은 지시가 되어 조용히 묻힌다.
  if [ -n "$FILE" ]; then
    gh issue close "$ISSUE" --reason completed
  else
    echo "· 산출물이 없어 이슈 #$ISSUE 를 열어둡니다"
  fi
fi

echo "✓ $EMOJI $AGENT 근무 완료  $(date '+%H:%M:%S')"
