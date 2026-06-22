/**
 * GS1 Digital Link conformance door.
 *
 * Validates GS1 Digital Link URIs and bracketed AI element strings against GS1's OWN
 * **Barcode Syntax Engine** (the official `gs1encoder` WASM, Apache-2.0) — the same engine the
 * OpenDPP backend uses as its conformance oracle. This is an independent check: validity is asserted
 * by GS1's grammar (check digits, AI associations, key-qualifier sequences), never by a hand-rolled
 * regex. A bad GTIN check digit, an over-long AI-21 serial (> 20 chars), or an invalid key-qualifier
 * sequence (e.g. AI-21 under a GRAI) is rejected.
 *
 * Input: one identifier per line. A line beginning with `http(s)://` is parsed as a Digital Link URI;
 * a line beginning with `(` is parsed as a bracketed AI element string. `#` lines and blanks are ignored.
 */
import { readFileSync } from "node:fs";
import { GS1encoder } from "gs1encoder";

/** Parse + validate every GS1 identifier in `file`. Returns true iff ALL are GS1-conformant. */
export async function validateGs1File(file) {
  const lines = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) throw new Error("no GS1 Digital Links / element strings found (one per line)");

  const eng = await GS1encoder.create();
  let allValid = true;
  console.log(`GS1 Digital Link / element-string conformance — ${file}`);
  for (const input of lines) {
    try {
      // The engine throws a typed exception on an invalid grammar / check digit / AI association.
      if (/^https?:\/\//i.test(input)) eng.dataStr = input; // Digital Link URI
      else if (input.startsWith("(")) eng.aiDataStr = input; // bracketed AI element string
      else eng.dataStr = input; // general barcode message
      const ai = eng.aiDataStr;
      let dl = null;
      try {
        dl = eng.getDLuri(null); // canonical https://id.gs1.org/… form (not all inputs form a DL)
      } catch {
        dl = null;
      }
      console.log(`  ✓ ${input}`);
      console.log(`      AIs ${ai}${dl ? `\n      DL  ${dl}` : ""}`);
    } catch (e) {
      allValid = false;
      const markup = (() => {
        try {
          return eng.errMarkup;
        } catch {
          return "";
        }
      })();
      console.log(`  ✗ ${input}`);
      console.log(`      ${String(e?.message ?? e)}${markup ? `  [${markup}]` : ""}`);
    }
  }
  console.log(
    allValid
      ? `✓ VALID — all ${lines.length} GS1 identifier(s) conform to GS1's grammar.`
      : `✗ INVALID — one or more GS1 identifier(s) were rejected by GS1's engine.`,
  );
  return allValid;
}
