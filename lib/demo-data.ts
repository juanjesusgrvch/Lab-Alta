import { getTodayInBuenosAires } from "@/lib/format";
import type {
  DefectAnalysis,
  NaturalEntry,
  StoredSample,
} from "@/types/domain";

const shiftDate = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
  }).format(date);
};

const getDateStamp = (dateValue: string, hourOffset = 0) =>
  Date.parse(`${dateValue}T${String(8 + hourOffset).padStart(2, "0")}:00:00`);

export const createDemoDefectAnalyses = (): DefectAnalysis[] => {
  const today = getTodayInBuenosAires();
  const dateA = shiftDate(today, -18);
  const dateB = shiftDate(today, -12);
  const dateC = shiftDate(today, -9);
  const dateD = shiftDate(today, -5);
  const dateE = shiftDate(today, -2);

  return [
    {
      id: `DEF-${dateA.replaceAll("-", "")}-01`,
      analysisDate: dateA,
      client: "ALTA EXPORT",
      supplier: "COOP. DEL LITORAL",
      processCode: "P-2401",
      product: "POROTO NEGRO",
      sampleWeightGr: 300,
      relatedAnalysis: "ING-DEM-001",
      outputStage: "CLASIFICADORA N°2",
      gramajeHundredths: 230,
      humidity: 13.1,
      defects: [
        { id: "DEF-ITEM-001", name: "QUEBRADO", grams: 8.2 },
        { id: "DEF-ITEM-002", name: "PARTIDO", grams: 4.6 },
        { id: "DEF-ITEM-003", name: "MATERIAS EXTRANAS", grams: 0.8 },
      ],
      observations: "LOTE ESTABLE PARA SEGUIMIENTO DE SALIDA.",
      createdAtMs: getDateStamp(dateA, 0),
      updatedAtMs: getDateStamp(dateA, 1),
    },
    {
      id: `DEF-${dateB.replaceAll("-", "")}-02`,
      analysisDate: dateB,
      client: "ALTA EXPORT",
      supplier: "SEMILLAS DEL NORTE",
      processCode: "P-2401",
      product: "POROTO ALUBIA",
      sampleWeightGr: 300,
      relatedAnalysis: "ING-DEM-002",
      outputStage: "DENSIMETRICA",
      gramajeHundredths: 200,
      humidity: 12.7,
      defects: [
        { id: "DEF-ITEM-004", name: "DESCORTICADO", grams: 3.1 },
        { id: "DEF-ITEM-005", name: "MANCHADO LEVE", grams: 1.9 },
        { id: "DEF-ITEM-006", name: "PARTIDO", grams: 5.4 },
      ],
      observations: "MEJORA DE LIMPIEZA RESPECTO AL LOTE ANTERIOR.",
      createdAtMs: getDateStamp(dateB, 0),
      updatedAtMs: getDateStamp(dateB, 2),
    },
    {
      id: `DEF-${dateC.replaceAll("-", "")}-03`,
      analysisDate: dateC,
      client: "MERCADOS DEL SUR",
      supplier: "COOP. DEL LITORAL",
      processCode: "P-2417",
      product: "GARBANZO",
      sampleWeightGr: 300,
      relatedAnalysis: "ING-DEM-003",
      outputStage: "LUSTRADORA",
      gramajeHundredths: null,
      humidity: 13.4,
      defects: [
        { id: "DEF-ITEM-007", name: "QUEBRADO", grams: 6.4 },
        { id: "DEF-ITEM-008", name: "OXIDADO LEVE", grams: 1.1 },
        { id: "DEF-ITEM-009", name: "BROTADO", grams: 0.6 },
      ],
      observations: "REVISION VISUAL RECOMENDADA ANTES DE ENVASAR.",
      createdAtMs: getDateStamp(dateC, 0),
      updatedAtMs: getDateStamp(dateC, 1),
    },
    {
      id: `DEF-${dateD.replaceAll("-", "")}-04`,
      analysisDate: dateD,
      client: "INDUSTRIA PAMPA",
      supplier: "AGROINSUMOS DEL ESTE",
      processCode: "P-2450",
      product: "POROTO COLORADO DRK",
      sampleWeightGr: 300,
      relatedAnalysis: "ING-DEM-004",
      outputStage: "ELECTRONICA",
      gramajeHundredths: 210,
      humidity: 11.9,
      defects: [
        { id: "DEF-ITEM-010", name: "MATERIAS EXTRANAS", grams: 0.3 },
        { id: "DEF-ITEM-011", name: "QUEBRADO", grams: 2.8 },
        { id: "DEF-ITEM-012", name: "DESCOLORIDO", grams: 0.9 },
      ],
      observations: "TENDENCIA POSITIVA EN EL CONTROL DE COLOR.",
      createdAtMs: getDateStamp(dateD, 0),
      updatedAtMs: getDateStamp(dateD, 3),
    },
    {
      id: `DEF-${dateE.replaceAll("-", "")}-05`,
      analysisDate: dateE,
      client: "MERCADOS DEL SUR",
      supplier: "SEMILLAS DEL NORTE",
      processCode: "P-2417",
      product: "SESAMO BLANCO",
      sampleWeightGr: 300,
      relatedAnalysis: "ING-DEM-005",
      outputStage: "ENVASADORA",
      gramajeHundredths: null,
      humidity: 12.2,
      defects: [
        { id: "DEF-ITEM-013", name: "PARTIDO", grams: 4.1 },
        { id: "DEF-ITEM-014", name: "CASCADO", grams: 1.6 },
        { id: "DEF-ITEM-015", name: "MANCHADO LEVE", grams: 0.7 },
      ],
      observations: "LOTE DEMO CARGADO PARA PRUEBAS DE NAVEGACION.",
      createdAtMs: getDateStamp(dateE, 0),
      updatedAtMs: getDateStamp(dateE, 4),
    },
  ];
};

