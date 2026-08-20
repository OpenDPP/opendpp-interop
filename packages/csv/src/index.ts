/**
 * @opendpp/csv — OpenDPP CSV → passport reference mapper
 *
 * Maps a parsed CSV row to the PUBLIC passport-create shape that the OpenDPP API
 * accepts (`POST /api/v1/passports` and `/passports/bulk`): `{ productId, operatorId?,
 * facilityId?, metadata }`. Pure, parser-agnostic, zero runtime dependencies — you bring
 * your own RFC-4180 parser (papaparse, csv-parse, …) and hand the rows in.
 *
 * This is a fresh reference implementation derived from the documented public CSV
 * templates + the public ingest contract — NOT a lift of the hosted node's internals.
 * The package only produces JSON you could POST yourself; the hosted node remains the
 * single source of ESPR validation, GS1 check-digit enforcement, operator binding,
 * eIDAS sealing, and the `vcReady` / `warnings` signals returned at ingest.
 *
 * DATA INTEGRITY (load-bearing): a blank cell yields an ABSENT metadata field — never a
 * fabricated default — so the server's ESPR validation rejects an incomplete row rather
 * than the importer inventing regulated data.
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

/** One parsed CSV row: a map of column header → cell value (an absent/blank cell is `undefined`). */
export type PassportCsvRow = Record<string, string | undefined>;

/**
 * The public passport-create payload accepted by `POST /api/v1/passports` (single) and each row of
 * `POST /api/v1/passports/bulk`. `metadata` is the per-category ESPR object; the hosted node validates
 * it (and is authoritative). `operatorId` may be omitted only when the workspace has exactly one bound
 * economic operator; `facilityId` links a manufacturing Facility and is what makes the result `vcReady`.
 */
export interface PassportCreateInput {
  productId: string;
  operatorId?: string;
  facilityId?: string;
  metadata: Record<string, unknown>;
}

/** The nine ESPR product categories OpenDPP recognises. */
export const ESPR_CATEGORIES = [
  "textiles",
  "batteries",
  "construction",
  "electronics",
  "chemicals",
  "cosmetics",
  "toys",
  "iron-steel",
  "aluminium",
] as const;

export type EsprCategory = (typeof ESPR_CATEGORIES)[number];

/** Type guard for a known ESPR category slug. */
export function isEsprCategory(value: string | undefined): value is EsprCategory {
  return typeof value === "string" && (ESPR_CATEGORIES as readonly string[]).includes(value);
}

/** A single column in a downloadable CSV template. `required` is a best-effort hint — the live
 *  per-category JSON Schema (`GET /api/v1/schemas/{category}`) is authoritative for the full rule set. */
export interface CsvColumn {
  name: string;
  required: boolean;
  description: string;
}

/** The canonical column set for one category's CSV template. */
export interface PassportCsvTemplate {
  category: EsprCategory;
  columns: CsvColumn[];
}

// --- value coercion: only return a value when the cell is genuinely present (never a default) ---

const str = (v: string | undefined): string | undefined => {
  const s = (v ?? "").trim();
  return s.length ? s : undefined;
};
const num = (v: string | undefined): number | undefined => {
  const s = str(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v: string | undefined): boolean => str(v)?.toLowerCase() === "true";
const pipeList = (v: string | undefined): string[] | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const out = s.split("|").map((x) => x.trim()).filter(Boolean);
  return out.length ? out : undefined;
};
/** Assign `obj[key] = val` only when `val` is defined — keeps absent fields absent (no fabrication). */
const set = (obj: Record<string, unknown>, key: string, val: unknown): void => {
  if (val !== undefined) obj[key] = val;
};

// Split a facility cell on ':' but re-join any URL that was split on the ':' in 'https://'.
function splitFacilitySegments(fStr: string): string[] {
  const raw = fStr.split(":");
  const segs: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let cur = raw[i];
    while (i + 1 < raw.length && raw[i + 1].startsWith("//")) {
      cur += ":" + raw[i + 1];
      i++;
    }
    segs.push(cur);
  }
  return segs;
}

