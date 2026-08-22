/**
 * memory.md 병합.
 *
 * 새 항목을 "## 이미 다룬 주제" 바로 아래에 끼워 넣고, 오래된 항목부터 잘라
 * 파일이 무한정 자라지 않게 한다. 헤더와 HTML 주석은 그대로 보존한다.
 *
 * 순수 함수 — 파일을 읽지도 쓰지도 않는다.
 */

export const HEADING = "## 이미 다룬 주제";

export function mergeMemory(current, note, today, keep = 30) {
  const entries = note
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^-\s*/, ""))
    // 모델이 메모 앞에 날짜를 직접 적어 오는 일이 있다. 그대로 두면
    // "- 2026-08-23 2026-08-23 ..." 처럼 두 번 찍힌다.
    .map((l) => l.replace(/^\d{4}-\d{2}-\d{2}[\s:·-]*/, ""))
    .filter(Boolean)
    .map((l) => `- ${today} ${l}`);

  if (entries.length === 0) return current;

  const lines = current.split("\n");
  const at = lines.findIndex((l) => l.trim().startsWith(HEADING));

  // 헤딩이 없으면 파일 끝에 새로 만든다
  if (at === -1) {
    return [...lines, "", HEADING, "", ...entries, ""].join("\n");
  }

  const head = lines.slice(0, at + 1);
  const rest = lines.slice(at + 1);
  const comments = rest.filter((l) => l.trim().startsWith("<!--"));
  const old = rest.filter((l) => l.trim().startsWith("- "));
  const kept = old.slice(0, Math.max(0, keep - entries.length));

  return [...head, "", ...comments, ...entries, ...kept, ""].join("\n");
}
