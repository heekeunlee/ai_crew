#!/usr/bin/env node
/**
 * 저장소 상태를 화면이 읽을 site/state.json 한 장으로 만든다.
 *
 *   node scripts/build-state.mjs                평소 갱신
 *   node scripts/build-state.mjs --start scout  근무 시작 표시
 *   node scripts/build-state.mjs --clear        근무 표시 전부 걷어내기
 *
 * 화면은 이 파일 하나만 가져간다. 로스터도 여기 같이 실어서 fetch가 한 번이면 끝난다.
 */

import { summarizeWork, deriveStatus, STALE_MS } from "./lib/state.mjs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "site", "state.json");
const RECENT = 5;

const args = process.argv.slice(2);
const startFlag = args.indexOf("--start");
const startAgent = startFlag === -1 ? null : args[startFlag + 1];
const clearAll = args.includes("--clear");

const crew = JSON.parse(await readFile(path.join(ROOT, "crew.json"), "utf8"));

/** 이전 state를 읽어 근무 표시를 이어받는다 */
let prev = { agents: [] };
if (existsSync(OUT)) {
  try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch { /* 깨졌으면 새로 만든다 */ }
}
const prevOf = (id) => prev.agents?.find((a) => a.id === id) ?? {};

/** 파일이 마지막으로 커밋된 시각. 커밋 전이면 null. */
function committedAt(relPath) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", relPath], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

const repo = (() => {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
})();

const now = Date.now();
const todayKST = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
const agents = [];

for (const [i, a] of crew.agents.entries()) {
  // 산출물이 날짜별로 쌓이는 에이전트와, 파일 하나를 계속 덮어쓰는
  // 에이전트(아키비스트)를 같은 모양으로 맞춘다.
  const single = a.outputMode === "single";
  const rels = [];

  if (single) {
    if (existsSync(path.join(ROOT, a.outputFile))) rels.push(a.outputFile);
  } else {
    const dir = path.join(ROOT, a.output);
    if (existsSync(dir)) {
      // 정기 근무는 2026-08-23.md, 이슈 근무는 2026-08-23-i7.md
      for (const f of (await readdir(dir))
        .filter((f) => /^\d{4}-\d{2}-\d{2}(-i\d+)?\.md$/.test(f))
        .sort()
        .reverse()) {
        rels.push(path.posix.join(a.output, f));
      }
    }
  }

  // 파일명 정렬 순서와 커밋 순서는 다르다. 같은 날 정기 근무(2026-08-23.md)와
  // 이슈 근무(2026-08-23-i7.md)가 겹치면 나중에 커밋된 쪽이 앞이 아닐 수 있다.
  // 상태 판정은 "가장 최근 커밋"을 봐야 하므로 최댓값을 쓴다.
  const lastRunAt = rels
    .slice(0, RECENT)
    .map(committedAt)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  const recent = [];
  for (const rel of rels.slice(0, RECENT)) {
    const md = await readFile(path.join(ROOT, rel), "utf8");
    const { summary, items } = summarizeWork(md);
    const named = path.basename(rel, ".md");
    const dated = named.match(/^(\d{4}-\d{2}-\d{2})(?:-i(\d+))?$/);
    recent.push({
      // 덮어쓰기형은 파일명에 날짜가 없으므로 커밋 시각에서 뽑는다
      date: dated ? dated[1] : (lastRunAt ? lastRunAt.slice(0, 10) : todayKST),
      // 이슈로 지시받아 한 근무면 몇 번 이슈였는지 남긴다
      ...(dated?.[2] ? { issue: Number(dated[2]) } : {}),
      summary,
      items,
      url: repo ? `https://github.com/${repo}/blob/main/${rel}` : rel,
    });
  }

  const files = rels;

  // --start로 켠 표시를 물려받되, 오래된 것은 여기서 정리한다
  let startedAt = clearAll ? null : (prevOf(a.id).startedAt ?? null);
  if (startAgent === a.id) startedAt = new Date(now).toISOString();
  if (startedAt && now - Date.parse(startedAt) >= STALE_MS) startedAt = null;
  // 근무 시작 이후에 결과물이 커밋됐으면 그 근무는 끝난 것이다
  if (startedAt && lastRunAt && Date.parse(lastRunAt) >= Date.parse(startedAt)) startedAt = null;

  agents.push({
    id: a.id,
    name: a.name,
    emoji: a.emoji,
    color: a.color,
    desk: i,
    schedule: a.schedule ?? null,
    scheduleNote: a.scheduleNote ?? null,
    status: deriveStatus({ startedAt, lastRunAt }, now),
    startedAt,
    lastRunAt,
    total: files.length,
    recent,
  });
}

const state = {
  generatedAt: new Date(now).toISOString(),
  repo,
  officeTitle: crew.officeTitle ?? "AI CREW",
  agents,
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(state, null, 2) + "\n", "utf8");

console.log(`✓ site/state.json 생성`);
for (const a of agents) {
  console.log(`  ${a.emoji} ${a.name.padEnd(6)} ${a.status.padEnd(8)} 산출물 ${a.total}건`);
}
