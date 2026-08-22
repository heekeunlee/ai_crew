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
 * "책상에 있다 = 작업 중"이라는 규칙은 그대로다. 돌아다니는 것은
 * 일하지 않는 동안의 모습일 뿐이라 상태를 흐리지 않는다.
 *
 * 창밖 하늘과 벽시계는 실제 한국 시각을 따른다. 밤에 보면 밤이다.
 *
 * 말풍선은 두 종류다.
 *   진짜 데이터  결과물 총평, 다음 근무까지 남은 시간, 대기 중인 지시
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
const FACE_SIDE = "....SEES....";   // 걸을 때는 옆얼굴
const SKIN = "#E8B98A", EYE = "#241812", PANTS = "#39404F";
const HAIRS = ["#2A2018", "#5A3A2A", "#4A4A52", "#201A14", "#3B2B33"];

/* ---------------- 장소 ---------------- */

const MEETING = [
  { x: 180, y: 196 }, { x: 206, y: 178 }, { x: 238, y: 178 }, { x: 264, y: 196 },
];
const SOFA = [{ x: 22, y: 190 }, { x: 46, y: 190 }, { x: 70, y: 190 }, { x: 94, y: 190 }];
const BOARD = [{ x: 204, y: 88 }, { x: 231, y: 88 }, { x: 258, y: 88 }, { x: 285, y: 88 }];
// 탕비실 안, 카운터 앞에 서는 자리
const PANTRY = [{ x: 18, y: 98 }, { x: 44, y: 98 }, { x: 70, y: 98 }, { x: 96, y: 98 }];
// 탕비실(x<150, y<104)과 가구를 피한 자리만 골랐다
const WANDER = [
  { x: 170, y: 84 }, { x: 196, y: 78 }, { x: 300, y: 92 }, { x: 250, y: 96 },
  { x: 40, y: 152 }, { x: 138, y: 158 }, { x: 148, y: 200 }, { x: 300, y: 198 },
  { x: 70, y: 150 }, { x: 296, y: 150 },
];

// 클릭에 반응하는 소품. 반응이 있으면 화면을 한 번 더 들여다보게 된다.
const PROPS = {
  coffee: { x: 8, y: 52, w: 140, h: 52 },   // 탕비실 전체가 클릭 대상
  plant:  { x: 310, y: 138, w: 26, h: 46 },
  clock:  { x: 146, y: 12, w: 30, h: 30 },
};

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const AMBIENT = ["…", "☕", "흠", "♪"];

/* ---------------- 시간 ---------------- */

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const kstHour = () => { const n = kstNow(); return n.getUTCHours() + n.getUTCMinutes() / 60; };

// 창밖 하늘은 실제 한국 시각을 따른다
function skyOf(h) {
  if (h >= 5 && h < 7)   return { a: "#F2A97E", b: "#F6D6A8", sun: "#FFE9B0", sunY: 32, stars: 0, tint: null };
  if (h >= 7 && h < 17)  return { a: "#7FB8DC", b: "#B9DCEF", sun: "#FFF3C4", sunY: 19, stars: 0, tint: null };
  if (h >= 17 && h < 19) return { a: "#E08A5C", b: "#F3C08A", sun: "#FFD07A", sunY: 33, stars: 0, tint: "rgba(120,70,30,0.10)" };
  if (h >= 19 && h < 21) return { a: "#3E4A78", b: "#7A6A9A", sun: null, sunY: 0, stars: 4, tint: "rgba(30,40,80,0.20)" };
  return { a: "#1B2440", b: "#2E3A5C", sun: "#E8E8D8", sunY: 20, stars: 9, tint: "rgba(20,30,70,0.30)" };
}
const isNight = (h) => h >= 19 || h < 6;

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

function untilText(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}분 뒤`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 뒤`;
  return `${Math.round(h / 24)}일 뒤`;
}

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

let state = null, actors = [], selected = 0, scale = 3, t = 0, roomKey = "";
let meetingUntil = 0, nextMeetingAt = 0, coffeeUntil = 0;
let partyUntil = 0, confetti = [];

