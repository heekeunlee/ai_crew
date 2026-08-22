import test from "node:test";
import assert from "node:assert/strict";
import { stripPreamble } from "./lib/output.mjs";

test("첫 H1 앞의 서두를 잘라낸다", () => {
  const s = "8회 검색을 모두 마쳤습니다. 요약본을 작성합니다.\n\n---\n\n# 2026-08-23 리서치\n\n> 총평";
  assert.equal(stripPreamble(s), "# 2026-08-23 리서치\n\n> 총평");
});

test("이미 H1으로 시작하면 그대로 둔다", () => {
  const s = "# 2026-08-23 리서치\n\n> 총평\n\n## 개발자 도구";
  assert.equal(stripPreamble(s), s);
});

test("H1이 없으면 손대지 않는다", () => {
  const s = "## 소제목만 있는 응답\n\n내용";
  assert.equal(stripPreamble(s), s);
});

test("본문 속 H1은 건드리지 않는다 (첫 번째만 기준)", () => {
  const s = "서두 한 줄\n\n# 첫 제목\n\n내용\n\n# 두 번째 제목\n\n내용";
  assert.equal(stripPreamble(s), "# 첫 제목\n\n내용\n\n# 두 번째 제목\n\n내용");
});

test("잘라낼 앞부분이 너무 길면 본문일 수 있으므로 보존한다", () => {
  const s = "가".repeat(500) + "\n\n# 뒤늦은 제목\n\n내용";
  assert.equal(stripPreamble(s), s.trim());
});

test("# 뒤에 내용이 없는 줄은 헤딩으로 치지 않는다", () => {
  const s = "서두\n\n#\n\n# 진짜 제목\n\n내용";
  assert.equal(stripPreamble(s), "# 진짜 제목\n\n내용");
});

test("앞뒤 공백을 정리한다", () => {
  assert.equal(stripPreamble("\n\n  \n# 제목\n\n내용\n\n\n"), "# 제목\n\n내용");
});