function parseMaterials(cell: string | undefined): Record<string, unknown>[] | undefined {
  if (!cell) return undefined;
  const out = cell
    .split("|")
    .map((m) => {
      const [name, pct] = m.split(":");
      return { material: str(name), percentage: num(pct) };
    })
    .filter((m) => m.material !== undefined);
  return out.length ? out : undefined;
}

function parseFibers(cell: string | undefined): Record<string, unknown>[] | undefined {
  if (!cell) return undefined;
  const out = cell
    .split("|")
    .map((f) => {
      const [fiber, pct] = f.split(":");
      return { fiber: str(fiber), percentage: num(pct) };
    })
    .filter((f) => f.fiber !== undefined);
  return out.length ? out : undefined;
}

function parseCertificates(cell: string | undefined): Record<string, unknown>[] {
  if (!cell) return [];
  return cell
    .split("|")
    .map((c) => {
      const [name, ref, issuer, validUntil] = c.split(":");
      const o: Record<string, unknown> = {};
      set(o, "name", str(name));
      set(o, "referenceNumber", str(ref));
      set(o, "issuer", str(issuer));
      set(o, "validUntil", str(validUntil));
      return o;
    })
    .filter((c) => c.name !== undefined);
}

function parseFacilities(cell: string | undefined): Record<string, unknown>[] | undefined {
  if (!cell) return undefined;
  const facs = cell.split("||").map((fStr) => {
    const segs = splitFacilitySegments(fStr);
    const fac: Record<string, unknown> = {};
    set(fac, "facilityName", str(segs[0]));
    set(fac, "location", str(segs[1]));
    set(fac, "activity", str(segs[2]));
    // Field order after name/location/activity varies by sector (eori, eudrPlots, traceabilityDocs are
    // all optional). Detect each by content: a URL-bearing `|` group is the traceability doc, a non-URL
    // `|` group is the EUDR plot, a bare value is the EORI.
    let eori: string | undefined;
    let eudrRaw: string | undefined;
    let traceRaw: string | undefined;
    for (const s of segs.slice(3)) {
      const v = str(s);
      if (!v) continue;
      if (v.includes("|") && /https?:\/\//.test(v)) traceRaw = v;
      else if (v.includes("|")) eudrRaw = v;
      else if (!eori) eori = v;
    }
    set(fac, "eori", eori);
    if (eudrRaw) {
      const p = eudrRaw.split("|");
      const coordinates: Record<string, unknown>[] = [];
      for (let c = 2; c < p.length; c += 2) {
        const lat = num(p[c]);
        const lng = num(p[c + 1]);
        if (lat !== undefined && lng !== undefined) coordinates.push({ lat, lng });
      }
      const plot: Record<string, unknown> = { coordinates };
      set(plot, "plotId", str(p[0]));
      set(plot, "polygonType", str(p[1]));
      fac.eudrPlots = [plot];
    }
    if (traceRaw) {
      const p = traceRaw.split("|");
      const doc: Record<string, unknown> = {};
      set(doc, "documentName", str(p[0]));
      set(doc, "documentHash", str(p[1]));
      set(doc, "documentUrl", str(p[2]));
      fac.traceabilityDocs = [doc];
    }
    return fac;
  });
  return facs.length ? facs : undefined;
}

// Build carbonFootprint from whatever the row provides; omit the object entirely if there's nothing.
function parseCarbonFootprint(row: PassportCsvRow): Record<string, unknown> | undefined {
  const co2eKg = num(row.carbonFootprint);
  const scope1 = num(row.scope1);
  const scope2 = num(row.scope2);
  const scope3 = num(row.scope3);
  if (co2eKg === undefined && scope1 === undefined && scope2 === undefined && scope3 === undefined) {
    return undefined;
  }
  const cf: Record<string, unknown> = { unit: "kg CO2e" };
  set(cf, "co2eKg", co2eKg);
  set(cf, "scope1", scope1);
  set(cf, "scope2", scope2);
  set(cf, "scope3", scope3);
  return cf;
}

function scalarUnit(cell: string | undefined, defaultUnit: string): Record<string, unknown> | undefined {
  if (!cell) return undefined;
  const [val, unit] = cell.split(":");
  const v = num(val);
  if (v === undefined) return undefined;
  return { value: v, unit: str(unit) ?? defaultUnit };
}

/**
 * Maps a CSV row's cells to the per-category ESPR `metadata` object. Mirrors the column conventions of
 * the public `opendpp_*_template.csv` templates: lists use `|`, facilities use `||` between facilities
 * and `:` between a facility's fields, and `scalar:unit` / `material:percentage` pairs use `:`.
 */
function rowToMetadata(row: PassportCsvRow): Record<string, unknown> {
  const cat = str(row.category);
  const m: Record<string, unknown> = {};
  set(m, "category", cat);
  set(m, "materialComposition", parseMaterials(str(row.materials)));
  set(m, "carbonFootprint", parseCarbonFootprint(row));
  set(m, "originCountry", str(row.origin));
  set(m, "facilityDetails", parseFacilities(str(row.facilities)));

  const rc: Record<string, unknown> = {
    ceMarking: bool(row.ceMarking),
    certificates: parseCertificates(str(row.regulatoryCertificates)),
  };
  set(rc, "declarationOfConformityUrl", str(row.declarationOfConformityUrl));
  m.regulatoryCompliance = rc;

  if (cat === "textiles") {
    set(m, "fiberComposition", parseFibers(str(row.fiberComposition)));
    set(m, "size", str(row.size));
    set(m, "careInstructions", pipeList(row.careInstructions));
    const pct = num(row.recycledContentPct);
    if (pct !== undefined) {
      const r: Record<string, unknown> = { percentage: pct };
      set(r, "source", str(row.recycledContentSource));
      m.recycledContent = r;
    }
  } else if (cat === "batteries") {
    set(m, "batteryCategory", str(row.batteryCategory));
    set(m, "chemistry", str(row.chemistry));
    set(m, "electrochemicalCapacity", scalarUnit(str(row.electrochemicalCapacity), "Ah"));
    set(m, "stateOfCharge", num(row.stateOfCharge));
    const cycleLife = num(row.durabilityCycleLife);
    const cal = num(row.durabilityCalendarLifeYears);
    if (cycleLife !== undefined || cal !== undefined) {
      const d: Record<string, unknown> = {};
      set(d, "cycleLife", cycleLife);
      set(d, "calendarLifeYears", cal);
      m.durability = d;
    }
    const co = num(row.recycledCobalt);
    const li = num(row.recycledLithium);
    const pb = num(row.recycledLead);
    const ni = num(row.recycledNickel);
    if (co !== undefined || li !== undefined || pb !== undefined || ni !== undefined) {
      const s: Record<string, unknown> = {};
      set(s, "cobalt", co);
      set(s, "lithium", li);
      set(s, "lead", pb);
      set(s, "nickel", ni);
      m.recycledContentShare = s;
    }
    const ddUrl = str(row.dueDiligenceReportUrl);
    const coO = str(row.cobaltCountryOfOrigin);
    const liO = str(row.lithiumCountryOfOrigin);
    const niO = str(row.nickelCountryOfOrigin);
    if (ddUrl || coO || liO || niO) {
      const e: Record<string, unknown> = {};
      set(e, "dueDiligenceReportUrl", ddUrl);
      set(e, "cobaltCountryOfOrigin", coO);
      set(e, "lithiumCountryOfOrigin", liO);
      set(e, "nickelCountryOfOrigin", niO);
      m.esgDueDiligence = e;
    }
    // Annex XIII battery identity (audit H4): manufacturer / date / place of manufacture.
    set(m, "dateOfManufacture", str(row.dateOfManufacture));
    const mfrName = str(row.manufacturerName);
    const mfrAddress = str(row.manufacturerAddress);
    if (mfrName || mfrAddress) {
      const mf: Record<string, unknown> = {};
      set(mf, "name", mfrName);
      set(mf, "address", mfrAddress);
      m.manufacturer = mf;
    }
    const pomCountry = str(row.placeOfManufactureCountry);
    const pomCity = str(row.placeOfManufactureCity);
    if (pomCountry || pomCity) {
      const pom: Record<string, unknown> = {};
      set(pom, "country", pomCountry);
      set(pom, "city", pomCity);
      m.placeOfManufacture = pom;
    }
  } else if (cat === "electronics") {
    set(m, "model", str(row.model));
    set(m, "standbyPower", scalarUnit(str(row.standbyPower), "W"));
    set(m, "batteryLife", num(row.batteryLife));
    set(m, "recycledPlasticContent", num(row.recycledPlasticContent));
    const rep = num(row.repairabilityScore);
    const dur = num(row.durabilityScore);
    if (rep !== undefined || dur !== undefined) {
      const c: Record<string, unknown> = {};
      set(c, "repairabilityScore", rep);
      set(c, "durabilityScore", dur);
      m.circularityIndices = c;
    }
    set(m, "electronicWasteInstructions", str(row.electronicWasteInstructions));
  } else if (cat === "chemicals") {
    set(m, "hazardClassification", pipeList(row.hazardClassification));
    set(m, "safetyDatasheetUrl", str(row.safetyDatasheetUrl));
    m.presenceOfSVHC = bool(row.presenceOfSVHC);
  } else if (cat === "construction") {
    set(m, "declarationOfPerformanceNumber", str(row.declarationOfPerformanceNumber));
    // The CPR Declaration of Performance — its OWN column. It used to be fed from the
    // declarationOfConformityUrl cell, which made a construction row carry the same URL as both its
    // DoP and its Declaration of Conformity; they are different documents.
    set(m, "declarationOfPerformanceUrl", str(row.declarationOfPerformanceUrl));
  } else if (cat === "cosmetics") {
    set(m, "ingredientList", pipeList(row.ingredientList));
    const pr = str(row.packagingRecyclability);
    if (pr) {
      m.packagingRecyclability = pr.includes(":")
        ? { recycledContentPercentage: num(pr.split(":")[1]) }
        : num(pr);
    }
  } else if (cat === "toys") {
    set(m, "ageGrading", str(row.ageGrading));
    set(m, "chemicalContentCertificates", pipeList(row.chemicalContentCertificates));
    m.physicalSafetyParameters = {
      chokingHazardWarning: bool(row.chokingHazardWarning),
      sharpEdgesChecked: bool(row.sharpEdgesChecked),
      flammabilityCertified: bool(row.flammabilityCertified),
    };
  } else if (cat === "iron-steel") {
    set(m, "scrapMetalContentRatio", num(row.scrapMetalContentRatio));
    set(m, "tensileStrengthClass", str(row.tensileStrengthClass));
    set(m, "carbonEmissionIntensityPerTon", num(row.carbonEmissionIntensityPerTon));
  } else if (cat === "aluminium") {
    set(m, "postConsumerScrapContent", num(row.postConsumerScrapContent));
    set(m, "smelterElectricitySource", str(row.smelterElectricitySource));
    set(m, "energyIntensityPerKg", num(row.energyIntensityPerKg));
  }
  return m;
}

/**
 * Maps one parsed CSV row to a public passport-create payload. Throws if the row has no `productId`.
 * Reads optional top-level `operatorId` / `facilityId` columns; everything else becomes per-category
 * `metadata`. Does NOT inject a default operator and does NOT validate — pass the result to the public
 * API and let the hosted node be authoritative.
 */
export function mapCsvRowToPassport(row: PassportCsvRow): PassportCreateInput {
  const productId = str(row.productId);
  if (!productId) {
    throw new Error('CSV row is missing a "productId".');
  }
  const out: PassportCreateInput = { productId, metadata: rowToMetadata(row) };
  const operatorId = str(row.operatorId);
  if (operatorId !== undefined) out.operatorId = operatorId;
  const facilityId = str(row.facilityId);
  if (facilityId !== undefined) out.facilityId = facilityId;
  return out;
}

/**
 * Maps an array of parsed CSV rows to public passport-create payloads, ready for `POST
 * /api/v1/passports/bulk`. Wholly-empty rows (every cell blank) are skipped; a non-empty row missing
 * `productId` throws. No per-line error reporting or duplicate-key handling — that productized UX stays
 * in the hosted portal; here you get a clean, deterministic mapping.
 */
export function mapCsvRowsToPassports(rows: PassportCsvRow[]): PassportCreateInput[] {
  const out: PassportCreateInput[] = [];
  for (const row of rows) {
    const isEmpty = Object.values(row).every((v) => str(v) === undefined);
    if (isEmpty) continue;
    out.push(mapCsvRowToPassport(row));
  }
  return out;
}

// --- CSV templates: the canonical column set per category, for offline header generation/validation ---

const SHARED_COLUMNS: CsvColumn[] = [
  { name: "productId", required: true, description: "GTIN-14, GRAI, or free-form SKU (the hosted node enforces the GS1 mod-10 check digit)." },
  { name: "operatorId", required: false, description: "Economic operator id; omit only if your workspace has exactly one bound operator." },
  { name: "facilityId", required: false, description: "Manufacturing Facility id; required for a Verifiable Credential (makes the passport vcReady)." },
  { name: "category", required: true, description: "ESPR category slug (one of the nine ESPR_CATEGORIES)." },
  { name: "materials", required: true, description: "materialComposition as material:percentage pairs joined by | (e.g. Cotton:85|Polyester:15; must sum to 100)." },
  { name: "origin", required: true, description: "originCountry as an ISO 3166-1 alpha-2 code (e.g. PT)." },
  { name: "facilities", required: true, description: "facilityDetails as name:location:activity:eori, multiple joined by ||." },
  { name: "regulatoryCertificates", required: false, description: "certificates as name:reference:issuer:validUntil, joined by |." },
  { name: "declarationOfConformityUrl", required: false, description: "URL of the declaration of conformity." },
  { name: "declarationOfPerformanceUrl", required: false, description: "Construction only: URL of the CPR Declaration of Performance (a different document from the declaration of conformity)." },
  { name: "ceMarking", required: false, description: "true / false." },
  { name: "carbonFootprint", required: false, description: "Total product carbon footprint in kg CO2e." },
  { name: "scope1", required: false, description: "GHG scope 1 emissions (kg CO2e)." },
  { name: "scope2", required: false, description: "GHG scope 2 emissions (kg CO2e)." },
  { name: "scope3", required: false, description: "GHG scope 3 emissions (kg CO2e)." },
];

const col = (name: string, description: string, required = false): CsvColumn => ({ name, required, description });

const CATEGORY_COLUMNS: Record<EsprCategory, CsvColumn[]> = {
  textiles: [
    col("fiberComposition", "fiber:percentage pairs joined by | (e.g. Cotton:80|Elastane:20).", true),
    col("size", "Garment size."),
    col("careInstructions", "Care instructions joined by |."),
    col("recycledContentPct", "Recycled-content percentage."),
    col("recycledContentSource", "Recycled-content source."),
  ],
  batteries: [
    col("batteryCategory", "Battery category (e.g. EV, LMT, industrial).", true),
    col("chemistry", "Cell chemistry (e.g. NMC, LFP).", true),
    col("electrochemicalCapacity", "value:unit (e.g. 100:Ah; defaults to Ah)."),
    col("stateOfCharge", "State of charge (%)."),
    col("durabilityCycleLife", "Rated cycle life."),
    col("durabilityCalendarLifeYears", "Calendar life in years."),
    col("recycledCobalt", "Recycled cobalt share (%)."),
    col("recycledLithium", "Recycled lithium share (%)."),
    col("recycledLead", "Recycled lead share (%)."),
    col("recycledNickel", "Recycled nickel share (%)."),
    col("dueDiligenceReportUrl", "Supply-chain due-diligence report URL."),
    col("cobaltCountryOfOrigin", "Cobalt country of origin (ISO 3166-1 alpha-2)."),
    col("lithiumCountryOfOrigin", "Lithium country of origin (ISO 3166-1 alpha-2)."),
    col("nickelCountryOfOrigin", "Nickel country of origin (ISO 3166-1 alpha-2)."),
    col("manufacturerName", "Legal manufacturer name (Annex XIII)."),
    col("manufacturerAddress", "Manufacturer registered address (optional)."),
    col("dateOfManufacture", "Date of manufacture (YYYY-MM-DD)."),
    col("placeOfManufactureCountry", "Place of manufacture — country (ISO 3166-1 alpha-2)."),
    col("placeOfManufactureCity", "Place of manufacture — city (optional)."),
  ],
  electronics: [
    col("model", "Product model designation."),
    col("standbyPower", "value:unit (e.g. 0.5:W; defaults to W)."),
    col("batteryLife", "Battery life."),
    col("recycledPlasticContent", "Recycled plastic content (%)."),
    col("repairabilityScore", "Repairability score."),
    col("durabilityScore", "Durability score."),
    col("electronicWasteInstructions", "WEEE / e-waste handling instructions."),
  ],
  chemicals: [
    col("hazardClassification", "Hazard classes joined by |."),
    col("safetyDatasheetUrl", "Safety datasheet URL."),
    col("presenceOfSVHC", "true / false — presence of substances of very high concern."),
  ],
  construction: [
    col("declarationOfPerformanceNumber", "Declaration of Performance (DoP) number."),
    col("declarationOfPerformanceUrl", "Declaration of Performance (DoP) URL."),
  ],
  cosmetics: [
    col("ingredientList", "INCI ingredients joined by |."),
    col("packagingRecyclability", "A percentage, or recycled:NN for recycled-content percentage."),
  ],
  toys: [
    col("ageGrading", "Age grading."),
    col("chemicalContentCertificates", "Chemical-content certificates joined by |."),
    col("chokingHazardWarning", "true / false."),
    col("sharpEdgesChecked", "true / false."),
    col("flammabilityCertified", "true / false."),
  ],
  "iron-steel": [
    col("scrapMetalContentRatio", "Scrap-metal content ratio (%)."),
    col("tensileStrengthClass", "Tensile strength class."),
    col("carbonEmissionIntensityPerTon", "Carbon emission intensity per ton."),
  ],
  aluminium: [
    col("postConsumerScrapContent", "Post-consumer scrap content (%)."),
    col("smelterElectricitySource", "Smelter electricity source."),
    col("energyIntensityPerKg", "Energy intensity per kg."),
  ],
};

/**
 * Returns the canonical CSV column set for a category — the shared columns plus that category's own
 * columns. `required` flags are a best-effort hint; the live per-category JSON Schema served at
 * `GET /api/v1/schemas/{category}` is the authoritative rule set.
 */
export function passportCsvTemplate(category: EsprCategory): PassportCsvTemplate {
  if (!isEsprCategory(category)) {
    throw new Error(`Unknown ESPR category "${category}".`);
  }
  return { category, columns: [...SHARED_COLUMNS, ...CATEGORY_COLUMNS[category]] };
}

/** Returns the comma-joined CSV header row for a category's template. */
export function passportCsvTemplateHeader(category: EsprCategory): string {
  return passportCsvTemplate(category)
    .columns.map((c) => c.name)
    .join(",");
}
