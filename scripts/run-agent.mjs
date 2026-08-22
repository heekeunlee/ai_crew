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
 * 읽는 것 : crew.json, agents/<id>/{SOUL,TASK,memory}.md
 * 쓰는 것 : work/<id>/YYYY-MM-DD.md, agents/<id>/memory.md
 */

import { mergeMemory } from "./lib/memory.mjs";
import { stripPreamble } from "./lib/output.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEMORY_MARK = "===MEMORY===";
const MEMORY_KEEP = 30;

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

/* ---------------- 준비 ---------------- */

const agentId = process.argv[2];
if (!agentId) die("에이전트 id가 필요합니다.  예: node scripts/run-agent.mjs scout");

// DRY_RUN=1 이면 Claude를 부르지 않고 가짜 응답으로 배관만 확인한다 (사용량 0)
const DRY = process.env.DRY_RUN === "1";

// CI에서는 반드시 토큰이 있어야 한다. 로컬은 이미 로그인돼 있으면 그대로 쓴다.
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

// KST 기준 날짜 — 워크플로는 UTC로 돌지만 사람은 한국 시간으로 읽는다
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/* ---------------- Claude Code 호출 ---------------- */

// Claude Code는 코딩 에이전트라 놔두면 파일부터 읽으려 든다. 필요한 내용은
// 전부 프롬프트에 넣고, 파일 접근이 불가능하다는 걸 명시해야 헤매지 않는다.
const GUARD =
  "너는 파일 시스템에 접근할 수 없다. 필요한 정보는 전부 이 프롬프트 안에 있다.\n" +
  "결과물을 파일로 저장하려 하지 말고 응답 본문으로 출력해라. 저장은 호출한 쪽이 한다.";

const system =
  `${soul}\n\n---\n\n${GUARD}\n\n---\n\n` +
  `오늘은 ${today} (KST)입니다.\n\n` +
  `다루는 주제:\n${(agent.topics ?? []).map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

const prompt = `${task}\n\n---\n\n# 내 기억\n\n${memory}`;

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
    const child = spawn("claude", args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));

    child.on("error", (e) =>
      reject(new Error(
        e.code === "ENOENT"
          ? "claude 명령을 찾을 수 없습니다.  npm install -g @anthropic-ai/claude-code"
          : e.message
      ))
    );

    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude 종료 코드 ${code}\n${err.trim()}`));
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`JSON 파싱 실패. 원본 앞부분:\n${out.slice(0, 400)}`));
      }
    });

    // 프롬프트가 길 수 있으니 argv 대신 stdin으로 넘긴다
    child.stdin.end(prompt, "utf8");
  });
}

const dryResponse = () => ({
  is_error: false,
  num_turns: 0,
  result:
    `# ${today} 리서치\n\n> DRY_RUN 모드 — 실제 호출 없이 배관만 확인한 결과입니다.\n\n` +
    `## 1. 예시 항목\n\n이 문서는 Claude를 부르지 않고 만들어졌습니다. 여기까지 파일이 ` +
    `생겼다면 crew.json 읽기, brain 파일 읽기, 저장 경로, 기억 갱신까지 전부 정상입니다.\n\n` +
    `출처: (없음)\n\n${MEMORY_MARK}\n- DRY_RUN 테스트`,
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

const cut = text.indexOf(MEMORY_MARK);
const body = stripPreamble(cut === -1 ? text : text.slice(0, cut));
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

console.log(`✓ ${agent.emoji} ${agent.name} 근무 완료`);
console.log(`  → ${path.relative(ROOT, outFile)} (${body.length}자)`);
if (note) console.log(`  → memory.md 갱신`);
console.log(`  턴 ${res.num_turns ?? "?"} · ${((res.duration_ms ?? 0) / 1000).toFixed(0)}초`);
if (res.total_cost_usd != null) {
  console.log(`  환산 $${res.total_cost_usd.toFixed(4)} (구독 토큰 사용 시 실제 청구 아님)`);
}
