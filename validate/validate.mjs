#!/usr/bin/env node
/**
 * OpenDPP interop conformance validator — the runnable core of this boundary kit.
 *
 * Validate an AAS Environment, a UNTP DigitalProductPassport credential, or a CIRPASS-2 EU-registry
 * pointer YOU produce against the SAME official/reference, vendored JSON Schemas OpenDPP's own CI
 * validates against (see ../schemas/), so you can prove conformance offline before you ship — without
 * any access to the OpenDPP product source.
 *
 *   node validate.mjs aas         path/to/aas-environment.json
 *   node validate.mjs untp        path/to/dpp-credential.json
 *   node validate.mjs semanticids path/to/aas-environment.json       [--strict]
 *   node validate.mjs registry    path/to/eu-registry-pointer.json   (CIRPASS-2, NON-NORMATIVE)
 *   node validate.mjs shacl       path/to/passport.jsonld            (OpenDPP SHACL, NON-NORMATIVE)
 *
 * Exit codes: 0 = conformant · 1 = schema/shape errors (printed) · 2 = usage / read error.
 *
 * NOTE: `aas`/`untp`/`registry` check STRUCTURAL conformance against the JSON Schema. `semanticids` checks IDTA
 * template IDENTITY only — it classifies each `semanticId` against the CC-BY IDTA allowlist
 * (../idta-semantic-ids.json), never structural conformance to the template body. `shacl` validates the
 * OpenDPP `application/ld+json` passport against OpenDPP's OWN, NON-NORMATIVE SHACL shapes
 * (../shapes/opendpp-dpp-shapes.ttl) — a starter contribution offered to CIRPASS-2, NOT an EU/CIRPASS-2
 * conformance oracle. Verifying a `vc+jwt` SIGNATURE (resolve did:web → verify the JWS → validate the
 * payload) is a separate concern — see the README recipe ("Verify a signature"), which uses only
 * standard WebCrypto / JOSE, no OpenDPP code.
 *
 * Apache-2.0 © OpenDPP UAB. The vendored schemas in ../schemas/ retain their upstream terms (see NOTICE).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { classifyAasFile, VERDICTS } from "./semantic-ids.mjs";
import { validateShaclFile } from "./shacl.mjs";

const SCHEMAS = {
  // AAS v3.0: official IDTA-01001-3-1 JSON Schema (draft-2019-09).
  aas: { file: "aas-v3.schema.json", Ajv: Ajv2019, label: "AAS v3.0 Environment (IDTA-01001-3-1)" },
  // UNTP DigitalProductPassport v0.7.0 (draft-2020-12).
  untp: { file: "untp-dpp-v0.7.0.schema.json", Ajv: Ajv2020, label: "UNTP DigitalProductPassport v0.7.0" },
  // CIRPASS-2 mock-eu-registry pointer (ESPR Art. 13 index record), draft-2020-12. NON-NORMATIVE reference.
  registry: { file: "cirpass2-eu-registry-pointer.schema.json", Ajv: Ajv2020, label: "CIRPASS-2 EU registry pointer (default-schema.json)" },
};

export const INTEROP_KINDS = Object.keys(SCHEMAS);
// Schema-validated kinds + the identity-only semanticId classifier + the SHACL shapes door (no ajv).
export const ALL_KINDS = [...INTEROP_KINDS, "semanticids", "shacl"];

/** Validate `data` of the given `kind` ("aas" | "untp"). Returns { valid, label, errors }. */
export function validateInterop(kind, data) {
  const spec = SCHEMAS[kind];
  if (!spec) throw new Error(`unknown kind "${kind}" — expected one of: ${INTEROP_KINDS.join(" | ")}`);
  const schemaUrl = new URL(`../schemas/${spec.file}`, import.meta.url);
  const schema = JSON.parse(readFileSync(schemaUrl, "utf8"));
  const ajv = new spec.Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = !!validate(data);
  return { valid, label: spec.label, errors: validate.errors ?? [] };
}

// --- CLI -----------------------------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const strict = argv.includes("--strict");
  const [kind, file] = argv.filter((a) => a !== "--strict");
  if (!kind || !file || !ALL_KINDS.includes(kind)) {
    console.error(`usage: node validate.mjs <${ALL_KINDS.join("|")}> <file> [--strict]`);
    process.exit(2);
  }

  // --- SHACL door (JSON-LD → RDF + SHACL shapes; NOT a JSON-Schema kind) --------------------------
  if (kind === "shacl") {
    let report;
    try {
      report = await validateShaclFile(resolve(file));
    } catch (e) {
      console.error(`could not validate ${file}: ${e?.message ?? e}`);
      process.exit(2);
    }
    console.log(`OpenDPP SHACL shapes (NON-NORMATIVE, starter) — ${file}:`);
    for (const v of report.violations) {
      const where = v.focusNode ? ` @ ${v.focusNode}` : "";
      const path = v.path ? ` [${v.path}]` : "";
      const val = v.value !== undefined ? ` (value: ${v.value})` : "";
      console.log(`  ✗ ${v.severity}${path}${where}: ${v.message}${val}`);
    }
    if (report.conforms) {
      console.log(`\n✓ CONFORMS — OpenDPP DigitalProductPassport SHACL shapes (${report.dataTriples} triples).`);
      process.exit(0);
    }
    console.error(`\n✗ NON-CONFORMING — ${report.violations.length} violation(s).`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(resolve(file), "utf8"));
  } catch (e) {
    console.error(`could not read/parse ${file}: ${e?.message ?? e}`);
    process.exit(2);
  }

  if (kind === "semanticids") {
    const { counts, items, allowlistRef } = classifyAasFile(data);
    console.log(`semanticId identity — ${file} (IDTA allowlist ${allowlistRef.slice(0, 7)}):`);
    for (const it of items) console.log(`  ${it.verdict.padEnd(20)} ${it.iri}`);
    console.log(`\n  ${VERDICTS.map((v) => `${v}:${counts[v]}`).join("  ")}`);
    const deprecated = items.filter((it) => it.verdict === "idta-deprecated");
    const unverified = items.filter((it) => it.unverifiedIdta);
    if (deprecated.length || unverified.length) {
      console.log(`\n  ⚠ ${unverified.length} unverified IDTA-namespace id(s); ${deprecated.length} deprecated IDTA id(s).`);
      if (strict) {
        console.error(`✗ STRICT — an IDTA-namespace semanticId is deprecated or absent from the allowlist.`);
        process.exit(1);
      }
    }
    console.log(`✓ classified ${items.length} semanticId(s) (identity only; not structural conformance).`);
    process.exit(0);
  }

  const { valid, label, errors } = validateInterop(kind, data);
  if (valid) {
    console.log(`✓ VALID — ${label} (${file})`);
    process.exit(0);
  }
  console.error(`✗ INVALID — ${label} (${file}):`);
  console.error(JSON.stringify(errors.slice(0, 10), null, 2));
  process.exit(1);
}
