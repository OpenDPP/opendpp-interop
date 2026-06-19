/**
 * Offline validator door for OpenDPP's SD-JWT-VC selective-disclosure credential (backend #118).
 *
 * An SD-JWT-VC is `<JWS>~<disclosure>~…~`. This door, with ZERO extra dependencies (node built-ins only):
 *   1. decodes the compact JWS header + payload;
 *   2. checks the IETF SD-JWT-VC profile — protected `typ` is `dc+sd-jwt` (the deprecated `vc+sd-jwt` is
 *      accepted), `alg` ES256, and the REQUIRED top-level claims `iss` + `vct` are present;
 *   3. reconstructs the selective disclosures — each `[salt, claim, value]` disclosure's
 *      `base64url(SHA-256(ASCII(disclosure)))` digest MUST appear in `credentialSubject._sd`; duplicates and
 *      unknown digests are rejected (IETF SD-JWT §8.1); `_sd_alg` must be `sha-256`;
 *   4. cryptographically VERIFIES the issuer ES256 signature against the committed `did:web` document
 *      (`battery-issuer-did.json`, resolved as a sibling of the sample) using Node WebCrypto — the same
 *      check any third party would run, no OpenDPP code.
 *
 * Exit/return: returns `true` when everything conforms + the signature verifies, else prints the reasons
 * and returns `false`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import crypto from "node:crypto";

const b64urlJson = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
const digest = (disclosure) => Buffer.from(crypto.createHash("sha256").update(disclosure, "ascii").digest()).toString("base64url");

export async function validateSdJwtFile(file, opts = {}) {
  const sdjwt = readFileSync(file, "utf8").trim();
  const parts = sdjwt.split("~");
  const jws = parts[0];
  const disclosures = parts.slice(1).filter((p) => p.length > 0); // drop the empty trailing (no key binding)
  const errors = [];

  const [h, p, s] = jws.split(".");
  if (!h || !p || !s) {
    console.error(`✗ NON-CONFORMING — not a compact JWS / SD-JWT (${file})`);
    return false;
  }
  const header = b64urlJson(h);
  const payload = b64urlJson(p);

  // 1. SD-JWT-VC profile.
  if (header.typ !== "dc+sd-jwt" && header.typ !== "vc+sd-jwt") errors.push(`typ "${header.typ}" is not the SD-JWT-VC media type dc+sd-jwt`);
  if (header.alg !== "ES256") errors.push(`alg "${header.alg}" is not ES256`);
  if (typeof payload.iss !== "string" || !payload.iss) errors.push("missing the REQUIRED SD-JWT-VC `iss` claim");
  if (typeof payload.vct !== "string" || !payload.vct) errors.push("missing the REQUIRED SD-JWT-VC `vct` claim");
  if (payload._sd_alg !== undefined && payload._sd_alg !== "sha-256") errors.push(`unsupported _sd_alg "${payload._sd_alg}"`);

  // 2. Disclosure reconstruction (IETF SD-JWT §8.1).
  const sd = new Set(Array.isArray(payload?.credentialSubject?._sd) ? payload.credentialSubject._sd : []);
  const disclosed = [];
  const seen = new Set();
  for (const d of disclosures) {
    let arr;
    try {
      arr = b64urlJson(d);
    } catch {
      errors.push("malformed disclosure");
      continue;
    }
    const dg = digest(d);
    if (!sd.has(dg)) errors.push(`disclosure for "${arr[1]}" has no matching _sd digest`);
    else if (seen.has(dg)) errors.push(`duplicate disclosure for "${arr[1]}" (a digest MUST appear once)`);
    else {
      seen.add(dg);
      disclosed.push(arr[1]);
    }
  }

  // 3. ES256 signature verification against the committed did:web document.
  const didPath = opts.didPath || join(dirname(file), "battery-issuer-did.json");
  let did;
  try {
    did = JSON.parse(readFileSync(didPath, "utf8"));
  } catch (e) {
    errors.push(`could not read issuer did document ${basename(didPath)}: ${e?.message ?? e}`);
  }
  const vm = did && (did.verificationMethod || []).find((m) => m.id === header.kid);
  if (!vm?.publicKeyJwk) {
    errors.push(`did document has no verification method for kid ${header.kid}`);
  } else {
    const jwk = vm.publicKeyJwk;
    const key = await globalThis.crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const ok = await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new Uint8Array(Buffer.from(s, "base64url")),
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) errors.push("ES256 signature does not verify against the did:web key");
  }

  if (errors.length) {
    console.error(`✗ NON-CONFORMING — SD-JWT-VC (${file}):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    return false;
  }
  console.log(`✓ VALID — IETF SD-JWT-VC (typ ${header.typ}, vct ${payload.vct})`);
  console.log(`  ES256 signature verifies vs ${basename(didPath)}; ${disclosed.length}/${sd.size} disclosure(s) revealed: ${disclosed.join(", ") || "(none — full hidden)"}`);
  return true;
}
