import test from "node:test";
import assert from "node:assert/strict";
import { mergeMemory, HEADING } from "./lib/memory.mjs";

const base = `# 리서처의 기억

설명 문장.

${HEADING}

<!-- 최근 항목이 위로 쌓입니다. -->
`;

test("새 항목이 헤딩 바로 아래에 날짜와 함께 들어간다", () => {
  const out = mergeMemory(base, "- Claude 에이전트 SDK, GitHub Actions 비용", "2026-08-22");
  assert.match(out, /- 2026-08-22 Claude 에이전트 SDK, GitHub Actions 비용/);
  assert.ok(out.indexOf(HEADING) < out.indexOf("2026-08-22"));
});

test("앞의 하이픈이 있든 없든 결과가 같다", () => {
  const a = mergeMemory(base, "- 주제 A", "2026-08-22");
  const b = mergeMemory(base, "주제 A", "2026-08-22");
  assert.equal(a, b);
});

test("기존 항목이 새 항목 아래에 보존된다", () => {
  const once = mergeMemory(base, "첫날 주제", "2026-08-21");
  const twice = mergeMemory(once, "둘째날 주제", "2026-08-22");
  assert.match(twice, /2026-08-21 첫날 주제/);
  const i2 = twice.indexOf("둘째날"), i1 = twice.indexOf("첫날");
  assert.ok(i2 < i1, "최신 항목이 위에 와야 한다");
});

test("헤더와 주석이 보존된다", () => {
  const out = mergeMemory(base, "주제", "2026-08-22");
  assert.match(out, /# 리서처의 기억/);
  assert.match(out, /설명 문장\./);
  assert.match(out, /<!-- 최근 항목이 위로 쌓입니다\. -->/);
});

test("keep 상한을 넘으면 오래된 것부터 잘린다", () => {
  let m = base;
  for (let i = 1; i <= 40; i++) m = mergeMemory(m, `주제 ${i}`, "2026-08-22", 5);
  const items = m.split("\n").filter((l) => l.startsWith("- 2026"));
  assert.equal(items.length, 5);
  assert.match(items[0], /주제 40/);
  assert.ok(!m.includes("주제 1\n"), "가장 오래된 항목은 사라져야 한다");
});

test("여러 줄 메모를 모두 받는다", () => {
  const out = mergeMemory(base, "- 주제 A\n- 주제 B\n\n- 주제 C", "2026-08-22");
  assert.equal(out.split("\n").filter((l) => l.startsWith("- 2026")).length, 3);
});

test("빈 메모면 원본을 그대로 돌려준다", () => {
  assert.equal(mergeMemory(base, "   \n\n  ", "2026-08-22"), base);
});

test("헤딩이 없는 파일에도 새로 만들어 붙인다", () => {
  const out = mergeMemory("# 제목만 있는 파일\n", "주제", "2026-08-22");
  assert.match(out, new RegExp(HEADING));
  assert.match(out, /- 2026-08-22 주제/);
});
