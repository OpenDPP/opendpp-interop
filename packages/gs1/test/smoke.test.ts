// @opendpp/gs1 smoke test — proves the package works standalone (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidGTIN,
  isGTINVal,
  isValidGLN,
  isGRAIVal,
  isGs1Keyed,
  gtinIngestError,
  nonGs1Warning,
  parseDigitalLinkPath,
  generateDigitalLinkUri,
  generateUnitDigitalLinkUri,
  canonicalProductUpi,
  canonicalUnitUpi,
} from "../src/index.ts";

const VALID_GTIN14 = "09501101531000"; // valid GTIN-14 (mod-10 check digit = 0)
const VALID_GLN13 = "9501101531000"; // valid GLN-13 (mod-10 check digit = 0)

test("mod-10 check-digit validation (GTIN / GLN / GRAI)", () => {
  assert.equal(isValidGTIN(VALID_GTIN14), true);
  assert.equal(isGTINVal(VALID_GTIN14), true);
  assert.equal(isGTINVal("00012345678900"), false); // wrong check digit
  assert.equal(isGTINVal("12345"), false); // not 14 digits
  assert.equal(isValidGLN(VALID_GLN13), true);
  assert.equal(isValidGLN("123"), false);
  assert.equal(isGRAIVal(VALID_GTIN14 + "ABC"), true); // GTIN-14 asset + alphanumeric serial
  assert.equal(isGRAIVal(VALID_GTIN14), true); // asset only, no serial
});

test("GS1-keyed detection + ingest guard", () => {
  assert.equal(isGs1Keyed(VALID_GTIN14), true);
  assert.equal(isGs1Keyed("WIDGET-1"), false);
  assert.equal(gtinIngestError(VALID_GTIN14), null);
  assert.equal(gtinIngestError("WIDGET-1"), null); // non-GS1 SKU is accepted
  assert.match(gtinIngestError("00012345678900") ?? "", /modulo-10 check digit is invalid/);
  assert.equal(nonGs1Warning("WIDGET-1").path, "productId");
});

test("Digital Link path parsing", () => {
  assert.deepEqual(parseDigitalLinkPath("09501101531000/21/ABC"), {
    primaryId: "09501101531000",
    additionalAttributes: { "21": "ABC" },
  });
  assert.equal(parseDigitalLinkPath(""), null);
});

test("URI builders (suffix-asserted — resolver host is env-dependent)", () => {
  assert.ok(generateDigitalLinkUri(VALID_GTIN14, "pp_1").endsWith(`/01/${VALID_GTIN14}`));
  assert.ok(generateDigitalLinkUri("WIDGET-1", "pp_9").endsWith("/passport/pp_9"));
  assert.ok(
    generateUnitDigitalLinkUri(VALID_GTIN14, "SER-42").endsWith(`/01/${VALID_GTIN14}/21/SER-42`),
  );
  // Canonical UPIs are pure — always the GS1 identity host, never an OpenDPP host.
  assert.equal(canonicalProductUpi(VALID_GTIN14), `https://id.gs1.org/01/${VALID_GTIN14}`);
  assert.equal(
    canonicalUnitUpi(VALID_GTIN14, "SER-42"),
    `https://id.gs1.org/01/${VALID_GTIN14}/21/SER-42`,
  );
});
