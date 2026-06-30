/**
 * @opendpp/eori — EORI number validation
 *
 * Two layers:
 *   1. Pure, offline syntax/parsing — `isValidEoriSyntax`, `parseEori`,
 *      `normalizeEori`, `validateOperatorRegId`, country-prefix classification.
 *   2. Authoritative online validation against the European Commission's official
 *      EOS validation web service — `validateEori` / `validateEoriBatch`.
 *
 * The EU Commission service is the only authoritative validator for EU-issued
 * EORIs (the interactive page lives at
 * https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp). This package
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
  REG_ID_SCHEMES,
  type RegIdScheme,
  isValidEoriSyntax,
  validateOperatorRegId,
  normalizeEori,
  parseEori,
  type EoriParts,
} from "./format.js";

export {
  EU_EORI_COUNTRIES,
  classifyEoriCountry,
  type EoriCountryScope,
  type EoriCountryInfo,
} from "./countries.js";

export {
  EORI_SOAP_NAMESPACE,
  EoriServiceError,
  buildValidateEoriEnvelope,
  parseValidateEoriResponse,
  type RawEoriResult,
  type ParsedEoriResponse,
} from "./soap.js";

export {
  DEFAULT_REQUESTS_PER_SECOND,
  EoriRateLimiter,
  createEoriRateLimiter,
  defaultEoriRateLimiter,
  setDefaultEoriRateLimit,
  getDefaultEoriRateLimit,
  type RateLimiter,
} from "./rate-limit.js";

export {
  EORI_VALIDATION_ENDPOINT,
  EORI_VALIDATION_WSDL,
  EORI_VALIDATION_HOMEPAGE,
  MAX_EORI_PER_REQUEST,
  validateEori,
  validateEoriBatch,
  isEoriRegistered,
  type EoriTransport,
  type EoriTransportRequest,
  type EoriTransportResponse,
  type ValidateEoriOptions,
  type EoriValidationResult,
  type EoriValidationSource,
} from "./validate.js";