export const createDemoNaturalEntries = (): NaturalEntry[] => {
  const today = getTodayInBuenosAires();
  const dateA = shiftDate(today, -16);
  const dateB = shiftDate(today, -13);
  const dateC = shiftDate(today, -8);
  const dateD = shiftDate(today, -4);
  const dateE = shiftDate(today, -1);

  return [
    {
      id: "ING-DEM-001",
      entryDate: dateA,
      truckPlate: "AE123BC",
      client: "ALTA EXPORT",
      supplier: "COOP. DEL LITORAL",
      product: "POROTO NEGRO",
      processCode: "P-2401",
      grossKg: 28240,
      tareKg: 7240,
      netKg: 21000,
      withAnalysis: true,
      analysisCode: "ANL-2401-A",
      observations: "INGRESO PARA CLASIFICACION.",
      packagingMovements: [
        {
          id: "PKG-DEM-001",
          movementType: "alta",
          packagingType: "BOLSON DE 1000 KG",
          packagingCondition: "USADO",
          quantity: 21,
        },
      ],
      analysisSummary: {
        humidityPct: 13.1,
        brokenPct: 4.2,
        foreignMatterPct: 0.3,
        notes: "MATERIAL ESTABLE PARA LIMPIEZA.",
      },
    },
    {
      id: "ING-DEM-002",
      entryDate: dateB,
      truckPlate: "AF456CD",
      client: "ALTA EXPORT",
      supplier: "SEMILLAS DEL NORTE",
      product: "POROTO ALUBIA",
      processCode: "P-2401",
      grossKg: 26800,
      tareKg: 6800,
      netKg: 20000,
      withAnalysis: true,
      analysisCode: "ANL-2401-B",
      observations: "SEPARAR LOTE PARA CONTROL DE DENSIMETRICA.",
      packagingMovements: [
        {
          id: "PKG-DEM-002",
          movementType: "alta",
          packagingType: "BOLSA 50 KG",
          packagingCondition: "NUEVO",
          quantity: 400,
        },
      ],
    },
    {
      id: "ING-DEM-003",
      entryDate: dateC,
      truckPlate: "AG789DE",
      client: "MERCADOS DEL SUR",
      supplier: "COOP. DEL LITORAL",
      product: "GARBANZO",
      processCode: "P-2417",
      grossKg: 25250,
      tareKg: 6250,
      netKg: 19000,
      withAnalysis: false,
      analysisCode: "",
      observations: "PENDIENTE DE EVALUACION EN LABORATORIO.",
      packagingMovements: [
        {
          id: "PKG-DEM-003",
          movementType: "alta",
          packagingType: "GRANEL",
          packagingCondition: "",
          quantity: 19,
        },
      ],
    },
    {
      id: "ING-DEM-004",
      entryDate: dateD,
      truckPlate: "AH321EF",
      client: "INDUSTRIA PAMPA",
      supplier: "AGROINSUMOS DEL ESTE",
      product: "PREMEZCLA INDUSTRIAL",
      processCode: "P-2450",
      grossKg: 18000,
      tareKg: 3000,
      netKg: 15000,
      withAnalysis: true,
      analysisCode: "ANL-2450-A",
      observations: "USO INDUSTRIAL, CONTROLAR DESPACHO INTERNO.",
      packagingMovements: [
        {
          id: "PKG-DEM-004",
          movementType: "alta",
          packagingType: "BOLSON DE 1000 KG",
          packagingCondition: "NUEVO",
          quantity: 15,
        },
      ],
    },
    {
      id: "ING-DEM-005",
      entryDate: dateE,
      truckPlate: "AI654FG",
      client: "MERCADOS DEL SUR",
      supplier: "SEMILLAS DEL NORTE",
      product: "SESAMO BLANCO",
      processCode: "P-2417",
      grossKg: 23800,
      tareKg: 5800,
      netKg: 18000,
      withAnalysis: true,
      analysisCode: "ANL-2417-A",
      observations: "LOTE DEMO CARGADO PARA PRUEBAS DE NAVEGACION.",
      packagingMovements: [
        {
          id: "PKG-DEM-005",
          movementType: "alta",
          packagingType: "BOLSA 25 KG",
          packagingCondition: "USADO",
          quantity: 720,
        },
      ],
    },
  ];
};

