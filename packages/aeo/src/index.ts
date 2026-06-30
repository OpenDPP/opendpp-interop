/**
 * @opendpp/aeo — Authorised Economic Operator (AEO) lookup
 *
 * Two layers:
 *   1. Pure, offline helpers — authorisation types (AEOC/AEOF/AEOS), AEO-number
 *      parsing, holder-name/country normalisation.
 *   2. Authoritative online lookup against the European Commission's official EOS
 *      aeo-retrieve web service — `lookupAeo` / `lookupAeoBatch` / `hasAeoAuthorisation`.
 *
 * The EU Commission service is the authoritative source for AEO trusted-trader
 * status (the interactive page lives at
 * https://ec.europa.eu/taxation_customs/dds2/eos/aeo_consultation.jsp). This package
 * has zero runtime dependencies and an injectable HTTP transport.
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

export {
  AUTHORISATION_TYPES,
  type AuthorisationType,
  isAuthorisationType,
  normalizeHolderName,
  normalizeCountryCode,
  parseAeoNumber,
  isValidAeoNumberSyntax,
  type AeoNumberParts,
} from "./format.js";

export {
  DEFAULT_REQUESTS_PER_SECOND,
  AeoRateLimiter,
  createAeoRateLimiter,
  defaultAeoRateLimiter,
  setDefaultAeoRateLimit,
  getDefaultAeoRateLimit,
  type RateLimiter,
} from "./rate-limit.js";

export {
  AEO_SOAP_NAMESPACE,
  AeoServiceError,
  buildRetrieveAeoEnvelope,
  parseRetrieveAeoResponse,
  type AeoRequestCriteria,
  type AeoRawResult,
  type ParsedAeoResponse,
} from "./soap.js";

export {
  AEO_RETRIEVE_ENDPOINT,
  AEO_RETRIEVE_WSDL,
  AEO_CONSULTATION_HOMEPAGE,
  MAX_CRITERIA_PER_REQUEST,
  lookupAeo,
  lookupAeoBatch,
  hasAeoAuthorisation,
  type AeoTransport,
  type AeoTransportRequest,
  type AeoTransportResponse,
  type AeoQuery,
  type LookupAeoOptions,
  type AeoAuthorisation,
  type AeoLookupResult,
} from "./lookup.js";
