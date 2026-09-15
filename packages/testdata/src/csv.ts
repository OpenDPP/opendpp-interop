/**
 * @opendpp/testdata — CSV serialization of generated samples.
 *
 * The exact INVERSE of @opendpp/csv's row→passport mapping, restricted to what the public
 * CSV templates can express: `passportToCsvRow(generatePassport(...))` fed back through
 * `mapCsvRowToPassport` reproduces the generated metadata (minus `productName`, which the
 * public template has no column for). Guarded by this package's round-trip tests, so the
 * two packages cannot drift apart silently.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { passportCsvTemplate, type EsprCategory, type PassportCreateInput } from "@opendpp/csv";

type Meta = Record<string, any>;

const setCell = (row: Record<string, string>, name: string, value: unknown): void => {
  if (value !== undefined && value !== null) row[name] = String(value);
};

const joinPairs = (items: { percentage: number }[] | undefined, key: string): string | undefined =>
  items?.map((i) => `${(i as Meta)[key]}:${i.percentage}`).join("|");

const joinList = (items: string[] | undefined): string | undefined => items?.join("|");

/** The text of a translated value (the generated samples carry one language, which the row's `language` cell names). */
const textOf = (v: Meta[] | undefined): string | undefined => v?.[0]?.value;

/** A document reference as its `contentType|url|title|language` cell (trailing blanks trimmed). */
const resourceCell = (r: Meta | undefined): string | undefined =>
  r ? trimTrailingPipes([r.contentType, r.url, r.resourceTitle ?? "", r.language ?? ""].join("|")) : undefined;

/** Drop empty trailing segments of a `|` micro-format cell (a loop, not a regex — no backtracking to reason about). */
function trimTrailingPipes(cell: string): string {
  let end = cell.length;
  while (end > 0 && cell[end - 1] === "|") end -= 1;
  return cell.slice(0, end);
}

function facilityCell(facilities: Meta[] | undefined): string | undefined {
  if (!facilities?.length) return undefined;
  return facilities
    .map((f) => {
      const segs = [f.facilityName, f.location, f.activity];
      if (f.eori !== undefined) segs.push(f.eori);
      const plot = f.eudrPlots?.[0];
      if (plot) {
        const coords = (plot.coordinates as Meta[]).flatMap((c) => [c.lat, c.lng]);
        segs.push([plot.plotId, plot.polygonType, ...coords].join("|"));
      }
      const doc = f.traceabilityDocs?.[0];
      if (doc) segs.push(trimTrailingPipes([doc.contentType, doc.url, doc.resourceTitle, doc.documentHash, doc.language ?? ""].join("|")));
      return segs.join(":");
    })
    .join("||");
}

const certificatesCell = (certs: Meta[] | undefined): string | undefined =>
  certs?.length
    ? certs.map((c) => [c.name, c.referenceNumber, c.issuer, c.validUntil].join(":")).join("|")
    : undefined;

/** The one language the sample's translated texts carry (the CSV template holds one per row). */
function languageOf(m: Meta): string | undefined {
  const first = m.productName?.[0] ?? m.careInstructions?.[0]?.[0] ?? m.electronicWasteInstructions?.[0];
  return first?.language ?? "en-GB";
}

/**
 * Serializes one generated passport to the cells of its category's public CSV template.
 * Only CSV-expressible fields are written (generated samples contain nothing else, except
 * `productName` — see the module note).
 */
