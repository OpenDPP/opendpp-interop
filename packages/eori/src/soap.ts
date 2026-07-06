/**
 * @opendpp/eori — SOAP request/response plumbing for the EU EOS service
 *
 * The European Commission EOS EORI service is a document/literal SOAP 1.1 service
 * (targetNamespace http://eori.ws.eos.dds.s/, operation `validateEORI`). To keep
 * the package zero-dependency we build the envelope as a string and parse the flat
 * response with a small, namespace-tolerant reader rather than pulling in a SOAP
 * stack. The two exports here are deterministic and offline — `validate.ts` wires
 * them to a transport.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use
 * this file except in compliance with the License. You may obtain a copy of the
 * License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * "OpenDPP" is a trademark of Opendpp UAB; the Apache-2.0 license grants no rights to the marks.
 */

/** SOAP target namespace of the EU EOS validation service (from its WSDL). */
export const EORI_SOAP_NAMESPACE = "http://eori.ws.eos.dds.s/";

/** A single `<result>` element from a `validateEORIResponse`. */
export interface RawEoriResult {
  eori: string;
  /** 0 = valid (operator exists), 1 = not valid; null if the service omitted it */
  status: number | null;
  /** the service's `statusDescr` text */
  statusDescription: string;
  errorReason?: string;
  name?: string;
  address?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

/** Parsed `validateEORIResponse` envelope. */
export interface ParsedEoriResponse {
  requestDate?: string;
  errorDescription?: string;
  results: RawEoriResult[];
}

/** Thrown when the service returns a SOAP Fault or an unreadable response. */
export class EoriServiceError extends Error {
  /** SOAP faultcode, when present. */
  readonly faultCode?: string;
  constructor(message: string, options?: { cause?: unknown; faultCode?: string }) {
    super(message, options);
    this.name = "EoriServiceError";
    if (options?.faultCode) this.faultCode = options.faultCode;
  }
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Maximum SOAP response body we will parse. A real `validateEORIResponse` is a few KB; a body past
 * this is rejected before scanning. SECURITY (js/polynomial-redos): {@link parseValidateEoriResponse}
 * is exported and receives `await response.text()` with no size cap and an injectable transport — the
 * input is untrusted. The readers below are LINEAR (indexOf, no lazy backtracking); this cap is a
 * coarse defence-in-depth bound on top of them.
 */
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function isNameChar(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    (ch >= "0" && ch <= "9") ||
    ch === "_" ||
    ch === "-" ||
    ch === "."
  );
}
function isSpace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v";
}

/**
 * Linear, namespace-prefix + attribute tolerant, case-insensitive XML element readers. These REPLACE
 * the previous lazy `[\s\S]*?` regexes whose backtracking was O(n²) on a crafted response
 * (js/polynomial-redos). Semantics match the old regexes exactly (guarded in `soap.test.ts`): an open
 * tag is `<[ns:]name` whose name is followed by whitespace or `>` (so `<name…>`, not `<namefoo>`), its
 * `>` ends the tag; the matching close is the next `</[ns:]name\s*>`; inner text is everything between.
 */
// The scanners take a PRE-LOWERCASED `lower` (== body.toLowerCase()) and an already-lowercased
// `target`, computed ONCE by the callers below. Computing them per-call made a many-element parse
// O(n²) (each of N result blocks re-lowercased the whole body) — a reintroduced polynomial DoS.
function findOpenTag(body: string, lower: string, target: string, from: number): { contentStart: number } | null {
  let i = Math.max(from, 0);
  while (i < body.length) {
    const lt = body.indexOf("<", i);
    if (lt < 0) return null;
    if (body[lt + 1] === "/") {
      i = lt + 1;
      continue; // a close tag — skip
    }
    let namePos = lt + 1;
    let q = namePos;
    while (q < body.length && isNameChar(body[q]!)) q++;
    if (q > lt + 1 && body[q] === ":") namePos = q + 1; // consume a namespace prefix ([\w.-]+ before ':')
    if (lower.startsWith(target, namePos)) {
      const after = namePos + target.length;
      const ch = body[after];
      if (ch === ">" || ch === undefined || isSpace(ch)) {
        const gt = body.indexOf(">", after);
        if (gt < 0) return null;
        return { contentStart: gt + 1 };
      }
    }
    i = lt + 1;
  }
  return null;
}

/** Index of the `<` of the next `</[ns:]name\s*>` close tag at/after `from`, or -1. Linear. */
function findCloseTag(body: string, lower: string, target: string, from: number): number {
  let i = Math.max(from, 0);
  while (i < body.length) {
    const lt = body.indexOf("</", i);
    if (lt < 0) return -1;
    let namePos = lt + 2;
    let q = namePos;
    while (q < body.length && isNameChar(body[q]!)) q++;
    if (q > lt + 2 && body[q] === ":") namePos = q + 1;
    if (lower.startsWith(target, namePos)) {
      let after = namePos + target.length;
      while (after < body.length && isSpace(body[after]!)) after++;
      if (body[after] === ">") return lt;
    }
    i = lt + 2;
  }
  return -1;
}

