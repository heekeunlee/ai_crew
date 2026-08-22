/**
 * 산출물 파일과 근무 표시를 화면이 읽을 상태로 바꾼다.
 *
 * 순수 함수만 — 파일도 git도 건드리지 않는다. 실제 I/O는 build-state.mjs가 한다.
 */

/** 작업 중 표시가 이 시간을 넘기면 죽은 것으로 본다 (워크플로가 중간에 실패한 경우) */
export const STALE_MS = 30 * 60 * 1000;

/** 커밋 후 이 시간 안이면 "방금 완료"로 본다 */
export const FRESH_MS = 6 * 60 * 60 * 1000;

/**
 * 리서치 문서 한 편에서 화면에 쓸 요약을 뽑는다.
 *  - 첫 인용줄(> ...)이 총평
 *  - ### 개수가 항목 수
 */
export function summarizeWork(markdown) {
  const lines = markdown.split("\n");

  const quote = lines.find((l) => /^>\s+\S/.test(l));
  const summary = quote ? quote.replace(/^>\s+/, "").trim() : "";

  // "넘어간 것" 섹션 아래의 목록은 산출물이 아니므로 세지 않는다
  const cutAt = lines.findIndex((l) => /^##\s+.*넘어간/.test(l));
  const body = cutAt === -1 ? lines : lines.slice(0, cutAt);
  const items = body.filter((l) => /^###\s+\S/.test(l)).length;

  return { summary, items };
}

/**
 * 에이전트 하나의 표시 상태를 정한다.
 *
 *   working  근무 표시가 있고 아직 살아 있음
 *   done     최근 FRESH_MS 안에 결과물을 냄
 *   idle     그 외
 */
export function deriveStatus({ startedAt, lastRunAt }, now = Date.now()) {
  if (startedAt) {
    const age = now - Date.parse(startedAt);
    if (Number.isFinite(age) && age >= 0 && age < STALE_MS) return "working";
  }
  if (lastRunAt) {
    const age = now - Date.parse(lastRunAt);
    if (Number.isFinite(age) && age >= 0 && age < FRESH_MS) return "done";
  }
  return "idle";
}
