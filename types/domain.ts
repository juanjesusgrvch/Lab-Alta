// Navegacion
export type DashboardTab = "defects" | "natural" | "samples";

export interface DashboardCampaign {
  id: string;
  name: string;
  from: string;
  to: string;
}

export interface DashboardPreferences {
  campaigns: DashboardCampaign[];
  defaultCampaignId: string;
}

export interface DashboardRelationalSeed {
  source: DashboardTab;
  client: string;
  supplier: string;
  product: string;
  processCode: string;
  analysisReference: string;
  outputStage: string;
  warehouseZone: string;
  shelf: string;
  sampleCode: string;
  gramajeHundredths: number | null;
}

// Defectos
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
  gramajeHundredths: number | null;
  humidity: number;
  defects: DefectItem[];
  observations: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

// Descargas
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
  packagingKg?: number;
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
  numeroCartaPorte?: string;
  observations: string;
  packagingMovements?: PackagingMovement[];
  analysisSummary?: NaturalAnalysisSummary;
}

// Muestras
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
  gramajeHundredths: number | null;
  quantityKg: number;
  retentionUntil: string;
  status: "Activa" | "Liberada" | "Vencida";
  releasedAt?: string | null;
  notes: string;
}
