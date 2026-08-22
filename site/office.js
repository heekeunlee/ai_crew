/* ai_crew 2D 픽셀 오피스
 *
 * state.json 하나만 읽어서 그린다. 인원 수는 로스터에서 나오므로
 * 에이전트가 늘어도 이 파일은 손댈 일이 없다.
 *
 * 상태와 연출의 관계
 *   working  책상에 앉아 있다. 실제로 Actions가 도는 중이다.
 *   done     게시판에 결과를 붙이고, 그 뒤로는 사무실을 돌아다닌다.
 *   idle     돌아다니거나 소파에 앉거나 커피를 마신다.
 *
 * 즉 "책상에 있다 = 작업 중"이라는 규칙은 그대로다. 돌아다니는 것은
 * 일하지 않는 동안의 모습일 뿐이라 상태를 흐리지 않는다.
 *
 * 말풍선은 두 종류다.
 *   진짜 데이터  방금 낸 결과물의 총평, 다음 근무 시각, 누적 산출물 수
 *   분위기용     "☕", "…" 같은 짧은 것. 없는 사실을 지어내지 않는다.
 */

const LW = 336, LH = 214;
const DESK_W = 56, DESK_TOP = 118, MARGIN = 20;

const STATUS = {
  working: { dot: "#4ADE80", label: "작업 중" },
  done:    { dot: "#FBBF24", label: "방금 완료" },
  idle:    { dot: "#94A3B8", label: "대기" },
};

const SPRITE = [
  "............", "....HHHH....", "...HHHHHH...", "...HSSSSH...",
  "...SSSSSS...", "...SESSES...", "...SSSSSS...", "....SSSS....",
  ".....SS.....", "..CCCCCCCC..", ".CCCCCCCCCC.", ".SCCCCCCCCS.",
  ".SCCCCCCCCS.", "..CCDDDDCC..", "..PPP..PPP..", "..PPP..PPP..",
];
const LEGS_A = ["..PPP..PPP..", "..PPP..PPP.."];
const LEGS_B = ["...PPPPPP...", "..PPP...PP.."];
const SKIN = "#E8B98A", EYE = "#241812", PANTS = "#39404F";
const HAIRS = ["#2A2018", "#5A3A2A", "#4A4A52", "#201A14", "#3B2B33"];

/* ---------------- 장소 ---------------- */

// 회의 탁자 둘레의 자리. 위쪽 두 자리는 탁자보다 위에 그려진다.
const MEETING = [
  { x: 180, y: 196 }, { x: 206, y: 178 }, { x: 238, y: 178 }, { x: 264, y: 196 },
];
// 소파
const SOFA = [{ x: 22, y: 190 }, { x: 46, y: 190 }, { x: 70, y: 190 }, { x: 94, y: 190 }];
// 게시판 앞
const BOARD = [{ x: 204, y: 88 }, { x: 231, y: 88 }, { x: 258, y: 88 }, { x: 285, y: 88 }];
// 커피바 앞
const COFFEE = [{ x: 100, y: 96 }, { x: 122, y: 96 }];
// 그냥 서성일 만한 곳. 책상·가구와 겹치지 않는 자리만 골랐다.
const WANDER = [
  { x: 44, y: 82 }, { x: 150, y: 88 }, { x: 186, y: 80 }, { x: 300, y: 92 },
  { x: 40, y: 152 }, { x: 138, y: 158 }, { x: 148, y: 200 }, { x: 300, y: 198 },
  { x: 70, y: 150 }, { x: 296, y: 150 },
];

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ---------------- 말풍선 문구 ---------------- */

// 분위기용. 짧고, 사실을 주장하지 않는 것만 쓴다.
const AMBIENT = ["…", "☕", "흠", "♪"];

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v * f)))
  );
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

const clip = (s, n) => {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const cut = t.split(/[.。·,]/)[0].trim() || t;
  return cut.length > n ? cut.slice(0, n - 1) + "…" : cut;
};

/* ---------------- 캔버스 ---------------- */

const cv = document.getElementById("office");
const ctx = cv.getContext("2d");
const off = document.createElement("canvas");
off.width = LW; off.height = LH;
const oc = off.getContext("2d");
const room = document.createElement("canvas");
room.width = LW; room.height = LH;
const rc = room.getContext("2d");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let P = oc;
const px = (x, y, w, h, c) => { P.fillStyle = c; P.fillRect(x | 0, y | 0, w | 0, h | 0); };

