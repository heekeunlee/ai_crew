/* ai_crew 2D 픽셀 오피스
 *
 * state.json 하나만 읽어서 그린다. 인원 수는 로스터에서 나오므로
 * 에이전트가 늘어도 이 파일은 손댈 일이 없다.
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

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v * f)))
  );
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

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

/* ---------------- 배치 ---------------- */

const deskX = (i, n) =>
  n <= 1 ? Math.round((LW - DESK_W) / 2)
         : Math.round(MARGIN + i * ((LW - MARGIN * 2 - DESK_W) / (n - 1)));

function slot(i, n, st) {
  if (st === "working") return { x: deskX(i, n) + 14, y: 124 };
  if (st === "done")    return { x: 204 + (i % 4) * 27, y: 88 };
  return { x: 22 + (i % 4) * 24, y: 190 };
}

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

  px(16, 12, 62, 30, "#8895A6");
  px(19, 15, 56, 24, "#86C2E0");
  px(19, 15, 56, 8, "#9FD3EC");
  px(46, 15, 2, 24, "#8895A6");
  px(19, 26, 56, 2, "#8895A6");

  px(194, 10, 122, 34, "#6E5B42");
  px(197, 13, 116, 28, "#EFE9D8");
  const notes = ["#F2A65A", "#8FC7E8", "#EE8B7B", "#A8D8A0", "#D9B3E8", "#F2D06B"];
  for (let i = 0; i < Math.min(3 + doneCount, 6); i++) {
    const cx = 201 + (i % 3) * 37, cy = 17 + ((i / 3) | 0) * 12;
    px(cx, cy, 11, 9, notes[i]);
    px(cx + 2, cy + 3, 7, 1, "rgba(0,0,0,0.22)");
    px(cx + 2, cy + 5, 5, 1, "rgba(0,0,0,0.22)");
  }

  px(316, 168, 14, 14, "#9A6A4A"); px(316, 168, 14, 3, "#B07E5A");
  px(320, 150, 6, 20, "#3E7A4A"); px(315, 154, 6, 5, "#4C9159");
  px(325, 158, 6, 5, "#4C9159");  px(318, 145, 9, 6, "#57A165");

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

function render() {
  if (!actors.length) return;
  const n = actors.length;
  let done = 0;
  for (const a of actors) if (a.st === "done") done++;
  if (done !== roomKey) { drawRoom(done); roomKey = done; }

  P = oc;
  oc.clearRect(0, 0, LW, LH);
  oc.drawImage(room, 0, 0);

  for (const act of actors.slice().sort((p, q) => p.y - q.y)) {
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
}

/* ---------------- 이동 ---------------- */

const WALK_SPEED = 95;
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
let lastFrame = performance.now();

// 프레임 수가 아니라 실제 경과 시간으로 움직인다. 탭이 백그라운드에 있어
// rAF가 throttle돼도 걸음이 중간에 멈추지 않는다.
function tick(now) {
  t += Math.min(0.1, (now - lastFrame) / 1000) * 60;
  lastFrame = now;
  for (const act of actors) {
    if (!act.moving) continue;
    const p = act.dur > 0 ? Math.min(1, (now - act.t0) / (act.dur * 1000)) : 1;
    const e = ease(p);
    act.x = act.fx + (act.tx - act.fx) * e;
    act.y = act.fy + (act.ty - act.fy) * e;
    if (p >= 1) { act.x = act.tx; act.y = act.ty; act.moving = false; }
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
  $("p-status").textContent = s.label;
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
    d.textContent = w.date.slice(5);
    const b = document.createElement("span");
    b.className = "t";
    b.textContent = w.summary || `${w.items}건`;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = w.items ? `${w.items}건` : "";
    row.append(d, b, n);
    list.append(row);
  }
}

/* ---------------- 상태 적용 ---------------- */

function applyState(s, instant) {
  const n = s.agents.length;
  const now = performance.now();
  actors = s.agents.map((a, i) => {
    const prev = actors.find((x) => x.id === a.id);
    const p = slot(i, n, a.status);
    const base = {
      ...a, hair: HAIRS[i % HAIRS.length], st: a.status, desk: i,
      fx: p.x, fy: p.y, tx: p.x, ty: p.y, x: p.x, y: p.y,
      t0: now, dur: 0, moving: false,
    };
    if (prev && !instant && !reduced) {
      const d = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (d >= 0.5) {
        Object.assign(base, {
          x: prev.x, y: prev.y, fx: prev.x, fy: prev.y,
          dur: Math.min(1.2, Math.max(0.4, d / WALK_SPEED)), moving: true,
        });
      }
    }
    return base;
  });
  roomKey = null;
  if (selected >= actors.length) selected = 0;
  paintPanel();
}

/* ---------------- 입력 ---------------- */

cv.addEventListener("click", (e) => {
  const r = cv.getBoundingClientRect();
  const lx = ((e.clientX - r.left) / r.width) * LW;
  const ly = ((e.clientY - r.top) / r.height) * LH;
  let best = -1, bd = 15;
  actors.forEach((a, i) => {
    const d = Math.hypot(lx - (a.x + 6), ly - (a.y - 8));
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0) { selected = best; paintPanel(); }
});

cv.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  selected = (selected + (e.key === "ArrowRight" ? 1 : actors.length - 1)) % actors.length;
  paintPanel();
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
    // 페이지를 열어둔 채로도 근무가 시작되면 반영되도록 주기적으로 다시 읽는다
    setInterval(() => load(false).catch(() => {}), 60_000);
  })
  .catch((err) => {
    $("error").hidden = false;
    $("error").textContent = `상태를 읽지 못했습니다 — ${err.message}`;
  });
