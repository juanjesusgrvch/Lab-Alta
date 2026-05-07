import {
  createDemoDefectAnalyses,
  createDemoNaturalEntries,
  createDemoSamples,
} from "@/lib/demo-data";
import type {
  DashboardRelationalSeed,
  DefectAnalysis,
  NaturalEntry,
  StoredSample,
} from "@/types/domain";

const createSeed = (
  seed: Partial<DashboardRelationalSeed> & Pick<DashboardRelationalSeed, "source">,
) => ({
  source: seed.source,
  client: seed.client?.trim() ?? "",
  supplier: seed.supplier?.trim() ?? "",
  product: seed.product?.trim() ?? "",
  processCode: seed.processCode?.trim() ?? "",
  analysisReference: seed.analysisReference?.trim() ?? "",
  outputStage: seed.outputStage?.trim() ?? "",
  warehouseZone: seed.warehouseZone?.trim() ?? "",
  shelf: seed.shelf?.trim() ?? "",
  sampleCode: seed.sampleCode?.trim() ?? "",
  gramajeHundredths:
    typeof seed.gramajeHundredths === "number" && seed.gramajeHundredths > 0
      ? Math.round(seed.gramajeHundredths)
      : null,
}) satisfies DashboardRelationalSeed;

export const buildNaturalRelationalSeeds = (
  entries: Array<
    Partial<
      Pick<
        NaturalEntry,
        "client" | "supplier" | "product" | "processCode" | "analysisCode"
      >
    >
  >,
) =>
  entries.flatMap((entry) => {
    const baseSeed = createSeed({
      source: "natural",
      client: entry.client,
      supplier: entry.supplier,
      product: entry.product,
      processCode: entry.processCode,
      analysisReference: entry.analysisCode,
    });

    const analysisOnlySeed = entry.analysisCode?.trim()
      ? createSeed({
          source: "natural",
          analysisReference: entry.analysisCode,
        })
      : null;

    return analysisOnlySeed ? [baseSeed, analysisOnlySeed] : [baseSeed];
  });

export const buildSampleRelationalSeeds = (
  samples: Array<
    Partial<
      Pick<
        StoredSample,
        | "client"
        | "supplier"
        | "product"
        | "processCode"
        | "relatedAnalysisId"
        | "warehouseZone"
        | "shelf"
        | "sampleCode"
        | "gramajeHundredths"
      >
    >
  >,
) =>
  samples.map((sample) =>
    createSeed({
      source: "samples",
      client: sample.client,
      supplier: sample.supplier,
      product: sample.product,
      processCode: sample.processCode,
      analysisReference: sample.relatedAnalysisId,
      warehouseZone: sample.warehouseZone,
      shelf: sample.shelf,
      sampleCode: sample.sampleCode,
      gramajeHundredths:
        typeof sample.gramajeHundredths === "number"
          ? sample.gramajeHundredths
          : null,
    }),
  );

export const buildDefectRelationalSeeds = (
  analyses: Array<
    Partial<
      Pick<
        DefectAnalysis,
        | "id"
        | "client"
        | "supplier"
        | "product"
        | "processCode"
        | "relatedAnalysis"
        | "outputStage"
        | "gramajeHundredths"
      >
    >
  >,
) =>
  analyses.map((analysis) =>
    createSeed({
      source: "defects",
      client: analysis.client,
      supplier: analysis.supplier,
      product: analysis.product,
      processCode: analysis.processCode,
      analysisReference: analysis.relatedAnalysis || analysis.id,
      outputStage: analysis.outputStage,
      gramajeHundredths:
        typeof analysis.gramajeHundredths === "number"
          ? analysis.gramajeHundredths
          : null,
    }),
  );

export const createDemoDashboardRelationalSeeds = () => [
  ...buildNaturalRelationalSeeds(createDemoNaturalEntries()),
  ...buildSampleRelationalSeeds(createDemoSamples()),
  ...buildDefectRelationalSeeds(createDemoDefectAnalyses()),
];