let state = null, actors = [], selected = 0, scale = 3, t = 0, roomKey = null;
let meetingUntil = 0, nextMeetingAt = 0;

const deskX = (i, n) =>
  n <= 1 ? Math.round((LW - DESK_W) / 2)
         : Math.round(MARGIN + i * ((LW - MARGIN * 2 - DESK_W) / (n - 1)));

/* ---------------- 그리기 ---------------- */

function drawSprite(x, y, a, phase, walking) {
  const map = { H: a.hair, S: SKIN, E: EYE, C: a.color, D: shade(a.color, 0.75), P: PANTS };
  const rows = SPRITE.slice();
  if (walking) { const L = (phase | 0) % 2 ? LEGS_B : LEGS_A; rows[14] = L[0]; rows[15] = L[1]; }
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch !== ".") px(x + c, y + r, 1, 1, map[ch]);
    }
}

function drawRoom(doneCount) {
  P = rc;
  rc.clearRect(0, 0, LW, LH);
  px(0, 0, LW, 54, "#57657A");
  px(0, 0, LW, 3, "#455266");
  px(0, 50, LW, 4, "#3E4A5C");
  px(0, 54, LW, LH - 54, "#C3B69B");
  for (let x = 0; x < LW; x += 16) px(x, 54, 1, LH - 54, "#B7AA8F");
  for (let y = 54; y < LH; y += 16) px(0, y, LW, 1, "#B7AA8F");
  px(0, 54, LW, 2, "#A2957C");

  // 창문
  px(16, 12, 62, 30, "#8895A6");
  px(19, 15, 56, 24, "#86C2E0");
  px(19, 15, 56, 8, "#9FD3EC");
  px(46, 15, 2, 24, "#8895A6");
  px(19, 26, 56, 2, "#8895A6");

  // 게시판
  px(194, 10, 122, 34, "#6E5B42");
  px(197, 13, 116, 28, "#EFE9D8");
  const notes = ["#F2A65A", "#8FC7E8", "#EE8B7B", "#A8D8A0", "#D9B3E8", "#F2D06B"];
  for (let i = 0; i < Math.min(3 + doneCount, 6); i++) {
    const cx = 201 + (i % 3) * 37, cy = 17 + ((i / 3) | 0) * 12;
    px(cx, cy, 11, 9, notes[i]);
    px(cx + 2, cy + 3, 7, 1, "rgba(0,0,0,0.22)");
    px(cx + 2, cy + 5, 5, 1, "rgba(0,0,0,0.22)");
  }

  // 커피바 (윗벽 아래 빈 공간을 채운다)
  px(94, 66, 46, 16, "#8A6A4A");
  px(94, 66, 46, 4, "#A47F5C");
  px(96, 80, 42, 4, "#6A4E34");
  px(100, 58, 10, 10, "#4A4A56");   // 머신
  px(102, 60, 6, 4, "#2A2A34");
  px(103, 66, 4, 2, "#7A6A5A");
  px(118, 60, 5, 6, "#D9CFC0");     // 컵
  px(126, 61, 5, 5, "#D9CFC0");

  // 회의 탁자
  px(192, 182, 68, 18, "#6A4E34");
  px(194, 180, 64, 16, "#9A7550");
  px(194, 180, 64, 4, "#AE8A63");
  px(210, 186, 12, 5, "#EFE9D8");   // 서류
  px(228, 185, 10, 6, "#D9CFC0");

  // 화분
  px(316, 168, 14, 14, "#9A6A4A"); px(316, 168, 14, 3, "#B07E5A");
  px(320, 150, 6, 20, "#3E7A4A"); px(315, 154, 6, 5, "#4C9159");
  px(325, 158, 6, 5, "#4C9159");  px(318, 145, 9, 6, "#57A165");

  // 소파와 러그
  px(12, 168, 104, 34, "#A89478"); px(14, 170, 100, 30, "#B5A084");
  px(16, 172, 92, 18, "#7D5C7A");  px(16, 172, 92, 5, "#8E6C8B");
  px(16, 186, 92, 6, "#664A63");
  px(16, 172, 6, 18, "#664A63");   px(102, 172, 6, 18, "#664A63");
  P = oc;
}

