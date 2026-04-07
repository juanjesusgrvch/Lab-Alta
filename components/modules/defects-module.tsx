"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { MetricCard, SectionCard } from "@/components/dashboard/primitives";
import {
  defectCatalog,
  formatDefectLabel,
  normalizeDefectText,
  outputStageOptions,
  parseLegacyDefectLabel,
  requiresDefectDetail,
} from "@/lib/defects-config";
import {
  formatCompactDecimal,
  formatDate,
  formatGrams,
  formatHundredths,
  formatInteger,
  formatPercent,
  getTodayInBuenosAires,
} from "@/lib/format";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  createRecord,
  deleteRecord,
  saveRecord,
  subscribeToRecords,
} from "@/lib/firestore-records";
import { exportElementToPdf } from "@/lib/pdf";
import {
  autofillUniqueRelationalSelections,
  areStringFiltersEqual,
  clearInvalidRelationalSelections,
  getRelationalOptions,
  type RelationalFieldConfig,
} from "@/lib/relational-filters";
import type { DefectAnalysis, DefectItem } from "@/types/domain";

const chartColors = [
  "var(--chart-accent-1)",
  "var(--chart-accent-2)",
  "var(--chart-accent-3)",
  "var(--chart-accent-4)",
  "var(--chart-accent-5)",
];
const chartGridColor = "var(--chart-grid)";
const chartAxisColor = "var(--chart-axis)";
const PAGE_SIZE = 8;

type TimestampLike = {
  toMillis: () => number;
};

type DefectFormRow = {
  id: string;
  name: string;
  detail: string;
  grams: string;
};

type DefectFormState = {
  analysisDate: string;
  client: string;
  supplier: string;
  processCode: string;
  product: string;
  sampleWeightGr: string;
  relatedAnalysis: string;
  outputStage: string;
  gramajeHundredths: string;
  humidity: string;
  observations: string;
  defects: DefectFormRow[];
};

type DefectFilters = {
  client: string;
  supplier: string;
  processCode: string;
  product: string;
  outputStage: string;
  defect: string;
  from: string;
  to: string;
};

type DefectRelationalFilters = Pick<
  DefectFilters,
  "client" | "supplier" | "processCode" | "product" | "defect"
>;

type ProcessAverageDatum = {
  name: string;
  grams: number;
};

type EvolutionPoint = {
  date: string;
  day: string;
  grams: number;
};

const defectFilterConfig: Record<
  keyof DefectRelationalFilters,
  RelationalFieldConfig<DefectAnalysis>
> = {
  client: {
    getValues: (analysis) => [analysis.client],
    matches: (analysis, value) => analysis.client === value,
  },
  supplier: {
    getValues: (analysis) => [analysis.supplier],
    matches: (analysis, value) => analysis.supplier === value,
  },
  processCode: {
    getValues: (analysis) => [analysis.processCode],
    matches: (analysis, value) => analysis.processCode === value,
  },
  product: {
    getValues: (analysis) => [analysis.product],
    matches: (analysis, value) => analysis.product === value,
  },
  defect: {
    getValues: (analysis) =>
      analysis.defects.map((defect) =>
        formatDefectLabel(defect.name, defect.detail),
      ),
    matches: (analysis, value) =>
      analysis.defects.some(
        (defect) => formatDefectLabel(defect.name, defect.detail) === value,
      ),
  },
};

const normalizeUppercaseValue = (value: string) =>
  value.replace(/\s+/g, " ").replace(/^\s+/, "").toUpperCase();

const sortTextOptions = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "es", { sensitivity: "base" }),
  );

const createEmptyDefectRow = (): DefectFormRow => ({
  id: crypto.randomUUID(),
  name: "",
  detail: "",
  grams: "",
});

const createEmptyForm = (): DefectFormState => ({
  analysisDate: getTodayInBuenosAires(),
  client: "",
  supplier: "",
  processCode: "",
  product: "",
  sampleWeightGr: "300",
  relatedAnalysis: "",
  outputStage: "",
  gramajeHundredths: "",
  humidity: "",
  observations: "",
  defects: [createEmptyDefectRow()],
});

const formFromAnalysis = (analysis: DefectAnalysis): DefectFormState => ({
  analysisDate: analysis.analysisDate,
  client: analysis.client,
  supplier: analysis.supplier ?? "",
  processCode: analysis.processCode,
  product: analysis.product,
  sampleWeightGr: String(analysis.sampleWeightGr || 300),
  relatedAnalysis: analysis.relatedAnalysis ?? "",
  outputStage: analysis.outputStage ?? "",
  gramajeHundredths:
    analysis.gramajeHundredths > 0 ? String(analysis.gramajeHundredths) : "",
  humidity: analysis.humidity > 0 ? String(analysis.humidity) : "",
  observations: analysis.observations ?? "",
  defects:
    analysis.defects.length > 0
      ? analysis.defects.map((defect) => ({
          id: defect.id,
          name: defect.name,
          detail: defect.detail ?? "",
          grams: defect.grams > 0 ? String(defect.grams) : "",
        }))
      : [createEmptyDefectRow()],
});

const toNumberOrZero = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTimestampMs = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as TimestampLike).toMillis === "function"
  ) {
    return (value as TimestampLike).toMillis();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
};

const normalizeDefectItems = (value: unknown): DefectItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<DefectItem> & {
      count?: number;
      detail?: string;
      id?: string;
      name?: string;
    };

    const parsedLabel = parseLegacyDefectLabel(
      typeof candidate.name === "string" ? candidate.name : "",
      typeof candidate.detail === "string" ? candidate.detail : "",
    );
    const grams = toNumberOrZero(candidate.grams ?? candidate.count ?? 0);

    if (!parsedLabel.name && grams <= 0) {
      return [];
    }

    return [
      {
        id:
          typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id
            : `DEF-${index}-${crypto.randomUUID()}`,
        name: parsedLabel.name,
        detail: parsedLabel.detail || undefined,
        grams,
      },
    ];
  });
};

