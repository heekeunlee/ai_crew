import test from "node:test";
import assert from "node:assert/strict";
import { splitSections } from "./lib/sections.mjs";

const M = "===MEMORY===";
const I = "===ISSUE===";

test("표식이 없으면 전부 본문이다", () => {
  const { body, sections } = splitSections("# 제목\n\n내용", [M, I]);
  assert.equal(body, "# 제목\n\n내용");
  assert.deepEqual(sections, {});
});

test("표식 하나를 가른다", () => {
  const { body, sections } = splitSections(`# 제목\n\n내용\n\n${M}\n- 메모`, [M, I]);
  assert.equal(body, "# 제목\n\n내용");
  assert.equal(sections[M], "- 메모");
});

test("표식 두 개를 순서대로 가른다", () => {
  const t = `# 보고서\n\n발견함\n\n${M}\n- 기억\n\n${I}\n- [ ] 할 일`;
  const { body, sections } = splitSections(t, [M, I]);
  assert.equal(body, "# 보고서\n\n발견함");
  assert.equal(sections[M], "- 기억");
  assert.equal(sections[I], "- [ ] 할 일");
});

test("응답에 나온 순서가 인자 순서와 달라도 된다", () => {
  const t = `본문\n\n${I}\n- [ ] 할 일\n\n${M}\n- 기억`;
  const { body, sections } = splitSections(t, [M, I]);
  assert.equal(body, "본문");
  assert.equal(sections[I], "- [ ] 할 일");
  assert.equal(sections[M], "- 기억");
});

test("찾지 못한 표식은 키 자체가 없다", () => {
  const { sections } = splitSections(`본문\n\n${M}\n- 기억`, [M, I]);
  assert.ok(!(I in sections));
  assert.equal(sections[I] ?? "", "");
});

test("표식만 있고 내용이 없으면 빈 문자열", () => {
  const { body, sections } = splitSections(`본문\n\n${M}`, [M, I]);
  assert.equal(body, "본문");
  assert.equal(sections[M], "");
});

test("본문이 비어도 견딘다", () => {
  const { body, sections } = splitSections(`${M}\n- 기억`, [M, I]);
  assert.equal(body, "");
  assert.equal(sections[M], "- 기억");
});

test("빈 입력을 견딘다", () => {
  assert.deepEqual(splitSections("", [M, I]), { body: "", sections: {} });
});
