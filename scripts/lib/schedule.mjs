/**
 * cron 식에서 다음 실행 시각을 구한다.
 *
 * crew.json이 쓰는 범위만 다룬다 — 분, 시, 요일. 일/월은 `*`만 받는다.
 * 필요해지면 그때 넓히면 된다. 지금 없는 문법을 미리 지원하면
 * 검증할 수 없는 코드만 늘어난다.
 *
 * 모든 계산은 UTC 기준이다. GitHub Actions의 cron이 UTC라서다.
 *
 * 순수 함수 — 파일도 시계도 건드리지 않는다. 기준 시각을 인자로 받는다.
 */

// 읽을 수 있는 형태 (블록 주석 안에 스텝 문법을 쓰면 주석이 닫혀버려 여기 둔다)
//   "0 22 * * *"    매일 22:00 UTC
//   "0 0 * * 6"     토요일 00:00 UTC
//   "30 9 * * 1-5"  평일 09:30 UTC
//   "0 */6 * * *"   6시간마다
//   "0 9,18 * * *"  하루 두 번

/** "1-5" "0,3" "*" "*\/6" 같은 필드를 허용 값 집합으로 편다 */
function expand(field, min, max) {
  if (field === "*") return null; // 전부 허용
  const out = new Set();
  for (const part of field.split(",")) {
    const step = part.includes("/") ? Number(part.split("/")[1]) : 1;
    const range = part.split("/")[0];
    if (!Number.isInteger(step) || step < 1) return undefined;

    let lo, hi;
    if (range === "*") { lo = min; hi = max; }
    else if (range.includes("-")) {
      [lo, hi] = range.split("-").map(Number);
    } else {
      lo = hi = Number(range);
    }
    if (![lo, hi].every(Number.isInteger) || lo < min || hi > max || lo > hi) return undefined;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out.size ? out : undefined;
}

/**
 * @param {string} expr  cron 식
 * @param {number} from  기준 시각 (ms). 이 시각 "이후"의 첫 실행을 찾는다.
 * @returns {number|null} 다음 실행 시각(ms). 식을 못 읽으면 null.
 */
export function nextRun(expr, from = Date.now()) {
  const parts = String(expr ?? "").trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minF, hourF, domF, monF, dowF] = parts;
  if (domF !== "*" || monF !== "*") return null; // 지원 범위 밖

  const mins = expand(minF, 0, 59);
  const hours = expand(hourF, 0, 23);
  const dows = expand(dowF, 0, 7);
  if (mins === undefined || hours === undefined || dows === undefined) return null;

  // cron은 일요일을 0과 7 둘 다로 쓴다
  const dowOk = (d) => !dows || dows.has(d) || (d === 0 && dows.has(7));

  const t = new Date(from);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1); // "이후"이므로 다음 분부터

  // 최대 8일치를 분 단위로 훑는다. 요일 조건이 있어도 일주일이면 반드시 걸린다.
  for (let i = 0; i < 8 * 24 * 60; i++) {
    if (dowOk(t.getUTCDay()) &&
        (!hours || hours.has(t.getUTCHours())) &&
        (!mins || mins.has(t.getUTCMinutes()))) {
      return t.getTime();
    }
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return null;
}
