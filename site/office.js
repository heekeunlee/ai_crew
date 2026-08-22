/* ai_crew 2D 픽셀 오피스
 *
 * state.json 하나만 읽어서 그린다. 인원 수는 로스터에서 나오므로
 * 에이전트가 늘어도 이 파일은 손댈 일이 없다.
 *
 * 상태와 연출의 관계
 *   working  책상에 앉아 있다. 실제로 Actions가 도는 중이다.
 *   done     게시판에 결과를 붙이고, 그 뒤로는 사무실을 돌아다닌다.
 *   idle     돌아다니거나 소파에 앉거나 탕비실에 간다.
 *
 * "책상에 있다 = 작업 중"이라는 규칙은 그대로다.
 *
 * 화면에 있는 것 중 진짜 데이터로 움직이는 것
 *   창밖 하늘·벽시계   실제 한국 시각
 *   책장의 책          누적 산출물 수
 *   벽 액자 막대그래프  최근 7일 산출물
 *   트로피             10 / 50 / 100건 달성
 *   화이트보드          회의 중일 때 각자 낸 결과물
 *   프린터             새 산출물이 커밋되면 종이가 나온다
 *   게시판 빨간 핀      처리 안 된 이슈 지시
 *
 * 고양이와 계절 장식만 순수한 장식이다.
 */

const LW = 400, LH = 244;
const DESK_W = 56, DESK_TOP = 126, MARGIN = 20;
const WALL = 56;

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
const FACE_SIDE = "....SEES....";
const SKIN = "#E8B98A", EYE = "#241812", PANTS = "#39404F";
const HAIRS = ["#2A2018", "#5A3A2A", "#4A4A52", "#201A14", "#3B2B33"];

/* ---------------- 장소 ---------------- */

const PANTRY  = [{ x: 16, y: 100 }, { x: 44, y: 100 }, { x: 72, y: 100 }, { x: 100, y: 100 }];
const BOARD   = [{ x: 250, y: 96 }, { x: 278, y: 96 }, { x: 306, y: 96 }, { x: 334, y: 96 }];
const SOFA    = [{ x: 72, y: 206 }, { x: 96, y: 206 }, { x: 120, y: 206 }, { x: 144, y: 206 }];
const MEETING = [{ x: 256, y: 208 }, { x: 284, y: 188 }, { x: 318, y: 188 }, { x: 352, y: 208 }];
const WANDER = [
  { x: 190, y: 112 }, { x: 250, y: 116 }, { x: 310, y: 116 }, { x: 372, y: 122 },
  { x: 206, y: 166 }, { x: 248, y: 164 }, { x: 110, y: 236 }, { x: 268, y: 236 },
  { x: 300, y: 234 }, { x: 372, y: 226 },
];

const PROPS = {
  pantry:  { x: 6,   y: 52,  w: 144, h: 54 },
  shelf:   { x: 156, y: 56,  w: 76,  h: 50 },
  plant:   { x: 360, y: 146, w: 36,  h: 58 },
  clock:   { x: 126, y: 12,  w: 32,  h: 32 },
  chart:   { x: 164, y: 10,  w: 70,  h: 36 },
  printer: { x: 14,  y: 164, w: 40,  h: 32 },
};

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const AMBIENT = ["…", "☕", "흠", "♪"];

/* ---------------- 시간 ---------------- */

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const kstHour = () => { const n = kstNow(); return n.getUTCHours() + n.getUTCMinutes() / 60; };

function skyOf(h) {
  if (h >= 5 && h < 7)   return { a: "#F2A97E", b: "#F6D6A8", sun: "#FFE9B0", sunY: 34, stars: 0, tint: null };
  if (h >= 7 && h < 17)  return { a: "#7FB8DC", b: "#B9DCEF", sun: "#FFF3C4", sunY: 20, stars: 0, tint: null };
  if (h >= 17 && h < 19) return { a: "#E08A5C", b: "#F3C08A", sun: "#FFD07A", sunY: 35, stars: 0, tint: "rgba(120,70,30,0.10)" };
  if (h >= 19 && h < 21) return { a: "#3E4A78", b: "#7A6A9A", sun: null, sunY: 0, stars: 4, tint: "rgba(30,40,80,0.20)" };
  return { a: "#1B2440", b: "#2E3A5C", sun: "#E8E8D8", sunY: 21, stars: 9, tint: "rgba(20,30,70,0.30)" };
}
const isNight = (h) => h >= 19 || h < 6;