const normalizeDefectAnalysis = (
  recordId: string,
  rawAnalysis: Partial<DefectAnalysis> & {
    createdAt?: unknown;
    updatedAt?: unknown;
    gramaje?: number;
    lotCode?: string;
    totalUnitsInspected?: number;
  },
): DefectAnalysis => ({
  id: rawAnalysis.id?.trim() || recordId,
  analysisDate: rawAnalysis.analysisDate ?? getTodayInBuenosAires(),
  client: rawAnalysis.client ?? "",
  supplier: rawAnalysis.supplier ?? "",
  processCode: rawAnalysis.processCode ?? "",
  product: rawAnalysis.product ?? "",
  sampleWeightGr: Math.max(
    0,
    toNumberOrZero(
      rawAnalysis.sampleWeightGr ?? rawAnalysis.totalUnitsInspected ?? 300,
    ),
  ),
  relatedAnalysis: rawAnalysis.relatedAnalysis ?? rawAnalysis.lotCode ?? "",
  outputStage: rawAnalysis.outputStage ?? "",
  gramajeHundredths: Math.max(
    0,
    toNumberOrZero(rawAnalysis.gramajeHundredths ?? rawAnalysis.gramaje ?? 0),
  ),
  humidity: Math.max(0, toNumberOrZero(rawAnalysis.humidity ?? 0)),
  defects: normalizeDefectItems(rawAnalysis.defects),
  observations: rawAnalysis.observations ?? "",
  createdAtMs:
    rawAnalysis.createdAtMs ??
    getTimestampMs(rawAnalysis.createdAt) ??
    Date.parse(
      `${rawAnalysis.analysisDate ?? getTodayInBuenosAires()}T00:00:00`,
    ),
  updatedAtMs:
    rawAnalysis.updatedAtMs ??
    getTimestampMs(rawAnalysis.updatedAt) ??
    getTimestampMs(rawAnalysis.createdAt),
});

const sortAnalysesByRecency = (left: DefectAnalysis, right: DefectAnalysis) => {
  const byDate = right.analysisDate.localeCompare(left.analysisDate);

  if (byDate) {
    return byDate;
  }

  const rightStamp = right.updatedAtMs ?? right.createdAtMs ?? 0;
  const leftStamp = left.updatedAtMs ?? left.createdAtMs ?? 0;
  const byStamp = rightStamp - leftStamp;

  if (byStamp) {
    return byStamp;
  }

  return right.id.localeCompare(left.id);
};

const getMonthKey = (dateValue: string) => dateValue.slice(0, 7);

const shiftMonthKey = (monthKey: string, delta: number) => {
  const date = new Date(`${monthKey}-01T12:00:00`);
  date.setMonth(date.getMonth() + delta);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).format(date);
};

const formatMonthLabel = (monthKey: string) => {
  const value = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Buenos_Aires",
  }).format(new Date(`${monthKey}-01T12:00:00`));

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getLatestMonthKey = (analyses: DefectAnalysis[]) =>
  analyses
    .reduce(
      (latest, analysis) =>
        analysis.analysisDate > latest ? analysis.analysisDate : latest,
      analyses[0]?.analysisDate ?? getTodayInBuenosAires(),
    )
    .slice(0, 7);

const getDefectPercentage = (grams: number, sampleWeightGr: number) =>
  sampleWeightGr > 0 ? (grams / sampleWeightGr) * 100 : 0;

const buildRecordId = (analysisDate: string) =>
  `DEF-${analysisDate.replaceAll("-", "")}-${Date.now()}`;

const buildProcessMismatchWarning = (
  analyses: DefectAnalysis[],
  client: string,
  processCode: string,
) => {
  if (!client || !processCode) {
    return "";
  }

  const hasClientHistory = analyses.some(
    (analysis) => analysis.client === client,
  );
  const hasProcessHistory = analyses.some(
    (analysis) => analysis.processCode === processCode,
  );
  const hasKnownPair = analyses.some(
    (analysis) =>
      analysis.client === client && analysis.processCode === processCode,
  );

  if (hasClientHistory && hasProcessHistory && !hasKnownPair) {
    return "El proceso no coincide con los antecedentes del cliente. Se puede guardar igual.";
  }

  return "";
};

const buildDefectSummary = (defect: DefectItem, sampleWeightGr: number) => {
  const label = formatDefectLabel(defect.name, defect.detail);
  const percentage = getDefectPercentage(defect.grams, sampleWeightGr);

  return `${label}: ${formatGrams(defect.grams)} (${formatPercent(percentage)})`;
};

const formRelationConfig = {
  client: defectFilterConfig.client,
  supplier: defectFilterConfig.supplier,
  processCode: defectFilterConfig.processCode,
  product: defectFilterConfig.product,
} satisfies Record<
  "client" | "supplier" | "processCode" | "product",
  RelationalFieldConfig<DefectAnalysis>
>;

