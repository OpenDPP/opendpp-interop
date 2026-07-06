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
  gs1CheckDigit,
  makeGtin,
  makeGln,
  parseDigitalLinkPath,
  generateDigitalLinkUri,
  generateUnitDigitalLinkUri,
  canonicalProductUpi,
  canonicalUnitUpi,
  toNdefUriRecord,
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

test("GRAI serial accepts the full GS1 CSET-82 charset (audit G-grai)", () => {
  // The AI-8003 serial component is CSET 82 (alphanumeric PLUS !\"%&'()*+,-./:;<=>?_), not just
  // [A-Za-z0-9]. Real returnable-asset serials use hyphens/slashes/dots; the engine decodes them fine.
  for (const serial of ["AB-CD", "A.B", "A/B", "A_B", "LOT(1)", "!%&'*+,:;<=>?", 'A"B']) {
    assert.equal(isGRAIVal(VALID_GTIN14 + serial), true, `CSET-82 serial ${JSON.stringify(serial)} must be accepted`);
  }
  // Still rejects characters OUTSIDE CSET 82.
  for (const bad of ["A B", "A#B", "A$B", "A@B", "A[B", "A\tB", "café", "A^B", "A`B"]) {
    assert.equal(isGRAIVal(VALID_GTIN14 + bad), false, `non-CSET-82 serial ${JSON.stringify(bad)} must be rejected`);
  }
  // Length + check-digit invariants are unchanged.
  assert.equal(isGRAIVal(VALID_GTIN14 + "X".repeat(16)), true, "16-char serial (total 30) is the max");
  assert.equal(isGRAIVal(VALID_GTIN14 + "X".repeat(17)), false, "17-char serial (total 31) exceeds the 30-char cap");
  assert.equal(isGRAIVal("00012345678900" + "AB-CD"), false, "a bad asset check digit is still rejected");
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

test("mod-10 minting (gs1CheckDigit / makeGtin / makeGln) round-trips the validators", () => {
  // Mint from a body, then validate with the SAME package — generation and validation agree by construction.
  const gtin = makeGtin("0950110154100");
  assert.equal(gtin.length, 14);
  assert.equal(isGTINVal(gtin), true);
  assert.equal(gs1CheckDigit("0950110154100"), Number(gtin[13]));

  const gln = makeGln("095011015401");
  assert.equal(gln.length, 13);
  assert.equal(isValidGLN(gln), true);

  // The known-valid fixtures reproduce exactly.
  assert.equal(makeGtin(VALID_GTIN14.slice(0, 13)), VALID_GTIN14);
  assert.equal(makeGln(VALID_GLN13.slice(0, 12)), VALID_GLN13);

  // Guard rails: wrong length / non-numeric bodies throw instead of minting garbage.
  assert.throws(() => makeGtin("123"), /13-digit body/);
  assert.throws(() => makeGln("123"), /12-digit body/);
  assert.throws(() => gs1CheckDigit("12a4"), /numeric body/);
});

test("toNdefUriRecord wraps a Digital Link as an NFC URI record (#403, carrier-agnostic)", () => {
  const uri = generateUnitDigitalLinkUri(VALID_GTIN14, "SN-1");
  assert.ok(uri.startsWith("https://"));
  const rec = toNdefUriRecord(uri);
  // NDEF short record: header 0xD1, type-length 1, payload-length, type 'U' (0x55), prefix code, remainder.
  assert.equal(rec[0], 0xd1, "MB|ME|SR|TNF-well-known header");
  assert.equal(rec[1], 0x01, "type length = 1");
  assert.equal(rec[3], 0x55, "record type 'U'");
  assert.equal(rec[4], 0x04, "https:// abbreviated to prefix code 0x04");
  assert.equal(rec[2], rec.length - 4, "payload length is consistent with the record length");
  // The stored remainder is the URI minus the abbreviated https:// prefix — round-trips to the same URL.
  const remainder = new TextDecoder().decode(rec.slice(5));
  assert.equal("https://" + remainder, uri, "an NFC tag carries the SAME resolvable URL as the QR");
  // http://www. picks the two-byte-shorter www-abbreviated code (0x01), proving longest-prefix match.
  assert.equal(toNdefUriRecord("http://www.example.com/x")[4], 0x01);
});