// 화분은 클릭할수록 자란다. 이 브라우저에만 남는다.
let plantLevel = 0;
try { plantLevel = Math.min(3, Number(localStorage.getItem("crew.plant") || 0)); } catch { /* 저장 불가여도 그만 */ }

const deskX = (i, n) =>
  n <= 1 ? Math.round((LW - DESK_W) / 2)
         : Math.round(MARGIN + i * ((LW - MARGIN * 2 - DESK_W) / (n - 1)));

/* ---------------- 캐릭터 ---------------- */

// 셔츠 색만으로는 픽셀 크기에서 구분이 어렵다. 머리에 다른 것을 하나씩 씌워
// 멀리서도 누가 누군지 알아보게 한다. 로스터 순서를 따르므로 인원이 늘면
// 다시 처음부터 돈다.
function drawHeadgear(x, y, i, color, face) {
  const at = (c, r, w, h, col) => px(x + (face < 0 ? 11 - c - (w - 1) : c), y + r, w, h, col);
  switch (i % 4) {
    case 0: // 캡 모자 — 챙이 보는 쪽으로
      at(3, 1, 6, 2, color);
      at(2, 2, 8, 1, color);
      at(8, 3, 4, 1, shade(color, 0.75));
      break;
    case 1: // 뒤로 묶은 머리
      at(3, 1, 6, 2, "#5A3A2A");
      at(9, 3, 2, 4, "#5A3A2A");
      at(9, 7, 2, 2, shade("#5A3A2A", 0.8));
      break;
    case 2: // 안경
      at(3, 5, 3, 2, "#2A2A34");
      at(7, 5, 3, 2, "#2A2A34");
      at(6, 5, 1, 1, "#2A2A34");
      break;
    case 3: // 헤드셋
      at(3, 0, 6, 1, "#2E2E38");
      at(2, 1, 1, 3, "#2E2E38");
      at(9, 1, 1, 3, "#2E2E38");
      at(1, 3, 2, 3, color);
      at(9, 3, 2, 3, color);
      break;
  }
}

function drawSprite(x, y, a, phase, walking, face) {
  const map = { H: a.hair, S: SKIN, E: EYE, C: a.color, D: shade(a.color, 0.75), P: PANTS };
  const rows = SPRITE.slice();
  if (walking) {
    const L = (phase | 0) % 2 ? LEGS_B : LEGS_A;
    rows[14] = L[0]; rows[15] = L[1];
    rows[5] = FACE_SIDE;
  }
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      px(x + (face < 0 ? 11 - c : c), y + r, 1, 1, map[ch]);
    }
  drawHeadgear(x, y, a.desk, a.color, face);
}

/* ---------------- 방 ---------------- */

