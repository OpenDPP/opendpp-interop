/**
 * @opendpp/testdata — OpenDPP synthetic sample-data generator
 *
 * Deterministic, category-valid SAMPLE passports (and EPCIS-shaped supply-chain event
 * chains) for integrating against the OpenDPP Digital Product Passport API without
 * hand-crafting ESPR-shaped payloads. Covers every ESPR category the public contract
 * recognises; emits the public passport-create shape (`POST /api/v1/passports`,
 * `/passports/bulk`) and round-trips the @opendpp/csv template columns.
 *
 * SYNTHETIC BY CONSTRUCTION: fictional operators/facilities marked "(SAMPLE)", GTINs
 * minted under a fictional GS1 company prefix (valid mod-10 via @opendpp/gs1), and
 * example.opendpp-node.eu URLs. Output is structurally valid against the public
 * per-category schemas (`GET /api/v1/schemas/{category}`); the hosted node remains
 * authoritative for validation, GS1 enforcement, operator binding and sealing.
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

export { ESPR_CATEGORIES, isEsprCategory, type EsprCategory, type PassportCreateInput } from "@opendpp/csv";

export {
  DEFAULT_SEED,
  generatePassport,
  generatePassports,
  type GeneratePassportOptions,
  type GeneratePassportsOptions,
} from "./passports.js";

export {
  generateEventChain,
  toUntpEventCredential,
  type EpcisAction,
  type EpcisEventType,
  type EpcisTestEvent,
  type GenerateEventChainOptions,
  type ToUntpEventCredentialOptions,
} from "./events.js";

export { passportToCsvRow, passportsToCsv } from "./csv.js";

export { MAX_ITEMS_PER_CATEGORY, TESTDATA_GS1_PREFIX, sampleGtin, sgtinEpc } from "./identifiers.js";