export const DefectsModule = () => {
  const [analyses, setAnalyses] = useState<DefectAnalysis[]>([]);
  const [filters, setFilters] = useState<DefectFilters>({
    client: "",
    supplier: "",
    processCode: "",
    product: "",
    outputStage: "",
    defect: "",
    from: "",
    to: "",
  });
  const [form, setForm] = useState<DefectFormState>(createEmptyForm);
  const [editingAnalysisId, setEditingAnalysisId] = useState<string | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [activeProcessChart, setActiveProcessChart] = useState("");
  const [activeDefectChart, setActiveDefectChart] = useState("");
  const [activeTrendMonth, setActiveTrendMonth] = useState(() =>
    getMonthKey(getTodayInBuenosAires()),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToRecords<DefectAnalysis>(
      "defects",
      (records) => {
        setAnalyses(
          records
            .map((record) => normalizeDefectAnalysis(record.id, record.data))
            .sort(sortAnalysesByRecency),
        );
        setIsSyncing(false);
        setSyncError(null);
      },
      () => {
        setAnalyses([]);
        setIsSyncing(false);
        setSyncError(
          "No se pudo sincronizar la coleccion de defectos con Firestore.",
        );
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.client,
    filters.supplier,
    filters.processCode,
    filters.product,
    filters.outputStage,
    filters.defect,
    filters.from,
    filters.to,
  ]);

  const relationalFilters: DefectRelationalFilters = {
    client: filters.client,
    supplier: filters.supplier,
    processCode: filters.processCode,
    product: filters.product,
    defect: filters.defect,
  };

  const matchesDateRange = (
    analysis: DefectAnalysis,
    from: string,
    to: string,
  ) => {
    const matchesFrom = !from || analysis.analysisDate >= from;
    const matchesTo = !to || analysis.analysisDate <= to;

    return matchesFrom && matchesTo;
  };

  const clientOptions = getRelationalOptions(
    analyses,
    relationalFilters,
    "client",
    defectFilterConfig,
    (analysis) => matchesDateRange(analysis, filters.from, filters.to),
  );
  const processOptions = getRelationalOptions(
    analyses,
    relationalFilters,
    "processCode",
    defectFilterConfig,
    (analysis) => matchesDateRange(analysis, filters.from, filters.to),
  );
  const productOptions = getRelationalOptions(
    analyses,
    relationalFilters,
    "product",
    defectFilterConfig,
    (analysis) => matchesDateRange(analysis, filters.from, filters.to),
  );
  const defectOptions = getRelationalOptions(
    analyses,
    relationalFilters,
    "defect",
    defectFilterConfig,
    (analysis) => matchesDateRange(analysis, filters.from, filters.to),
  );
  const supplierOptions = getRelationalOptions(
    analyses,
    relationalFilters,
    "supplier",
    defectFilterConfig,
    (analysis) => matchesDateRange(analysis, filters.from, filters.to),
  );
  const outputStageOptionsForFilter = sortTextOptions(
    analyses.map((analysis) => analysis.outputStage),
  );

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: DefectRelationalFilters = {
        client: current.client,
        supplier: current.supplier,
        processCode: current.processCode,
        product: current.product,
        defect: current.defect,
      };
      const sanitizedRelational = clearInvalidRelationalSelections(
        analyses,
        currentRelational,
        defectFilterConfig,
        (analysis) => matchesDateRange(analysis, current.from, current.to),
      );

      if (areStringFiltersEqual(currentRelational, sanitizedRelational)) {
        return current;
      }

      return {
        ...current,
        ...sanitizedRelational,
      };
    });
  }, [
    analyses,
    filters.client,
    filters.supplier,
    filters.processCode,
    filters.product,
    filters.outputStage,
    filters.defect,
    filters.from,
    filters.to,
  ]);

  const filteredAnalyses = analyses.filter((analysis) => {
    const matchesClient = !filters.client || analysis.client === filters.client;
    const matchesSupplier =
      !filters.supplier || analysis.supplier === filters.supplier;
    const matchesProcess =
      !filters.processCode || analysis.processCode === filters.processCode;
    const matchesProduct =
      !filters.product || analysis.product === filters.product;
    const matchesOutputStage =
      !filters.outputStage || analysis.outputStage === filters.outputStage;
    const matchesDefect =
      !filters.defect ||
      analysis.defects.some(
        (defect) =>
          formatDefectLabel(defect.name, defect.detail) === filters.defect,
      );

    return (
      matchesClient &&
      matchesSupplier &&
      matchesProcess &&
      matchesProduct &&
      matchesOutputStage &&
      matchesDefect &&
      matchesDateRange(analysis, filters.from, filters.to)
    );
  });

  const sortedFilteredAnalyses = [...filteredAnalyses].sort(
    sortAnalysesByRecency,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(sortedFilteredAnalyses.length / PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedAnalyses = sortedFilteredAnalyses.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const totalSampleGr = filteredAnalyses.reduce(
    (sum, analysis) => sum + analysis.sampleWeightGr,
    0,
  );
  const averageSampleWeight =
    filteredAnalyses.length > 0 ? totalSampleGr / filteredAnalyses.length : 0;
  const averageGramajeHundredths =
    filteredAnalyses.length > 0
      ? filteredAnalyses.reduce(
          (sum, analysis) => sum + analysis.gramajeHundredths,
          0,
        ) / filteredAnalyses.length
      : 0;
  const totalDefectGrams = filteredAnalyses.reduce(
    (sum, analysis) =>
      sum +
      analysis.defects.reduce(
        (defectSum, defect) => defectSum + defect.grams,
        0,
      ),
    0,
  );
  const averageDefectGrams =
    filteredAnalyses.length > 0
      ? totalDefectGrams / filteredAnalyses.length
      : 0;
  const averageDefectPercent =
    averageSampleWeight > 0
      ? getDefectPercentage(averageDefectGrams, averageSampleWeight)
      : 0;

  const averageDefectMap = new Map<string, number>();
  filteredAnalyses.forEach((analysis) => {
    analysis.defects.forEach((defect) => {
      const label = formatDefectLabel(defect.name, defect.detail);
      averageDefectMap.set(
        label,
        (averageDefectMap.get(label) ?? 0) + defect.grams,
      );
    });
  });

  const dominantDefect =
    averageDefectMap.size > 0
      ? [...averageDefectMap.entries()]
          .map(([name, totalGrams]) => ({
            name,
            averageGrams:
              filteredAnalyses.length > 0
                ? totalGrams / filteredAnalyses.length
                : 0,
          }))
          .sort((left, right) => right.averageGrams - left.averageGrams)[0]
      : null;
  const dominantDefectPercent = dominantDefect
    ? getDefectPercentage(dominantDefect.averageGrams, averageSampleWeight)
    : 0;

  const processScopedAnalyses = activeProcessChart
    ? analyses
        .filter((analysis) => analysis.processCode === activeProcessChart)
        .sort(sortAnalysesByRecency)
    : [];
  const processAverageWeight =
    processScopedAnalyses.length > 0
      ? processScopedAnalyses.reduce(
          (sum, analysis) => sum + analysis.sampleWeightGr,
          0,
        ) / processScopedAnalyses.length
      : 0;

  const processAverageMap = new Map<string, number>();
  processScopedAnalyses.forEach((analysis) => {
    analysis.defects.forEach((defect) => {
      const label = formatDefectLabel(defect.name, defect.detail);
      processAverageMap.set(
        label,
        (processAverageMap.get(label) ?? 0) + defect.grams,
      );
    });
  });

  const processAverageData: ProcessAverageDatum[] = [
    ...processAverageMap.entries(),
  ]
    .map(([name, totalGrams]) => ({
      name,
      grams:
        processScopedAnalyses.length > 0
          ? totalGrams / processScopedAnalyses.length
          : 0,
    }))
    .sort((left, right) => right.grams - left.grams);

  const processDefectOptions = sortTextOptions(
    processScopedAnalyses.flatMap((analysis) =>
      analysis.defects.map((defect) =>
        formatDefectLabel(defect.name, defect.detail),
      ),
    ),
  );

  useEffect(() => {
    if (!activeProcessChart) {
      setActiveDefectChart("");
      return;
    }

    if (activeDefectChart && processDefectOptions.includes(activeDefectChart)) {
      return;
    }

    setActiveDefectChart("");
  }, [activeProcessChart, activeDefectChart, processDefectOptions]);

  useEffect(() => {
    if (!processScopedAnalyses.length) {
      return;
    }

    const hasDataInActiveMonth = processScopedAnalyses.some(
      (analysis) => getMonthKey(analysis.analysisDate) === activeTrendMonth,
    );

    if (!hasDataInActiveMonth) {
      setActiveTrendMonth(getLatestMonthKey(processScopedAnalyses));
    }
  }, [activeTrendMonth, processScopedAnalyses]);

  const evolutionMap = new Map<string, number[]>();
  processScopedAnalyses.forEach((analysis) => {
    if (
      !activeDefectChart ||
      getMonthKey(analysis.analysisDate) !== activeTrendMonth
    ) {
      return;
    }

    analysis.defects.forEach((defect) => {
      const label = formatDefectLabel(defect.name, defect.detail);
      if (label !== activeDefectChart) {
        return;
      }

      const values = evolutionMap.get(analysis.analysisDate) ?? [];
      values.push(defect.grams);
      evolutionMap.set(analysis.analysisDate, values);
    });
  });

  const evolutionData: EvolutionPoint[] = [...evolutionMap.entries()]
    .map(([date, values]) => ({
      date,
      day: date.slice(8, 10),
      grams: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const formRelationalFilters = {
    client: form.client,
    supplier: form.supplier,
    processCode: form.processCode,
    product: form.product,
  };
  const formClientOptions = getRelationalOptions(
    analyses,
    formRelationalFilters,
    "client",
    formRelationConfig,
  );
  const formSupplierOptions = getRelationalOptions(
    analyses,
    formRelationalFilters,
    "supplier",
    formRelationConfig,
  );
  const formProcessOptions = getRelationalOptions(
    analyses,
    formRelationalFilters,
    "processCode",
    formRelationConfig,
  );
  const formProductOptions = getRelationalOptions(
    analyses,
    formRelationalFilters,
    "product",
    formRelationConfig,
  );
  const relatedAnalysesScoped = analyses.filter((analysis) => {
    const matchesClient = !form.client || analysis.client === form.client;
    const matchesSupplier =
      !form.supplier || analysis.supplier === form.supplier;
    const matchesProcess =
      !form.processCode || analysis.processCode === form.processCode;
    const matchesProduct = !form.product || analysis.product === form.product;

    return matchesClient && matchesSupplier && matchesProcess && matchesProduct;
  });
  const relatedAnalysisOptions = sortTextOptions([
    ...relatedAnalysesScoped.map((analysis) => analysis.id),
    ...relatedAnalysesScoped.map((analysis) => analysis.relatedAnalysis),
  ]);
  const formOutputOptions = sortTextOptions([
    ...outputStageOptions,
    ...relatedAnalysesScoped.map((analysis) => analysis.outputStage),
  ]);
  const combinedDefectOptions = sortTextOptions([
    ...defectCatalog,
    ...analyses.flatMap((analysis) =>
      analysis.defects.map((defect) => defect.name),
    ),
  ]);
  const processChartOptions = sortTextOptions(
    analyses.map((analysis) => analysis.processCode),
  );
  const processMismatchWarning = buildProcessMismatchWarning(
    analyses,
    form.client,
    form.processCode,
  );

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    setForm((current) => {
      const currentRelations = {
        client: current.client,
        supplier: current.supplier,
        processCode: current.processCode,
        product: current.product,
      };
      const autofilledRelations = autofillUniqueRelationalSelections(
        analyses,
        currentRelations,
        formRelationConfig,
      );
      const nextForm = {
        ...current,
        ...autofilledRelations,
      };
      let changed = !areStringFiltersEqual(
        currentRelations,
        autofilledRelations,
      );

      if (!nextForm.relatedAnalysis && relatedAnalysisOptions.length === 1) {
        nextForm.relatedAnalysis = relatedAnalysisOptions[0];
        changed = true;
      }

      if (!nextForm.outputStage && formOutputOptions.length === 1) {
        nextForm.outputStage = formOutputOptions[0];
        changed = true;
      }

      return changed ? nextForm : current;
    });
  }, [
    isModalOpen,
    analyses,
    form.client,
    form.supplier,
    form.processCode,
    form.product,
    form.relatedAnalysis,
    form.outputStage,
    relatedAnalysisOptions,
    formOutputOptions,
  ]);

  const openCreateModal = () => {
    setEditingAnalysisId(null);
    setForm(createEmptyForm());
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (analysis: DefectAnalysis) => {
    setEditingAnalysisId(analysis.id);
    setForm(formFromAnalysis(analysis));
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAnalysisId(null);
    setFormError(null);
  };

  const toggleExpandedAnalysis = (analysisId: string) => {
    setExpandedAnalysisId((current) =>
      current === analysisId ? null : analysisId,
    );
  };

  const handleExpandableCardKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    analysisId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpandedAnalysis(analysisId);
    }
  };

  const handleFilterChange = (field: keyof DefectFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleTextFieldChange = (
    field: Exclude<keyof DefectFormState, "defects">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]:
        field === "analysisDate" ? value : normalizeUppercaseValue(value),
    }));
  };

  const handleDefectFieldChange = (
    rowId: string,
    field: keyof DefectFormRow,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      defects: current.defects.map((defect) => {
        if (defect.id !== rowId) {
          return defect;
        }

        if (field === "grams") {
          return {
            ...defect,
            grams: value,
          };
        }

        if (field === "name") {
          const nextName = normalizeDefectText(value);
          return {
            ...defect,
            name: nextName,
            detail: requiresDefectDetail(nextName) ? defect.detail : "",
          };
        }

        return {
          ...defect,
          [field]: normalizeUppercaseValue(value),
        };
      }),
    }));
  };

  const handleAddDefectRow = () => {
    setForm((current) => ({
      ...current,
      defects: [...current.defects, createEmptyDefectRow()],
    }));
  };

  const handleRemoveDefectRow = (rowId: string) => {
    setForm((current) => ({
      ...current,
      defects:
        current.defects.length > 1
          ? current.defects.filter((defect) => defect.id !== rowId)
          : [createEmptyDefectRow()],
    }));
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    const confirmed = window.confirm(
      "Este analisis se eliminará. Quieres continuar?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteRecord("defects", analysisId);
    } catch {
      setSyncError("No se pudo eliminar el analisis seleccionado.");
    }
  };

  const handleExport = async () => {
    if (!panelRef.current) {
      return;
    }

    try {
      setIsExporting(true);
      await exportElementToPdf(panelRef.current, "modulo-defectos");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanedDefects = form.defects.reduce<DefectItem[]>(
      (items, defect) => {
        const parsedLabel = parseLegacyDefectLabel(defect.name, defect.detail);
        const grams = Math.max(0, toNumberOrZero(defect.grams));

        if (!parsedLabel.name) {
          return items;
        }

        items.push({
          id: defect.id || crypto.randomUUID(),
          name: parsedLabel.name,
          grams,
          ...(parsedLabel.detail ? { detail: parsedLabel.detail } : {}),
        });

        return items;
      },
      [],
    );

    if (!cleanedDefects.length) {
      setFormError(
        "Agrega al menos un defecto con nombre para guardar el analisis.",
      );
      return;
    }

    const sampleWeightGr = Math.max(
      0,
      toNumberOrZero(form.sampleWeightGr || 300),
    );
    const existingCreatedAtMs = editingAnalysisId
      ? analyses.find((analysis) => analysis.id === editingAnalysisId)
          ?.createdAtMs
      : undefined;

    const payload: Omit<DefectAnalysis, "id"> = {
      analysisDate: form.analysisDate,
      client: normalizeUppercaseValue(form.client),
      supplier: normalizeUppercaseValue(form.supplier),
      processCode: normalizeUppercaseValue(form.processCode),
      product: normalizeUppercaseValue(form.product),
      sampleWeightGr: sampleWeightGr || 300,
      relatedAnalysis: normalizeUppercaseValue(form.relatedAnalysis),
      outputStage: normalizeUppercaseValue(form.outputStage),
      gramajeHundredths: Math.max(
        0,
        Math.round(toNumberOrZero(form.gramajeHundredths)),
      ),
      humidity: Math.max(0, toNumberOrZero(form.humidity)),
      defects: cleanedDefects,
      observations: normalizeUppercaseValue(form.observations),
      updatedAtMs: Date.now(),
      ...(typeof existingCreatedAtMs === "number"
        ? { createdAtMs: existingCreatedAtMs }
        : {}),
    };

    try {
      setIsPersisting(true);
      setFormError(null);
      const currentUser = getFirebaseAuth().currentUser;

      if (editingAnalysisId) {
        await saveRecord(
          "defects",
          editingAnalysisId,
          payload,
          currentUser?.uid,
        );
      } else {
        const recordId = buildRecordId(form.analysisDate);
        await createRecord("defects", recordId, payload, currentUser?.uid);
      }

      closeModal();
    } catch (error) {
      console.error("Error al guardar analisis de defectos", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No se pudo guardar el analisis en Firestore.";
      setFormError(message);
    } finally {
      setIsPersisting(false);
    }
  };

  const liveSampleWeight =
    Math.max(0, toNumberOrZero(form.sampleWeightGr || 300)) || 300;

  return (
    <div ref={panelRef} className="module-stack">
      <div className="metric-grid samples-metric-grid">
        <MetricCard
          label="Cantidad de analisis"
          value={formatInteger(filteredAnalyses.length)}
          tone="sand"
        />
        <MetricCard
          label="Gr analizados"
          value={formatGrams(totalSampleGr)}
          tone="olive"
        />
        <MetricCard
          label="Gramaje promedio"
          value={formatHundredths(averageGramajeHundredths)}
          tone="forest"
        />
        <button
          type="button"
          className="metric-card metric-card-button tone-rust"
          onClick={openCreateModal}
        >
          <span>Nuevo analisis</span>
          <strong>Agregar</strong>
          <div className="metric-card-button__icon">
            <Plus size={18} />
          </div>
        </button>
      </div>

      <SectionCard
        title="FILTROS"
        action={
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setFilters({
                client: "",
                supplier: "",
                processCode: "",
                product: "",
                outputStage: "",
                defect: "",
                from: "",
                to: "",
              })
            }
          >
            Limpiar
          </button>
        }
        className="samples-filters-card"
      >
        <div className="samples-filters-bar defects-filters-bar">
          <label className="samples-filter-field">
            Cliente
            <select
              value={filters.client}
              onChange={(event) =>
                handleFilterChange("client", event.target.value)
              }
            >
              <option value="">Todos</option>
              {clientOptions.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </label>

          <label className="samples-filter-field">
            Proveedor
            <select
              value={filters.supplier}
              onChange={(event) =>
                handleFilterChange("supplier", event.target.value)
              }
            >
              <option value="">Todos</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </label>

          <label className="samples-filter-field">
            Proceso
            <select
              value={filters.processCode}
              onChange={(event) =>
                handleFilterChange("processCode", event.target.value)
              }
            >
              <option value="">Todos</option>
              {processOptions.map((processCode) => (
                <option key={processCode} value={processCode}>
                  {processCode}
                </option>
              ))}
            </select>
          </label>

          <label className="samples-filter-field">
            Producto
            <select
              value={filters.product}
              onChange={(event) =>
                handleFilterChange("product", event.target.value)
              }
            >
              <option value="">Todos</option>
              {productOptions.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </label>

          <label className="samples-filter-field">
            Salida en
            <select
              value={filters.outputStage}
              onChange={(event) =>
                handleFilterChange("outputStage", event.target.value)
              }
            >
              <option value="">Todos</option>
              {outputStageOptionsForFilter.map((outputStage) => (
                <option key={outputStage} value={outputStage}>
                  {outputStage}
                </option>
              ))}
            </select>
          </label>

          <label className="samples-filter-field">
            Defecto
            <select
              value={filters.defect}
              onChange={(event) =>
                handleFilterChange("defect", event.target.value)
              }
            >
              <option value="">Todos</option>
              {defectOptions.map((defect) => (
                <option key={defect} value={defect}>
                  {defect}
                </option>
              ))}
            </select>
          </label>

          <label className="samples-filter-field">
            Desde
            <input
              type="date"
              value={filters.from}
              onChange={(event) =>
                handleFilterChange("from", event.target.value)
              }
            />
          </label>

          <label className="samples-filter-field">
            Hasta
            <input
              type="date"
              value={filters.to}
              onChange={(event) => handleFilterChange("to", event.target.value)}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Historial de analisis"
        action={
          <div className="section-action-cluster">
            <span className="samples-list-count">
              {formatInteger(sortedFilteredAnalyses.length)} registros
            </span>
            <button
              type="button"
              className="icon-button compact-icon-button"
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Exportar analisis en PDF"
              title="Exportar PDF"
            >
              <Download size={16} />
            </button>
          </div>
        }
      >
        <div className="defects-history-list">
          {paginatedAnalyses.length ? (
            paginatedAnalyses.map((analysis) => {
              const totalDefectGramsByAnalysis = analysis.defects.reduce(
                (sum, defect) => sum + defect.grams,
                0,
              );
              const totalDefectPercentByAnalysis = getDefectPercentage(
                totalDefectGramsByAnalysis,
                analysis.sampleWeightGr,
              );

              return (
                <article
                  key={analysis.id}
                  className={`defects-history-card record-card--light${
                    expandedAnalysisId === analysis.id ? " is-expanded" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedAnalysisId === analysis.id}
                  onClick={() => toggleExpandedAnalysis(analysis.id)}
                  onKeyDown={(event) =>
                    handleExpandableCardKeyDown(event, analysis.id)
                  }
                >
                  <div className="defects-history-card__header">
                    <div>
                      <div className="defects-history-card__title">
                        <strong>{analysis.product || "SIN PRODUCTO"}</strong>
                      </div>
                      <p>
                        {analysis.client || "SIN CLIENTE"} /{" "}
                        {analysis.processCode || "SIN PROCESO"} /{" "}
                        {formatDate(analysis.analysisDate)}
                      </p>
                    </div>

                    <div className="defects-history-card__actions">
                      <button
                        type="button"
                        className="icon-button compact-icon-button compact-icon-button--view"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpandedAnalysis(analysis.id);
                        }}
                        aria-label={
                          expandedAnalysisId === analysis.id
                            ? "Ocultar detalle del analisis"
                            : "Ver detalle del analisis"
                        }
                        title={
                          expandedAnalysisId === analysis.id
                            ? "Ocultar detalle"
                            : "Vista extendida"
                        }
                      >
                        {expandedAnalysisId === analysis.id ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="icon-button compact-icon-button compact-icon-button--edit"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(analysis);
                        }}
                        aria-label="Editar analisis"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button compact-icon-button compact-icon-button--delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteAnalysis(analysis.id);
                        }}
                        aria-label="Eliminar analisis"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {expandedAnalysisId === analysis.id ? (
                    <div className="record-card__extended">
                      <div className="record-card__extended-grid">
                        <div>
                          <span>Peso muestra</span>
                          <strong>
                            {formatGrams(analysis.sampleWeightGr)}
                          </strong>
                        </div>
                        <div>
                          <span>Gramaje</span>
                          <strong>
                            {formatHundredths(analysis.gramajeHundredths)}
                          </strong>
                        </div>
                        <div>
                          <span>Salida</span>
                          <strong>
                            {analysis.outputStage || "Sin salida"}
                          </strong>
                        </div>
                        <div>
                          <span>Proveedor</span>
                          <strong>
                            {analysis.supplier || "Sin proveedor"}
                          </strong>
                        </div>
                        <div>
                          <span>Humedad</span>
                          <strong>
                            {analysis.humidity > 0
                              ? `${formatCompactDecimal(analysis.humidity)} %`
                              : "Sin dato"}
                          </strong>
                        </div>
                        <div>
                          <span>Analisis relacionado</span>
                          <strong>
                            {analysis.relatedAnalysis || "Sin relacion"}
                          </strong>
                        </div>
                        <div>
                          <span>Total defectos</span>
                          <strong>
                            {formatGrams(totalDefectGramsByAnalysis)} (
                            {formatPercent(totalDefectPercentByAnalysis)})
                          </strong>
                        </div>
                      </div>

                      <div className="record-card__extended-grid">
                        {analysis.defects.length ? (
                          analysis.defects.map((defect) => (
                            <div key={defect.id}>
                              <span>
                                {formatDefectLabel(defect.name, defect.detail)}
                              </span>
                              <strong>
                                {buildDefectSummary(
                                  defect,
                                  analysis.sampleWeightGr,
                                )}
                              </strong>
                            </div>
                          ))
                        ) : (
                          <div>
                            <span>Defectos</span>
                            <strong>Sin defectos detallados</strong>
                          </div>
                        )}
                      </div>

                      {analysis.observations ? (
                        <p className="defects-history-card__notes">
                          {analysis.observations}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="samples-empty-state">
              <strong>No hay analisis para esta vista</strong>
              <p>
                Ajusta los filtros o registra un nuevo analisis desde el modal.
              </p>
            </div>
          )}
        </div>

        <div className="samples-pagination defects-history-pagination">
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={safeCurrentPage === 1}
            aria-label="Pagina anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <span>
            Pagina {safeCurrentPage} de {totalPages}
          </span>

          <button
            type="button"
            className="ghost-button compact-button"
            onClick={() =>
              setCurrentPage((page) => Math.min(page + 1, totalPages))
            }
            disabled={safeCurrentPage === totalPages}
            aria-label="Pagina siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Intensidad promedio">
        <div className="defects-intensity-grid">
          <article
            className="defects-intensity-card defects-intensity-card--feature"
            style={
              {
                "--intensity-ring": `${Math.min(Math.max(averageDefectPercent, 0), 100)}%`,
              } as CSSProperties
            }
          >
            <div className="defects-intensity-card__visual">
              <div className="defects-intensity-card__ring">
                <strong>{formatPercent(averageDefectPercent)}</strong>
              </div>
            </div>
            <div className="defects-intensity-card__content">
              <span>Defectos promedio por analisis</span>
              <strong>{formatGrams(averageDefectGrams)}</strong>
              <p>Volumen promedio detectado en cada analisis. </p>
              <div className="defects-intensity-card__meter">
                <span
                  style={{
                    width: `${Math.min(Math.max(averageDefectPercent, 0), 100)}%`,
                  }}
                />
              </div>
              <small>{`Peso muestra promedio: ${formatGrams(averageSampleWeight)}`}</small>
            </div>
          </article>

          <article
            className="defects-intensity-card defects-intensity-card--feature"
            style={
              {
                "--intensity-ring": `${Math.min(Math.max(dominantDefectPercent, 0), 100)}%`,
              } as CSSProperties
            }
          >
            <div className="defects-intensity-card__visual">
              <div className="defects-intensity-card__ring">
                <strong>{formatPercent(dominantDefectPercent)}</strong>
              </div>
            </div>
            <div className="defects-intensity-card__content">
              <span>Defecto dominante</span>
              <strong>{dominantDefect?.name ?? "Sin datos"}</strong>
              <p>
                {dominantDefect
                  ? `${formatGrams(dominantDefect.averageGrams)} promedio por analisis.`
                  : "Todavia no hay suficientes analisis para calcularlo."}
              </p>
              <div className="defects-intensity-card__meter">
                <span
                  style={{
                    width: `${Math.min(Math.max(dominantDefectPercent, 0), 100)}%`,
                  }}
                />
              </div>
              <small>{`Base de calculo: ${formatGrams(averageSampleWeight)} por muestra`}</small>
            </div>
          </article>
        </div>
      </SectionCard>

      <div className="module-grid defects-analytics-grid">
        <SectionCard
          title="Promedio de defectos segun proceso"
          action={
            <div className="defects-chart-toolbar defects-chart-toolbar--stack">
              <label className="samples-filter-field">
                Proceso
                <select
                  className="defects-chart-select"
                  value={activeProcessChart}
                  onChange={(event) =>
                    setActiveProcessChart(event.target.value)
                  }
                >
                  <option value="">Seleccionar</option>
                  {processChartOptions.map((processCode) => (
                    <option key={processCode} value={processCode}>
                      {processCode}
                    </option>
                  ))}
                </select>
              </label>

              <span className="samples-list-count">
                Peso muestra prom.: {formatGrams(processAverageWeight)}
              </span>
            </div>
          }
        >
          <div className="chart-shell defects-chart-shell">
            {activeProcessChart ? (
              processAverageData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={processAverageData}
                    margin={{ top: 12, right: 18, bottom: 28, left: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridColor}
                    />
                    <XAxis
                      dataKey="name"
                      stroke={chartAxisColor}
                      angle={-22}
                      textAnchor="end"
                      interval={0}
                      height={84}
                    />
                    <YAxis
                      stroke={chartAxisColor}
                      tickFormatter={(value) => formatInteger(Number(value))}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatGrams(value),
                        "Promedio por analisis",
                      ]}
                    />
                    <Bar dataKey="grams" radius={[8, 8, 0, 0]}>
                      {processAverageData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="samples-empty-state">
                  <strong>El proceso no tiene defectos graficables</strong>
                  <p>
                    Prueba con otro proceso o registra analisis con detalle de
                    defectos.
                  </p>
                </div>
              )
            ) : (
              <div className="samples-empty-state">
                <strong>Selecciona un proceso</strong>
                <p>
                  Cuando elijas un proceso veras el promedio de gramos por
                  defecto.
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Evolucion de un defecto en el tiempo"
          action={
            <div className="defects-chart-toolbar">
              <label className="samples-filter-field">
                Defecto
                <select
                  className="defects-chart-select"
                  value={activeDefectChart}
                  onChange={(event) => setActiveDefectChart(event.target.value)}
                  disabled={!activeProcessChart}
                >
                  <option value="">Seleccionar</option>
                  {processDefectOptions.map((defect) => (
                    <option key={defect} value={defect}>
                      {defect}
                    </option>
                  ))}
                </select>
              </label>

              <div className="natural-month-nav">
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() =>
                    setActiveTrendMonth((current) => shiftMonthKey(current, -1))
                  }
                  disabled={!activeProcessChart || !activeDefectChart}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{formatMonthLabel(activeTrendMonth)}</span>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() =>
                    setActiveTrendMonth((current) => shiftMonthKey(current, 1))
                  }
                  disabled={!activeProcessChart || !activeDefectChart}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          }
        >
          <div className="chart-shell defects-chart-shell">
            {activeProcessChart ? (
              activeDefectChart ? (
                evolutionData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={evolutionData}
                      margin={{ top: 12, right: 18, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartGridColor}
                      />
                      <XAxis dataKey="day" stroke={chartAxisColor} />
                      <YAxis
                        stroke={chartAxisColor}
                        tickFormatter={(value) => formatInteger(Number(value))}
                      />
                      <Tooltip
                        labelFormatter={(label) => `Dia ${label}`}
                        formatter={(value: number) => [
                          formatGrams(value),
                          "Promedio diario",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="grams"
                        stroke="var(--chart-accent-2)"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="samples-empty-state">
                    <strong>Sin datos para este mes</strong>
                    <p>
                      Cambia de mes o selecciona otro defecto dentro del
                      proceso.
                    </p>
                  </div>
                )
              ) : (
                <div className="samples-empty-state">
                  <strong>Selecciona un defecto</strong>
                  <p>
                    El listado depende del proceso elegido en el grafico
                    anterior.
                  </p>
                </div>
              )
            ) : (
              <div className="samples-empty-state">
                <strong>Primero selecciona un proceso</strong>
                <p>
                  Asi se habilita el listado de defectos vinculados a ese
                  proceso.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {isModalOpen && hasMounted
        ? createPortal(
            <div
              className="samples-modal-backdrop"
              role="presentation"
              onClick={closeModal}
            >
              <div
                className="samples-modal card defects-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="defects-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="samples-modal__header">
                  <div>
                    <span className="eyebrow">
                      {editingAnalysisId ? "Editar analisis" : "Nuevo analisis"}
                    </span>
                    <h3 id="defects-modal-title">
                      {editingAnalysisId
                        ? "Actualizar analisis de defectos"
                        : "Registrar analisis de defectos"}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={closeModal}
                    aria-label="Cerrar modal"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form className="stack-form" onSubmit={handleSubmit}>
                  <div className="form-grid two-columns defects-form-grid">
                    <div className="stack-form defects-form-subsection">
                      <label>
                        FECHA *
                        <input
                          type="date"
                          required
                          value={form.analysisDate}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "analysisDate",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        CLIENTE *
                        <input
                          type="text"
                          list="defects-client-options"
                          required
                          className="samples-uppercase-input"
                          value={form.client}
                          onChange={(event) =>
                            handleTextFieldChange("client", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        PROVEEDOR
                        <input
                          type="text"
                          list="defects-supplier-options"
                          className="samples-uppercase-input"
                          value={form.supplier}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "supplier",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        PROCESO *
                        <input
                          type="text"
                          list="defects-process-options"
                          required
                          className="samples-uppercase-input"
                          value={form.processCode}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "processCode",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        PRODUCTO *
                        <input
                          type="text"
                          list="defects-product-options"
                          required
                          className="samples-uppercase-input"
                          value={form.product}
                          onChange={(event) =>
                            handleTextFieldChange("product", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        PESO MUESTRA *
                        <input
                          type="number"
                          min="0"
                          required
                          value={form.sampleWeightGr}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "sampleWeightGr",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="stack-form defects-form-subsection">
                      <label>
                        ANALISIS RELACIONADO
                        <input
                          type="text"
                          list="defects-related-analysis-options"
                          className="samples-uppercase-input"
                          value={form.relatedAnalysis}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "relatedAnalysis",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        SALIDA EN
                        <input
                          type="text"
                          list="defects-output-options"
                          className="samples-uppercase-input"
                          value={form.outputStage}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "outputStage",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        GRAMAJE
                        <input
                          type="number"
                          min="0"
                          value={form.gramajeHundredths}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "gramajeHundredths",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        HUMEDAD
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.humidity}
                          onChange={(event) =>
                            handleTextFieldChange(
                              "humidity",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {processMismatchWarning ? (
                    <div className="defects-form-warning">
                      {processMismatchWarning}
                    </div>
                  ) : null}

                  {formError ? (
                    <div className="defects-form-error">{formError}</div>
                  ) : null}

                  <div className="defects-form-subsection">
                    <div className="card-heading">
                      <div>
                        <h4>Defectos</h4>
                        <p>
                          Escribe una letra para autocompletar. El porcentaje se
                          calcula sobre {formatGrams(liveSampleWeight)}.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button compact-button"
                        onClick={handleAddDefectRow}
                      >
                        <Plus size={14} />
                        Agregar fila
                      </button>
                    </div>

                    <div className="defects-form-list">
                      {form.defects.map((defect) => {
                        const needsDetail = requiresDefectDetail(defect.name);
                        const defectPercentage = getDefectPercentage(
                          toNumberOrZero(defect.grams),
                          liveSampleWeight,
                        );

                        return (
                          <div key={defect.id} className="defects-form-row">
                            <label className="defects-form-row__label defects-form-row__label--wide">
                              Defecto
                              <input
                                type="text"
                                list="defects-name-options"
                                className="samples-uppercase-input"
                                value={defect.name}
                                onChange={(event) =>
                                  handleDefectFieldChange(
                                    defect.id,
                                    "name",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>

                            {needsDetail ? (
                              <label className="defects-form-row__label">
                                Detalle
                                <input
                                  type="text"
                                  className="samples-uppercase-input"
                                  value={defect.detail}
                                  onChange={(event) =>
                                    handleDefectFieldChange(
                                      defect.id,
                                      "detail",
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                            ) : (
                              <div className="defects-form-row__ghost" />
                            )}

                            <label className="defects-form-row__label">
                              Gramos
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={defect.grams}
                                onChange={(event) =>
                                  handleDefectFieldChange(
                                    defect.id,
                                    "grams",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>

                            <span className="defects-form-row__pct">
                              {formatPercent(defectPercentage)}
                            </span>

                            <button
                              type="button"
                              className="ghost-button compact-button danger-button"
                              onClick={() => handleRemoveDefectRow(defect.id)}
                              disabled={form.defects.length === 1}
                              aria-label="Eliminar fila de defecto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <label>
                    OBSERVACIONES
                    <textarea
                      rows={4}
                      className="samples-uppercase-input"
                      value={form.observations}
                      onChange={(event) =>
                        handleTextFieldChange(
                          "observations",
                          event.target.value,
                        )
                      }
                      placeholder="DETALLE OPERATIVO, ACLARACIONES O CONTEXTO DEL ANALISIS"
                    />
                  </label>

                  <div className="samples-modal__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={closeModal}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={isPersisting}
                    >
                      {isPersisting
                        ? "Guardando..."
                        : editingAnalysisId
                          ? "Guardar cambios"
                          : "Guardar analisis"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      <datalist id="defects-client-options">
        {formClientOptions.map((client) => (
          <option key={client} value={client} />
        ))}
      </datalist>

      <datalist id="defects-supplier-options">
        {formSupplierOptions.map((supplier) => (
          <option key={supplier} value={supplier} />
        ))}
      </datalist>

      <datalist id="defects-process-options">
        {formProcessOptions.map((processCode) => (
          <option key={processCode} value={processCode} />
        ))}
      </datalist>

      <datalist id="defects-product-options">
        {formProductOptions.map((product) => (
          <option key={product} value={product} />
        ))}
      </datalist>

      <datalist id="defects-related-analysis-options">
        {relatedAnalysisOptions.map((analysisId) => (
          <option key={analysisId} value={analysisId} />
        ))}
      </datalist>

      <datalist id="defects-output-options">
        {formOutputOptions.map((outputStage) => (
          <option key={outputStage} value={outputStage} />
        ))}
      </datalist>

      <datalist id="defects-name-options">
        {combinedDefectOptions.map((defect) => (
          <option key={defect} value={defect} />
        ))}
      </datalist>
    </div>
  );
};