function drawRoom(key) {
  P = rc;
  rc.clearRect(0, 0, LW, LH);
  const h = kstHour();
  const sky = skyOf(h);
  const night = isNight(h);

  px(0, 0, LW, 54, night ? "#3D4657" : "#57657A");
  px(0, 0, LW, 3, night ? "#2E3644" : "#455266");
  px(0, 50, LW, 4, night ? "#2A323F" : "#3E4A5C");
  px(0, 54, LW, LH - 54, night ? "#A99D85" : "#C3B69B");
  for (let x = 0; x < LW; x += 16) px(x, 54, 1, LH - 54, night ? "#9E9279" : "#B7AA8F");
  for (let y = 54; y < LH; y += 16) px(0, y, LW, 1, night ? "#9E9279" : "#B7AA8F");
  px(0, 54, LW, 2, night ? "#8C8069" : "#A2957C");

  // 창문
  px(16, 12, 62, 30, night ? "#6E7A8C" : "#8895A6");
  px(19, 15, 56, 12, sky.a);
  px(19, 27, 56, 12, sky.b);
  for (let i = 0; i < sky.stars; i++) px(21 + ((i * 37) % 52), 16 + ((i * 23) % 9), 1, 1, "#FFF6D8");
  if (sky.sun) px(58, sky.sunY, 7, 7, sky.sun);
  px(46, 15, 2, 24, night ? "#6E7A8C" : "#8895A6");
  px(19, 26, 56, 2, night ? "#6E7A8C" : "#8895A6");

  // 벽 포스터
  px(92, 14, 38, 26, "#5A4A6E");
  px(94, 16, 34, 22, "#EFE9D8");
  px(98, 20, 26, 3, "#5A4A6E");
  px(98, 26, 18, 2, "#9A8CB0");
  px(98, 30, 22, 2, "#9A8CB0");
  px(98, 34, 12, 2, "#C86A4A");

  // 벽시계 — 실제 한국 시각을 가리킨다
  px(148, 14, 26, 26, "#4A4438");
  px(150, 16, 22, 22, "#F4EEDC");
  const cx = 161, cy = 27;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    px(cx + Math.round(Math.cos(ang) * 9), cy + Math.round(Math.sin(ang) * 9), 1, 1, "#8A8272");
  }
  const now = kstNow();
  const hAng = ((now.getUTCHours() % 12) / 12 + now.getUTCMinutes() / 720) * Math.PI * 2 - Math.PI / 2;
  const mAng = (now.getUTCMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
  for (let r = 1; r <= 5; r++) px(cx + Math.round(Math.cos(hAng) * r), cy + Math.round(Math.sin(hAng) * r), 1, 1, "#3A3428");
  for (let r = 1; r <= 8; r++) px(cx + Math.round(Math.cos(mAng) * r), cy + Math.round(Math.sin(mAng) * r), 1, 1, "#5A5344");
  px(cx, cy, 1, 1, "#C0392B");

  // 게시판
  px(194, 10, 122, 34, "#6E5B42");
  px(197, 13, 116, 28, "#EFE9D8");
  const notes = ["#F2A65A", "#8FC7E8", "#EE8B7B", "#A8D8A0", "#D9B3E8", "#F2D06B"];
  for (let i = 0; i < Math.min(3 + key.done, 6); i++) {
    const nx = 201 + (i % 3) * 37, ny = 17 + ((i / 3) | 0) * 12;
    px(nx, ny, 11, 9, notes[i]);
    px(nx + 2, ny + 3, 7, 1, "rgba(0,0,0,0.22)");
    px(nx + 2, ny + 5, 5, 1, "rgba(0,0,0,0.22)");
  }
  // 대기 중인 지시는 빨간 핀으로
  for (let i = 0; i < Math.min(key.queued, 4); i++) px(301, 17 + i * 6, 4, 4, "#D9483B");

  // ── 탕비실 ──────────────────────────────────
  // 바닥을 타일로 갈아 사무실과 구분한다
  px(8, 56, 140, 44, night ? "#B2B0A6" : "#CFCCC0");
  for (let x = 8; x < 148; x += 12) px(x, 56, 1, 44, night ? "#A5A399" : "#C2BFB2");
  for (let y = 56; y < 100; y += 12) px(8, y, 140, 1, night ? "#A5A399" : "#C2BFB2");
  // 오른쪽 칸막이
  px(146, 54, 4, 46, "#8A8578");
  px(146, 54, 4, 3, "#A39D8E");
  px(144, 96, 8, 4, "#6E6A5E");

  // 상부장
  px(12, 56, 74, 9, "#7E6A52");
  px(12, 63, 74, 2, "#5E4E3C");
  px(28, 58, 1, 5, "#5E4E3C"); px(52, 58, 1, 5, "#5E4E3C");

  // 카운터
  px(12, 70, 92, 8, "#B9B3A4");
  px(12, 70, 92, 2, "#D2CDBE");
  px(12, 78, 92, 10, "#8A8378");
  px(12, 86, 92, 2, "#6E6A5E");

  // 커피 머신
  px(16, 60, 12, 12, "#3E3E4A");
  px(18, 62, 8, 5, "#22222C");
  px(19, 68, 6, 2, "#7A6A5A");
  px(20, 70, 4, 2, "#5A4A3A");
  // 주전자
  px(34, 62, 9, 10, "#C9C4B8");
  px(43, 65, 3, 3, "#9A958A");
  px(36, 60, 5, 2, "#9A958A");
  // 컵 세 개
  px(52, 66, 5, 6, "#EFE9D8"); px(60, 67, 5, 5, "#E8CFC0"); px(68, 66, 5, 6, "#D8E4EF");
  // 싱크
  px(80, 71, 20, 6, "#9AA0A6");
  px(82, 72, 16, 4, "#7A8087");
  px(88, 64, 2, 8, "#B5BAC0");
  px(88, 63, 6, 2, "#B5BAC0");

  // 냉장고
  px(112, 56, 26, 40, "#DCDCD4");
  px(112, 56, 26, 3, "#EFEFE8");
  px(112, 74, 26, 2, "#B8B8B0");
  px(134, 66, 2, 6, "#8A8A82");
  px(134, 80, 2, 6, "#8A8A82");
  px(116, 60, 6, 5, "#E86A8A");

  // 스툴 둘
  px(30, 88, 10, 3, "#7D5C7A"); px(33, 91, 4, 6, "#5E4A5C");
  px(56, 88, 10, 3, "#7D5C7A"); px(59, 91, 4, 6, "#5E4A5C");

  // 회의 탁자
  px(192, 182, 68, 18, "#6A4E34");
  px(194, 180, 64, 16, "#9A7550");
  px(194, 180, 64, 4, "#AE8A63");
  px(210, 186, 12, 5, "#EFE9D8");
  px(228, 185, 10, 6, "#D9CFC0");

  // 화분 — 클릭하면 자란다
  const g = key.plant;
  px(316, 168, 14, 14, "#9A6A4A"); px(316, 168, 14, 3, "#B07E5A");
  px(320, 150 - g * 6, 6, 20 + g * 6, "#3E7A4A");
  px(315, 154 - g * 4, 6, 5, "#4C9159");
  px(325, 158 - g * 4, 6, 5, "#4C9159");
  px(318, 145 - g * 6, 9, 6, "#57A165");
  if (g >= 2) { px(311, 148 - g * 3, 6, 5, "#4C9159"); px(328, 151 - g * 3, 6, 5, "#4C9159"); }
  if (g >= 3) { px(321, 137 - g * 6, 4, 4, "#E86A8A"); px(315, 140 - g * 6, 3, 3, "#E86A8A"); }

  // 소파와 러그
  px(12, 168, 104, 34, "#A89478"); px(14, 170, 100, 30, "#B5A084");
  px(16, 172, 92, 18, "#7D5C7A");  px(16, 172, 92, 5, "#8E6C8B");
  px(16, 186, 92, 6, "#664A63");
  px(16, 172, 6, 18, "#664A63");   px(102, 172, 6, 18, "#664A63");

  // 밤에는 전체를 눌러 어둡게. 대신 조명이 도드라진다.
  if (sky.tint) { rc.fillStyle = sky.tint; rc.fillRect(0, 54, LW, LH - 54); }
  if (night) {
    px(74, 56, 8, 3, "#FFE9A8");          // 탕비실 등
    rc.globalAlpha = 0.14;
    rc.fillStyle = "#FFD98A";
    rc.fillRect(10, 58, 136, 40);
    rc.globalAlpha = 1;
  }
  P = oc;
}

