// A chameleon creeps along a branch under the contribution graph, snapping up each
// week with its tongue and taking on the colour of the brightest day it ate.
import type { Calendar } from "./github";

// GitHub dark-mode contribution palette, index = level.
const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const BG = "#0d1117";
const START = "#44544a"; // muted grey-green before the first bite

export type Options = { step?: number; tagline?: string };

type Pt = [number, number];
const r = (n: number) => +n.toFixed(2);
const deg = (rad: number) => (rad * 180) / Math.PI;

// Samples a chain of cubic beziers [P0, C1, C2, P1, C3, C4, P2, ...] into points with unit normals.
const sampleCubics = (pts: Pt[], perSeg: number) => {
  const out: { p: Pt; n: Pt }[] = [];
  for (let s = 0; s + 3 < pts.length; s += 3) {
    const [p0, c1, c2, p1] = [pts[s], pts[s + 1], pts[s + 2], pts[s + 3]];
    for (let i = 0; i <= perSeg; i++) {
      if (s > 0 && i === 0) continue;
      const t = i / perSeg,
        u = 1 - t;
      const p: Pt = [
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
      ];
      const d: Pt = [
        3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p1[0] - c2[0]),
        3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p1[1] - c2[1]),
      ];
      const len = Math.hypot(d[0], d[1]) || 1;
      out.push({ p, n: [-d[1] / len, d[0] / len] });
    }
  }
  return out;
};

// Tapered ribbon along a sampled centreline, width w0 at the start shrinking to w1.
const ribbon = (samples: { p: Pt; n: Pt }[], w0: number, w1: number) => {
  const n = samples.length - 1;
  const left: string[] = [],
    right: string[] = [];
  samples.forEach(({ p, n: nv }, i) => {
    const w = (w0 + (w1 - w0) * Math.pow(i / n, 0.85)) / 2;
    left.push(`${r(p[0] + nv[0] * w)} ${r(p[1] + nv[1] * w)}`);
    right.push(`${r(p[0] - nv[0] * w)} ${r(p[1] - nv[1] * w)}`);
  });
  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
};

const capsule = (len: number, w0: number, w1: number) =>
  `M0 ${-w0}L${len} ${-w1}A${w1} ${w1} 0 0 1 ${len} ${w1}L0 ${w0}A${w0} ${w0} 0 0 1 0 ${-w0}Z`;

