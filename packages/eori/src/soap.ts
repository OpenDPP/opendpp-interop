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

function xmlUnescape(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
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

/** Read a single leaf element's text by local name (ignoring any namespace prefix). */
function leaf(scope: string, localName: string): string | undefined {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}\\s*>`,
    "i",
  );
  const m = re.exec(scope);
  if (!m) return undefined;
  return xmlUnescape(m[1] ?? "").trim();
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

  // SOAP Fault → surface faultstring/faultcode.
  const fault = /<(?:[\w.-]+:)?Fault(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?Fault\s*>/i.exec(body);
  if (fault) {
    const inner = fault[1] ?? "";
    const faultString = leaf(inner, "faultstring") || leaf(inner, "Reason") || "SOAP Fault";
    const faultCode = leaf(inner, "faultcode") || leaf(inner, "Code");
    throw new EoriServiceError(`EORI service fault: ${faultString}`, { faultCode });
  }

  const blocks = body.match(
    /<(?:[\w.-]+:)?result(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?result\s*>/gi,
  );

  if (!blocks) {
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