function drawDesk(i, n, lit, night) {
  const x = deskX(i, n);
  px(x, DESK_TOP + 14, DESK_W, 3, "rgba(90,80,60,0.22)");
  px(x, DESK_TOP, DESK_W, 6, "#A57F57");
  px(x, DESK_TOP, DESK_W, 2, "#B9906A");
  px(x, DESK_TOP + 6, DESK_W, 9, "#7E5D3E");
  px(x + 3, DESK_TOP + 15, 4, 6, "#6A4E34");
  px(x + DESK_W - 7, DESK_TOP + 15, 4, 6, "#6A4E34");

  const mx = x + 32, my = DESK_TOP - 16;
  if (lit) {
    // 켜진 모니터가 책상에 빛을 흘린다
    oc.globalAlpha = 0.22;
    px(mx - 4, DESK_TOP - 1, 26, 5, "#7FD6FF");
    oc.globalAlpha = 1;
  } else if (night) {
    // 밤에 빈 자리엔 스탠드만 작게 켜둔다
    px(x + 6, DESK_TOP - 6, 3, 6, "#6A5A44");
    px(x + 4, DESK_TOP - 9, 7, 3, "#C9A659");
    oc.globalAlpha = 0.18;
    px(x + 1, DESK_TOP - 2, 14, 4, "#FFD98A");
    oc.globalAlpha = 1;
  }
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

/* ---------------- 분위기 ---------------- */

function drawSteam() {
  if (reduced) return;
  for (let i = 0; i < 3; i++) {
    const ph = (t / 14 + i * 7) % 20;
    const sy = 60 - ph;
    if (sy < 44) continue;
    oc.globalAlpha = Math.max(0, 0.5 - ph / 44);
    px(20 + Math.round(Math.sin((ph + i * 3) / 3) * 2), sy, 2, 2, "#FFFFFF");
    oc.globalAlpha = 1;
  }
}

function drawParty(now) {
  if (now >= partyUntil) return;
  const hues = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#B983FF"];
  oc.globalAlpha = 0.22;
  for (let y = 54; y < LH; y += 16)
    for (let x = 0; x < LW; x += 16)
      px(x, y, 16, 16, hues[(((x / 16) | 0) + ((y / 16) | 0) + ((t / 8) | 0)) % hues.length]);
  oc.globalAlpha = 1;
  for (const c of confetti) px(c.x, c.y, 2, 3, c.c);
}

/* ---------------- 말풍선 ---------------- */

function drawBubble(act, S) {
  const b = act.bubble;
  if (!b || !b.text) return;
  const life = (performance.now() - b.at) / 1000;
  if (life > b.dur) { act.bubble = null; return; }

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

  const x = Math.max(2 * S, Math.min(LW * S - w - 2 * S, headX - w / 2));
  const y = Math.max(2 * S, headY - h);

  ctx.fillStyle = "rgba(20,18,14,0.35)";
  ctx.fillRect(x + 2 * S, y + 2 * S, w, h);
  ctx.fillStyle = "#FFFDF6";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#3A3428";
  ctx.fillRect(x, y, w, S); ctx.fillRect(x, y + h - S, w, S);
  ctx.fillRect(x, y, S, h); ctx.fillRect(x + w - S, y, S, h);

  const tx = Math.max(x + 3 * S, Math.min(x + w - 6 * S, headX - 2 * S));
  ctx.fillStyle = "#FFFDF6";
  ctx.fillRect(tx, y + h, 4 * S, 3 * S);
  ctx.fillStyle = "#3A3428";
  ctx.fillRect(tx, y + h + 3 * S, 4 * S, S);

  ctx.fillStyle = "#221E18";
  ctx.fillText(b.text, x + padX, y + padY);
  ctx.restore();
}

const MAX_BUBBLES = 2;
const liveBubbles = (now) =>
  actors.filter((a) => a.bubble && (now - a.bubble.at) / 1000 < a.bubble.dur).length;

function say(act, text, dur = 4.5, force = false) {
  if (!text) return;
  const now = performance.now();
  if (!force && !act.bubble && liveBubbles(now) >= MAX_BUBBLES) return;
  act.bubble = { text, at: now, dur };
}

/* ---------------- 행동 ---------------- */

function lineFor(act, kind) {
  const r = act.recent?.[0];
  if (kind === "party") return pick(["🎉", "와", "♪♪", "신난다"]);
  if (kind === "coffee") return pick(["☕", "한 잔", "잠깐 쉽시다"]);
  if (kind === "meeting") return clip(r?.summary, 18) || act.scheduleNote || "보고할 것 없음";
  if (act.st === "working") return pick(["작업 중…", "검색 중…", "정리 중…"]);
  if (act.st === "done") return clip(r?.summary, 18) || `${r?.items ?? 0}건 올렸습니다`;

  const real = [];
  if (act.queued?.length) real.push(`#${act.queued[0].number} 대기 중`);
  const u = untilText(act.nextRunAt);
  if (u) real.push(`다음 근무 ${u}`);
  if (act.total) real.push(`누적 ${act.total}건`);
  return Math.random() < 0.6 && real.length ? pick(real) : pick(AMBIENT);
}

function goTo(act, p, speedScale = 1) {
  const d = Math.hypot(p.x - act.x, p.y - act.y);
  act.fx = act.x; act.fy = act.y;
  act.tx = p.x;   act.ty = p.y;
  if (Math.abs(p.x - act.x) > 2) act.face = p.x > act.x ? 1 : -1;
  if (d < 0.5) { act.moving = false; return; }
  act.t0 = performance.now();
  act.dur = Math.min(3.5, Math.max(0.5, d / (58 * speedScale)));
  act.moving = true;
}

function decide(act, now) {
  const freeCount = actors.filter((a) => a.st !== "working").length;

  if (now < partyUntil) {
    goTo(act, pick(WANDER), 1.8);
    act.nextAt = now + 1400 + Math.random() * 1200;
    if (Math.random() < 0.6) say(act, lineFor(act, "party"), 2);
    return;
  }

  if (act.st === "working") {
    const seat = { x: deskX(act.desk, actors.length) + 14, y: 124 };
    if (Math.abs(act.x - seat.x) > 1 || Math.abs(act.y - seat.y) > 1) goTo(act, seat);
    act.face = 1;
    act.nextAt = now + 5000 + Math.random() * 4000;
    if (Math.random() < 0.5) say(act, lineFor(act), 3.5);
    return;
  }

  if (now < coffeeUntil) {
    goTo(act, PANTRY[act.desk % PANTRY.length]);
    act.nextAt = now + 3000 + Math.random() * 2000;
    if (Math.random() < 0.5) say(act, lineFor(act, "coffee"), 3);
    return;
  }

  if (now < meetingUntil) {
    const seat = MEETING[act.desk % MEETING.length];
    if (Math.hypot(act.x - seat.x, act.y - seat.y) > 2) goTo(act, seat, 1.3);
    act.nextAt = now + freeCount * 1200 + 2600;
    say(act, lineFor(act, "meeting"), 3.4);
    return;
  }

  if (act.st === "done" && !act.posted) {
    goTo(act, BOARD[act.desk % BOARD.length]);
    act.posted = true;
    act.nextAt = now + 6000;
    say(act, lineFor(act), 5);
    return;
  }

  const roll = Math.random();
  const target = roll < 0.3 ? SOFA[act.desk % SOFA.length]
               : roll < 0.45 ? pick(PANTRY)
               : pick(WANDER);
  goTo(act, target);
  act.nextAt = now + 5000 + Math.random() * 7000;
  if (Math.random() < 0.3) say(act, lineFor(act), 4);
}

function maybeMeet(now) {
  if (now < nextMeetingAt || now < meetingUntil || now < coffeeUntil || now < partyUntil) return;
  const free = actors.filter((a) => a.st !== "working");
  if (free.length < 2) { nextMeetingAt = now + 20000; return; }
  meetingUntil = now + 24000;
  nextMeetingAt = meetingUntil + 35000 + Math.random() * 25000;
  free.forEach((a, i) => { a.nextAt = now + i * 900; });
}

/* ---------------- 프레임 ---------------- */

function render() {
  if (!actors.length) return;
  const n = actors.length;
  const now = performance.now();
  const night = isNight(kstHour());

  let done = 0;
  for (const a of actors) if (a.st === "done") done++;
  // 방은 자주 바뀌지 않는다. 바뀔 이유가 생겼을 때만 다시 그린다.
  const key = { done, plant: plantLevel, queued: state?.queued ?? 0 };
  const ks = `${done}|${plantLevel}|${key.queued}|${Math.floor(kstHour() * 60)}`;
  if (ks !== roomKey) { drawRoom(key); roomKey = ks; }

  P = oc;
  oc.clearRect(0, 0, LW, LH);
  oc.drawImage(room, 0, 0);
  drawSteam();
  drawParty(now);

  const order = actors.slice().sort((p, q) => p.y - q.y);
  const party = now < partyUntil && !reduced;

  for (const act of order) {
    const jump = party ? Math.round(Math.abs(Math.sin((t + act.desk * 20) / 7)) * 4) : 0;
    const bob = act.st === "working" && !reduced && ((t / 26) | 0) % 2 ? 1 : 0;
    const sy = (act.y | 0) - 16 + bob - jump, sx = act.x | 0;
    px(sx + 2, act.y - 1, 8, 2, "rgba(70,60,45,0.28)");
    drawSprite(sx, sy, act, t / 9, act.moving && !reduced, act.face);

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
    drawDesk(i, n, !!(at && at.st === "working" && Math.abs(at.x - (deskX(i, n) + 14)) < 3), night);
  }

  const S = scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, LW * S, LH * S);
  ctx.drawImage(off, 0, 0, LW * S, LH * S);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // 책상에는 이름만 흐리게 남긴다. 자리 주인이 누구인지 알려주는 명패일 뿐,
  // 지금 거기 있다는 뜻이 아니다.
  for (let i = 0; i < n; i++) {
    const act = actors.find((a) => a.desk === i);
    if (!act) continue;
    ctx.font = `700 ${Math.round(6.4 * S)}px "Gothic A1", sans-serif`;
    ctx.fillStyle = night ? "rgba(60,54,42,0.55)" : "rgba(70,64,52,0.45)";
    ctx.fillText(act.name, (deskX(i, n) + DESK_W / 2) * S, (DESK_TOP + 24) * S);
  }

  // 진짜 이름표는 캐릭터를 따라다닌다. 돌아다니는 동안에도 누가 누구인지
  // 알 수 있어야 하므로 항상 켜 둔다.
  for (const act of order) {
    const label = act.name;
    ctx.font = `800 ${Math.round(6.4 * S)}px "Gothic A1", sans-serif`;
    const tw = ctx.measureText(label).width;
    const bw = tw + 5 * S, bh = 9.5 * S;
    const bx = Math.max(1 * S, Math.min(LW * S - bw - 1 * S, (act.x + 6) * S - bw / 2));
    const by = (act.y + 2) * S;
    ctx.fillStyle = "rgba(24,20,16,0.78)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = act.color;
    ctx.fillRect(bx, by, bw, 1.4 * S);
    ctx.fillStyle = "#F6F2E6";
    ctx.fillText(label, bx + bw / 2, by + 1.8 * S);
  }
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(6.2 * S)}px "Gothic A1", sans-serif`;
  ctx.fillStyle = "#E4DCC8";
  ctx.fillText("결과물 게시판", 195 * S, 45.6 * S);
  // 밤에는 바닥이 어두워져 같은 색으로는 라벨이 묻힌다
  ctx.fillStyle = night ? "#B9AE96" : "#7A705E";
  ctx.fillText("대기 구역", 14 * S, 204 * S);
  ctx.fillText("회의 탁자", 194 * S, 202 * S);
  ctx.fillStyle = night ? "#9A9488" : "#6E6A5E";
  ctx.fillText("탕비실", 12 * S, 95 * S);

  for (const act of order) drawBubble(act, S);
}

/* ---------------- 이동 ---------------- */

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
let lastFrame = performance.now();

function tick(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  t += dt * 60;
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
    if (now < partyUntil) {
      for (const c of confetti) {
        c.y += c.v * dt * 60;
        c.x += Math.sin((c.y + c.seed) / 9) * 0.4;
        if (c.y > LH) { c.y = 54; c.x = Math.random() * LW; }
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
  const u = untilText(act.nextRunAt);
  $("p-status").textContent = u ? `${s.label} · 다음 ${u}` : s.label;
  $("p-total").textContent = act.total ? `누적 ${act.total}건` : "";

  const q = $("p-queued");
  q.textContent = "";
  q.hidden = !act.queued?.length;
  for (const i of act.queued ?? []) {
    const a = document.createElement("a");
    a.className = "queued";
    a.href = `https://github.com/${state.repo}/issues/${i.number}`;
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = `#${i.number} ${i.title}`;
    q.append(a);
  }

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
    row.href = w.url; row.target = "_blank"; row.rel = "noopener";
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
      ...a, hair: HAIRS[i % HAIRS.length], st: a.status, desk: i, face: 1,
      x: home.x, y: home.y, fx: home.x, fy: home.y, tx: home.x, ty: home.y,
      t0: now, dur: 0, moving: false, bubble: null,
      nextAt: now + 600 + i * 700,
      posted: a.status !== "done",
    };
    if (prev) {
      Object.assign(base, {
        x: prev.x, y: prev.y, fx: prev.x, fy: prev.y, tx: prev.x, ty: prev.y,
        bubble: prev.bubble, face: prev.face,
        posted: a.status === "done" ? (prev.st === "done" ? prev.posted : false) : true,
        nextAt: prev.st === a.status ? prev.nextAt : now + 300,
      });
    }
    return base;
  });
  roomKey = "";
  if (selected >= actors.length) selected = 0;
  if (reduced || first)
    for (const a of actors) {
      const h = homeOf(a.desk, n, a.st);
      a.x = h.x; a.y = h.y; a.tx = h.x; a.ty = h.y; a.moving = false;
    }
  paintPanel();
}