/** Inner text of the FIRST `<[ns:]name…>…</[ns:]name>` in `body`, or null. Linear. */
function firstTagInner(body: string, name: string): string | null {
  const lower = body.toLowerCase();
  const target = name.toLowerCase();
  const open = findOpenTag(body, lower, target, 0);
  if (!open) return null;
  const close = findCloseTag(body, lower, target, open.contentStart);
  if (close < 0) return null;
  return body.slice(open.contentStart, close);
}

/** Inner text of EVERY `<[ns:]name…>…</[ns:]name>` (non-overlapping), matching the old global regex. Linear. */
function allTagInners(body: string, name: string): string[] {
  const lower = body.toLowerCase(); // ONCE for the whole scan — not per block (that was O(n²)).
  const target = name.toLowerCase();
  const inners: string[] = [];
  let from = 0;
  for (;;) {
    const open = findOpenTag(body, lower, target, from);
    if (!open) break;
    const close = findCloseTag(body, lower, target, open.contentStart);
    if (close < 0) break;
    inners.push(body.slice(open.contentStart, close));
    const gt = body.indexOf(">", close);
    from = gt < 0 ? body.length : gt + 1;
  }
  return inners;
}

/** Replace every `<![CDATA[ … ]]>` with its inner content (linear indexOf scan; the old lazy `/g` regex was O(n²)). */
function stripCdata(value: string): string {
  const OPEN = "<![CDATA[";
  const CLOSE = "]]>";
  if (value.indexOf(OPEN) < 0) return value;
  let out = "";
  let i = 0;
  for (;;) {
    const s = value.indexOf(OPEN, i);
    if (s < 0) return out + value.slice(i);
    out += value.slice(i, s);
    const cs = s + OPEN.length;
    const e = value.indexOf(CLOSE, cs);
    if (e < 0) return out + value.slice(s); // unterminated CDATA → leave untouched (matches the old non-match)
    out += value.slice(cs, e);
    i = e + CLOSE.length;
  }
}

function xmlUnescape(value: string): string {
  return stripCdata(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

/**
 * Build the SOAP 1.1 envelope for a `validateEORI` call. Both the wrapper and the
 * repeated `eori` children are namespace-qualified — the service schema uses
 * elementFormDefault="qualified" and rejects unqualified children with a
 * cvc-complex-type fault.
 */
export function buildValidateEoriEnvelope(eoris: readonly string[]): string {
  const items = eoris.map((e) => `<eori:eori>${xmlEscape(String(e))}</eori:eori>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    `xmlns:eori="${EORI_SOAP_NAMESPACE}">` +
    "<soapenv:Header/>" +
    "<soapenv:Body>" +
    `<eori:validateEORI>${items}</eori:validateEORI>` +
    "</soapenv:Body>" +
    "</soapenv:Envelope>"
  );
}

/** Read a single leaf element's text by local name (ignoring any namespace prefix). Linear. */
function leaf(scope: string, localName: string): string | undefined {
  const inner = firstTagInner(scope, localName);
  if (inner === null) return undefined;
  return xmlUnescape(inner).trim();
}

function optional(value: string | undefined): string | undefined {
  return value !== undefined && value !== "" ? value : undefined;
}

/**
 * Parse a `validateEORIResponse` SOAP body. Throws {@link EoriServiceError} on a
 * SOAP Fault or when the body contains no recognisable response.
 */
export function parseValidateEoriResponse(xml: string): ParsedEoriResponse {
  const body = String(xml ?? "");

  // SECURITY (js/polynomial-redos): reject an oversized body before any scanning (untrusted input).
  if (body.length > MAX_RESPONSE_BYTES) {
    throw new EoriServiceError(`EORI service response too large to parse (${body.length} bytes).`);
  }

  // SOAP Fault → surface faultstring/faultcode.
  const faultInner = firstTagInner(body, "Fault");
  if (faultInner !== null) {
    const faultString = leaf(faultInner, "faultstring") || leaf(faultInner, "Reason") || "SOAP Fault";
    const faultCode = leaf(faultInner, "faultcode") || leaf(faultInner, "Code");
    throw new EoriServiceError(`EORI service fault: ${faultString}`, { faultCode });
  }

  const blocks = allTagInners(body, "result");

  if (blocks.length === 0) {
    // No fault and no results — only acceptable if the service reported an error.
    const errorDescription = leaf(body, "errorDescription");
    if (errorDescription) {
      return { requestDate: leaf(body, "requestDate"), errorDescription, results: [] };
    }
    throw new EoriServiceError(
      "EORI service response did not contain a validateEORIResponse result.",
    );
  }

  const results: RawEoriResult[] = blocks.map((block) => {
    const statusText = leaf(block, "status");
    const status = statusText !== undefined && /^-?\d+$/.test(statusText) ? Number(statusText) : null;
    return {
      eori: leaf(block, "eori") ?? "",
      status,
      statusDescription: leaf(block, "statusDescr") ?? "",
      errorReason: optional(leaf(block, "errorReason")),
      name: optional(leaf(block, "name")),
      address: optional(leaf(block, "address")),
      street: optional(leaf(block, "street")),
      postalCode: optional(leaf(block, "postalCode")),
      city: optional(leaf(block, "city")),
      country: optional(leaf(block, "country")),
    };
  });

  return {
    requestDate: leaf(body, "requestDate"),
    errorDescription: optional(leaf(body, "errorDescription")),
    results,
  };
}
