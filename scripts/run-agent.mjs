#!/usr/bin/env node
/**
 * 에이전트 한 명을 한 번 근무시킨다.
 *
 *   node scripts/run-agent.mjs scout
 *
 * 모델 호출은 Claude Code를 headless(-p)로 띄워서 한다. Anthropic API 키가
 * 아니라 Claude 구독 토큰(CLAUDE_CODE_OAUTH_TOKEN)으로 인증하므로 API 크레딧이
 * 들지 않는다. 대신 구독 사용량을 쓴다.
 *
 * 에이전트마다 다른 것은 전부 crew.json에 있다. 이 스크립트는 네 명 모두에게
 * 같은 계약을 준다 — 프롬프트를 받고 마크다운을 돌려준다.
 *
 *   inputs      프롬프트에 끼워 넣을 기존 산출물
 *   readsRepo   저장소를 직접 훑어야 하는가 (메카닉만 true)
 *   outputMode  "dated"  → work/<id>/YYYY-MM-DD.md
 *               "single" → 고정 파일 하나를 덮어씀
 *
 * 정기 근무 외에 이슈로 즉석 지시를 받을 수도 있다.
 *   AGENT_INSTRUCTION_FILE  이번 근무에만 적용할 지시가 담긴 파일
 *   AGENT_SUFFIX            산출물 파일명 뒤에 붙일 꼬리 (예: -i7)
 */

import { mergeMemory } from "./lib/memory.mjs";
import { stripPreamble } from "./lib/output.mjs";
import { splitSections } from "./lib/sections.mjs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK_MEMORY = "===MEMORY===";
const MARK_ISSUE = "===ISSUE===";
const MEMORY_KEEP = 30;

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

/* ---------------- 준비 ---------------- */

const agentId = process.argv[2];
if (!agentId) die("에이전트 id가 필요합니다.  예: node scripts/run-agent.mjs scout");

const DRY = process.env.DRY_RUN === "1";

if (!DRY && process.env.CI && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  die("CLAUDE_CODE_OAUTH_TOKEN이 없습니다.\n" +
      "  1) 로컬에서 `claude setup-token` 실행\n" +
      "  2) 출력된 토큰을 저장소 Settings → Secrets → Actions 에 등록");
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

const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/* ---------------- 입력 자료 ---------------- */

/** crew.json의 inputs에 적힌 디렉터리에서 최근 파일을 읽어 프롬프트에 끼운다 */
async function collectInputs() {
  const blocks = [];
  for (const spec of agent.inputs ?? []) {
    const dir = path.join(ROOT, spec.dir);
    if (!existsSync(dir)) continue;

    const files = (await readdir(dir))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, spec.limit ?? 5);

    for (const f of files) {
      const md = await readFile(path.join(dir, f), "utf8");
      blocks.push(`### ${path.posix.join(spec.dir, f)}\n\n${md.trim()}`);
    }
  }
  return blocks;
}

const inputs = await collectInputs();

/* ---------------- 즉석 지시 ---------------- */

// 이슈로 들어온 지시. 정기 근무면 비어 있다.
let instruction = "";
const instFile = process.env.AGENT_INSTRUCTION_FILE;
if (instFile) {
  if (!existsSync(instFile)) die(`지시 파일이 없습니다: ${instFile}`);
  instruction = (await readFile(instFile, "utf8")).trim();
  if (!instruction) die("지시 파일이 비어 있습니다.");
}

/* ---------------- 프롬프트 ---------------- */

// Claude Code는 코딩 에이전트라 놔두면 파일부터 읽으려 든다. 저장소를 훑어야 하는
// 에이전트가 아니라면 필요한 내용을 전부 프롬프트에 넣고 접근 불가를 명시해야 헤매지 않는다.
const GUARD = agent.readsRepo
  ? "저장소 파일을 읽어도 된다. 다만 어떤 파일도 수정하거나 생성하지 마라.\n" +
    "결과물은 응답 본문으로 출력해라. 저장은 호출한 쪽이 한다."
  : "너는 파일 시스템에 접근할 수 없다. 필요한 정보는 전부 이 프롬프트 안에 있다.\n" +
    "결과물을 파일로 저장하려 하지 말고 응답 본문으로 출력해라. 저장은 호출한 쪽이 한다.";

const topicBlock = agent.topics?.length
  ? `\n\n다루는 주제:\n${agent.topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
  : "";

const system = `${soul}\n\n---\n\n${GUARD}\n\n---\n\n오늘은 ${today} (KST)입니다.${topicBlock}`;

// 즉석 지시는 TASK.md의 "할 일"만 대체한다. 출력 형식과 마지막 블록 규칙은
// 그대로 지켜야 저장·기억 갱신 파이프라인이 계속 돌아간다.
const instructionBlock = instruction
  ? `---\n\n# 이번 근무는 지시가 따로 있습니다\n\n` +
    `아래 지시가 위의 "할 일"보다 우선한다. 다만 **출력 형식과 마지막 블록 규칙은 그대로 지킨다.**\n` +
    `지시와 무관한 정기 업무는 이번에 하지 않는다.\n\n${instruction}`
  : "";