export const createDemoSamples = (): StoredSample[] => {
  const today = getTodayInBuenosAires();
  const dateA = shiftDate(today, -22);
  const dateB = shiftDate(today, -16);
  const dateC = shiftDate(today, -11);
  const dateD = shiftDate(today, -6);
  const dateE = shiftDate(today, -2);

  return [
    {
      id: "SMP-DEM-001",
      storedAt: dateA,
      sampleCode: "SMP-AE-001",
      client: "ALTA EXPORT",
      supplier: "COOP. DEL LITORAL",
      product: "POROTO NEGRO",
      processCode: "P-2401",
      relatedAnalysisId: `DEF-${dateA.replaceAll("-", "")}-01`,
      warehouseZone: "ZONA A",
      shelf: "EST-01",
      gramajeHundredths: 230,
      quantityKg: 25,
      retentionUntil: shiftDate(today, 40),
      status: "Activa",
      notes: "MUESTRA TESTIGO DE INGRESO INICIAL.",
    },
    {
      id: "SMP-DEM-002",
      storedAt: dateB,
      sampleCode: "SMP-AE-002",
      client: "ALTA EXPORT",
      supplier: "SEMILLAS DEL NORTE",
      product: "POROTO ALUBIA",
      processCode: "P-2401",
      relatedAnalysisId: `DEF-${dateB.replaceAll("-", "")}-02`,
      warehouseZone: "ZONA B",
      shelf: "EST-03",
      gramajeHundredths: 200,
      quantityKg: 18,
      retentionUntil: shiftDate(today, 12),
      status: "Activa",
      notes: "MUESTRA DE CAMION 03/02/2026.",
    },
    {
      id: "SMP-DEM-003",
      storedAt: dateC,
      sampleCode: "SMP-MS-003",
      client: "MERCADOS DEL SUR",
      supplier: "COOP. DEL LITORAL",
      product: "GARBANZO",
      processCode: "P-2417",
      relatedAnalysisId: `DEF-${dateC.replaceAll("-", "")}-03`,
      warehouseZone: "ZONA C",
      shelf: "EST-07",
      gramajeHundredths: null,
      quantityKg: 20,
      retentionUntil: shiftDate(today, -3),
      status: "Activa",
      notes: "MUESTRA TESTIGO EXPORTACION.",
    },
    {
      id: "SMP-DEM-004",
      storedAt: dateD,
      sampleCode: "SMP-IP-004",
      client: "INDUSTRIA PAMPA",
      supplier: "AGROINSUMOS DEL ESTE",
      product: "POROTO NEGRO",
      processCode: "P-2450",
      relatedAnalysisId: `DEF-${dateD.replaceAll("-", "")}-04`,
      warehouseZone: "ZONA D",
      shelf: "EST-02",
      gramajeHundredths: 240,
      quantityKg: 15,
      retentionUntil: shiftDate(today, 22),
      status: "Liberada",
      releasedAt: dateD,
      notes: "MUESTRA PARA CLIENTE.",
    },
    {
      id: "SMP-DEM-005",
      storedAt: dateE,
      sampleCode: "SMP-MS-005",
      client: "MERCADOS DEL SUR",
      supplier: "SEMILLAS DEL NORTE",
      product: "SESAMO BLANCO",
      processCode: "P-2417",
      relatedAnalysisId: `DEF-${dateE.replaceAll("-", "")}-05`,
      warehouseZone: "ZONA A",
      shelf: "EST-05",
      gramajeHundredths: null,
      quantityKg: 22,
      retentionUntil: shiftDate(today, 65),
      status: "Activa",
      notes: "REGISTRO DE DENSIMETRICA PARA SEGUIMIENTO DE MUESTRA.",
    },
  ];
};
