/**
 * IDTA submodel-template `semanticId` classifier — offline, dependency-free.
 *
 * Classifies every `semanticId` in an AAS Environment against the vendored, CC-BY IDTA allowlist
 * (`../idta-semantic-ids.json`), so you can independently check whether a submodel `semanticId` is a
 * genuine, published IDTA template id — for your OWN AAS output, not just OpenDPP's.
 *
 *   node validate.mjs semanticids path/to/aas-environment.json
 *
 * Verdicts:
 *   - "real-idta-published"  the id is an IDTA submodel-template IRI that is PUBLISHED in the registry
 *                            snapshot (the genuine, current identity).
 *   - "idta-deprecated"      a real IDTA IRI that the registry has DEPRECATED (still resolvable, but
 *                            superseded — an honest red flag).
 *   - "vendor-coined"        an honest `urn:opendpp:*` id OpenDPP coins (never presented as IDTA/eCl@ss).
 *   - "eclass"               an eCl@ss IRDI (`0173-1#…`), e.g. a genuine property-level concept id.
 *   - "catena-x"             a Catena-X / Eclipse Tractus-X SAMM aspect-model id (`urn:samm:io.catenax.…`)
 *                            that OpenDPP deliberately REFERENCES (CC-BY-4.0) as an identifier string only —
 *                            no model definitions are redistributed, so no attribution obligation attaches.
 *   - "unknown"              anything else, INCLUDING an `admin-shell.io` (IDTA-namespace) IRI that is
 *                            NOT in this allowlist — i.e. an IDTA-identity claim we cannot vouch for.
 *
 * This checks IDENTITY only (is the id the authentic IDTA template id?), NOT structural conformance to
 * the template body. The allowlist covers the IDTA submodel-template anchors OpenDPP uses, each
 * machine-checked `published`/`deprecated` against admin-shell-io/submodel-templates (CC-BY-4.0).
 *
 * Apache-2.0 © OpenDPP UAB. The IDTA-derived allowlist retains its CC-BY-4.0 terms (see ../NOTICE).
 */
import { readFileSync } from "node:fs";

const ALLOWLIST = JSON.parse(readFileSync(new URL("../idta-semantic-ids.json", import.meta.url), "utf8"));

const PUBLISHED = new Set(ALLOWLIST.anchors.filter((a) => a.status === "published").map((a) => a.iri));
const DEPRECATED = new Set(ALLOWLIST.anchors.filter((a) => a.status === "deprecated").map((a) => a.iri));

export const VERDICTS = ["real-idta-published", "idta-deprecated", "vendor-coined", "eclass", "catena-x", "unknown"];

/** Classify a single `semanticId` IRI against the allowlist (membership/identity, not URL shape). */
export function classifySemanticId(iri) {
  if (PUBLISHED.has(iri)) return "real-idta-published";
  if (DEPRECATED.has(iri)) return "idta-deprecated";
  if (iri.startsWith("urn:opendpp:")) return "vendor-coined";
  if (/^0173-1#/.test(iri)) return "eclass";
  // A Catena-X / Eclipse Tractus-X SAMM aspect-model id we deliberately REFERENCE (CC-BY-4.0, by URN
  // string only). Scoped to io.catenax so a non-Catena-X urn:samm id stays "unknown".
  if (/^urn:samm:io\.catenax\./.test(iri)) return "catena-x";
  return "unknown";
}

/** True for an IDTA-namespace IRI we could NOT verify as published/deprecated — a potential overclaim. */
export function isUnverifiedIdtaNamespace(iri) {
  return iri.startsWith("https://admin-shell.io/") && !PUBLISHED.has(iri) && !DEPRECATED.has(iri);
}

/** Recursively collect every `semanticId.keys[].value` in an AAS Environment (submodels + elements). */
export function collectSemanticIds(node, out = new Set()) {
  if (Array.isArray(node)) {
    for (const n of node) collectSemanticIds(n, out);
  } else if (node && typeof node === "object") {
    if (node.semanticId && Array.isArray(node.semanticId.keys)) {
      for (const k of node.semanticId.keys) if (k && typeof k.value === "string") out.add(k.value);
    }
    for (const key of Object.keys(node)) collectSemanticIds(node[key], out);
  }
  return out;
}

/** Classify every distinct semanticId in an AAS Environment. Returns counts + per-iri verdicts. */
export function classifyAasFile(data) {
  const iris = [...collectSemanticIds(data)].sort();
  const items = iris.map((iri) => ({ iri, verdict: classifySemanticId(iri), unverifiedIdta: isUnverifiedIdtaNamespace(iri) }));
  const counts = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  for (const it of items) counts[it.verdict] += 1;
  return { counts, items, allowlistRef: ALLOWLIST._pinnedRef };
}
