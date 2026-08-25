/**
 * OpenDPP DPP / battery SHACL validator — offline, against OpenDPP's OWN, NON-NORMATIVE shapes.
 *
 * Validates an OpenDPP PUBLIC `application/ld+json` Digital Product Passport (the JSON-LD door) against
 * the OpenDPP-authored starter SHACL shapes in `../shapes/opendpp-dpp-shapes.ttl`, so you can check an
 * OpenDPP JSON-LD passport (yours or the bundled sample) against shapes that target OpenDPP's real DPP
 * vocabulary — filling the gap left by the CIRPASS-2 `dpp-validator`'s placeholder `example.org` shapes.
 *
 *   node validate.mjs shacl path/to/passport.jsonld
 *
 * NON-NORMATIVE. These shapes are OpenDPP-authored and offered as a contribution to CIRPASS-2 — they are
 * NOT accepted, normative, or an EU / CIRPASS-2 conformance oracle. CIRPASS-2's own `dpp-validator` is
 * NOT used as an oracle here.
 *
 * Fully OFFLINE: the passport's `@context` references the REMOTE URL
 * `https://opendpp-node.eu/contexts/dpp/v1`, but the document loader below returns a stub `{ "@context":
 * {} }` for ANY `opendpp-node.eu` URL, so JSON-LD expansion uses the INLINE context only — no network.
 *
 * Apache-2.0 © OpenDPP UAB.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import jsonld from "jsonld";
import rdf from "@zazuko/env-node";
import SHACLValidator from "rdf-validate-shacl";

const SHAPES_URL = new URL("../shapes/opendpp-dpp-shapes.ttl", import.meta.url);

/**
 * OFFLINE JSON-LD document loader: any opendpp-node.eu URL (the remote `@context` URL in the passport's
 * `@context` array) resolves to an EMPTY stub context, so expansion relies solely on the INLINE context
 * map — no network fetch. Any OTHER remote URL is refused, keeping validation hermetic.
 */
async function offlineDocumentLoader(url) {
  if (url.includes("opendpp-node.eu")) {
    return { contextUrl: null, documentUrl: url, document: { "@context": {} } };
  }
  throw new Error(`offline validator refused a network fetch for: ${url}`);
}

/** Parse a Turtle string into an RDF/JS dataset (via the bundled @zazuko/env-node Turtle parser). */
async function turtleToDataset(turtle) {
  const stream = rdf.formats.parsers.import("text/turtle", Readable.from([turtle]));
  return await rdf.dataset().import(stream);
}

/** Expand a JSON-LD document to an RDF/JS dataset, OFFLINE (inline context only). */
async function jsonldToDataset(doc) {
  const nquads = await jsonld.toRDF(doc, { format: "application/n-quads", documentLoader: offlineDocumentLoader });
  const stream = rdf.formats.parsers.import("application/n-quads", Readable.from([nquads]));
  return await rdf.dataset().import(stream);
}

/**
 * Validate an OpenDPP JSON-LD passport (already-parsed object) against the OpenDPP SHACL shapes.
 * Returns { conforms, violations[], dataTriples }.
 */
export async function validateShacl(doc) {
  const shapes = await turtleToDataset(readFileSync(SHAPES_URL, "utf8"));
  const data = await jsonldToDataset(doc);
  const validator = new SHACLValidator(shapes, { factory: rdf });
  const report = await validator.validate(data);
  const violations = report.results.map((r) => ({
    severity: (r.severity?.value ?? "").split("#").pop() || "Violation",
    path: r.path?.value,
    focusNode: r.focusNode?.value,
    value: r.value?.value,
    message: r.message.map((m) => m.value).join("; ") || "(no message)",
  }));
  return { conforms: report.conforms, violations, dataTriples: data.size };
}

/** Read a JSON-LD passport file and validate it against the OpenDPP SHACL shapes. */
export async function validateShaclFile(file) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  return await validateShacl(doc);
}