function drawDesk(i, n, lit) {
  const x = deskX(i, n);
  px(x, DESK_TOP + 14, DESK_W, 3, "rgba(90,80,60,0.22)");
  px(x, DESK_TOP, DESK_W, 6, "#A57F57");
  px(x, DESK_TOP, DESK_W, 2, "#B9906A");
  px(x, DESK_TOP + 6, DESK_W, 9, "#7E5D3E");
  px(x + 3, DESK_TOP + 15, 4, 6, "#6A4E34");
  px(x + DESK_W - 7, DESK_TOP + 15, 4, 6, "#6A4E34");

  const mx = x + 32, my = DESK_TOP - 16;
  px(mx + 7, my + 15, 4, 3, "#4A4A56");
  px(mx, my, 18, 15, "#33333F");
  px(mx + 2, my + 2, 14, 11, lit ? "#7FD6FF" : "#22222C");
  if (lit) {
    px(mx + 3, my + 4, 9, 1, "#DFF4FF");
    px(mx + 3, my + 6, 11, 1, "#B7E8FF");
    px(mx + 3, my + 8, 6, 1, "#DFF4FF");
  }
  px(x + 5, DESK_TOP + 1, 12, 4, "#EFE9D8");
  px(x + 7, DESK_TOP, 12, 4, "#F7F3E6");
}

/* ---------------- 말풍선 ---------------- */