// 12월엔 트리, 한여름엔 선풍기. 벽시계가 이미 실제 날짜를 알고 있으니 공짜다.
function seasonOf() {
  const m = kstNow().getUTCMonth() + 1;
  if (m === 12 || m === 1) return "winter";
  if (m >= 7 && m <= 8) return "summer";
  return "plain";
}

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
let printUntil = 0, printStack = 0, lastSeenRun = null;

let plantLevel = 0;
try { plantLevel = Math.min(3, Number(localStorage.getItem("crew.plant") || 0)); } catch { /* 저장 불가여도 그만 */ }

const deskX = (i, n) =>
  n <= 1 ? Math.round((LW - DESK_W) / 2)
         : Math.round(MARGIN + i * ((LW - MARGIN * 2 - DESK_W) / (n - 1)));

/* ---------------- 고양이 ---------------- */

// 아무 데이터도 나타내지 않는다. 그냥 사무실에 고양이가 산다.
const CAT_SPOTS = [
  { x: 150, y: 212, sleep: true },   // 소파 앞 러그 (자리에 앉은 직원에게 가리지 않는 곳)
  { x: 210, y: 170, sleep: false },
  { x: 44, y: 158, sleep: false },
  { x: 330, y: 232, sleep: true },
  { x: 176, y: 118, sleep: false },
  { x: 300, y: 150, sleep: true },
];
const cat = { x: 150, y: 212, fx: 150, fy: 212, tx: 150, ty: 212,
              t0: 0, dur: 0, moving: false, face: 1, nextAt: 3000, sleeping: true, bubble: null };

const CAT_BODY = [
  "..X....X..", ".XXX..XXX.", ".XXXXXXXX.", ".XoXXXXoX.",
  ".XXXwwXXX.", "..XXXXXX..", ".XXXXXXXXt", ".X.XX.XX.t",
];

function drawCat(x, y, face, sleeping, phase) {
  const map = { X: "#7A6A58", o: sleeping ? "#7A6A58" : "#F0E68C", w: "#3A3026", t: "#7A6A58" };
  const tail = sleeping ? 0 : Math.round(Math.sin(phase / 8) * 1);
  for (let r = 0; r < CAT_BODY.length; r++)
    for (let c = 0; c < CAT_BODY[r].length; c++) {
      const ch = CAT_BODY[r][c];
      if (ch === ".") continue;
      const dx = ch === "t" ? tail : 0;
      px(x + (face < 0 ? 9 - c : c) + dx, y + r - 8, 1, 1, map[ch]);
    }
  if (sleeping) {
    const z = ((phase / 30) | 0) % 3;
    px(x + 11, y - 12 - z, 2, 2, "#FFFFFF");
  }
}

/* ---------------- 캐릭터 ---------------- */

