#!/usr/bin/env node
/**
 * crew.json의 근무표를 launchd 작업으로 옮긴다.
 *
 *   node scripts/local/install.mjs          plist를 쓰고 등록한다
 *   node scripts/local/install.mjs --print  내용만 보여준다
 *   node scripts/local/install.mjs --remove 전부 걷어낸다
 *
 * 로스터가 바뀌면 이걸 다시 돌리면 된다. 에이전트를 늘릴 때 손댈 곳은
 * crew.json 하나라는 원칙을 여기서도 지킨다.
 *
 * cron은 UTC, launchd는 이 기계의 지역 시간(KST)을 쓴다. 그 차이를 여기서 흡수한다.
 */

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
const UID = process.getuid();
const PREFIX = "com.ai_crew.";

const PRINT = process.argv.includes("--print");
const REMOVE = process.argv.includes("--remove");

/** "0 22 * * *" (UTC) → { minute, hour, weekday|null } (KST) */
function toKST(expr) {
  const p = String(expr ?? "").trim().split(/\s+/);
  if (p.length !== 5) return null;
  const [min, hr, dom, mon, dow] = p;
  // 이 저장소가 쓰는 범위만 다룬다. 그 밖이면 손대지 않고 알린다.
  if (dom !== "*" || mon !== "*") return null;
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hr)) return null;

  const hourUtc = Number(hr);
  const hourKst = (hourUtc + 9) % 24;
  const rolled = hourUtc + 9 >= 24;   // KST가 다음 날로 넘어갔는가

  let weekday = null;
  if (dow !== "*") {
    if (!/^\d+$/.test(dow)) return null;
    weekday = (Number(dow) % 7 + (rolled ? 1 : 0)) % 7;
  }
  return { minute: Number(min), hour: hourKst, weekday };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function plist({ label, args, calendar, interval, log }) {
  const when = calendar
    ? `  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>${calendar.hour}</integer>
    <key>Minute</key><integer>${calendar.minute}</integer>${
      calendar.weekday === null ? "" : `
    <key>Weekday</key><integer>${calendar.weekday}</integer>`}
  </dict>`
    : `  <key>StartInterval</key><integer>${interval}</integer>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${esc(a)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key><string>${esc(ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>${esc(os.homedir())}</string>
  </dict>
${when}
  <key>StandardOutPath</key><string>${esc(log)}</string>
  <key>StandardErrorPath</key><string>${esc(log)}</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
`;
}

const crew = JSON.parse(await readFile(path.join(ROOT, "crew.json"), "utf8"));
const LOGDIR = path.join(os.homedir(), "Library", "Logs", "ai_crew");
const jobs = [];

for (const a of crew.agents) {
  if (!a.schedule) continue;
  const cal = toKST(a.schedule);
  if (!cal) {
    console.error(`⚠ ${a.id}: "${a.schedule}" 는 launchd로 옮기지 못했습니다. 건너뜁니다.`);
    continue;
  }
  jobs.push({
    label: `${PREFIX}${a.id}`,
    args: [path.join(ROOT, "scripts/local/work.sh"), a.id],
    calendar: cal,
    log: path.join(LOGDIR, `${a.id}.launchd.log`),
    note: `${a.emoji} ${a.name}  ${a.scheduleNote ?? a.schedule}`,
  });
}

jobs.push({
  label: `${PREFIX}poll`,
  args: [path.join(ROOT, "scripts/local/poll.sh")],
  interval: 120,
  log: path.join(LOGDIR, "poll.launchd.log"),
  note: "📋 이슈 폴링  2분마다",
});

const sh = (cmd, args) => {
  try { execFileSync(cmd, args, { stdio: "pipe" }); return true; }
  catch { return false; }
};

if (REMOVE) {
  for (const j of jobs) {
    sh("launchctl", ["bootout", `gui/${UID}/${j.label}`]);
    const f = path.join(AGENTS_DIR, `${j.label}.plist`);
    if (existsSync(f)) await unlink(f);
    console.log(`✓ ${j.label} 제거`);
  }
  process.exit(0);
}

if (PRINT) {
  for (const j of jobs) {
    console.log(`\n──── ${j.label}  (${j.note}) ────`);
    console.log(plist(j));
  }
  process.exit(0);
}

await mkdir(AGENTS_DIR, { recursive: true });
await mkdir(LOGDIR, { recursive: true });

for (const j of jobs) {
  const file = path.join(AGENTS_DIR, `${j.label}.plist`);
  await writeFile(file, plist(j), "utf8");
  // 이미 등록돼 있으면 먼저 내려야 새 내용이 반영된다
  sh("launchctl", ["bootout", `gui/${UID}/${j.label}`]);
  if (!sh("launchctl", ["bootstrap", `gui/${UID}`, file])) {
    console.error(`✗ ${j.label} 등록 실패`);
    process.exit(1);
  }
  const t = j.calendar
    ? `${["일","월","화","수","목","금","토"][j.calendar.weekday] ?? "매일"} ` +
      `${String(j.calendar.hour).padStart(2,"0")}:${String(j.calendar.minute).padStart(2,"0")} KST`
    : `${j.interval}초마다`;
  console.log(`✓ ${j.note.padEnd(24)} ${t}`);
}
console.log(`\n로그: ${LOGDIR}`);
