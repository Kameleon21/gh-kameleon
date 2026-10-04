#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { fetchCalendar } from "./github";
import { render } from "./render";

const { values } = parseArgs({
  options: {
    username: { type: "string", short: "u" },
    output: { type: "string", short: "o", default: "kameleon.svg" },
    step: { type: "string", default: "0.3" },
    tagline: { type: "string", default: "you are what you commit" },
  },
});

if (!values.username) {
  console.error("Usage: bun src/cli.ts --username <login> [--output kameleon.svg] [--step 0.3] [--tagline text]");
  process.exit(1);
}

const cal = await fetchCalendar(values.username);
const svg = render(cal, { step: Number(values.step), tagline: values.tagline });
await Bun.write(values.output!, svg);
console.log(`${values.output}: ${cal.total} contributions, ${(svg.length / 1024).toFixed(1)}KB`);