// 픽셀 캔버스가 아니라 표시 캔버스에 그린다. 한글이 뭉개지지 않게 하려면
// 확대된 좌표계에서 직접 텍스트를 찍어야 한다.
function drawBubble(act, S) {
  const b = act.bubble;
  if (!b || !b.text) return;
  const life = (performance.now() - b.at) / 1000;
  if (life > b.dur) { act.bubble = null; return; }

  // 반투명한 채로 떠 있으면 바닥 무늬와 섞여 읽기 어렵다. 뜨고 지는 순간만
  // 아주 짧게 흐리고, 나머지 구간은 100%로 둔다.
  const IN = 0.1, OUT = 0.18;
  const fade = life < IN ? life / IN
             : life > b.dur - OUT ? Math.max(0, (b.dur - life) / OUT)
             : 1;
  if (fade <= 0.02) return;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = `700 ${Math.round(6.6 * S)}px "Gothic A1", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const padX = 4 * S, padY = 3 * S;
  const w = ctx.measureText(b.text).width + padX * 2;
  const h = 9 * S + padY * 2;
  const headX = (act.x + 6) * S;
  const headY = (act.y - 22) * S - Math.min(4, life * 20) * S * 0.2;

  let x = headX - w / 2;
  x = Math.max(2 * S, Math.min(LW * S - w - 2 * S, x));
  const y = Math.max(2 * S, headY - h);

  ctx.fillStyle = "rgba(20,18,14,0.35)";
  ctx.fillRect(x + 2 * S, y + 2 * S, w, h);
  ctx.fillStyle = "#FFFDF6";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#3A3428";
  ctx.fillRect(x, y, w, S);
  ctx.fillRect(x, y + h - S, w, S);
  ctx.fillRect(x, y, S, h);
  ctx.fillRect(x + w - S, y, S, h);

  // 꼬리
  const tx = Math.max(x + 3 * S, Math.min(x + w - 6 * S, headX - 2 * S));
  ctx.fillStyle = "#FBF7EC";
  ctx.fillRect(tx, y + h, 4 * S, 3 * S);
  ctx.fillStyle = "#3A3428";
  ctx.fillRect(tx, y + h + 3 * S, 4 * S, S);

  ctx.fillStyle = "#221E18";
  ctx.fillText(b.text, x + padX, y + padY);
  ctx.restore();
}

const MAX_BUBBLES = 2;

function liveBubbles(now) {
  return actors.filter((a) => a.bubble && (now - a.bubble.at) / 1000 < a.bubble.dur).length;
}

function say(act, text, dur = 4.5, force = false) {
  if (!text) return;
  const now = performance.now();
  // 이미 떠 있는 게 많으면 이번엔 말하지 않는다. 넷이 동시에 말하면
  // 말풍선끼리 겹쳐서 아무것도 읽을 수 없다.
  if (!force && !act.bubble && liveBubbles(now) >= MAX_BUBBLES) return;
  act.bubble = { text, at: now, dur };
}

/* ---------------- 행동 ---------------- */

// 이 에이전트가 지금 할 말. 진짜 데이터를 우선하고, 없으면 분위기용으로 채운다.
function lineFor(act, kind) {
  const r = act.recent?.[0];
  if (kind === "meeting") {
    return clip(r?.summary, 18) || (act.scheduleNote ? act.scheduleNote : "보고할 것 없음");
  }
  if (act.st === "working") return pick(["작업 중…", "검색 중…", "정리 중…"]);
  if (act.st === "done") return clip(r?.summary, 18) || `${r?.items ?? 0}건 올렸습니다`;
  // idle
  const real = [];
  if (act.scheduleNote) real.push(`다음 ${act.scheduleNote.replace(" KST", "")}`);
  if (act.total) real.push(`누적 ${act.total}건`);
  return Math.random() < 0.55 && real.length ? pick(real) : pick(AMBIENT);
}

function goTo(act, p, speedScale = 1) {
  const d = Math.hypot(p.x - act.x, p.y - act.y);
  act.fx = act.x; act.fy = act.y;
  act.tx = p.x;   act.ty = p.y;
  if (d < 0.5) { act.moving = false; return; }
  act.t0 = performance.now();
  act.dur = Math.min(3.5, Math.max(0.5, d / (58 * speedScale)));
  act.moving = true;
}

// 다음에 뭘 할지 고른다. working은 책상을 떠나지 않는다.
function decide(act, now) {
  const free = () => actors.filter((a) => a.st !== "working").length;
  if (act.st === "working") {
    const seat = { x: deskX(act.desk, actors.length) + 14, y: 124 };
    if (Math.abs(act.x - seat.x) > 1 || Math.abs(act.y - seat.y) > 1) goTo(act, seat);
    act.nextAt = now + 5000 + Math.random() * 4000;
    if (Math.random() < 0.5) say(act, lineFor(act), 3.5);
    return;
  }

  if (now < meetingUntil) {
    const seat = MEETING[act.desk % MEETING.length];
    if (Math.hypot(act.x - seat.x, act.y - seat.y) > 2) goTo(act, seat, 1.3);
    act.nextAt = now + free() * 1200 + 2600;
    say(act, lineFor(act, "meeting"), 3.4);
    return;
  }

  // done이면 먼저 게시판에 결과를 붙이러 간다
  if (act.st === "done" && !act.posted) {
    goTo(act, BOARD[act.desk % BOARD.length]);
    act.posted = true;
    act.nextAt = now + 6000;
    say(act, lineFor(act), 5);
    return;
  }

  const roll = Math.random();
  let target;
  if (roll < 0.3) target = SOFA[act.desk % SOFA.length];
  else if (roll < 0.45) target = pick(COFFEE);
  else target = pick(WANDER);

  goTo(act, target);
  act.nextAt = now + 5000 + Math.random() * 7000;
  if (Math.random() < 0.3) say(act, lineFor(act), 4);
}

// 둘 이상이 일하지 않고 있으면 가끔 회의를 연다
function maybeMeet(now) {
  if (now < nextMeetingAt || now < meetingUntil) return;
  const free = actors.filter((a) => a.st !== "working");
  if (free.length < 2) { nextMeetingAt = now + 20000; return; }
  meetingUntil = now + 24000;
  nextMeetingAt = meetingUntil + 35000 + Math.random() * 25000;
  // 한 명씩 차례로 말하게 시차를 준다. 동시에 뜨면 말풍선끼리 겹친다.
  free.forEach((a, i) => { a.nextAt = now + i * 900; });
}

/* ---------------- 프레임 ---------------- */

function render() {
  if (!actors.length) return;
  const n = actors.length;
  let done = 0;
  for (const a of actors) if (a.st === "done") done++;
  if (done !== roomKey) { drawRoom(done); roomKey = done; }

  P = oc;
  oc.clearRect(0, 0, LW, LH);
  oc.drawImage(room, 0, 0);

  const order = actors.slice().sort((p, q) => p.y - q.y);

  for (const act of order) {
    const bob = act.st === "working" && !reduced && ((t / 26) | 0) % 2 ? 1 : 0;
    const sy = (act.y | 0) - 16 + bob, sx = act.x | 0;
    px(sx + 2, act.y - 1, 8, 2, "rgba(70,60,45,0.28)");
    drawSprite(sx, sy, act, t / 9, act.moving && !reduced);

    oc.globalAlpha = act.st === "working" && !reduced ? (((t / 30) | 0) % 2 ? 1 : 0.45) : 1;
    px(sx + 4, sy - 6, 4, 4, STATUS[act.st].dot);
    oc.globalAlpha = 1;

    if (act === actors[selected]) {
      px(sx - 3, sy - 10, 18, 1, "#FFFFFF");
      px(sx - 3, act.y + 2, 18, 1, "#FFFFFF");
      px(sx - 3, sy - 10, 1, act.y - sy + 12, "#FFFFFF");
      px(sx + 14, sy - 10, 1, act.y - sy + 12, "#FFFFFF");
    }
    if (act.st === "working" && !reduced)
      for (let i = 0, k = ((t / 22) | 0) % 3; i <= k; i++)
        px(sx + 15 + i * 3, sy - 4, 2, 2, "#FFFFFF");
  }

  for (let i = 0; i < n; i++) {
    const at = actors.find((a) => a.desk === i);
    drawDesk(i, n, !!(at && at.st === "working" && Math.abs(at.x - (deskX(i, n) + 14)) < 3));
  }

  const S = scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, LW * S, LH * S);
  ctx.drawImage(off, 0, 0, LW * S, LH * S);

  // 책상 이름표는 자리에 붙어 있는 표시라 캐릭터가 떠나도 그대로 둔다
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < n; i++) {
    const act = actors.find((a) => a.desk === i);
    if (!act) continue;
    const cx = (deskX(i, n) + DESK_W / 2) * S;
    ctx.font = `800 ${Math.round(7.2 * S)}px "Gothic A1", sans-serif`;
    ctx.fillStyle = "#2E2A22";
    ctx.fillText(act.name, cx, (DESK_TOP + 24) * S);
    ctx.font = `500 ${Math.round(6.2 * S)}px "Gothic A1", sans-serif`;
    ctx.fillStyle = "#5E564A";
    ctx.fillText(STATUS[act.st].label, cx, (DESK_TOP + 34) * S);
  }
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(6.2 * S)}px "Gothic A1", sans-serif`;
  ctx.fillStyle = "#E4DCC8";
  ctx.fillText("결과물 게시판", 195 * S, 45.6 * S);
  ctx.fillStyle = "#7A705E";
  ctx.fillText("대기 구역", 14 * S, 204 * S);
  ctx.fillText("회의 탁자", 194 * S, 202 * S);

  for (const act of order) drawBubble(act, S);
}