export const render = (cal: Calendar, { step = 0.3, tagline = "you are what you commit" }: Options = {}) => {
  const weeks = cal.weeks;

  const W = 840,
    H = 236;
  const CELL = 11,
    PITCH = 14;
  const GX = Math.round((W - (weeks.length * PITCH - 3)) / 2);
  const GY = 44;
  const BRANCH_Y = 196;
  const BRANCH_H = 9;

  // ---- Chameleon geometry, in a local frame facing right with the branch top at y = BR.
  const BR = 50;
  const MOUTH: Pt = [85, 25.5]; // where the tongue leaves the mouth
  const EYE: Pt = [71, 17];
  const EYE_R = 6.6;
  const LEAD = 18; // the mouth trails the target column by this much, so the tongue angles forward
  const BODY =
    "M4 27C10 16 20 9 32 8C40 8 46 11 50 12C54 8 58 2 63 1C66 1 70 5 73 9C78 14 84 18 88 22C89 23 89 25 87 26" +
    "C80 29 72 30 66 32C60 35 54 37 46 38C36 40 22 40 12 38C8 37 4 34 4 27Z";
  const TAIL = ribbon(
    sampleCubics(
      [
        [9, 33],
        [-4, 36],
        [-16, 42],
        [-19, 54],
        [-22, 66],
        [-10, 74],
        [0, 68],
        [8, 63],
        [6, 54],
        [-3, 53],
        [-9, 52],
        [-11, 58],
        [-6, 60],
      ],
      14,
    ),
    6.5,
    1,
  );
  const TAIL_LIGHT = ribbon(
    sampleCubics(
      [
        [9, 35],
        [-3, 38],
        [-14, 44],
        [-17, 54],
        [-20, 65],
        [-10, 72],
        [0, 66],
      ],
      14,
    ),
    2.2,
    0.6,
  );
  // Dorsal crest: small spines along the back curve.
  const back = sampleCubics(
    [
      [6, 25],
      [12, 15],
      [21, 9.5],
      [32, 8],
      [40, 8],
      [46, 11],
      [50, 12],
    ],
    12,
  );
  let crest = "";
  for (let i = 2; i < back.length - 1; i += 2) {
    const { p, n } = back[i];
    const h = 1.6 + 0.6 * Math.sin((i / back.length) * Math.PI);
    crest += `M${r(p[0] - 1.1)} ${r(p[1] + 0.6)}L${r(p[0] + n[0] * h)} ${r(p[1] + n[1] * h)}L${r(p[0] + 1.1)} ${r(p[1] + 0.6)}Z`;
  }

  const LX_MIN = -24,
    LX_MAX = 90; // local extents, for off-screen entry and exit

  // ---- Legs: two-segment limbs solved by inverse kinematics so the feet plant on the branch.
  const L1 = 13,
    L2 = 12.5;
  const ANKLE_Y = BR - 3;
  const STRIDE = PITCH * 3 * 0.6; // one gait period covers three columns, feet planted 60% of it
  const legs = {
    front: { hip: [48, 29] as Pt, neutral: 50, knee: 1 },
    rear: { hip: [12, 31] as Pt, neutral: 10, knee: -1 },
  };
  const footAt = (u: number, neutral: number, lift: number): Pt => {
    const pf = 0.6;
    if (u < pf) return [neutral + STRIDE / 2 - (u / pf) * STRIDE, ANKLE_Y];
    const s = (u - pf) / (1 - pf);
    const e = s * s * (3 - 2 * s);
    return [neutral - STRIDE / 2 + e * STRIDE, ANKLE_Y - lift * Math.sin(Math.PI * s)];
  };
  const solveLeg = (kind: keyof typeof legs, samples: number) => {
    const { hip, neutral, knee } = legs[kind];
    const thigh: number[] = [],
      shin: number[] = [],
      foot: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const [fx, fy] = footAt((i % samples) / samples, neutral, 5);
      const dx = fx - hip[0],
        dy = fy - hip[1];
      const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(L1 - L2) + 0.5), L1 + L2 - 0.3);
      const a = Math.atan2(dy, dx);
      const b = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
      const t1 = a - knee * b;
      const kx = hip[0] + L1 * Math.cos(t1),
        ky = hip[1] + L1 * Math.sin(t1);
      const t2 = Math.atan2(fy - ky, fx - kx);
      thigh.push(r(deg(t1)));
      shin.push(r(deg(t2 - t1)));
      foot.push(r(-deg(t2)));
    }
    return { thigh, shin, foot };
  };

  // ---- Timeline.
  const STEP = step;
  const v = PITCH / STEP; // px per second
  const P = 3 * STEP; // gait period
  const LAUNCH = 0.05,
    HOLD = 0.085,
    RET = 0.215,
    WASH = 0.5,
    REGROW = 2.6;
  const colX = (c: number) => GX + c * PITCH + CELL / 2;
  const xStart = r(-LX_MAX - 6);
  const walkerX = (c: number) => colX(c) - LEAD - MOUTH[0];
  const tAt = (c: number) => (walkerX(c) - xStart) / v;
  const lastLit = weeks.reduce((m, w, c) => (w.some((d) => d.level > 0) ? c : m), 0);
  const walkEnd = (W - LX_MIN + 6 - xStart) / v;
  const regrowStart = tAt(lastLit) + 1.1;
  const T = r(Math.ceil(Math.max(walkEnd, regrowStart + REGROW + 0.3) / P) * P);
  const xEnd = r(xStart + v * T);
  const pct = (t: number) => `${((t / T) * 100).toFixed(3)}%`;
  const groundY = BRANCH_Y - BR;

  const colMax = weeks.map((w) => Math.max(...w.map((d) => d.level)));
  const colTop = weeks.map((w) => w.findIndex((d) => d.level > 0));
  const weekTotals = weeks.map((w) => w.reduce((s, d) => s + d.count, 0));
  const bigWeeks = new Set(
    weekTotals
      .map((t, i) => [t, i])
      .sort((a, b) => b[0] - a[0])
      .slice(0, 7)
      .filter(([t]) => t > 0)
      .map(([, i]) => i),
  );
  const lit = weeks.map((_, c) => c).filter((c) => colTop[c] >= 0);

  const css: string[] = [];
  const defs: string[] = [];

  css.push(`@keyframes walk{0%{transform:translateX(${xStart}px)}100%{transform:translateX(${xEnd}px)}}`);

  // Strike: the tongue is aimed where the target will be relative to the mouth mid-hold.
  const aimAt = (c: number) => {
    const t = tAt(c) + (LAUNCH + HOLD) / 2;
    const mx = xStart + v * t + MOUTH[0],
      my = groundY + MOUTH[1];
    const tx = colX(c),
      ty = GY + colTop[c] * PITCH + CELL / 2;
    const dx = tx - mx,
      dy = my - ty;
    return { angle: r(deg(Math.atan2(dx, dy))), len: r(Math.hypot(dx, dy)), tx, ty };
  };
  {
    const shaft = ["0%{transform:scaleY(0)}"],
      tip = ["0%{transform:translateY(0) scale(0)}"],
      aim = ["0%{transform:rotate(0deg)}"],
      pupil: string[] = [],
      jaw = ["0%{transform:scaleY(0)}"],
      gulp = ["0%{transform:translateY(0) scale(.2)}"],
      nod = ["0%{transform:translateY(0)}"];
    const out = "cubic-bezier(.1,.9,.2,1)",
      back = "cubic-bezier(.55,0,.45,1)";
    const eyeRest = "translate(2.3px,-1.2px)";
    pupil.push(`0%{transform:${eyeRest}}`);
    for (const c of lit) {
      const t = tAt(c);
      const { angle, len, tx, ty } = aimAt(c);
      shaft.push(
        `${pct(t)}{transform:scaleY(0);animation-timing-function:${out}}`,
        `${pct(t + LAUNCH)}{transform:scaleY(${len})}`,
        `${pct(t + HOLD)}{transform:scaleY(${len});animation-timing-function:${back}}`,
        `${pct(t + RET)}{transform:scaleY(0)}`,
      );
      tip.push(
        `${pct(t)}{transform:translateY(0) scale(0);animation-timing-function:${out}}`,
        `${pct(t + LAUNCH)}{transform:translateY(${-len}px) scale(1)}`,
        `${pct(t + HOLD)}{transform:translateY(${-len}px) scale(1);animation-timing-function:${back}}`,
        `${pct(t + RET)}{transform:translateY(0) scale(0)}`,
      );
      aim.push(`${pct(t - 0.04)}{transform:rotate(${angle}deg);animation-timing-function:step-end}`);
      // Eye turret swivels onto the target ahead of the strike.
      const ex = tx - (xStart + v * t + EYE[0]),
        ey = ty - (groundY + EYE[1]);
      const el = Math.hypot(ex, ey) || 1;
      const look = `translate(${r((ex / el) * 2.8)}px,${r((ey / el) * 2.8)}px)`;
      pupil.push(`${pct(t - 0.03)}{transform:${look}}`, `${pct(t + 0.12)}{transform:${look}}`);
      jaw.push(
        `${pct(t - 0.03)}{transform:scaleY(0)}`,
        `${pct(t + 0.02)}{transform:scaleY(1)}`,
        `${pct(t + 0.15)}{transform:scaleY(1)}`,
        `${pct(t + 0.26)}{transform:scaleY(0)}`,
      );
      gulp.push(
        `${pct(t + 0.2)}{transform:translateY(0) scale(.2)}`,
        `${pct(t + 0.27)}{transform:translateY(1.5px) scale(1)}`,
        `${pct(t + 0.38)}{transform:translateY(3px) scale(.2)}`,
      );
      nod.push(`${pct(t + 0.2)}{transform:translateY(0)}`, `${pct(t + 0.27)}{transform:translateY(1.4px)}`, `${pct(t + 0.37)}{transform:translateY(0)}`);
    }
    pupil.push(`${pct(tAt(lastLit) + 0.6)}{transform:${eyeRest}}`, `100%{transform:${eyeRest}}`);
    shaft.push("100%{transform:scaleY(0)}");
    tip.push("100%{transform:translateY(0) scale(0)}");
    jaw.push("100%{transform:scaleY(0)}");
    gulp.push("100%{transform:translateY(0) scale(.2)}");
    nod.push("100%{transform:translateY(0)}");
    css.push(
      `@keyframes shaft{${shaft.join("")}}`,
      `@keyframes tip{${tip.join("")}}`,
      `@keyframes aim{${aim.join("")}}`,
      `@keyframes pupil{${pupil.join("")}}`,
      `@keyframes jaw{${jaw.join("")}}`,
      `@keyframes gulp{${gulp.join("")}}`,
      `@keyframes nod{${nod.join("")}}`,
    );
  }

  // Skin: a wash of the new colour sweeps from head to tail after each bite. The base layer
  // holds the old colour until the sweep has covered it; the sweep layer carries the new one.
  {
    const changes: { s: number; e: number; from: string; to: string }[] = [];
    let current = START;
    for (const c of lit) {
      const next = LEVELS[colMax[c]];
      if (next === current) continue;
      changes.push({ s: tAt(c) + 0.2, e: 0, from: current, to: next });
      current = next;
    }
    changes.forEach((ch, i) => {
      const limit = i + 1 < changes.length ? changes[i + 1].s - 0.03 : Infinity;
      ch.e = Math.min(ch.s + WASH, limit);
    });
    const hold = "animation-timing-function:step-end";
    const a = [`0%{fill:${START};${hold}}`],
      b = [`0%{fill:${START};${hold}}`],
      sweep = ["0%{transform:scaleX(0)}"],
      fade = [`0%{fill:${START}}`],
      tail = [`0%{fill:${START}}`];
    for (const ch of changes) {
      a.push(`${pct(ch.e)}{fill:${ch.to};${hold}}`);
      b.push(`${pct(ch.s)}{fill:${ch.to};${hold}}`);
      sweep.push(`${pct(ch.s)}{transform:scaleX(0);animation-timing-function:cubic-bezier(.3,0,.3,1)}`, `${pct(ch.e)}{transform:scaleX(1);${hold}}`);
      fade.push(`${pct(ch.s)}{fill:${ch.from}}`, `${pct(ch.e)}{fill:${ch.to}}`);
      tail.push(`${pct(ch.s + (ch.e - ch.s) * 0.45)}{fill:${ch.from}}`, `${pct(ch.e)}{fill:${ch.to}}`);
    }
    const end = pct(T - 0.3);
    a.push(`100%{fill:${START}}`);
    b.push(`100%{fill:${START}}`);
    sweep.push(`100%{transform:scaleX(0)}`);
    fade.push(`${end}{fill:${current}}`, `100%{fill:${START}}`);
    tail.push(`${end}{fill:${current}}`, `100%{fill:${START}}`);
    css.push(
      `@keyframes skinA{${a.join("")}}`,
      `@keyframes skinB{${b.join("")}}`,
      `@keyframes sweep{${sweep.join("")}}`,
      `@keyframes skinC{${fade.join("")}}`,
      `@keyframes skinT{${tail.join("")}}`,
    );
  }

  // Cells: each lit column is carried down with the tongue, shrinking into the mouth, then regrows.
  const cells: string[] = [];
  for (const c of lit) {
    const t = tAt(c);
    const mx = xStart + v * (t + RET) + MOUTH[0],
      my = groundY + MOUTH[1];
    const dx = r(mx - colX(c)),
      dy = r(my - (GY + colTop[c] * PITCH + CELL / 2));
    const grow = regrowStart + (c / weeks.length) * (REGROW - 0.7);
    css.push(
      `@keyframes e${c}{0%,${pct(t + HOLD)}{transform:translate(0,0) scale(1);opacity:1;animation-timing-function:cubic-bezier(.55,0,.45,1)}` +
        `${pct(t + HOLD + (RET - HOLD) * 0.7)}{opacity:1}` +
        `${pct(t + RET)}{transform:translate(${dx}px,${dy}px) scale(.12);opacity:0}` +
        `${pct(grow)}{transform:translate(0,0) scale(.3);opacity:0;animation-timing-function:cubic-bezier(.2,.8,.3,1.3)}` +
        `${pct(grow + 0.35)}{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(0,0) scale(1);opacity:1}}`,
      `.e${c}{animation:e${c} ${T}s linear infinite;transform-box:fill-box;transform-origin:50% ${CELL / 2}px}`,
    );
    const rects = weeks[c]
      .map((d, row) => (d.level ? `<rect x="${GX + c * PITCH}" y="${GY + row * PITCH}" width="${CELL}" height="${CELL}" rx="2" fill="${LEVELS[d.level]}"/>` : ""))
      .join("");
    cells.push(`<g class="e${c}">${rects}</g>`);
  }

  // "+N" pops for the biggest weeks.
  const pops: string[] = [];
  for (const c of bigWeeks) {
    const p = tAt(c) + HOLD;
    css.push(`@keyframes p${c}{0%,${pct(p)}{opacity:0;transform:translateY(0)}${pct(p + 0.12)}{opacity:1}${pct(p + 1.1)}{opacity:0;transform:translateY(-9px)}100%{opacity:0}}`);
    pops.push(`<text x="${r(colX(c))}" y="${GY - 6}" text-anchor="middle" class="pop" style="animation:p${c} ${T}s linear infinite">+${weekTotals[c]}</text>`);
  }

  const grid = weeks
    .map((w, c) => w.map((_, row) => `<rect x="${GX + c * PITCH}" y="${GY + row * PITCH}" width="${CELL}" height="${CELL}" rx="2"/>`).join(""))
    .join("");

  // ---- Branch: a bough with bark shading, a few twigs and leaves.
  const by = BRANCH_Y;
  let branch = `<path d="M-10 ${by + 0.5}C120 ${by - 1.5} 300 ${by + 1.5} 420 ${by}S720 ${by - 1.5} ${W + 10} ${by + 0.5}V${by + BRANCH_H + 1}C600 ${by + BRANCH_H - 1} 300 ${by + BRANCH_H + 1} -10 ${by + BRANCH_H}Z" fill="url(#bark)"/>`;
  branch += `<path d="M20 ${by + 3.5}Q120 ${by + 5} 230 ${by + 3}M330 ${by + 6}Q450 ${by + 7.5} 560 ${by + 5.5}M600 ${by + 3}Q700 ${by + 2} 820 ${by + 4}" fill="none" stroke="#2c221a" stroke-width=".9" opacity=".7"/>`;
  branch += `<path d="M0 ${by + 1.2}Q420 ${by + 2.6} ${W} ${by + 1.2}" fill="none" stroke="#6b5542" stroke-width=".8" opacity=".55"/>`;
  for (const [x, dir] of [
    [104, -1],
    [318, 1],
    [540, -1],
    [742, 1],
  ] as const) {
    const tx = x + dir * 9,
      ty = by - 13;
    branch += `<path d="M${x} ${by + 1}Q${x + dir * 3} ${by - 6} ${tx} ${ty}" fill="none" stroke="#4a3a2e" stroke-width="2" stroke-linecap="round"/>`;
    const leaf = (lx: number, ly: number, rot: number, s: number) =>
      `<g transform="translate(${lx} ${ly}) rotate(${rot}) scale(${s})"><path d="M0 0C3 -5 10 -5 14 0C10 5 3 5 0 0Z" fill="#2f7a44"/><path d="M1 0H13" stroke="#5fbf72" stroke-width=".7" opacity=".6"/></g>`;
    branch += leaf(tx, ty, dir > 0 ? -35 : -145, 1) + leaf(tx - dir * 2, ty + 4, dir > 0 ? 20 : 160, 0.8);
  }

  // ---- Chameleon parts.
  const legMarkup = (kind: keyof typeof legs, phase: number, far: boolean) => {
    const { hip } = legs[kind];
    const ik = solveLeg(kind, 24);
    const shade = far ? `<path d="${capsule(L1, 2.8, 2.2)}" fill="#000" opacity=".3"/>` : "";
    const shadeS = far ? `<path d="${capsule(L2, 2.1, 1.7)}" fill="#000" opacity=".3"/>` : "";
    const shadeF = far ? `<path d="${FOOT}" fill="#000" opacity=".3"/>` : "";
    const anim = (vals: number[]) =>
      `<animateTransform attributeName="transform" type="rotate" additive="sum" values="${vals.join(";")}" dur="${P}s" begin="${r(-phase * P)}s" repeatCount="indefinite"/>`;
    const off = far ? "translate(2 -1.5)" : "";
    return (
      `<g transform="${off} translate(${hip[0]} ${hip[1]})">${anim(ik.thigh)}<path class="skinC" d="${capsule(L1, 2.8, 2.2)}"/>${shade}` +
      `<g transform="translate(${L1} 0)">${anim(ik.shin)}<path class="skinC" d="${capsule(L2, 2.1, 1.7)}"/>${shadeS}` +
      `<g transform="translate(${L2} 0)">${anim(ik.foot)}<path class="skinC" d="${FOOT}"/>${shadeF}</g></g></g>`
    );
  };
  const FOOT = "M-3.4 -1.4Q-4.6 1.8 -3 4.6Q-1.6 6.2 -.6 3.6L0 1.6L.6 3.6Q1.6 6.2 3 4.6Q4.6 1.8 3.4 -1.4Q0 -3.6 -3.4 -1.4Z";

  defs.push(
    `<clipPath id="cb"><path d="${BODY}"/><path d="${crest}"/></clipPath>`,
    `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>`,
    `<linearGradient id="bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4736"/><stop offset=".5" stop-color="#46362a"/><stop offset="1" stop-color="#2a2019"/></linearGradient>`,
  );

  const dots = [
    [18, 24],
    [24, 17],
    [30, 27],
    [36, 15],
    [40, 24],
    [46, 19],
    [52, 27],
    [58, 21],
    [62, 14],
    [66, 8],
    [78, 16],
    [22, 32],
    [44, 31],
    [34, 34],
    [14, 31],
    [56, 33],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`)
    .join("");
  const bands = `<path d="M15 6L22 6L28 44L21 44ZM31 6L37 6L43 44L37 44ZM47 6L52 6L58 44L52 44Z"/>`;

  const rock =
    `<animateTransform attributeName="transform" type="translate" values="-1.3 0;1.3 0;-1.3 0" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${r(P / 2)}s" begin="${r(-0.2 * P)}s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="rotate" additive="sum" values="-.9 27 ${BR};.9 27 ${BR};-.9 27 ${BR}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${r(P / 2)}s" begin="${r(-0.2 * P - P / 8)}s" repeatCount="indefinite"/>`;
  const tailSway = `<animateTransform attributeName="transform" type="rotate" values="-2 9 33;2 9 33;-2 9 33" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${P}s" repeatCount="indefinite"/>`;

  const chameleon =
    `<g class="walker"><g transform="translate(0 ${groundY})">` +
    legMarkup("front", 0.5, true) +
    legMarkup("rear", 0, true) +
    `<g>${rock}<g class="nod">` +
    `<g>${tailSway}<path class="skinT" d="${TAIL}"/><path d="${TAIL_LIGHT}" fill="#fff" opacity=".14"/><path d="${TAIL}" fill="url(#shade)" opacity=".5"/></g>` +
    `<ellipse class="skinC gulp" cx="61" cy="34.5" rx="5" ry="3.8"/>` +
    `<path class="skinA" d="${BODY}"/><path class="skinA" d="${crest}"/>` +
    `<g clip-path="url(#cb)"><path class="skinB sweep" d="M-30 -4H96L104 56H-30Z"/></g>` +
    `<path d="${BODY}" fill="url(#shade)"/>` +
    `<g clip-path="url(#cb)"><g fill="#000" opacity=".09">${bands}</g><g fill="#fff" opacity=".16">${dots}</g>` +
    `<path d="M14 30C26 26 40 25 56 27" fill="none" stroke="#fff" stroke-width="2.6" opacity=".08" stroke-linecap="round"/></g>` +
    `<path d="M52 11C56 6 60 2.5 63.5 1.6" fill="none" stroke="#fff" stroke-width="1" opacity=".22" stroke-linecap="round"/>` +
    `<path d="M87 25Q78 29 69 28.5Q67.5 28.4 66.5 27.2" fill="none" stroke="#000" stroke-width="1" opacity=".45" stroke-linecap="round"/>` +
    `<circle cx="85.5" cy="21.5" r=".55" fill="#000" opacity=".4"/>` +
    `<g transform="translate(69 28)"><path class="jaw" d="M0 0L16.5 -4.4L17 -1Z" fill="#1a0f14"/></g>` +
    `<g transform="translate(${MOUTH[0]} ${MOUTH[1]})"><g class="aim">` +
    `<path class="shaft" d="M-2.2 0L-1.3 -1L1.3 -1L2.2 0Z" fill="#d9587a"/>` +
    `<g class="tip"><ellipse rx="3.4" ry="4.2" fill="#f08aa5"/><ellipse cx="-.9" cy="-1.3" rx="1.1" ry="1.4" fill="#fff" opacity=".45"/></g>` +
    `</g></g>` +
    `<circle class="skinC" cx="${EYE[0]}" cy="${EYE[1]}" r="${EYE_R}"/>` +
    `<circle cx="${EYE[0]}" cy="${EYE[1]}" r="${EYE_R}" fill="#000" opacity=".14"/>` +
    `<circle cx="${EYE[0]}" cy="${EYE[1]}" r="${EYE_R - 1.6}" fill="none" stroke="#fff" stroke-width=".6" opacity=".16"/>` +
    `<circle cx="${EYE[0]}" cy="${EYE[1]}" r="${EYE_R - 3.4}" fill="none" stroke="#fff" stroke-width=".6" opacity=".12"/>` +
    `<g transform="translate(${EYE[0]} ${EYE[1]})"><g class="pupil"><circle r="2.5" fill="#fff" opacity=".2"/><circle r="1.5" fill="#0a0d12"/><circle cx="-.5" cy="-.5" r=".45" fill="#fff" opacity=".8"/></g></g>` +
    `</g></g>` +
    legMarkup("rear", 0.5, false) +
    legMarkup("front", 0, false) +
    `</g></g>`;

  css.push(
    `.walker{animation:walk ${T}s linear infinite}`,
    `.nod{animation:nod ${T}s linear infinite}`,
    `.skinA{animation:skinA ${T}s linear infinite}`,
    `.skinB{animation:skinB ${T}s linear infinite}`,
    `.skinC{animation:skinC ${T}s linear infinite}`,
    `.skinT{animation:skinT ${T}s linear infinite}`,
    `.sweep{transform-box:fill-box;transform-origin:100% 50%;animation:sweep ${T}s linear infinite,skinB ${T}s linear infinite}`,
    `.shaft{transform-box:fill-box;transform-origin:50% 100%;animation:shaft ${T}s linear infinite}`,
    `.tip{animation:tip ${T}s linear infinite}`,
    `.aim{animation:aim ${T}s linear infinite}`,
    `.pupil{animation:pupil ${T}s ease-in-out infinite}`,
    `.jaw{transform-box:fill-box;transform-origin:0% 50%;animation:jaw ${T}s ease-in-out infinite}`,
    `.gulp{transform-box:fill-box;transform-origin:50% 0%;animation:gulp ${T}s ease-in-out infinite,skinC ${T}s linear infinite}`,
    `.pop{font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:#39d353;opacity:0}`,
    `.label{font:600 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:#7d8590}`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<style>${css.join("")}</style>`,
    `<defs>${defs.join("")}</defs>`,
    `<rect width="${W}" height="${H}" rx="10" fill="${BG}"/>`,
    `<text class="label" x="${GX}" y="22"><tspan fill="#e6edf3">${cal.login.toLowerCase()}</tspan> · ${tagline}</text>`,
    `<text class="label" x="${W - GX}" y="22" text-anchor="end"><tspan fill="#39d353">${cal.total}</tspan> contributions eaten this year</text>`,
    `<g fill="${LEVELS[0]}">${grid}</g>`,
    `<g>${cells.join("")}</g>`,
    pops.join(""),
    branch,
    chameleon,
    `</svg>`,
  ].join("");
};