const prompt = [
  task,
  instructionBlock,
  inputs.length ? `---\n\n# 참고 자료 (${inputs.length}건)\n\n${inputs.join("\n\n")}` : "",
  `---\n\n# 내 기억\n\n${memory}`,
].filter(Boolean).join("\n\n");

/* ---------------- 호출 ---------------- */

function runClaude() {
  const args = [
    "-p",
    "--output-format", "json",
    "--model", agent.model,
    "--system-prompt", system,
    "--permission-mode", "dontAsk",
    "--allowedTools", ...(agent.tools ?? ["WebSearch", "WebFetch"]),
  ];
  if (agent.maxBudgetUsd) args.push("--max-budget-usd", String(agent.maxBudgetUsd));

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: ROOT, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) =>
      reject(new Error(e.code === "ENOENT"
        ? "claude 명령을 찾을 수 없습니다.  npm install -g @anthropic-ai/claude-code"
        : e.message))
    );
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude 종료 코드 ${code}\n${err.trim()}`));
      try { resolve(JSON.parse(out)); }
      catch { reject(new Error(`JSON 파싱 실패. 원본 앞부분:\n${out.slice(0, 400)}`)); }
    });
    child.stdin.end(prompt, "utf8");
  });
}

const dryResponse = () => ({
  is_error: false,
  num_turns: 0,
  result:
    `# ${today} ${agent.name} 산출물\n\n> DRY_RUN 모드 — 실제 호출 없이 배관만 확인한 결과입니다.\n\n` +
    `### 예시 항목\n\n참고 자료 ${inputs.length}건을 받았습니다. 여기까지 파일이 생겼다면 ` +
    `crew.json 읽기, brain 파일 읽기, 입력 수집, 저장 경로, 기억 갱신까지 전부 정상입니다.\n\n` +
    `${MARK_MEMORY}\n- DRY_RUN 테스트`,
  usage: {},
});

let res;
try {
  res = DRY ? dryResponse() : await runClaude();
} catch (e) {
  die(String(e.message ?? e));
}

if (res.is_error) die(`Claude가 오류로 끝났습니다: ${res.result ?? res.subtype ?? "원인 불명"}`);

const text = (res.result ?? "").trim();
if (!text) die("빈 응답을 받았습니다.");

/* ---------------- 저장 ---------------- */

const { body: raw, sections } = splitSections(text, [MARK_MEMORY, MARK_ISSUE]);
const body = stripPreamble(raw);
const note = sections[MARK_MEMORY] ?? "";
const issue = sections[MARK_ISSUE] ?? "";

if (!note) console.warn(`⚠ ${MARK_MEMORY} 블록이 없어 기억을 갱신하지 않습니다.`);

// DRY_RUN은 진짜 산출물을 덮어쓰면 안 된다. 코드 경로는 그대로 타되
// 쓰기만 .ci/dry/ 아래로 돌린다.
const dest = (rel) => (DRY ? path.join(ROOT, ".ci", "dry", rel) : path.join(ROOT, rel));

// 정기 근무가 이미 오늘 파일을 만들어놨을 수 있으므로, 이슈 근무는 꼬리를 달아
// 덮어쓰지 않는다. (build-state가 -i<번호> 꼬리를 알아본다)
const suffix = (process.env.AGENT_SUFFIX ?? "").replace(/[^A-Za-z0-9-]/g, "");
const outRel = agent.outputMode === "single"
  ? agent.outputFile
  : path.posix.join(agent.output, `${today}${suffix}.md`);
const outFile = dest(outRel);

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, body + "\n", "utf8");

if (note) {
  const memRel = path.posix.join("agents", agentId, "memory.md");
  await mkdir(path.dirname(dest(memRel)), { recursive: true });
  await writeFile(dest(memRel), mergeMemory(memory, note, today, MEMORY_KEEP), "utf8");
}

// 산출물이 어디로 갔는지 워크플로에 알려준다. outputMode에 따라 경로가
// 달라지므로 워크플로가 셸로 추측하게 두면 틀린다.
if (!DRY) {
  await mkdir(path.join(ROOT, ".ci"), { recursive: true });
  await writeFile(path.join(ROOT, ".ci", "last-output.txt"), outRel + "\n", "utf8");
}

// 이슈로 올릴 내용이 있으면 워크플로가 집어갈 수 있게 남긴다
if (issue && !DRY) {
  const p = path.join(ROOT, ".ci", "issue.md");
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, issue + "\n", "utf8");
}

console.log(`✓ ${agent.emoji} ${agent.name} 근무 완료`);
console.log(`  → ${path.relative(ROOT, outFile)} (${body.length}자)${DRY ? "  [DRY]" : ""}`);
if (instruction) console.log(`  ← 즉석 지시 ${instruction.length}자`);
if (inputs.length) console.log(`  ← 참고 자료 ${inputs.length}건`);
if (note) console.log(`  → memory.md 갱신`);
if (issue) console.log(`  → .ci/issue.md (이슈 등록 대상)`);
console.log(`  턴 ${res.num_turns ?? "?"} · ${((res.duration_ms ?? 0) / 1000).toFixed(0)}초`);
if (res.total_cost_usd != null) {
  console.log(`  환산 $${res.total_cost_usd.toFixed(4)} (구독 토큰 사용 시 실제 청구 아님)`);
}