/* ---------------- 이동 ---------------- */

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
let lastFrame = performance.now();

// 프레임 수가 아니라 실제 경과 시간으로 움직인다. 탭이 백그라운드에 있어
// rAF가 throttle돼도 걸음이 중간에 멈추지 않는다.
function tick(now) {
  t += Math.min(0.1, (now - lastFrame) / 1000) * 60;
  lastFrame = now;

  if (!reduced) {
    maybeMeet(now);
    for (const act of actors) {
      if (act.moving) {
        const p = act.dur > 0 ? Math.min(1, (now - act.t0) / (act.dur * 1000)) : 1;
        const e = ease(p);
        act.x = act.fx + (act.tx - act.fx) * e;
        act.y = act.fy + (act.ty - act.fy) * e;
        if (p >= 1) { act.x = act.tx; act.y = act.ty; act.moving = false; }
      } else if (now >= act.nextAt) {
        decide(act, now);
      }
    }
  }

  render();
  requestAnimationFrame(tick);
}

/* ---------------- 패널 ---------------- */

const $ = (id) => document.getElementById(id);

function paintPanel() {
  const act = actors[selected];
  if (!act) return;
  const s = STATUS[act.st];
  $("p-emoji").textContent = act.emoji;
  $("p-name").textContent = act.name;
  $("p-id").textContent = act.id;
  $("p-dot").style.background = s.dot;
  $("p-status").textContent = act.scheduleNote ? `${s.label} · ${act.scheduleNote}` : s.label;
  $("p-total").textContent = act.total ? `누적 ${act.total}건` : "";

  const list = $("p-work");
  list.textContent = "";
  if (!act.recent.length) {
    const e = document.createElement("p");
    e.className = "empty";
    e.textContent = "아직 산출물이 없습니다.";
    list.append(e);
    return;
  }
  for (const w of act.recent) {
    const row = document.createElement("a");
    row.className = "work";
    row.href = w.url;
    row.target = "_blank";
    row.rel = "noopener";
    const d = document.createElement("span");
    d.className = "d";
    d.textContent = w.issue ? `#${w.issue}` : w.date.slice(5);
    const b = document.createElement("span");
    b.className = "t";
    b.textContent = w.summary || `${w.items}건`;
    const nn = document.createElement("span");
    nn.className = "n";
    nn.textContent = w.items ? `${w.items}건` : "";
    row.append(d, b, nn);
    list.append(row);
  }
}

