// csv-reader 1.0.0, the house entry, make.fun's own reference program: the harness runs `node /bot/main.ts` (node22). It reads every case from /input/cases.json (a JSON
// array of {id, input}), answers each one alone with run() from solve.js, and writes /output/answers.json: a JSON
// array of the answers, one per case and in the cases' order. An entry keeps this driver and replaces solve.js with a
// faster module whose run(input) returns the same answer for every input. Outside a container MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output.

import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its work runs under it (the rules: the house
// baseline runs with --no-incremental-marking, and an entry may tune V8's flags too).
setFlagsFromString('--no-incremental-marking');
setFlagsFromString('--single-threaded-gc');
// On Node 26 (the harness's), no TurboFan: Maglev's code reads the text about as fast, and TurboFan's compiles of the
// parser (tens of ms each, on the one CPU) cost more than they save. Node 22's Maglev is slower, so it keeps TurboFan.
if (Number(process.versions.node.split('.')[0]) >= 26) setFlagsFromString('--no-turbofan');

/** solve.js, imported by its URL (a .js module carries no types) and typed by its contract. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as { run: (input: unknown) => unknown };

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json')).toString()) as { id: string; input: unknown }[];
// Each answer is written as it is made: the file is the bytes of JSON.stringify of the answers' array, "[" then each
// answer's JSON joined by "," then "]", without holding every answer or one long string at once.
const fd = openSync(join(OUTPUT_DIR, 'answers.json'), 'w');
writeSync(fd, '[');
for (let i = 0; i < cases.length; i++) {
  if (i > 0) writeSync(fd, ',');
  writeSync(fd, JSON.stringify(run(cases[i].input) ?? null));
}
writeSync(fd, ']');
closeSync(fd);