export function passportToCsvRow(passport: PassportCreateInput): Record<string, string> {
  const m = passport.metadata as Meta;
  const row: Record<string, string> = {};
  setCell(row, "productId", passport.productId);
  setCell(row, "operatorId", passport.operatorId);
  setCell(row, "facilityId", passport.facilityId);
  setCell(row, "category", m.category);
  setCell(row, "language", languageOf(m));
  setCell(row, "materials", joinPairs(m.materialComposition, "material"));
  setCell(row, "origin", m.originCountry);
  setCell(row, "facilities", facilityCell(m.facilityDetails));
  setCell(row, "regulatoryCertificates", certificatesCell(m.regulatoryCompliance?.certificates));
  setCell(row, "declarationOfConformity", resourceCell(m.regulatoryCompliance?.declarationOfConformity));
  setCell(row, "ceMarking", m.regulatoryCompliance?.ceMarking);
  setCell(row, "carbonFootprint", m.carbonFootprint?.co2eKg);
  setCell(row, "scope1", m.carbonFootprint?.scope1);
  setCell(row, "scope2", m.carbonFootprint?.scope2);
  setCell(row, "scope3", m.carbonFootprint?.scope3);

  switch (m.category as EsprCategory) {
    case "textiles":
      setCell(row, "fiberComposition", joinPairs(m.fiberComposition, "fiber"));
      setCell(row, "size", m.size);
      setCell(row, "careInstructions", joinList((m.careInstructions as Meta[][] | undefined)?.map((step) => textOf(step) ?? "")));
      setCell(row, "recycledContentPct", m.recycledContent?.percentage);
      setCell(row, "recycledContentSource", m.recycledContent?.source);
      setCell(row, "takeBackScheme", resourceCell(m.circularityAttributes?.takeBackScheme));
      setCell(row, "repairabilityGuide", resourceCell(m.circularityAttributes?.repairabilityGuide));
      break;
    case "batteries":
      setCell(row, "batteryCategory", m.batteryCategory);
      setCell(row, "chemistry", m.chemistry);
      if (m.electrochemicalCapacity) {
        setCell(row, "electrochemicalCapacity", `${m.electrochemicalCapacity.value}:${m.electrochemicalCapacity.unit}`);
      }
      setCell(row, "stateOfCharge", m.stateOfCharge);
      setCell(row, "durabilityCycleLife", m.durability?.cycleLife);
      setCell(row, "durabilityCalendarLifeYears", m.durability?.calendarLifeYears);
      setCell(row, "recycledCobalt", m.recycledContentShare?.cobalt);
      setCell(row, "recycledLithium", m.recycledContentShare?.lithium);
      setCell(row, "recycledLead", m.recycledContentShare?.lead);
      setCell(row, "recycledNickel", m.recycledContentShare?.nickel);
      setCell(row, "disassemblyManual", resourceCell(m.circularityAndDisassembly?.disassemblyManual));
      setCell(row, "dueDiligenceReport", resourceCell(m.esgDueDiligence?.dueDiligenceReport));
      setCell(row, "cobaltCountryOfOrigin", m.esgDueDiligence?.cobaltCountryOfOrigin);
      setCell(row, "lithiumCountryOfOrigin", m.esgDueDiligence?.lithiumCountryOfOrigin);
      setCell(row, "nickelCountryOfOrigin", m.esgDueDiligence?.nickelCountryOfOrigin);
      setCell(row, "manufacturerName", m.manufacturer?.name);
      setCell(row, "manufacturerAddress", m.manufacturer?.address);
      setCell(row, "dateOfManufacture", m.dateOfManufacture);
      setCell(row, "placeOfManufactureCountry", m.placeOfManufacture?.country);
      setCell(row, "placeOfManufactureCity", m.placeOfManufacture?.city);
      break;
    case "electronics":
      setCell(row, "model", m.model);
      if (m.standbyPower) setCell(row, "standbyPower", `${m.standbyPower.value}:${m.standbyPower.unit}`);
      setCell(row, "batteryLife", m.batteryLife);
      setCell(row, "recycledPlasticContent", m.recycledPlasticContent);
      setCell(row, "repairabilityScore", m.circularityIndices?.repairabilityScore);
      setCell(row, "durabilityScore", m.circularityIndices?.durabilityScore);
      setCell(row, "electronicWasteInstructions", textOf(m.electronicWasteInstructions));
      setCell(row, "upgradeabilityInstructions", resourceCell(m.circularityAndMaintenance?.upgradeabilityInstructions));
      break;
    case "chemicals":
      setCell(row, "hazardClassification", joinList(m.hazardClassification));
      setCell(row, "safetyDatasheet", resourceCell(m.safetyDatasheet));
      setCell(row, "presenceOfSVHC", m.presenceOfSVHC);
      break;
    case "construction":
      setCell(row, "declarationOfPerformanceNumber", m.declarationOfPerformanceNumber);
      setCell(row, "declarationOfPerformance", resourceCell(m.declarationOfPerformance));
      break;
    case "cosmetics":
      setCell(row, "ingredientList", joinList(m.ingredientList));
      setCell(row, "packagingRecyclability", m.packagingRecyclability);
      break;
    case "toys":
      setCell(row, "ageGrading", m.ageGrading);
      setCell(row, "chemicalContentCertificates", joinList(m.chemicalContentCertificates));
      setCell(row, "chokingHazardWarning", m.physicalSafetyParameters?.chokingHazardWarning);
      setCell(row, "sharpEdgesChecked", m.physicalSafetyParameters?.sharpEdgesChecked);
      setCell(row, "flammabilityCertified", m.physicalSafetyParameters?.flammabilityCertified);
      break;
    case "iron-steel":
      setCell(row, "scrapMetalContentRatio", m.scrapMetalContentRatio);
      setCell(row, "tensileStrengthClass", m.tensileStrengthClass);
      setCell(row, "carbonEmissionIntensityPerTon", m.carbonEmissionIntensityPerTon);
      break;
    case "aluminium":
      setCell(row, "postConsumerScrapContent", m.postConsumerScrapContent);
      setCell(row, "smelterElectricitySource", m.smelterElectricitySource);
      setCell(row, "energyIntensityPerKg", m.energyIntensityPerKg);
      break;
  }
  return row;
}

/** RFC-4180 cell quoting: wrap when the cell contains a comma, quote, or newline. */
const quoteCell = (cell: string): string => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);

/**
 * Renders generated passports as CSV text under the category's official template header
 * (column order from @opendpp/csv), ready for the portal importer or your own tooling.
 */
export function passportsToCsv(category: EsprCategory, passports: PassportCreateInput[]): string {
  const columns = passportCsvTemplate(category).columns.map((c) => c.name);
  const lines = [columns.join(",")];
  for (const passport of passports) {
    const row = passportToCsvRow(passport);
    lines.push(columns.map((name) => quoteCell(row[name] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}
