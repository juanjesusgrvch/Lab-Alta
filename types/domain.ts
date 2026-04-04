export type DashboardTab = "defects" | "natural" | "samples";

export interface DefectItem {
  id: string;
  name: string;
  count: number;
}

export interface DefectAnalysis {
  id: string;
  analysisDate: string;
  client: string;
  product: string;
  processCode: string;
  lotCode: string;
  operator: string;
  totalUnitsInspected: number;
  defects: DefectItem[];
  observations: string;
}

export interface NaturalAnalysisSummary {
  humidityPct: number;
  brokenPct: number;
  foreignMatterPct: number;
  notes: string;
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
  analysisSummary?: NaturalAnalysisSummary;
}

export interface StoredSample {
  id: string;
  storedAt: string;
  sampleCode: string;
  client: string;
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
