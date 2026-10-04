// A pixel chameleon creeps along a branch under the contribution graph, snapping up
// each week with its tongue and taking on the colour of the brightest day it ate.
import type { Calendar } from "./github";

// GitHub dark-mode contribution palette, index = level.
const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const BG = "#0d1117";

export type Options = { step?: number; tagline?: string };

export const render = (cal: Calendar, { step = 0.3, tagline = "you are what you commit" }: Options = {}) => {
  const weeks = cal.weeks;

  const W = 840,
    H = 222;
  const CELL = 11,
    PITCH = 14;
  const GX = Math.round((W - (weeks.length * PITCH - 3)) / 2);
  const GY = 44;
  const BRANCH_Y = 196;
  const PX = 3; // sprite pixel size

  // Sprite, facing right. B body, S back stripe, L belly, E eye, P pupil, M mouth, C casque.
  const SPRITE = [
    "...........BBBB.............",
    ".........BSBBSBBB...CC......",
    "........BSBBSBBSBBBBCCC.....",
    ".......BBBBBBBBBBBBBBBCC....",
    "......BBBBBBBBBBBBBBBEEEB...",
    "......BBBBBBBBBBBBBBEEPEEB..",
    ".....BBBBBBBBBBBBBBBBEEEBBB.",
    "....BBLLLLLLLLLLLLBBBBBMMMMB",
    "...BB..LLLLLLLLLL..BBBBBBB..",
    "..B.........................",
    ".B..........................",
    "B..BB.......................",
    "B.B..B......................",
    "B.B..B......................",
    ".B..B.......................",
    "..BB........................",
  ];
  // Two leg frames for the creeping gait, occupying rows 9-11.
  const LEGS = [
    [".........BB.......BB........", "........B..B.....B..B.......", ".......BB..BB...BB..BB......"],
    ["..........BB.......BB.......", ".........B.B......B.B.......", "........BB.BB....BB.BB......"],
  ];
  const FEET_ROW = 12; // first row below the feet; this sits on the branch
  const SNOUT_X = 27 * PX; // tongue launches from the tip of the snout
  const SNOUT_Y = 7 * PX;

  // Timeline.
  const STEP = step; // seconds per column
  const FIRST = -3,
    LAST = weeks.length + 2;
  const WALK = (LAST - FIRST) * STEP;
  const REGROW = 2.6;
  const T = WALK + REGROW;
  const MOVE = 0.42; // fraction of a step spent moving; the rest is a pause to strike

  const pct = (t: number) => `${((t / T) * 100).toFixed(3)}%`;
  const r = (n: number) => +n.toFixed(2);
  const colX = (c: number) => GX + c * PITCH + CELL / 2;
  const chamX = (c: number) => r(colX(c) - SNOUT_X); // group x so the snout sits under column c
  const restStart = (c: number) => (c - FIRST) * STEP + MOVE * STEP;
  const strikePeak = (c: number) => restStart(c) + (1 - MOVE) * STEP * 0.42;

  const colMax = weeks.map((w) => Math.max(...w.map((d) => d.level)));
  const colTop = weeks.map((w) => w.findIndex((d) => d.level > 0)); // weekday index of the highest snack
  const weekTotals = weeks.map((w) => w.reduce((s, d) => s + d.count, 0));
  const bigWeeks = new Set(
    weekTotals
      .map((t, i) => [t, i])
      .sort((a, b) => b[0] - a[0])
      .slice(0, 7)
      .filter(([t]) => t > 0)
      .map(([, i]) => i),
  );

  const css: string[] = [];
  const svg: string[] = [];

  // Walk: creep forward, pause, creep forward. Off-screen at both ends so the loop jump is invisible.
  {
    const k: string[] = [`0%{transform:translateX(${chamX(FIRST)}px)}`];
    for (let c = FIRST + 1; c <= LAST; c++) {
      const s = (c - 1 - FIRST) * STEP + (1 - MOVE) * STEP;
      k.push(`${pct(s)}{transform:translateX(${chamX(c - 1)}px);animation-timing-function:cubic-bezier(.5,0,.3,1)}`);
      k.push(`${pct(s + MOVE * STEP)}{transform:translateX(${chamX(c)}px)}`);
    }
    k.push(`100%{transform:translateX(${chamX(LAST)}px)}`);
    css.push(`@keyframes walk{${k.join("")}}`);
    // Slight forward-back sway while creeping, the way real chameleons rock.
    css.push(`@keyframes sway{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}`);
  }

  // Tongue: one strike per non-empty week, reaching the highest lit day in that column.
  {
    const mouthY = BRANCH_Y - FEET_ROW * PX + SNOUT_Y;
    const k: string[] = ["0%{transform:scaleY(0)}"];
    const tip: string[] = ["0%{transform:translateY(0)}"];
    const full = mouthY - GY;
    weeks.forEach((_, c) => {
      if (colTop[c] < 0) return;
      const reach = (mouthY - (GY + colTop[c] * PITCH + CELL / 2)) / full;
      const a = restStart(c),
        p = strikePeak(c),
        e = restStart(c) + (1 - MOVE) * STEP * 0.95;
      k.push(
        `${pct(a)}{transform:scaleY(0);animation-timing-function:cubic-bezier(.2,.9,.3,1)}`,
        `${pct(p)}{transform:scaleY(${reach.toFixed(3)});animation-timing-function:cubic-bezier(.6,0,.9,.4)}`,
        `${pct(e)}{transform:scaleY(0)}`,
      );
      tip.push(
        `${pct(a)}{transform:translateY(0);animation-timing-function:cubic-bezier(.2,.9,.3,1)}`,
        `${pct(p)}{transform:translateY(${r(-reach * full)}px);animation-timing-function:cubic-bezier(.6,0,.9,.4)}`,
        `${pct(e)}{transform:translateY(0)}`,
      );
    });
    k.push("100%{transform:scaleY(0)}");
    tip.push("100%{transform:translateY(0)}");
    css.push(`@keyframes tongue{${k.join("")}}`, `@keyframes tip{${tip.join("")}}`);
  }

  // Skin: shifts to the brightest colour of each week it eats; empty weeks leave it unchanged.
  const START = "#3b4a3f";
  {
    const k: string[] = [`0%{fill:${START}}`];
    let current = START;
    weeks.forEach((_, c) => {
      if (colMax[c] === 0) return;
      const next = LEVELS[colMax[c]];
      if (next === current) return;
      const p = strikePeak(c) + 0.06;
      k.push(`${pct(p)}{fill:${current}}`, `${pct(p + 0.14)}{fill:${next}}`);
      current = next;
    });
    k.push(`${pct(WALK)}{fill:${current}}`, `100%{fill:${START}}`);
    css.push(`@keyframes skin{${k.join("")}}`);
  }

  // Cells: each lit day is swallowed at its column's strike, then the year grows back.
  const cells: string[] = [];
  weeks.forEach((week, c) => {
    if (colMax[c] === 0) return;
    const eat = strikePeak(c) + 0.02;
    const back = WALK + (c / weeks.length) * (REGROW - 0.7);
    css.push(
      `@keyframes e${c}{0%,${pct(eat)}{transform:scale(1);opacity:1}${pct(eat + 0.09)}{transform:scale(.2) translateY(${PITCH}px);opacity:0}` +
        `${pct(back)}{transform:scale(0);opacity:0}${pct(back + 0.25)}{transform:scale(1.25);opacity:1}${pct(back + 0.4)},100%{transform:scale(1);opacity:1}}`,
      `.e${c}{animation:e${c} ${T}s linear infinite}`,
    );
    week.forEach((d, row) => {
      if (d.level === 0) return;
      cells.push(
        `<rect class="e${c}" x="${GX + c * PITCH}" y="${GY + row * PITCH}" width="${CELL}" height="${CELL}" rx="2" fill="${LEVELS[d.level]}"/>`,
      );
    });
  });

  // "+N" pops for the biggest weeks.
  const pops: string[] = [];
  for (const c of bigWeeks) {
    const p = strikePeak(c);
    css.push(
      `@keyframes p${c}{0%,${pct(p)}{opacity:0;transform:translateY(0)}${pct(p + 0.12)}{opacity:1}${pct(p + 1.1)}{opacity:0;transform:translateY(-14px)}100%{opacity:0}}`,
    );
    pops.push(
      `<text x="${r(colX(c))}" y="${GY - 6}" text-anchor="middle" class="pop" style="animation:p${c} ${T}s linear infinite">+${weekTotals[c]}</text>`,
    );
  }

  const spritePath = (rows: string[], chars: string, yOffset = 0) => {
    let d = "";
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (chars.includes(ch)) d += `M${x * PX} ${(y + yOffset) * PX}h${PX}v${PX}h-${PX}z`;
      }),
    );
    return d;
  };

  const legFrames = LEGS.map((f, i) => `<path class="body legs l${i}" d="${spritePath(f, "B", 9)}"/>`).join("");

  const grid = weeks
    .map((w, c) =>
      w.map((_, row) => `<rect x="${GX + c * PITCH}" y="${GY + row * PITCH}" width="${CELL}" height="${CELL}" rx="2"/>`).join(""),
    )
    .join("");

  const chameleonY = BRANCH_Y - FEET_ROW * PX;
  const tongueH = chameleonY + SNOUT_Y - GY;

  // Branch: a long pixel bough with bark flecks, a few twigs and leaves.
  let bark = "",
    flecks = "",
    leaves = "";
  for (let x = 0; x < W; x += PX) {
    const y = BRANCH_Y;
    bark += `M${x} ${y}h${PX}v${PX * 2}h-${PX}z`;
    if ((x * 7) % 23 < 3) flecks += `M${x} ${y + PX}h${PX}v${PX}h-${PX}z`;
  }
  for (const [x, dir] of [
    [96, -1],
    [300, 1],
    [520, -1],
    [700, 1],
  ] as const) {
    // twig rising off the bough with a two-pixel leaf at the end
    leaves += `<path fill="#4a3a2e" d="M${x} ${BRANCH_Y - PX}h${PX}v${PX}h-${PX}zM${x + dir * PX} ${BRANCH_Y - 2 * PX}h${PX}v${PX}h-${PX}z"/>`;
    leaves += `<path fill="#2a6b3c" d="M${x + dir * 2 * PX} ${BRANCH_Y - 4 * PX}h${PX * 2}v${PX}h-${PX * 2}zM${x + dir * PX} ${BRANCH_Y - 3 * PX}h${PX * 2}v${PX}h-${PX * 2}z"/>`;
  }

  const LEG_PERIOD = STEP * 2;
  css.push(
    `.walker{animation:walk ${T}s linear infinite}`,
    `.bob{animation:sway ${STEP}s ease-in-out infinite}`,
    `.body{animation:skin ${T}s linear infinite}`,
    `.tongue{transform-box:fill-box;transform-origin:50% 100%;animation:tongue ${T}s linear infinite}`,
    `.tip{animation:tip ${T}s linear infinite}`,
    `.e0,${[...Array(weeks.length).keys()].map((c) => `.e${c}`).join(",")}{transform-box:fill-box;transform-origin:center}`,
    `@keyframes legA{0%,49.9%{opacity:1}50%,100%{opacity:0}}@keyframes legB{0%,49.9%{opacity:0}50%,100%{opacity:1}}`,
    `.l0{animation:skin ${T}s linear infinite,legA ${LEG_PERIOD}s step-end infinite}.l1{animation:skin ${T}s linear infinite,legB ${LEG_PERIOD}s step-end infinite}`,
    `.pop{font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:#39d353;opacity:0}`,
    `.label{font:600 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:#7d8590}`,
    `.label b{fill:#e6edf3}`,
  );

  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">`,
    `<style>${css.join("")}</style>`,
    `<rect width="${W}" height="${H}" rx="10" fill="${BG}"/>`,
    `<text class="label" x="${GX}" y="22"><tspan fill="#e6edf3">${cal.login.toLowerCase()}</tspan> · ${tagline}</text>`,
    `<text class="label" x="${W - GX}" y="22" text-anchor="end"><tspan fill="#39d353">${cal.total}</tspan> contributions eaten this year</text>`,
    `<g fill="${LEVELS[0]}">${grid}</g>`,
    `<g>${cells.join("")}</g>`,
    pops.join(""),
    `<path fill="#4a3a2e" d="${bark}"/><path fill="#33281f" d="${flecks}"/>`,
    leaves,
    `<g class="walker"><g transform="translate(0 ${chameleonY})"><g class="bob">`,
    `<rect class="tongue" x="${SNOUT_X - 2}" y="${SNOUT_Y - tongueH}" width="3" height="${tongueH}" fill="#e2627f"/>`,
    `<g class="tip"><rect x="${SNOUT_X - 3}" y="${SNOUT_Y - 2}" width="5" height="5" rx="2" fill="#f0809a"/></g>`,
    `<path class="body" d="${spritePath(SPRITE, "BSLEPMC")}"/>`,
    legFrames,
    `<path d="${spritePath(SPRITE, "S")}" fill="#000" opacity=".28"/>`,
    `<path d="${spritePath(SPRITE, "L")}" fill="#fff" opacity=".22"/>`,
    `<path d="${spritePath(SPRITE, "E")}" fill="#fff" opacity=".3"/>`,
    `<path d="${spritePath(SPRITE, "P")}" fill="${BG}"/>`,
    `<path d="${spritePath(SPRITE, "M")}" fill="#000" opacity=".35"/>`,
    `<path d="${spritePath(SPRITE, "C")}" fill="#fff" opacity=".12"/>`,
    `</g></g></g>`,
    `</svg>`,
  );

  return svg.join("");
};
