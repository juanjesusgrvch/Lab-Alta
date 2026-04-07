export type DashboardTab = "defects" | "natural" | "samples";

export interface DefectItem {
  id: string;
  name: string;
  detail?: string;
  grams: number;
}

export interface DefectAnalysis {
  id: string;
  analysisDate: string;
  client: string;
  supplier: string;
  product: string;
  processCode: string;
  sampleWeightGr: number;
  relatedAnalysis: string;
  outputStage: string;
  gramajeHundredths: number;
  humidity: number;
  defects: DefectItem[];
  observations: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface NaturalAnalysisSummary {
  humidityPct: number;
  brokenPct: number;
  foreignMatterPct: number;
  notes: string;
}

export interface PackagingMovement {
  id: string;
  movementType: "alta" | "baja";
  packagingType: string;
  packagingCondition: string;
  quantity: number;
}

export interface NaturalEntry {
  id: string;
  entryDate: string;
  truckPlate: string;
  client: string;
  supplier: string;
  product: string;
  processCode: string;
  grossKg: number;
  tareKg: number;
  netKg: number;
  withAnalysis: boolean;
  analysisCode?: string;
  observations: string;
  packagingMovements?: PackagingMovement[];
  analysisSummary?: NaturalAnalysisSummary;
}

export interface StoredSample {
  id: string;
  storedAt: string;
  sampleCode: string;
  client: string;
  supplier: string;
  product: string;
  processCode: string;
  relatedAnalysisId: string;
  warehouseZone: string;
  shelf: string;
  quantityKg: number;
  retentionUntil: string;
  status: "Activa" | "Liberada" | "Vencida";
  notes: string;
}
