#!/usr/bin/env node
/**
 * OpenDPP interop conformance validator — the runnable core of this boundary kit.
 *
 * Validate an AAS Environment or a UNTP DigitalProductPassport credential YOU produce against the
 * SAME official, vendored JSON Schemas OpenDPP's own CI validates against (see ../schemas/), so you
 * can prove conformance offline before you ship — without any access to the OpenDPP product source.
 *
 *   node validate.mjs aas   path/to/aas-environment.json
 *   node validate.mjs untp  path/to/dpp-credential.json
 *
 * Exit codes: 0 = conformant · 1 = schema errors (printed) · 2 = usage / read error.
 *
 * NOTE: this checks STRUCTURAL conformance against the JSON Schema. Verifying a `vc+jwt` SIGNATURE
 * (resolve did:web → verify the JWS → validate the payload) is a separate concern — see the recipe
 * in the README ("Verify a signature") which uses only standard WebCrypto / JOSE, no OpenDPP code.
 *
 * Apache-2.0 © OpenDPP UAB. The vendored schemas in ../schemas/ retain their upstream terms (see NOTICE).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCHEMAS = {
  // AAS v3.0: official IDTA-01001-3-1 JSON Schema (draft-2019-09).
  aas: { file: "aas-v3.schema.json", Ajv: Ajv2019, label: "AAS v3.0 Environment (IDTA-01001-3-1)" },
  // UNTP DigitalProductPassport v0.7.0 (draft-2020-12).
  untp: { file: "untp-dpp-v0.7.0.schema.json", Ajv: Ajv2020, label: "UNTP DigitalProductPassport v0.7.0" },
};

export const INTEROP_KINDS = Object.keys(SCHEMAS);

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
  const [kind, file] = process.argv.slice(2);
  if (!kind || !file || !INTEROP_KINDS.includes(kind)) {
    console.error(`usage: node validate.mjs <${INTEROP_KINDS.join("|")}> <file.json>`);
    process.exit(2);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(resolve(file), "utf8"));
  } catch (e) {
    console.error(`could not read/parse ${file}: ${e?.message ?? e}`);
    process.exit(2);
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
