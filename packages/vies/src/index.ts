/**
 * @opendpp/vies — EU VAT-ID validation
 *
 * Two layers:
 *   1. Pure, offline syntax/parsing — `isValidEuVatId`, `parseVatId`,
 *      `normalizeVatId`, EU VAT-prefix classification.
 *   2. Online existence check against the European Commission's official VIES
 *      service — `checkVatId` / `checkVatIdBatch` / `isVatRegistered`.
 *
 * VIES (VAT Information Exchange System) is the EU Commission's official
 * cross-border VAT-number validator (https://ec.europa.eu/taxation_customs/vies/).
 * This package has zero runtime dependencies and an injectable HTTP transport.
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
  EU_VAT_PREFIXES,
  isEuVatPrefix,
  normalizeVatId,
  isValidEuVatId,
  parseVatId,
  type ParsedVatId,
} from "./format.js";

export {
  VIES_CHECK_URL,
  VIES_HOMEPAGE,
  ViesServiceError,
  checkVatId,
  checkVatIdBatch,
  isVatRegistered,
  type ViesTransport,
  type ViesTransportRequest,
  type ViesTransportResponse,
  type ViesCheckOptions,
  type ViesCheckResult,
  type ViesCheckSource,
} from "./check.js";
