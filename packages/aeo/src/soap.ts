/**
 * @opendpp/aeo — SOAP request/response plumbing for the EU EOS aeo-retrieve service
 *
 * The European Commission EOS AEO service is a document/literal SOAP 1.1 service
 * (targetNamespace http://aeo.ws.eos.dds.s/, operation `retrieveAEO`). To keep the
 * package zero-dependency we build the envelope as a string and parse the flat
 * response with a small, namespace-tolerant reader. These two exports are
 * deterministic and offline — `lookup.ts` wires them to a transport.
 *
 * Wire quirks verified against the live service: the request children are
 * namespace-qualified (elementFormDefault="qualified"); `authorisationType` is
 * required; the response wrapper is `retrieveAEOResponse` → `return` → `result[]`;
 * the type element is `authorisation.type` (with a dot); `issuingCountry` comes back
 * as the full country NAME; "not found" is simply the absence of any `<result>`.
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

/** SOAP target namespace of the EU EOS aeo-retrieve service (from its WSDL). */
export const AEO_SOAP_NAMESPACE = "http://aeo.ws.eos.dds.s/";

/** A search criterion sent as one `<aeoRequestType>`. */
export interface AeoRequestCriteria {
  /** holder name (or AEO number) to match — the service does a substring match */
  holderName: string;
  /** optional 2-letter issuing-country filter */
  issuingCountry?: string;
  /** authorisation type(s) to include — at least one is REQUIRED by the service */
  authorisationTypes: readonly string[];
}

/** A single `<result>` from a `retrieveAEOResponse`. */
export interface AeoRawResult {
  authorisationHolderName?: string;
  /** full country NAME as returned by the service (not a code) */
  issuingCountry?: string;
  competentCustomsAuthority?: string;
  /** AEOC / AEOF / AEOS (raw string; narrowed by the lookup layer) */
  authorisationType?: string;
  /** DD/MM/YYYY as returned by the service */
  effectiveDate?: string;
}

/** Parsed `retrieveAEOResponse` envelope. */
export interface ParsedAeoResponse {
  requestDate?: string;
  errorDescription?: string;
  results: AeoRawResult[];
}

/** Thrown when the service returns a SOAP Fault or an unreadable response. */
export class AeoServiceError extends Error {
  /** SOAP faultcode, when present. */
  readonly faultCode?: string;
  constructor(message: string, options?: { cause?: unknown; faultCode?: string }) {
    super(message, options);
    this.name = "AeoServiceError";
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the SOAP 1.1 envelope for a `retrieveAEO` call. Both the wrapper and the
 * children are namespace-qualified (the schema uses elementFormDefault="qualified").
 * Element order follows the XSD sequence: holderName, issuingCountry, authorisationType.
 */
export function buildRetrieveAeoEnvelope(criteria: readonly AeoRequestCriteria[]): string {
  const items = criteria
    .map((c) => {
      const parts: string[] = [];
      if (c.holderName !== undefined && c.holderName !== "") {
        parts.push(`<aeo:authorisationHolderName>${xmlEscape(String(c.holderName))}</aeo:authorisationHolderName>`);
      }
      if (c.issuingCountry) {
        parts.push(`<aeo:issuingCountry>${xmlEscape(String(c.issuingCountry))}</aeo:issuingCountry>`);
      }
      for (const t of c.authorisationTypes) {
        parts.push(`<aeo:authorisationType>${xmlEscape(String(t))}</aeo:authorisationType>`);
      }
      return `<aeo:aeoRequestType>${parts.join("")}</aeo:aeoRequestType>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    `xmlns:aeo="${AEO_SOAP_NAMESPACE}">` +
    "<soapenv:Header/>" +
    "<soapenv:Body>" +
    `<aeo:retrieveAEO>${items}</aeo:retrieveAEO>` +
    "</soapenv:Body>" +
    "</soapenv:Envelope>"
  );
}

/** Read a single leaf element's text by local name (ignoring any namespace prefix). */
function leaf(scope: string, localName: string): string | undefined {
  const ln = escapeRegExp(localName);
  const re = new RegExp(`<(?:[\\w.-]+:)?${ln}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${ln}\\s*>`, "i");
  const m = re.exec(scope);
  if (!m) return undefined;
  return xmlUnescape(m[1] ?? "").trim();
}

function optional(value: string | undefined): string | undefined {
  return value !== undefined && value !== "" ? value : undefined;
}

/**
 * Parse a `retrieveAEOResponse` SOAP body. Throws {@link AeoServiceError} on a SOAP
 * Fault. A response with no `<result>` is a valid "no match" (results: []).
 */
export function parseRetrieveAeoResponse(xml: string): ParsedAeoResponse {
  const body = String(xml ?? "");

  const fault = /<(?:[\w.-]+:)?Fault(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?Fault\s*>/i.exec(body);
  if (fault) {
    const inner = fault[1] ?? "";
    const faultString = leaf(inner, "faultstring") || leaf(inner, "Reason") || "SOAP Fault";
    const faultCode = leaf(inner, "faultcode") || leaf(inner, "Code");
    throw new AeoServiceError(`AEO service fault: ${faultString}`, { faultCode });
  }

  // A retrieveAEOResponse wrapper must be present (even when it carries no result).
  if (!/<(?:[\w.-]+:)?retrieveAEOResponse(?:\s|>)/i.test(body) && !/<(?:[\w.-]+:)?return(?:\s|>)/i.test(body)) {
    throw new AeoServiceError("AEO service response did not contain a retrieveAEOResponse.");
  }

  const blocks =
    body.match(/<(?:[\w.-]+:)?result(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?result\s*>/gi) ?? [];

  const results: AeoRawResult[] = blocks.map((block) => ({
    authorisationHolderName: optional(leaf(block, "authorisationHolderName")),
    issuingCountry: optional(leaf(block, "issuingCountry")),
    competentCustomsAuthority: optional(leaf(block, "competentCustomsAuthority")),
    authorisationType: optional(leaf(block, "authorisation.type")),
    effectiveDate: optional(leaf(block, "effectiveDate")),
  }));

  return {
    requestDate: leaf(body, "requestDate"),
    errorDescription: optional(leaf(body, "errorDescription")),
    results,
  };
}