function drawHeadgear(x, y, i, color, face) {
  const at = (c, r, w, h, col) => px(x + (face < 0 ? 11 - c - (w - 1) : c), y + r, w, h, col);
  switch (i % 4) {
    case 0: at(3, 1, 6, 2, color); at(2, 2, 8, 1, color); at(8, 3, 4, 1, shade(color, 0.75)); break;
    case 1: at(3, 1, 6, 2, "#5A3A2A"); at(9, 3, 2, 4, "#5A3A2A"); at(9, 7, 2, 2, shade("#5A3A2A", 0.8)); break;
    case 2: at(3, 5, 3, 2, "#2A2A34"); at(7, 5, 3, 2, "#2A2A34"); at(6, 5, 1, 1, "#2A2A34"); break;
    case 3: at(3, 0, 6, 1, "#2E2E38"); at(2, 1, 1, 3, "#2E2E38"); at(9, 1, 1, 3, "#2E2E38");
            at(1, 3, 2, 3, color); at(9, 3, 2, 3, color); break;
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

function drawWindow(night, sky, season) {
  px(12, 12, 62, 32, night ? "#6E7A8C" : "#8895A6");
  px(15, 15, 56, 13, sky.a);
  px(15, 28, 56, 13, sky.b);

  // 창밖 건물 실루엣 — 밤에는 창문에 불이 켜진다
  const sil = night ? "#141A2E" : "#8FA8BE";
  const lit = "#F5D98A";
  const towers = [[17, 22, 7, 19], [26, 26, 5, 15], [33, 18, 9, 23], [44, 28, 6, 13],
                  [52, 23, 8, 18], [62, 30, 7, 11]];
  for (const [bx, by, bw, bh] of towers) {
    px(bx, by, bw, bh, sil);
    if (night) for (let wy = by + 2; wy < by + bh - 2; wy += 4)
      for (let wx = bx + 1; wx < bx + bw - 1; wx += 3)
        if ((wx * 7 + wy * 13) % 5 < 2) px(wx, wy, 1, 2, lit);
  }
  for (let i = 0; i < sky.stars; i++) px(17 + ((i * 37) % 52), 16 + ((i * 23) % 8), 1, 1, "#FFF6D8");
  if (sky.sun) px(56, sky.sunY, 7, 7, sky.sun);
  if (season === "winter") for (let i = 0; i < 14; i++) px(16 + ((i * 29) % 54), 16 + ((i * 17) % 26), 1, 1, "#FFFFFF");

  px(42, 15, 2, 26, night ? "#6E7A8C" : "#8895A6");
  px(15, 27, 56, 2, night ? "#6E7A8C" : "#8895A6");
}

function drawChart(daily) {
  px(164, 10, 70, 36, "#5A4A3E");
  px(167, 13, 64, 30, "#F4EEDC");
  const max = Math.max(1, ...daily.map((d) => d.count));
  daily.forEach((d, i) => {
    const bh = Math.max(1, Math.round((d.count / max) * 20));
    const bx = 170 + i * 9;
    px(bx, 40 - bh, 6, bh, d.count ? "#3B36C4" : "#CFC9B8");
    px(bx, 41, 6, 1, "#9A9484");
  });
}

function drawShelf(total) {
  // 책장 — 산출물 한 건이 책 한 권
  px(156, 56, 76, 50, "#6E5B42");
  px(158, 58, 72, 46, "#8A7050");
  for (const sy of [70, 84, 98]) px(158, sy, 72, 2, "#6E5B42");
  // 산출물이 적을 때 책장이 텅 비어 보이면 고장처럼 읽힌다. 칸마다
  // 고정 소품을 하나씩 두고, 책은 그 왼쪽으로 채워 나간다.
  px(214, 62, 6, 6, "#9A6A4A"); px(215, 58, 4, 4, "#4C9159");          // 화분
  px(212, 74, 12, 10, "#C08A5A"); px(212, 74, 12, 2, "#D6A472");        // 서류함
  px(214, 88, 9, 9, "#5A8AC0"); px(216, 90, 5, 5, "#7FB0E0");           // 지구본
  px(218, 97, 1, 2, "#6A5A44");

  const cols = ["#C0463B", "#3B6FC0", "#C08A3B", "#3BA06E", "#8A5AC0", "#C0563B"];
  let n = Math.min(total, 33);
  outer:
  for (const sy of [68, 82, 96]) {
    for (let i = 0; i < 11; i++) {
      if (n-- <= 0) break outer;
      const h = 6 + ((i * 7) % 4);
      px(161 + i * 4.6, sy - h + 2, 3, h, cols[(i + sy) % cols.length]);
    }
  }
  // 트로피 — 10 / 50 / 100건
  const tro = [10, 50, 100].filter((m) => total >= m).length;
  for (let i = 0; i < tro; i++) {
    const tx = 200 + i * 10;
    px(tx, 60, 6, 2, "#E0B24E");
    px(tx + 1, 55, 4, 5, "#F0C860");
    px(tx, 55, 1, 3, "#F0C860"); px(tx + 5, 55, 1, 3, "#F0C860");
  }
}

function drawWhiteboard(lines) {
  const X = 176, Y = 210;   // 책상 명패(y 150)와 겹치지 않게 바닥 쪽으로 내렸다
  px(X, Y, 66, 28, "#8A8578");
  px(X + 2, Y + 2, 62, 24, "#F6F4EC");
  px(X + 4, Y + 4, 30, 2, "#3B36C4");
  px(X + 20, Y + 28, 4, 6, "#6E6A5E"); px(X + 44, Y + 28, 4, 6, "#6E6A5E");
  if (!lines.length) {
    px(X + 6, Y + 10, 22, 2, "#C8C4B8"); px(X + 6, Y + 16, 34, 2, "#C8C4B8");
    return;
  }
  lines.slice(0, 4).forEach((l, i) => {
    px(X + 5, Y + 9 + i * 5, 2, 2, l.color);
    px(X + 9, Y + 10 + i * 5, Math.min(48, 8 + l.len * 2), 2, "#5A5648");
  });
}

function drawPrinter(stack) {
  px(14, 168, 38, 22, "#B8B4AA");
  px(14, 168, 38, 3, "#D2CEC4");
  px(18, 174, 26, 6, "#6E6A62");
  px(20, 176, 4, 2, "#4ADE80");
  px(16, 190, 34, 4, "#8A8680");
  for (let i = 0; i < Math.min(stack, 6); i++) px(20 + i, 166 - i * 2, 22, 2, "#FBF8EE");
}

function drawRoom(key) {
  P = rc;
  rc.clearRect(0, 0, LW, LH);
  const h = kstHour();
  const sky = skyOf(h);
  const night = isNight(h);
  const season = seasonOf();

  px(0, 0, LW, WALL, night ? "#3D4657" : "#57657A");
  px(0, 0, LW, 3, night ? "#2E3644" : "#455266");
  px(0, WALL - 4, LW, 4, night ? "#2A323F" : "#3E4A5C");
  px(0, WALL, LW, LH - WALL, night ? "#A99D85" : "#C3B69B");
  for (let x = 0; x < LW; x += 16) px(x, WALL, 1, LH - WALL, night ? "#9E9279" : "#B7AA8F");
  for (let y = WALL; y < LH; y += 16) px(0, y, LW, 1, night ? "#9E9279" : "#B7AA8F");
  px(0, WALL, LW, 2, night ? "#8C8069" : "#A2957C");

  drawWindow(night, sky, season);

  // 포스터
  px(84, 14, 34, 28, "#5A4A6E");
  px(86, 16, 30, 24, "#EFE9D8");
  px(90, 20, 22, 3, "#5A4A6E");
  px(90, 26, 14, 2, "#9A8CB0");
  px(90, 30, 18, 2, "#9A8CB0");
  px(90, 34, 10, 2, "#C86A4A");

  // 벽시계
  px(128, 14, 28, 28, "#4A4438");
  px(130, 16, 24, 24, "#F4EEDC");
  const cx = 142, cy = 28;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    px(cx + Math.round(Math.cos(ang) * 9), cy + Math.round(Math.sin(ang) * 9), 1, 1, "#8A8272");
  }
  const nw = kstNow();
  const hAng = ((nw.getUTCHours() % 12) / 12 + nw.getUTCMinutes() / 720) * Math.PI * 2 - Math.PI / 2;
  const mAng = (nw.getUTCMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
  for (let r = 1; r <= 5; r++) px(cx + Math.round(Math.cos(hAng) * r), cy + Math.round(Math.sin(hAng) * r), 1, 1, "#3A3428");
  for (let r = 1; r <= 8; r++) px(cx + Math.round(Math.cos(mAng) * r), cy + Math.round(Math.sin(mAng) * r), 1, 1, "#5A5344");
  px(cx, cy, 1, 1, "#C0392B");

  drawChart(key.daily);

  // 게시판
  px(242, 10, 150, 36, "#6E5B42");
  px(245, 13, 144, 30, "#EFE9D8");
  const notes = ["#F2A65A", "#8FC7E8", "#EE8B7B", "#A8D8A0", "#D9B3E8", "#F2D06B",
                 "#9AD8D8", "#F0B0C8", "#C8D89A"];
  for (let i = 0; i < Math.min(3 + key.done, 9); i++) {
    const nx = 249 + (i % 5) * 28, ny = 17 + ((i / 5) | 0) * 13;
    px(nx, ny, 12, 10, notes[i]);
    px(nx + 2, ny + 3, 8, 1, "rgba(0,0,0,0.22)");
    px(nx + 2, ny + 6, 5, 1, "rgba(0,0,0,0.22)");
  }
  for (let i = 0; i < Math.min(key.queued, 4); i++) px(383, 17 + i * 6, 4, 4, "#D9483B");

  // ── 탕비실 ──
  px(6, 58, 144, 46, night ? "#B2B0A6" : "#CFCCC0");
  for (let x = 6; x < 150; x += 12) px(x, 58, 1, 46, night ? "#A5A399" : "#C2BFB2");
  for (let y = 58; y < 104; y += 12) px(6, y, 144, 1, night ? "#A5A399" : "#C2BFB2");
  px(148, 56, 4, 48, "#8A8578");
  px(148, 56, 4, 3, "#A39D8E");
  px(10, 58, 74, 9, "#7E6A52");
  px(10, 65, 74, 2, "#5E4E3C");
  px(26, 60, 1, 5, "#5E4E3C"); px(50, 60, 1, 5, "#5E4E3C");
  px(10, 72, 92, 8, "#B9B3A4");
  px(10, 72, 92, 2, "#D2CDBE");
  px(10, 80, 92, 10, "#8A8378");
  px(10, 88, 92, 2, "#6E6A5E");
  px(14, 62, 12, 12, "#3E3E4A");
  px(16, 64, 8, 5, "#22222C");
  px(17, 70, 6, 2, "#7A6A5A");
  px(32, 64, 9, 10, "#C9C4B8"); px(41, 67, 3, 3, "#9A958A"); px(34, 62, 5, 2, "#9A958A");
  px(50, 68, 5, 6, "#EFE9D8"); px(58, 69, 5, 5, "#E8CFC0"); px(66, 68, 5, 6, "#D8E4EF");
  px(78, 73, 20, 6, "#9AA0A6"); px(80, 74, 16, 4, "#7A8087");
  px(86, 66, 2, 8, "#B5BAC0"); px(86, 65, 6, 2, "#B5BAC0");
  px(110, 58, 26, 40, "#DCDCD4");
  px(110, 58, 26, 3, "#EFEFE8");
  px(110, 76, 26, 2, "#B8B8B0");
  px(132, 68, 2, 6, "#8A8A82"); px(132, 82, 2, 6, "#8A8A82");
  px(114, 62, 6, 5, "#E86A8A");
  px(28, 90, 10, 3, "#7D5C7A"); px(31, 93, 4, 6, "#5E4A5C");
  px(54, 90, 10, 3, "#7D5C7A"); px(57, 93, 4, 6, "#5E4A5C");

  drawShelf(key.total);
  drawWhiteboard(key.wb);
  drawPrinter(key.stack);

  // 러그와 소파
  px(58, 176, 118, 40, "#A89478"); px(60, 178, 114, 36, "#B5A084");
  for (let i = 0; i < 5; i++) px(64 + i * 22, 182, 12, 28, "#AC977C");
  px(62, 182, 108, 20, "#7D5C7A"); px(62, 182, 108, 5, "#8E6C8B");
  px(62, 198, 108, 6, "#664A63");
  px(62, 182, 6, 20, "#664A63"); px(164, 182, 6, 20, "#664A63");

  // 회의 탁자
  px(266, 192, 82, 20, "#6A4E34");
  px(268, 190, 78, 18, "#9A7550");
  px(268, 190, 78, 4, "#AE8A63");
  px(286, 196, 12, 5, "#EFE9D8");
  px(306, 195, 10, 6, "#D9CFC0");

  // 화분
  const g = key.plant;
  px(364, 176, 16, 16, "#9A6A4A"); px(364, 176, 16, 3, "#B07E5A");
  px(369, 156 - g * 6, 6, 22 + g * 6, "#3E7A4A");
  px(363, 160 - g * 4, 6, 5, "#4C9159");
  px(374, 164 - g * 4, 6, 5, "#4C9159");
  px(367, 151 - g * 6, 9, 6, "#57A165");
  if (g >= 2) { px(359, 154 - g * 3, 6, 5, "#4C9159"); px(377, 157 - g * 3, 6, 5, "#4C9159"); }
  if (g >= 3) { px(370, 143 - g * 6, 4, 4, "#E86A8A"); px(364, 146 - g * 6, 3, 3, "#E86A8A"); }

  // 작은 관엽 하나 더
  px(112, 158, 10, 10, "#9A6A4A");
  px(115, 146, 4, 12, "#3E7A4A");
  px(111, 148, 5, 4, "#4C9159"); px(118, 151, 5, 4, "#4C9159");

  // 계절 장식
  if (season === "winter") {
    px(212, 214, 12, 4, "#6A4E34");
    for (let i = 0; i < 4; i++) px(214 - i, 210 - i * 4, 4 + i * 2, 4, "#2F7A4A");
    px(217, 194, 2, 2, "#F0C860");
    px(213, 206, 2, 2, "#E05A5A"); px(221, 210, 2, 2, "#5A9AE0");
  } else if (season === "summer") {
    px(214, 218, 10, 3, "#8A8578");
    px(218, 202, 2, 16, "#9A958A");
    px(212, 196, 14, 3, "#B5BAC0");
    px(213, 199, 12, 4, "#D2D6DA");
  }

  if (sky.tint) { rc.fillStyle = sky.tint; rc.fillRect(0, WALL, LW, LH - WALL); }
  if (night) {
    px(72, 58, 8, 3, "#FFE9A8");
    rc.globalAlpha = 0.14;
    rc.fillStyle = "#FFD98A";
    rc.fillRect(8, 60, 140, 42);
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
    oc.globalAlpha = 0.22;
    px(mx - 4, DESK_TOP - 1, 26, 5, "#7FD6FF");
    oc.globalAlpha = 1;
  } else if (night) {
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
    const sy = 62 - ph;
    if (sy < 46) continue;
    oc.globalAlpha = Math.max(0, 0.5 - ph / 44);
    px(18 + Math.round(Math.sin((ph + i * 3) / 3) * 2), sy, 2, 2, "#FFFFFF");
    oc.globalAlpha = 1;
  }
}

// 창밖으로 새가 지나간다. 아주 가끔.
function drawBirds() {
  if (reduced) return;
  const cycle = (t / 2) % 900;
  if (cycle > 120) return;
  const bx = 14 + cycle * 0.5;
  if (bx > 70) return;
  const flap = ((t / 6) | 0) % 2;
  for (const [ox, oy] of [[0, 0], [9, 4], [17, -2]]) {
    px(bx + ox, 20 + oy, 1, 1, "#3A4250");
    px(bx + ox - 1, 20 + oy + flap, 1, 1, "#3A4250");
    px(bx + ox + 1, 20 + oy + flap, 1, 1, "#3A4250");
  }
}

function drawParty(now) {
  if (now >= partyUntil) return;
  const hues = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#B983FF"];
  oc.globalAlpha = 0.22;
  for (let y = WALL; y < LH; y += 16)
    for (let x = 0; x < LW; x += 16)
      px(x, y, 16, 16, hues[(((x / 16) | 0) + ((y / 16) | 0) + ((t / 8) | 0)) % hues.length]);
  oc.globalAlpha = 1;
  for (const c of confetti) px(c.x, c.y, 2, 3, c.c);
}

/* ---------------- 말풍선 ---------------- */

function bubbleAt(text, at, dur, ax, ay, S) {
  const life = (performance.now() - at) / 1000;
  if (life > dur) return false;
  const IN = 0.1, OUT = 0.18;
  const fade = life < IN ? life / IN
             : life > dur - OUT ? Math.max(0, (dur - life) / OUT)
             : 1;
  if (fade <= 0.02) return true;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = `700 ${Math.round(6.6 * S)}px "Gothic A1", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const padX = 4 * S, padY = 3 * S;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 9 * S + padY * 2;
  const headX = (ax + 6) * S;
  const headY = (ay - 22) * S - Math.min(4, life * 20) * S * 0.2;
  const x = Math.max(2 * S, Math.min(LW * S - w - 2 * S, headX - w / 2));
  const y = Math.max(2 * S, headY - h);

  ctx.fillStyle = "rgba(20,18,14,0.35)"; ctx.fillRect(x + 2 * S, y + 2 * S, w, h);
  ctx.fillStyle = "#FFFDF6"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#3A3428";
  ctx.fillRect(x, y, w, S); ctx.fillRect(x, y + h - S, w, S);
  ctx.fillRect(x, y, S, h); ctx.fillRect(x + w - S, y, S, h);
  const tx = Math.max(x + 3 * S, Math.min(x + w - 6 * S, headX - 2 * S));
  ctx.fillStyle = "#FFFDF6"; ctx.fillRect(tx, y + h, 4 * S, 3 * S);
  ctx.fillStyle = "#3A3428"; ctx.fillRect(tx, y + h + 3 * S, 4 * S, S);
  ctx.fillStyle = "#221E18"; ctx.fillText(text, x + padX, y + padY);
  ctx.restore();
  return true;
}

function drawBubble(act, S) {
  const b = act.bubble;
  if (!b || !b.text) return;
  if (!bubbleAt(b.text, b.at, b.dur, act.x, act.y, S)) act.bubble = null;
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
  act.dur = Math.min(3.5, Math.max(0.5, d / (62 * speedScale)));
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
    const seat = { x: deskX(act.desk, actors.length) + 14, y: 132 };
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
  const target = roll < 0.28 ? SOFA[act.desk % SOFA.length]
               : roll < 0.44 ? pick(PANTRY)
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

function catStep(now) {
  if (reduced) return;
  if (cat.moving) {
    const p = cat.dur > 0 ? Math.min(1, (now - cat.t0) / (cat.dur * 1000)) : 1;
    cat.x = cat.fx + (cat.tx - cat.fx) * p;
    cat.y = cat.fy + (cat.ty - cat.fy) * p;
    if (p >= 1) { cat.x = cat.tx; cat.y = cat.ty; cat.moving = false; }
    return;
  }
  if (now < cat.nextAt) return;
  const spot = pick(CAT_SPOTS);
  const d = Math.hypot(spot.x - cat.x, spot.y - cat.y);
  cat.fx = cat.x; cat.fy = cat.y; cat.tx = spot.x; cat.ty = spot.y;
  if (Math.abs(spot.x - cat.x) > 2) cat.face = spot.x > cat.x ? 1 : -1;
  cat.t0 = now;
  cat.dur = Math.max(0.8, d / 34);
  cat.moving = d > 1;
  cat.sleeping = spot.sleep;
  cat.nextAt = now + cat.dur * 1000 + (spot.sleep ? 14000 : 6000) + Math.random() * 8000;
}

/* ---------------- 프레임 ---------------- */

function render() {
  if (!actors.length) return;
  const n = actors.length;
  const now = performance.now();
  const night = isNight(kstHour());

  let done = 0;
  for (const a of actors) if (a.st === "done") done++;

  const inMeeting = now < meetingUntil;
  const wb = inMeeting
    ? actors.filter((a) => a.st !== "working" && a.recent?.[0])
        .slice(0, 4)
        .map((a) => ({ color: a.color, len: Math.min(20, (a.recent[0].summary || "").length / 3) }))
    : [];

  const key = {
    done, plant: plantLevel, queued: state?.queued ?? 0,
    total: state?.totals?.outputs ?? 0,
    daily: state?.totals?.daily ?? [],
    wb, stack: printStack,
  };
  const ks = [done, plantLevel, key.queued, key.total, wb.length, printStack,
              Math.floor(kstHour() * 60)].join("|");
  if (ks !== roomKey) { drawRoom(key); roomKey = ks; }

  P = oc;
  oc.clearRect(0, 0, LW, LH);
  oc.drawImage(room, 0, 0);
  drawSteam();
  drawBirds();
  drawParty(now);

  // 프린터가 도는 동안 종이가 흔들린다
  if (now < printUntil && !reduced) px(20, 164 - ((t / 6) | 0) % 3, 22, 2, "#FFFFFF");

  const order = actors.slice().sort((p, q) => p.y - q.y);
  const party = now < partyUntil && !reduced;

  // 고양이도 깊이 정렬에 낀다
  const cats = [{ isCat: true, y: cat.y }];
  const all = [...order, ...cats].sort((p, q) => p.y - q.y);

  for (const item of all) {
    if (item.isCat) { drawCat(cat.x, cat.y, cat.face, cat.sleeping && !cat.moving, t); continue; }
    const act = item;
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
  for (let i = 0; i < n; i++) {
    const act = actors.find((a) => a.desk === i);
    if (!act) continue;
    ctx.font = `700 ${Math.round(6.4 * S)}px "Gothic A1", sans-serif`;
    ctx.fillStyle = night ? "rgba(60,54,42,0.55)" : "rgba(70,64,52,0.45)";
    ctx.fillText(act.name, (deskX(i, n) + DESK_W / 2) * S, (DESK_TOP + 24) * S);
  }
  for (const act of order) {
    ctx.font = `800 ${Math.round(6.4 * S)}px "Gothic A1", sans-serif`;
    const tw = ctx.measureText(act.name).width;
    const bw = tw + 5 * S, bh = 9.5 * S;
    const bx = Math.max(1 * S, Math.min(LW * S - bw - 1 * S, (act.x + 6) * S - bw / 2));
    const by = (act.y + 2) * S;
    ctx.fillStyle = "rgba(24,20,16,0.78)"; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = act.color; ctx.fillRect(bx, by, bw, 1.4 * S);
    ctx.fillStyle = "#F6F2E6"; ctx.fillText(act.name, bx + bw / 2, by + 1.8 * S);
  }

  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(6.2 * S)}px "Gothic A1", sans-serif`;
  ctx.fillStyle = "#E4DCC8";
  ctx.fillText("결과물 게시판", 243 * S, 47.5 * S);
  ctx.fillStyle = night ? "#9A9488" : "#6E6A5E";
  ctx.fillText("탕비실", 10 * S, 96 * S);
  ctx.fillStyle = "#E4D8BE";
  ctx.fillText("책장", 159 * S, 99 * S);
  ctx.fillStyle = night ? "#B9AE96" : "#7A705E";
  ctx.fillText("대기 구역", 60 * S, 218 * S);
  ctx.fillText("회의 탁자", 268 * S, 214 * S);

  for (const act of order) drawBubble(act, S);
  if (cat.bubble && !bubbleAt(cat.bubble.text, cat.bubble.at, cat.bubble.dur, cat.x - 2, cat.y - 4, S))
    cat.bubble = null;
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
    catStep(now);
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
        if (c.y > LH) { c.y = WALL; c.x = Math.random() * LW; }
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
  if (st === "working") return { x: deskX(i, n) + 14, y: 132 };
  if (st === "done") return BOARD[i % BOARD.length];
  return SOFA[i % SOFA.length];
}

function applyState(s, first) {
  const n = s.agents.length;
  const now = performance.now();

  // 새 산출물이 들어오면 프린터가 돈다
  const newest = s.agents.map((a) => a.lastRunAt).filter(Boolean).sort().pop() ?? null;
  if (!first && newest && newest !== lastSeenRun) {
    printUntil = now + 6000;
    printStack = Math.min(6, printStack + 1);
    toast("🖨️ 새 산출물이 나왔습니다");
  }
  if (newest) lastSeenRun = newest;

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
  confetti = Array.from({ length: 70 }, () => ({
    x: Math.random() * LW, y: WALL + Math.random() * (LH - WALL),
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

const ROLLCALL_MS = 8000;
let rollcall = new Map();
function rollcallTap(id) {
  const now = performance.now();
  for (const [k, at] of rollcall) if (now - at > ROLLCALL_MS) rollcall.delete(k);
  rollcall.set(id, now);
  const need = actors.length;
  if (rollcall.size >= need && need > 1) { rollcall.clear(); startParty(); return; }
  if (rollcall.size > 1) toast(`전원 호출 ${rollcall.size}/${need}`);
}

let lastShake = 0, shakeOn = false;
function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const g = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
  const now = performance.now();
  if (g > 26 && now - lastShake > 1500) { lastShake = now; startParty(); }
}
function enableShake() {
  if (shakeOn) return toast("이미 켜져 있습니다");
  const DM = window.DeviceMotionEvent;
  if (!DM) return toast("이 기기는 흔들기를 지원하지 않습니다");
  const go = () => { window.addEventListener("devicemotion", onMotion); shakeOn = true; toast("📳 흔들기 켜짐"); };
  if (typeof DM.requestPermission === "function") {
    DM.requestPermission().then((r) => (r === "granted" ? go() : toast("권한이 거부됐습니다"))).catch(() => toast("권한 요청 실패"));
  } else go();
}

window.addEventListener("keydown", (e) => {
  konami.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (konami.length > KONAMI.length) konami.shift();
  if (konami.length === KONAMI.length && konami.every((k, i) => k === KONAMI[i])) {
    konami = []; startParty();
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

  // 고양이가 사람보다 우선. 작아서 노리기 어렵기 때문이다.
  if (Math.hypot(lx - (cat.x + 5), ly - (cat.y - 4)) < 13) {
    cat.bubble = { text: pick(["야옹", "냐", "…", "골골"]), at: performance.now(), dur: 2.5 };
    cat.sleeping = false;
    cat.nextAt = performance.now() + 500;
    return;
  }

  let best = -1, bd = 16;
  actors.forEach((a, i) => {
    const d = Math.hypot(lx - (a.x + 6), ly - (a.y - 8));
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0) {
    selected = best;
    paintPanel();
    say(actors[best], lineFor(actors[best]), 4, true);
    rollcallTap(actors[best].id);
    return;
  }

  if (inProp(lx, ly, PROPS.pantry)) return coffeeBreak();
  if (inProp(lx, ly, PROPS.plant)) return growPlant();
  if (inProp(lx, ly, PROPS.printer)) {
    printUntil = performance.now() + 4000;
    return toast("🖨️ 드르륵");
  }
  if (inProp(lx, ly, PROPS.shelf)) {
    return toast(`📚 누적 산출물 ${state?.totals?.outputs ?? 0}건`);
  }
  if (inProp(lx, ly, PROPS.chart)) {
    const d = state?.totals?.daily ?? [];
    return toast(`📊 최근 7일 ${d.reduce((n, x) => n + x.count, 0)}건`);
  }
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
  cat.nextAt = now + 1200;
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
  $("helpbtn").onclick = () => { $("help").hidden = !$("help").hidden; };
  const sb = $("shakebtn");
  if (sb) sb.onclick = enableShake;
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