/* ---------------- 이스터 에그 ---------------- */

let toastTimer = 0;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function startParty() {
  if (reduced) return toast("🎉 (동작 최소화 설정이라 조용히 축하합니다)");
  partyUntil = performance.now() + 12000;
  confetti = Array.from({ length: 60 }, () => ({
    x: Math.random() * LW, y: 54 + Math.random() * (LH - 54),
    v: 0.5 + Math.random() * 1.2, seed: Math.random() * 100,
    c: pick(["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#B983FF", "#FFFFFF"]),
  }));
  for (const a of actors) a.nextAt = 0;
  toast("🎉 파티 모드");
}

function coffeeBreak() {
  coffeeUntil = performance.now() + 12000;
  for (const a of actors) if (a.st !== "working") a.nextAt = 0;
  toast("☕ 커피 타임");
}

function growPlant() {
  plantLevel = (plantLevel + 1) % 4;
  try { localStorage.setItem("crew.plant", String(plantLevel)); } catch { /* 저장 못 해도 그만 */ }
  roomKey = "";
  toast(plantLevel === 0 ? "🪴 새 화분으로 갈았습니다" : `🌱 화분 ${plantLevel}단계`);
}

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
                "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konami = [];

window.addEventListener("keydown", (e) => {
  konami.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (konami.length > KONAMI.length) konami.shift();
  if (konami.length === KONAMI.length && konami.every((k, i) => k === KONAMI[i])) {
    konami = [];
    startParty();
  }
  if (e.key === "?") { e.preventDefault(); $("help").hidden = !$("help").hidden; }
  if (e.key === "Escape") $("help").hidden = true;
  if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) coffeeBreak();
});

/* ---------------- 입력 ---------------- */

const inProp = (lx, ly, p) => lx >= p.x && lx <= p.x + p.w && ly >= p.y && ly <= p.y + p.h;

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
    return;
  }

  if (inProp(lx, ly, PROPS.coffee)) return coffeeBreak();
  if (inProp(lx, ly, PROPS.plant)) return growPlant();
  if (inProp(lx, ly, PROPS.clock)) {
    const n = kstNow();
    toast(`🕐 ${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")} KST`);
  }
});

cv.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  selected = (selected + (e.key === "ArrowRight" ? 1 : actors.length - 1)) % actors.length;
  paintPanel();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const now = performance.now();
  lastFrame = now;
  actors.forEach((a, i) => {
    a.bubble = null;
    if (a.moving) { a.x = a.tx; a.y = a.ty; a.moving = false; }
    if (now >= a.nextAt) a.nextAt = now + 400 + i * 900;
  });
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
  $("queued").textContent = state.queued ? `· 지시 대기 ${state.queued}` : "";
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
