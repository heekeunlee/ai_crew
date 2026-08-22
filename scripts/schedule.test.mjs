import test from "node:test";
import assert from "node:assert/strict";
import { nextRun } from "./lib/schedule.mjs";

const at = (iso) => Date.parse(iso);
const iso = (ms) => new Date(ms).toISOString().replace(".000", "");

test("매일 정해진 시각 — 오늘 아직 안 지났으면 오늘", () => {
  assert.equal(iso(nextRun("0 22 * * *", at("2026-08-23T10:00:00Z"))), "2026-08-23T22:00:00Z");
});

test("매일 정해진 시각 — 이미 지났으면 내일", () => {
  assert.equal(iso(nextRun("0 22 * * *", at("2026-08-23T22:30:00Z"))), "2026-08-24T22:00:00Z");
});

test("정확히 그 시각이면 다음 회차를 준다", () => {
  assert.equal(iso(nextRun("0 22 * * *", at("2026-08-23T22:00:00Z"))), "2026-08-24T22:00:00Z");
});

test("요일 지정 — 토요일", () => {
  // 2026-08-23은 일요일
  const r = nextRun("0 0 * * 6", at("2026-08-23T01:00:00Z"));
  assert.equal(new Date(r).getUTCDay(), 6);
  assert.equal(iso(r), "2026-08-29T00:00:00Z");
});

test("요일 지정 — 월요일", () => {
  const r = nextRun("0 0 * * 1", at("2026-08-23T01:00:00Z"));
  assert.equal(iso(r), "2026-08-24T00:00:00Z");
});

test("요일 범위 1-5는 평일만", () => {
  // 금요일 밤 → 다음은 월요일
  const r = nextRun("30 9 * * 1-5", at("2026-08-21T23:00:00Z"));
  assert.equal(iso(r), "2026-08-24T09:30:00Z");
});

test("일요일은 0과 7 둘 다 받는다", () => {
  const a = nextRun("0 5 * * 0", at("2026-08-22T12:00:00Z"));
  const b = nextRun("0 5 * * 7", at("2026-08-22T12:00:00Z"));
  assert.equal(a, b);
  assert.equal(new Date(a).getUTCDay(), 0);
});

test("스텝 문법 */6", () => {
  assert.equal(iso(nextRun("0 */6 * * *", at("2026-08-23T07:00:00Z"))), "2026-08-23T12:00:00Z");
});

test("쉼표 목록", () => {
  assert.equal(iso(nextRun("0 9,18 * * *", at("2026-08-23T10:00:00Z"))), "2026-08-23T18:00:00Z");
});

test("crew.json의 네 식이 모두 읽힌다", () => {
  for (const e of ["0 22 * * *", "0 0 * * 6", "0 14 * * *", "0 0 * * 1"]) {
    assert.ok(Number.isFinite(nextRun(e, at("2026-08-23T01:00:00Z"))), e);
  }
});

test("지원하지 않거나 깨진 식은 null", () => {
  for (const e of ["", null, "0 22 * *", "0 22 1 * *", "0 22 * 3 *", "abc", "0 99 * * *", "0 22 * * 9"]) {
    assert.equal(nextRun(e, at("2026-08-23T01:00:00Z")), null, JSON.stringify(e));
  }
});

test("결과는 항상 기준 시각보다 뒤다", () => {
  const base = at("2026-08-23T13:37:00Z");
  for (const e of ["0 22 * * *", "0 0 * * 6", "*/5 * * * *"]) {
    assert.ok(nextRun(e, base) > base, e);
  }
});
