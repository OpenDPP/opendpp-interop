/**
 * @opendpp/testdata — per-category sample metadata templates (internal).
 *
 * Builds the per-category ESPR `metadata` object for one sample passport. Two invariants
 * every template MUST keep:
 *
 *   1. VALID: covers every key the public per-category schema requires (the same rule set
 *      served at `GET /api/v1/schemas/{category}`), with in-range values — so a generated
 *      passport passes ingest validation as-is.
 *   2. CSV-EXPRESSIBLE: every emitted field maps onto a column of the @opendpp/csv template
 *      for that category (the one exception is the human-friendly `productName`, which the
 *      public CSV template has no column for) — so a generated passport round-trips
 *      `passportToCsvRow` → `mapCsvRowToPassport` losslessly. Values therefore never contain
 *      the CSV micro-format separators `:` and `|` (`,` is fine — the CSV writer quotes).
 *
 * All names/identifiers are SYNTHETIC: "(SAMPLE)" markers, fictional EORIs, and
 * example.opendpp-node.eu URLs (a domain OpenDPP controls).
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { EsprCategory } from "@opendpp/csv";
import type { Rng } from "./prng.js";

/** One synthetic manufacturing site (fictional; the EORI's first two letters double as originCountry). */
interface SampleFacility {
  name: string;
  location: string;
  eori: string;
  /** "lat,lng" — reused by event chains as the readPoint. */
  geo: string;
}

export const SAMPLE_FACILITIES: readonly SampleFacility[] = [
  { name: "Vilnius Assembly Works (SAMPLE)", location: "Vilnius, Lithuania", eori: "LT123456789012", geo: "54.6872,25.2797" },
  { name: "Saxony Cell Plant (SAMPLE)", location: "Dresden, Germany", eori: "DE987654321000", geo: "51.0504,13.7373" },
  { name: "Porto Finishing Line (SAMPLE)", location: "Porto, Portugal", eori: "PT500100200300", geo: "41.1579,-8.6291" },
  { name: "Basque Foundry (SAMPLE)", location: "Bilbao, Spain", eori: "ES112233445566", geo: "43.2630,-2.9350" },
  { name: "Uppsala Materials Lab (SAMPLE)", location: "Uppsala, Sweden", eori: "SE778899001122", geo: "59.8586,17.6389" },
];

const ACTIVITIES = [
  "Manufacturing and assembly",
  "Final inspection and packaging",
  "Component fabrication",
  "Surface treatment and finishing",
] as const;

const PRODUCT_NAMES: Record<EsprCategory, readonly string[]> = {
  textiles: ["Merino Crewneck Sweater", "Organic Cotton Tee", "Recycled Denim Jacket", "Linen Summer Shirt"],
  batteries: ["LFP Industrial Cell", "NMC EV Module", "Sodium-Ion Storage Pack", "LTO Transit Battery"],
  construction: ["Mineral Wool Panel", "Cross-Laminated Timber Beam", "Recycled Aggregate Block", "Gypsum Fibre Board"],
  electronics: ["Smart Thermostat", "Cordless Drill", "LED Panel Luminaire", "Network Media Player"],
  chemicals: ["Industrial Degreaser", "Waterborne Coating", "Adhesive Resin", "Specialty Solvent Blend"],
  cosmetics: ["Hydrating Face Cream", "Mineral Sunscreen", "Botanical Shampoo", "Classic Lip Balm"],
  toys: ["Wooden Stacking Blocks", "Plush Forest Fox", "Construction Brick Set", "Pull-Along Duck"],
  "iron-steel": ["Hot-Rolled Structural Beam", "Cold-Formed Steel Coil", "Rebar Grade Bundle", "Galvanised Sheet Panel"],
  aluminium: ["Extruded Frame Profile", "Beverage Can Body Stock", "Cast Alloy Wheel Blank", "Facade Cladding Sheet"],
};

const MATERIALS: Record<EsprCategory, readonly string[]> = {
  textiles: ["Organic Cotton", "Recycled Polyester", "Elastane", "Linen", "Merino Wool"],
  batteries: ["LFP Cathode", "Graphite Anode", "Aluminium Casing", "Copper Collector", "Electrolyte"],
  construction: ["Mineral Wool", "Recycled Glass", "Basalt Fibre", "Gypsum", "Cement Binder"],
  electronics: ["Recycled ABS Housing", "Copper Wiring", "Silicon PCB", "Aluminium Heatsink", "Glass Display"],
  chemicals: ["Aqueous Base", "Surfactant Blend", "Acrylic Polymer", "Stabiliser"],
  cosmetics: ["Aqua Base", "Plant Glycerin", "Shea Butter", "Mineral Pigment"],
  toys: ["FSC Beech Wood", "Water-Based Paint", "Recycled Polypropylene", "Cotton Fabric"],
  "iron-steel": ["Recycled Scrap Steel", "Virgin Iron Ore", "Alloying Elements"],
  aluminium: ["Post-Consumer Scrap", "Primary Aluminium", "Magnesium Alloy"],
};

