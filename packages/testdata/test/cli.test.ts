// @opendpp/testdata CLI smoke test — runs the tsx-loaded src/cli.ts as a child process
// (Apache-2.0, (c) Opendpp UAB).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { passportCsvTemplateHeader } from "@opendpp/csv";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const run = (...args: string[]): string =>
  execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: pkgRoot,
    encoding: "utf8",
  });

test("json output is POST-ready and deterministic", () => {
  const out = run("batteries", "--count", "2");
  const passports = JSON.parse(out);
  assert.equal(passports.length, 2);
  assert.match(passports[0].productId, /^\d{14}$/);
  assert.equal(passports[0].metadata.category, "batteries");
  assert.equal(run("batteries", "--count", "2"), out, "same seed must print the same bytes");
  assert.notEqual(run("batteries", "--count", "2", "--seed", "7"), out);
});

test("csv output carries the official template header; events output carries chains", () => {
  const csv = run("textiles", "--count", "1", "--format", "csv");
  assert.equal(csv.split("\n")[0], passportCsvTemplateHeader("textiles"));
  const chains = JSON.parse(run("toys", "--count", "1", "--format", "events"));
  assert.equal(chains[0].events.length, 4);
  assert.equal(chains[0].events[1].action, null);
});

test("bad input exits non-zero with a pointer to --help", () => {
  assert.throws(() => run("spaceships"), /Unknown category/);
  assert.throws(() => run("all", "--format", "csv"), /single category/);
  assert.throws(() => run("toys", "--format", "yaml"), /--format must be/);
});
