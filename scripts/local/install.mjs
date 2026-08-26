#!/usr/bin/env node
/**
 * crew.json의 근무표를 launchd 작업으로 옮긴다.
 *
 *   node scripts/local/install.mjs          plist와 설치 스크립트를 만든다
 *   node scripts/local/install.mjs --print  내용만 보여준다
 *
 * 로스터가 바뀌면 이걸 다시 돌리면 된다. 에이전트를 늘릴 때 손댈 곳은
 * crew.json 하나라는 원칙을 여기서도 지킨다.
 *
 * cron은 UTC, launchd는 이 기계의 지역 시간(KST)을 쓴다. 그 차이를 여기서 흡수한다.
 *
 * ── LaunchAgent가 아니라 LaunchDaemon인 이유 ──
 * ~/Library/LaunchAgents의 작업은 그 사용자가 **로그인할 때** 뜬다. 화면 없이
 * ssh로만 쓰는 기계에는 로그인 세션이 없어서 영영 안 뜬다. 실제로 이 기계에서
 * `launchctl bootstrap gui/501`은 "Domain does not support specified action"으로,
 * cron은 TCC 때문에 "Operation not permitted"로 막혔다.
 * /Library/LaunchDaemons는 부팅 시 로그인과 무관하게 뜬다. 대신 설치에 root가
 * 필요해서, 이 스크립트는 plist를 만들어 두고 설치 명령만 알려준다.
 *
 * 데몬은 UserName으로 그 사용자가 되어 돈다. Claude 자격증명이 키체인이 아니라
 * ~/.claude/.credentials.json 파일에 있어서 로그인 세션 없이도 읽힌다.
 */

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STAGE = path.join(ROOT, ".ci", "launchd");
const DEST = "/Library/LaunchDaemons";
const USER = os.userInfo().username;
const PREFIX = "com.ai_crew.";

const PRINT = process.argv.includes("--print");

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
  <key>UserName</key><string>${esc(USER)}</string>
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

if (PRINT) {
  for (const j of jobs) {
    console.log(`\n──── ${j.label}  (${j.note}) ────`);
    console.log(plist(j));
  }
  process.exit(0);
}

await mkdir(STAGE, { recursive: true });
await mkdir(LOGDIR, { recursive: true });

const lines = ["#!/bin/sh", "# root로 실행해야 합니다: sudo sh .ci/launchd/install.sh", "set -e"];
for (const j of jobs) {
  const staged = path.join(STAGE, `${j.label}.plist`);
  await writeFile(staged, plist(j), "utf8");
  lines.push(
    `launchctl bootout system/${j.label} 2>/dev/null || true`,
    `install -o root -g wheel -m 644 '${staged}' '${DEST}/${j.label}.plist'`,
    `launchctl bootstrap system '${DEST}/${j.label}.plist'`,
    `echo '✓ ${j.label}'`,
  );
}
lines.push("echo", "echo '등록된 작업:'", "launchctl list | grep ai_crew || true");
await writeFile(path.join(STAGE, "install.sh"), lines.join("\n") + "\n", "utf8");

const uninstall = ["#!/bin/sh", "# root로 실행해야 합니다: sudo sh .ci/launchd/uninstall.sh"];
for (const j of jobs) {
  uninstall.push(
    `launchctl bootout system/${j.label} 2>/dev/null || true`,
    `rm -f '${DEST}/${j.label}.plist'`,
    `echo '✓ ${j.label} 제거'`,
  );
}
await writeFile(path.join(STAGE, "uninstall.sh"), uninstall.join("\n") + "\n", "utf8");

for (const j of jobs) {
  const t = j.calendar
    ? `${["일","월","화","수","목","금","토"][j.calendar.weekday] ?? "매일"} ` +
      `${String(j.calendar.hour).padStart(2,"0")}:${String(j.calendar.minute).padStart(2,"0")} KST`
    : `${j.interval}초마다`;
  console.log(`  ${j.note.padEnd(24)} ${t}`);
}
console.log(`\nplist ${jobs.length}개를 ${STAGE} 에 만들었습니다.`);
console.log(`\n설치:   sudo sh ${path.join(STAGE, "install.sh")}`);
console.log(`되돌리기: sudo sh ${path.join(STAGE, "uninstall.sh")}`);
console.log(`로그:   ${LOGDIR}`);