const CERT_NAMES: Record<EsprCategory, readonly string[]> = {
  textiles: ["Fibre Content Verification", "OEKO-Style Substance Screening"],
  batteries: ["UN 38.3 Transport Test Summary", "Battery Regulation CE Assessment"],
  construction: ["Declaration of Performance Assessment", "Reaction-to-Fire Classification"],
  electronics: ["Low Voltage Directive Assessment", "Electromagnetic Compatibility Report"],
  chemicals: ["CLP Classification Review", "REACH Registration Summary"],
  cosmetics: ["Product Information File Review", "Preservative Efficacy Test"],
  toys: ["Toy Safety Directive Assessment", "Mechanical and Physical Test Report"],
  "iron-steel": ["Mill Test Certificate", "Structural Grade Verification"],
  aluminium: ["Alloy Composition Certificate", "Anodising Quality Assessment"],
};

/** `n` distinct materials with integer percentages summing to exactly 100. */
function composition(rng: Rng, pool: readonly string[], key: "material" | "fiber"): Record<string, number | string>[] {
  const n = Math.min(rng.int(2, 3), pool.length);
  const names = rng.pickN(pool, n);
  const shares: number[] = [];
  let remaining = 100;
  for (let i = 0; i < n - 1; i++) {
    // Leave >=10 for each remaining slot so every share stays a plausible 10..80.
    const share = rng.int(10, remaining - 10 * (n - 1 - i));
    shares.push(share);
    remaining -= share;
  }
  shares.push(remaining);
  return names.map((name, i) => ({ [key]: name, percentage: shares[i] }));
}

const docUrl = (rng: Rng, kind: string): string =>
  `https://compliance.example.opendpp-node.eu/docs/${kind}-${rng.hex(8)}.pdf`;

function certificates(rng: Rng, category: EsprCategory): Record<string, unknown>[] {
  return rng.pickN(CERT_NAMES[category], rng.int(1, 2)).map((name) => ({
    name: `${name} (SAMPLE)`,
    referenceNumber: `SAMPLE-${rng.int(1000, 9999)}-${rng.int(10, 99)}`,
    issuer: rng.pick(["Notified Body 0000 (SAMPLE)", "Conformity Institute Vilnius (SAMPLE)"]),
    validUntil: `${rng.int(2029, 2033)}-${String(rng.int(1, 12)).padStart(2, "0")}-15`,
  }));
}

function facilityDetails(rng: Rng, category: EsprCategory): Record<string, unknown>[] {
  const fac = rng.pick(SAMPLE_FACILITIES);
  const detail: Record<string, unknown> = {
    facilityName: fac.name,
    location: fac.location,
    activity: rng.pick(ACTIVITIES),
    eori: fac.eori,
  };
  // Per-facility deforestation/forced-labour traceability data, mirroring the hosted validation
  // engine's matrix: EUDR plots are mandatory for textiles + chemicals, traceability docs for
  // textiles + electronics. One of each is exactly what the CSV facility cell can carry.
  if (category === "textiles" || category === "chemicals") {
    detail.eudrPlots = [
      {
        plotId: `EUDR-${rng.int(1000, 9999)}`,
        polygonType: "point",
        coordinates: [{ lat: rng.float(36, 60, 4), lng: rng.float(-9, 25, 4) }],
      },
    ];
  }
  if (category === "textiles" || category === "electronics") {
    detail.traceabilityDocs = [
      {
        documentName: "Supply Chain Origin Attestation (SAMPLE)",
        documentHash: rng.hex(64),
        documentUrl: `https://traceability.example.opendpp-node.eu/docs/origin-${rng.hex(8)}.pdf`,
      },
    ];
  }
  return [detail];
}

