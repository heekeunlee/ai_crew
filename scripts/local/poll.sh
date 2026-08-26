#!/bin/zsh
#
# 이슈 칸반을 폴링해 대기 중인 지시를 집어간다.
# .github/workflows/on-issue.yml 자리를 대신한다.
#
# 깃허브는 라벨이 "붙는 순간"을 이벤트로 알려주지만 여기서는 그럴 수 없다.
# 그래서 열린 이슈의 상태를 보고, 한 번 집어간 이슈는 updatedAt이 바뀌기
# 전까지 다시 건드리지 않는다. 실패한 지시를 다시 돌리려면 이슈에 댓글을
# 달거나 라벨을 다시 붙이면 된다 — 둘 다 updatedAt을 바꾼다.

set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

ROOT="${0:A:h}/../.."
cd "$ROOT" || exit 1

STATE="$HOME/Library/Application Support/ai_crew"
SEEN="$STATE/handled"
mkdir -p "$STATE"; touch "$SEEN"

OWNER="$(gh repo view --json owner --jq .owner.login)" || exit 0

# 이슈는 누구나 열 수 있다. 저장소 주인이 연 것만 받는다.
# 이게 없으면 남이 이슈를 열어 구독 사용량을 태울 수 있다.
gh issue list --state open --limit 20 --json number,labels,author,updatedAt \
  --jq ".[] | select(.author.login == \"$OWNER\")
        | . as \$i
        | (\$i.labels[].name | select(startswith(\"agent:\")))
        | \"\(\$i.number)\t\(.[6:])\t\(\$i.updatedAt)\"" \
| while IFS=$'\t' read -r NUM ID UPDATED; do
    KEY="$NUM:$UPDATED"
    grep -qxF "$KEY" "$SEEN" && continue

    if ! node -e "process.exit(require('./crew.json').agents.some(a=>a.id==='$ID')?0:1)"; then
      echo "· 이슈 #$NUM: crew.json에 '$ID' 가 없습니다"
      # 로그에만 남기면 이슈를 연 사람은 무시당한 줄 안다. on-issue.yml처럼 알려준다.
      IDS="$(node -e "console.log(require('./crew.json').agents.map(a=>'agent:'+a.id).join(', '))")"
      gh issue comment "$NUM" --body \
        "라벨 \`agent:$ID\` 에 해당하는 에이전트가 crew.json에 없습니다. 쓸 수 있는 라벨: $IDS"
      echo "$KEY" >> "$SEEN"
      continue
    fi

    echo "· 이슈 #$NUM → $ID"
    "$ROOT/scripts/local/work.sh" "$ID" "$NUM"
    RC=$?

    # 75는 "그 에이전트가 다른 이슈로 바빠서 손도 못 댔다"는 뜻이다. 기록하면
    # 안 된다 — 기록하는 순간 그 지시는 아무도 안 한 채 영영 묻힌다.
    # 그 밖의 실패는 기록한다. 2분마다 같은 실패를 반복하는 게 더 나쁘다.
    if [ "$RC" -eq 75 ]; then
      echo "· 이슈 #$NUM: $ID 가 근무 중 — 다음 폴링에서 다시 시도합니다"
    else
      echo "$KEY" >> "$SEEN"
    fi
  done

# 기록이 무한정 자라지 않게 최근 것만 남긴다
tail -n 200 "$SEEN" > "$SEEN.tmp" && mv "$SEEN.tmp" "$SEEN"
