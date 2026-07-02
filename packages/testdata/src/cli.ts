#!/usr/bin/env node
/**
 * @opendpp/testdata CLI — `npx @opendpp/testdata <category|all> [flags]`.
 *
 * Prints synthetic sample data to stdout: the public passport-create JSON (default), CSV
 * under the category's official template header, or EPCIS-shaped event chains. Fully
 * deterministic — the same seed prints the same bytes on every machine.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import process from "node:process";
import { ESPR_CATEGORIES, isEsprCategory, type EsprCategory, type PassportCreateInput } from "@opendpp/csv";
import { DEFAULT_SEED, generatePassports, type GeneratePassportsOptions } from "./passports.js";
import { generateEventChain } from "./events.js";
import { passportsToCsv } from "./csv.js";
import { MAX_ITEMS_PER_CATEGORY, TESTDATA_GS1_PREFIX } from "./identifiers.js";

const USAGE = `Usage: opendpp-testdata <category|all> [options]

Generate deterministic synthetic sample data for the OpenDPP API (marked "(SAMPLE)",
fictional GS1 prefix ${TESTDATA_GS1_PREFIX} — never real products or operators).

Categories: ${ESPR_CATEGORIES.join(", ")} — or "all" (json format only).

Options:
  -c, --count <n>        Samples per category (default 5, max ${MAX_ITEMS_PER_CATEGORY})
  -s, --seed <value>     Deterministic seed (default ${DEFAULT_SEED}); same seed, same output
  -f, --format <fmt>     json | csv | events (default json)
      --prefix <digits>  10-digit GS1 company prefix for minted GTINs
      --operator-id <id> Bind samples to your workspace's economic operator
      --facility-id <id> Link your Facility id (what makes a passport vcReady)
  -h, --help             Show this help

Examples:
  opendpp-testdata batteries --count 10                 # POST-ready passport JSON
  opendpp-testdata textiles --format csv > textiles.csv # portal-importable CSV
  opendpp-testdata batteries --format events            # EPCIS-shaped event chains
`;

interface CliArgs {
  category: string;
  count: number;
  seed: string | number;
  format: "json" | "csv" | "events";
  prefix?: string;
  operatorId?: string;
  facilityId?: string;
}

function fail(message: string): never {
  process.stderr.write(`opendpp-testdata: ${message}\n\nRun with --help for usage.\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { category: "", count: 5, seed: DEFAULT_SEED, format: "json" };
  const takeValue = (flag: string, i: number): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("-")) fail(`${flag} needs a value.`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      case "-c":
      case "--count": {
        const n = Number(takeValue(a, i++));
        if (!Number.isInteger(n)) fail(`--count must be an integer, got "${argv[i]}".`);
        args.count = n;
        break;
      }
      case "-s":
      case "--seed": {
        const v = takeValue(a, i++);
        args.seed = /^-?\d+$/.test(v) ? Number(v) : v;
        break;
      }
      case "-f":
      case "--format": {
        const v = takeValue(a, i++);
        if (v !== "json" && v !== "csv" && v !== "events") fail(`--format must be json, csv or events, got "${v}".`);
        args.format = v;
        break;
      }
      case "--prefix":
        args.prefix = takeValue(a, i++);
        break;
      case "--operator-id":
        args.operatorId = takeValue(a, i++);
        break;
      case "--facility-id":
        args.facilityId = takeValue(a, i++);
        break;
      default:
        if (a.startsWith("-")) fail(`Unknown option "${a}".`);
        if (args.category) fail(`Unexpected extra argument "${a}".`);
        args.category = a;
    }
  }
  if (!args.category) fail("Missing <category>.");
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const categories: EsprCategory[] =
    args.category === "all"
      ? [...ESPR_CATEGORIES]
      : isEsprCategory(args.category)
        ? [args.category]
        : fail(`Unknown category "${args.category}" — one of: ${ESPR_CATEGORIES.join(", ")}, all.`);
  if (args.category === "all" && args.format !== "json") {
    fail(`--format ${args.format} needs a single category (per-category columns/chains).`);
  }

  const generate = (category: EsprCategory): PassportCreateInput[] => {
    const opts: GeneratePassportsOptions = { category, count: args.count, seed: args.seed };
    if (args.prefix !== undefined) opts.companyPrefix = args.prefix;
    if (args.operatorId !== undefined) opts.operatorId = args.operatorId;
    if (args.facilityId !== undefined) opts.facilityId = args.facilityId;
    return generatePassports(opts);
  };

  if (args.format === "csv") {
    process.stdout.write(passportsToCsv(categories[0], generate(categories[0])));
    return;
  }
  const passports = categories.flatMap(generate);
  if (args.format === "events") {
    const chains = passports.map((p) => ({
      productId: p.productId,
      events: generateEventChain(p, args.prefix !== undefined ? { seed: args.seed, companyPrefix: args.prefix } : { seed: args.seed }),
    }));
    process.stdout.write(JSON.stringify(chains, null, 2) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify(passports, null, 2) + "\n");
}

main();