/** Builds the full, valid, CSV-expressible sample `metadata` object for one passport. */
export function buildMetadata(category: EsprCategory, rng: Rng): Record<string, unknown> {
  const scope1 = rng.int(20, 180);
  const scope2 = rng.int(30, 260);
  const scope3 = rng.int(50, 420);
  const facilities = facilityDetails(rng, category);
  const m: Record<string, unknown> = {
    category,
    productName: `${rng.pick(PRODUCT_NAMES[category])} (SAMPLE)`,
    materialComposition: composition(rng, MATERIALS[category], "material"),
    carbonFootprint: { unit: "kg CO2e", co2eKg: scope1 + scope2 + scope3, scope1, scope2, scope3 },
    originCountry: (facilities[0].eori as string).slice(0, 2),
    facilityDetails: facilities,
    regulatoryCompliance: {
      ceMarking: true,
      certificates: certificates(rng, category),
      declarationOfConformityUrl: docUrl(rng, "conformity"),
    },
  };

  switch (category) {
    case "textiles":
      m.fiberComposition = composition(rng, MATERIALS.textiles, "fiber");
      m.size = rng.pick(["XS", "S", "M", "L", "XL"]);
      m.careInstructions = rng.pickN(
        ["Machine wash cold", "Do not tumble dry", "Iron on low heat", "Wash inside out", "Line dry in shade"],
        rng.int(2, 3),
      );
      m.recycledContent = {
        percentage: rng.int(10, 80),
        source: rng.pick(["pre-consumer", "post-consumer", "mixed"]),
      };
      break;
    case "batteries":
      m.batteryCategory = rng.pick(["industrial", "ev", "portable", "lmt"]);
      m.chemistry = rng.pick(["LFP", "NMC 811", "LTO", "Sodium-ion"]);
      // Keep the flagship category coherent: the display name reflects the drawn chemistry.
      m.productName = `${m.chemistry} ${rng.pick(["Industrial Cell", "EV Module", "Storage Pack", "Transit Battery"])} (SAMPLE)`;
      m.electrochemicalCapacity = { value: rng.int(20, 300), unit: "Ah" };
      m.stateOfCharge = rng.int(20, 80);
      m.durability = { cycleLife: rng.int(2000, 8000), calendarLifeYears: rng.int(8, 20) };
      // Annex XIII battery identity fields (audit H4) — CSV-expressible via the manufacturerName /
      // dateOfManufacture / placeOfManufactureCountry columns of the @opendpp/csv batteries template.
      m.manufacturer = { name: `${rng.pick(["Saxony Battery Works", "Trondheim Cell", "Iberia Energy Cells", "Baltic Power Systems"])} GmbH (SAMPLE)` };
      m.dateOfManufacture = `2026-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
      m.placeOfManufacture = { country: (facilities[0].eori as string).slice(0, 2) };
      m.recycledContentShare = {
        cobalt: rng.int(0, 25),
        lithium: rng.int(0, 12),
        lead: 0,
        nickel: rng.int(0, 20),
      };
      m.esgDueDiligence = {
        dueDiligenceReportUrl: docUrl(rng, "diligence"),
        cobaltCountryOfOrigin: rng.pick(["CD", "AU", "MA"]),
        lithiumCountryOfOrigin: rng.pick(["CL", "AU", "PT"]),
        nickelCountryOfOrigin: rng.pick(["ID", "CA", "FI"]),
      };
      break;
    case "construction": {
      m.declarationOfPerformanceNumber = `DoP-SAMPLE-${rng.int(10000, 99999)}`;
      // The public CSV template carries ONE declarationOfConformityUrl column, which the mapper
      // feeds to BOTH the regulatory block and this top-level construction field — keep them equal.
      m.declarationOfConformityUrl = (m.regulatoryCompliance as Record<string, unknown>).declarationOfConformityUrl;
      break;
    }
    case "electronics":
      m.model = `EL-${rng.int(100, 999)} (SAMPLE)`;
      m.standbyPower = { value: rng.float(0.1, 2, 1), unit: "W" };
      m.batteryLife = rng.int(8, 72);
      m.recycledPlasticContent = rng.int(10, 60);
      m.circularityIndices = { repairabilityScore: rng.int(5, 10), durabilityScore: rng.int(5, 10) };
      m.electronicWasteInstructions = "Return via a WEEE collection point; never dispose of in household waste.";
      break;
    case "chemicals":
      m.hazardClassification = rng.pickN(["H315", "H319", "H412", "H302"], 2);
      m.safetyDatasheetUrl = docUrl(rng, "sds");
      m.presenceOfSVHC = false;
      break;
    case "cosmetics":
      m.ingredientList = rng.pickN(
        ["Aqua", "Glycerin", "Sodium Chloride", "Butyrospermum Parkii Butter", "Tocopherol", "Parfum"],
        rng.int(3, 5),
      );
      m.packagingRecyclability = rng.int(40, 95);
      break;
    case "toys":
      m.ageGrading = rng.pick(["0+", "3+", "6+", "8+"]);
      m.chemicalContentCertificates = rng.pickN(
        ["EN 71-3 Migration Report (SAMPLE)", "Phthalate Screening Certificate (SAMPLE)"],
        rng.int(1, 2),
      );
      m.physicalSafetyParameters = {
        chokingHazardWarning: true,
        sharpEdgesChecked: true,
        flammabilityCertified: true,
      };
      break;
    case "iron-steel":
      m.scrapMetalContentRatio = rng.int(20, 95);
      m.tensileStrengthClass = rng.pick(["S235JR", "S275J0", "S355JR", "S460M"]);
      m.carbonEmissionIntensityPerTon = rng.int(400, 2200);
      break;
    case "aluminium":
      m.postConsumerScrapContent = rng.int(20, 90);
      m.smelterElectricitySource = rng.pick(["hydro", "wind", "solar", "grid-mix"]);
      m.energyIntensityPerKg = rng.int(5, 15);
      break;
  }
  return m;
}
