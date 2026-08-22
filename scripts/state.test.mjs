import test from "node:test";
import assert from "node:assert/strict";
import { summarizeWork, deriveStatus, STALE_MS, FRESH_MS } from "./lib/state.mjs";

const doc = `# 2026-08-23 리서치

> 개발자 도구는 Copilot이 협업툴로 파고들고, 미국 증시는 비트코인이 끌었다.

## 개발자 도구

### GitHub Copilot, Slack 안으로

본문.

출처: https://example.com/a

## 미국 증시

### 비트코인 22% 급등

본문.

출처: https://example.com/b

---

## 오늘 확인했지만 넘어간 것

- 한국 증시 — 중복
- CodeQL Swift — 오정보
`;

test("총평과 항목 수를 뽑는다", () => {
  const { summary, items } = summarizeWork(doc);
  assert.match(summary, /^개발자 도구는 Copilot/);
  assert.equal(items, 2);
});

test("'넘어간 것' 아래는 항목으로 세지 않는다", () => {
  const extra = doc + "\n### 이건 넘어간 것 아래라 안 셈\n";
  assert.equal(summarizeWork(extra).items, 2);
});

test("총평이 없어도 죽지 않는다", () => {
  const { summary, items } = summarizeWork("# 제목\n\n### 항목 하나\n");
  assert.equal(summary, "");
  assert.equal(items, 1);
});

test("빈 문서를 견딘다", () => {
  assert.deepEqual(summarizeWork(""), { summary: "", items: 0 });
});

const iso = (ms) => new Date(ms).toISOString();

test("근무 표시가 살아 있으면 working", () => {
  const now = Date.now();
  assert.equal(deriveStatus({ startedAt: iso(now - 60_000), lastRunAt: null }, now), "working");
});

test("근무 표시가 오래되면 working이 아니다", () => {
  const now = Date.now();
  const st = deriveStatus({ startedAt: iso(now - STALE_MS - 1000), lastRunAt: null }, now);
  assert.equal(st, "idle");
});

test("최근 결과물이 있으면 done", () => {
  const now = Date.now();
  assert.equal(deriveStatus({ startedAt: null, lastRunAt: iso(now - 3600_000) }, now), "done");
});

test("결과물이 오래되면 idle", () => {
  const now = Date.now();
  assert.equal(deriveStatus({ startedAt: null, lastRunAt: iso(now - FRESH_MS - 1000) }, now), "idle");
});

test("근무 표시가 최근 결과물보다 우선한다", () => {
  const now = Date.now();
  const st = deriveStatus({ startedAt: iso(now - 60_000), lastRunAt: iso(now - 3600_000) }, now);
  assert.equal(st, "working");
});

test("아무 기록이 없으면 idle", () => {
  assert.equal(deriveStatus({ startedAt: null, lastRunAt: null }), "idle");
});

test("미래 시각이나 깨진 값에 속지 않는다", () => {
  const now = Date.now();
  assert.equal(deriveStatus({ startedAt: iso(now + 600_000), lastRunAt: null }, now), "idle");
  assert.equal(deriveStatus({ startedAt: "언젠가", lastRunAt: "어제" }, now), "idle");
});

test("색인 문서의 이탤릭 부제도 총평으로 잡는다", () => {
  const idx = `# 색인\n\n*2026-08-23 갱신 · 자료 3건 · 항목 7건*\n\n## 개발자 도구\n\n- **A** — 설명\n- **B** — 설명\n`;
  const { summary, items } = summarizeWork(idx);
  assert.equal(summary, "2026-08-23 갱신 · 자료 3건 · 항목 7건");
  assert.equal(items, 2);
});

test("### 이 있으면 불릿은 세지 않는다", () => {
  const md = `# 제목\n\n### 항목 하나\n\n- 본문 속 불릿\n- 또 하나\n\n### 항목 둘\n`;
  assert.equal(summarizeWork(md).items, 2);
});

test("인용줄이 이탤릭보다 우선한다", () => {
  const md = `# 제목\n\n> 진짜 총평\n\n*부제*\n`;
  assert.equal(summarizeWork(md).summary, "진짜 총평");
});
