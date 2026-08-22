#!/usr/bin/env node
/**
 * 에이전트 한 명을 한 번 근무시킨다.
 *
 *   node scripts/run-agent.mjs scout
 *
 * 읽는 것 : crew.json, agents/<id>/{SOUL,TASK,memory}.md
 * 쓰는 것 : work/<id>/YYYY-MM-DD.md, agents/<id>/memory.md
 */

import Anthropic from "@anthropic-ai/sdk";
import { mergeMemory } from "./lib/memory.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEMORY_MARK = "===MEMORY===";
const MEMORY_KEEP = 30;

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

/* ---------------- 준비 ---------------- */

const agentId = process.argv[2];
if (!agentId) die("에이전트 id가 필요합니다.  예: node scripts/run-agent.mjs scout");

// DRY_RUN=1 이면 API를 부르지 않고 가짜 응답으로 배관만 확인한다 (토큰 0원)
const DRY = process.env.DRY_RUN === "1";

if (!DRY && !process.env.ANTHROPIC_API_KEY) {
  die("ANTHROPIC_API_KEY가 없습니다.\n" +
      "  로컬: export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "  Actions: 저장소 Settings → Secrets → Actions 에 등록");
}

const crew = JSON.parse(await readFile(path.join(ROOT, "crew.json"), "utf8"));
const agent = crew.agents.find((a) => a.id === agentId);
if (!agent) die(`crew.json에 "${agentId}" 항목이 없습니다.`);

const agentDir = path.join(ROOT, "agents", agentId);
const read = async (f) => {
  const p = path.join(agentDir, f);
  if (!existsSync(p)) die(`${path.relative(ROOT, p)} 파일이 없습니다.`);
  return readFile(p, "utf8");
};

const [soul, task, memory] = await Promise.all([
  read("SOUL.md"), read("TASK.md"), read("memory.md")
]);

// KST 기준 날짜 — 워크플로는 UTC로 돌지만 사람은 한국 시간으로 읽는다
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const today = kst.toISOString().slice(0, 10);

/* ---------------- 호출 ---------------- */

const client = DRY ? null : new Anthropic();

const system =
  `${soul}\n\n---\n\n` +
  `오늘은 ${today} (KST)입니다.\n` +
  `다루는 주제:\n${(agent.topics ?? []).map((t) => `- ${t}`).join("\n")}`;

const messages = [{
  role: "user",
  content: `${task}\n\n---\n\n# 내 기억 (memory.md)\n\n${memory}`
}];

const searchTool = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: agent.maxSearches ?? 6
};

async function converse(tools) {
  let turns = 0;
  for (;;) {
    if (++turns > 12) die("응답 루프가 12회를 넘었습니다. 중단합니다.");

    const res = await client.messages.create({
      model: agent.model,
      max_tokens: agent.maxTokens ?? 4000,
      system,
      messages,
      ...(tools ? { tools } : {})
    });

    // 서버 도구가 오래 돌면 pause_turn으로 끊어 보낸다 → 이어서 계속
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    return res;
  }
}

const dryResponse = () => ({
  content: [{
    type: "text",
    text: `# ${today} 리서치\n\n> DRY_RUN 모드 — 실제 호출 없이 배관만 확인한 결과입니다.\n\n` +
          `## 1. 예시 항목\n\n이 문서는 API를 부르지 않고 만들어졌습니다. ` +
          `여기까지 파일이 생겼다면 crew.json 읽기, brain 파일 읽기, 저장 경로, ` +
          `기억 갱신까지 전부 정상입니다.\n\n출처: (없음)\n\n` +
          `${MEMORY_MARK}\n- DRY_RUN 테스트`
  }],
  usage: { input_tokens: 0, output_tokens: 0 }
});

let res;
try {
  res = DRY ? dryResponse() : await converse(agent.webSearch ? [searchTool] : undefined);
} catch (err) {
  const msg = String(err?.message ?? err);
  if (agent.webSearch && /web_search|tool|not.*(enabled|allowed|support)/i.test(msg)) {
    console.warn("⚠ 웹 검색 도구를 쓸 수 없어 검색 없이 진행합니다.");
    console.warn(`  (${msg.split("\n")[0]})`);
    console.warn("  Anthropic 콘솔에서 web search를 활성화하면 해결됩니다.");
    messages.length = 1;
    res = await converse(undefined);
  } else {
    die(`API 호출 실패: ${msg}`);
  }
}

const text = res.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("")
  .trim();

if (!text) die("모델이 빈 응답을 돌려줬습니다.");

/* ---------------- 저장 ---------------- */

const cut = text.indexOf(MEMORY_MARK);
const body = (cut === -1 ? text : text.slice(0, cut)).trim();
const note = cut === -1 ? "" : text.slice(cut + MEMORY_MARK.length).trim();

if (cut === -1) console.warn(`⚠ ${MEMORY_MARK} 블록이 없어 기억을 갱신하지 않습니다.`);

const outDir = path.join(ROOT, agent.output);
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, `${today}.md`);
await writeFile(outFile, body + "\n", "utf8");

if (note) {
  await writeFile(
    path.join(agentDir, "memory.md"),
    mergeMemory(memory, note, today, MEMORY_KEEP),
    "utf8"
  );
}

const usage = res.usage ?? {};
console.log(`✓ ${agent.emoji} ${agent.name} 근무 완료`);
console.log(`  → ${path.relative(ROOT, outFile)} (${body.length}자)`);
if (note) console.log(`  → memory.md 갱신`);
console.log(`  토큰 in ${usage.input_tokens ?? "?"} / out ${usage.output_tokens ?? "?"}`);
