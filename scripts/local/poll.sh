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
      echo "$KEY" >> "$SEEN"
      continue
    fi

    echo "· 이슈 #$NUM → $ID"
    # 성공이든 실패든 한 번 집어간 것으로 기록한다. 무한 재시도를 막는다.
    echo "$KEY" >> "$SEEN"
    "$ROOT/scripts/local/work.sh" "$ID" "$NUM"
  done

# 기록이 무한정 자라지 않게 최근 것만 남긴다
tail -n 200 "$SEEN" > "$SEEN.tmp" && mv "$SEEN.tmp" "$SEEN"