/* ---------------- 상태 적용 ---------------- */

function homeOf(i, n, st) {
  if (st === "working") return { x: deskX(i, n) + 14, y: 124 };
  if (st === "done") return BOARD[i % BOARD.length];
  return SOFA[i % SOFA.length];
}

function applyState(s, first) {
  const n = s.agents.length;
  const now = performance.now();
  actors = s.agents.map((a, i) => {
    const prev = actors.find((x) => x.id === a.id);
    const home = homeOf(i, n, a.status);
    const base = {
      ...a, hair: HAIRS[i % HAIRS.length], st: a.status, desk: i,
      x: home.x, y: home.y, fx: home.x, fy: home.y, tx: home.x, ty: home.y,
      t0: now, dur: 0, moving: false, bubble: null,
      nextAt: now + 600 + i * 700,
      posted: a.status !== "done",
    };
    if (prev) {
      // 이미 화면에 있던 캐릭터는 있던 자리에서 이어간다
      Object.assign(base, {
        x: prev.x, y: prev.y, fx: prev.x, fy: prev.y, tx: prev.x, ty: prev.y,
        bubble: prev.bubble,
        posted: a.status === "done" ? (prev.st === "done" ? prev.posted : false) : true,
        nextAt: prev.st === a.status ? prev.nextAt : now + 300,
      });
    }
    return base;
  });
  roomKey = null;
  if (selected >= actors.length) selected = 0;
  if (reduced || first) for (const a of actors) { const h = homeOf(a.desk, n, a.st); a.x = h.x; a.y = h.y; a.tx = h.x; a.ty = h.y; a.moving = false; }
  paintPanel();
}

/* ---------------- 입력 ---------------- */

cv.addEventListener("click", (e) => {
  const r = cv.getBoundingClientRect();
  const lx = ((e.clientX - r.left) / r.width) * LW;
  const ly = ((e.clientY - r.top) / r.height) * LH;
  let best = -1, bd = 16;
  actors.forEach((a, i) => {
    const d = Math.hypot(lx - (a.x + 6), ly - (a.y - 8));
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0) {
    selected = best;
    paintPanel();
    say(actors[best], lineFor(actors[best]), 4, true);
  }
});

cv.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  selected = (selected + (e.key === "ArrowRight" ? 1 : actors.length - 1)) % actors.length;
  paintPanel();
});

// 배경 탭에서는 rAF가 아예 멈춘다. 돌아왔을 때 그동안 밀린 nextAt이
// 한꺼번에 터져 넷이 동시에 움직이는 걸 막는다.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const now = performance.now();
  lastFrame = now;
  actors.forEach((a, i) => {
    a.bubble = null;
    if (a.moving) { a.x = a.tx; a.y = a.ty; a.moving = false; }
    if (now >= a.nextAt) a.nextAt = now + 400 + i * 900;
  });
  // 자리를 비운 사이 근무가 시작됐을 수 있다
  load(false).catch(() => {});
});

function resize() {
  const w = cv.parentElement.clientWidth - 20;
  scale = Math.max(1, Math.min(4, w / LW));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(LW * scale * dpr);
  cv.height = Math.round(LH * scale * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
new ResizeObserver(resize).observe(cv.parentElement);

/* ---------------- 시작 ---------------- */

const rel = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m)) return "";
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
};

async function load(first) {
  const res = await fetch(`state.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`state.json ${res.status}`);
  state = await res.json();
  document.title = `${state.officeTitle} — AI 오피스`;
  $("title").textContent = state.officeTitle;
  $("count").textContent = `${state.agents.length} agents`;
  $("updated").textContent = `갱신 ${rel(state.generatedAt)}`;
  if (state.repo) { $("repo").href = `https://github.com/${state.repo}`; $("repo").hidden = false; }
  applyState(state, first);
  resize();
}

load(true)
  .then(() => {
    if (document.fonts?.ready) document.fonts.ready.then(render);
    requestAnimationFrame(tick);
    setInterval(() => load(false).catch(() => {}), 60_000);
  })
  .catch((err) => {
    $("error").hidden = false;
    $("error").textContent = `상태를 읽지 못했습니다 — ${err.message}`;
  });
