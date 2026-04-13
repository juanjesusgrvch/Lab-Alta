"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
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
  chunkPdfItems,
  PdfExportPage,
  PdfExportPortal,
  PdfExportRoot,
  PdfHistoryCardsSection,
  PdfSelectedFiltersSection,
  type PdfExportFilterItem,
} from "@/components/modules/pdf-export";
import {
  formatDate,
  formatInteger,
  formatKg,
  getTodayInBuenosAires,
} from "@/lib/format";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  createRecord,
  deleteRecord,
  saveRecord,
  subscribeToRecords,
} from "@/lib/firestore-records";
import { exportElementToPdf, waitForPdfLayout } from "@/lib/pdf";
import {
  createBulkPackagingMovement,
  createPackagingMovement,
  formatPackagingMovementLabel,
  getPackagingIdsFromMovements,
  hasExplicitPackagingDetails,
  normalizePackagingMovement,
  normalizePackagingText,
  packagingConditionOptions,
  packagingTypeOptions,
  type PackagingMovementRecord,
} from "@/lib/packaging";
import {
  autofillUniqueRelationalSelections,
  areStringFiltersEqual,
  clearInvalidRelationalSelections,
  getRelationalOptions,
  type RelationalFieldConfig,
} from "@/lib/relational-filters";
import type { DashboardDataMode } from "@/lib/dashboard-data-mode";
import { createDemoNaturalEntries } from "@/lib/demo-data";
import type { NaturalEntry } from "@/types/domain";

// Configuracion
const chartColors = [
  "var(--chart-accent-1)",
  "var(--chart-accent-2)",
  "var(--chart-accent-3)",
  "var(--chart-accent-4)",
  "var(--chart-accent-5)",
];
const chartGridColor = "var(--chart-grid)";
const chartAxisColor = "var(--chart-axis)";
const PAGE_SIZE = 5;

// Tipos
type NaturalFormState = {
  entryDate: string;
  client: string;
  product: string;
  netKg: number;
  supplier: string;
  processCode: string;
  withAnalysis: boolean;
  analysisCode: string;
  hasCartaPorte: boolean;
  numeroCartaPorte: string;
  observations: string;
  hasPackagingDetails: boolean;
  packagingMovements: PackagingMovementRecord[];
};

type NaturalRelationalFilters = {
  client: string;
  supplier: string;
  product: string;
  processCode: string;
  packagingId: string;
};

type NaturalFormRelations = Pick<
  NaturalFormState,
  "client" | "supplier" | "product" | "processCode" | "analysisCode"
>;

type MonthlyScatterPoint = {
  day: number;
  netKg: number;
  loads: number[];
};

type NaturalBreakdownGroup = "product" | "client" | "process";

type NaturalBreakdownDatum = {
  name: string;
  netKg: number;
};

// Filtros
const naturalFilterConfig: Record<
  keyof NaturalRelationalFilters,
  RelationalFieldConfig<NaturalEntry>
> = {
  client: {
    getValues: (entry) => [entry.client],
    matches: (entry, value) => entry.client === value,
  },
  supplier: {
    getValues: (entry) => [entry.supplier],
    matches: (entry, value) => entry.supplier === value,
  },
  product: {
    getValues: (entry) => [entry.product],
    matches: (entry, value) => entry.product === value,
  },
  processCode: {
    getValues: (entry) => [entry.processCode],
    matches: (entry, value) => entry.processCode === value,
  },
  packagingId: {
    getValues: (entry) =>
      getPackagingIdsFromMovements(entry.packagingMovements),
    matches: (entry, value) =>
      getPackagingIdsFromMovements(entry.packagingMovements).includes(value),
  },
};

const naturalFormRelationConfig: Record<
  keyof NaturalFormRelations,
  RelationalFieldConfig<NaturalEntry>
> = {
  client: {
    getValues: (entry) => [entry.client],
    matches: (entry, value) => entry.client === value,
  },
  supplier: {
    getValues: (entry) => [entry.supplier],
    matches: (entry, value) => entry.supplier === value,
  },
  product: {
    getValues: (entry) => [entry.product],
    matches: (entry, value) => entry.product === value,
  },
  processCode: {
    getValues: (entry) => [entry.processCode],
    matches: (entry, value) => entry.processCode === value,
  },
  analysisCode: {
    getValues: (entry) => [entry.analysisCode ?? ""],
    matches: (entry, value) => (entry.analysisCode ?? "") === value,
  },
};

// Formulario
const normalizeUppercaseValue = (value: string) =>
  value.replace(/\s+/g, " ").replace(/^\s+/, "").toUpperCase();

const createEmptyForm = (): NaturalFormState => ({
  entryDate: getTodayInBuenosAires(),
  client: "",
  product: "",
  netKg: 0,
  supplier: "",
  processCode: "",
  withAnalysis: false,
  analysisCode: "",
  hasCartaPorte: false,
  numeroCartaPorte: "",
  observations: "",
  hasPackagingDetails: false,
  packagingMovements: [createPackagingMovement("alta")],
});

const formFromEntry = (entry: NaturalEntry): NaturalFormState => {
  const hasPackagingDetails = hasExplicitPackagingDetails(
    entry.packagingMovements,
  );
  const numeroCartaPorte = normalizeUppercaseValue(
    entry.numeroCartaPorte ?? "",
  );

  return {
    entryDate: entry.entryDate,
    client: entry.client,
    product: entry.product,
    netKg: entry.netKg,
    supplier: entry.supplier,
    processCode: entry.processCode,
    withAnalysis: entry.withAnalysis,
    analysisCode: entry.analysisCode ?? "",
    hasCartaPorte: Boolean(numeroCartaPorte),
    numeroCartaPorte,
    observations: entry.observations ?? entry.analysisSummary?.notes ?? "",
    hasPackagingDetails,
    packagingMovements:
      hasPackagingDetails && entry.packagingMovements?.length
        ? entry.packagingMovements.map((movement, index) =>
            normalizePackagingMovement(
              movement,
              movement.id?.trim() || `PKG-${entry.id}-${index + 1}`,
            ),
          )
        : [createPackagingMovement("alta")],
  };
};

// Meses
const getMonthKey = (value: string) => value.slice(0, 7);

const parseMonthKey = (monthKey: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return { year, monthIndex };
};

const formatMonthLabel = (monthKey: string) => {
  const parsed = parseMonthKey(monthKey);

  if (!parsed) {
    return "Mes no disponible";
  }

  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Buenos_Aires",
  }).format(new Date(Date.UTC(parsed.year, parsed.monthIndex, 1, 12)));

  return label.charAt(0).toUpperCase() + label.slice(1);
};

const getAdjacentMonthKey = (
  monthKeys: string[],
  currentMonthKey: string,
  delta: number,
) => {
  if (!monthKeys.length) {
    return currentMonthKey;
  }

  const currentIndex = monthKeys.indexOf(currentMonthKey);

  if (currentIndex === -1) {
    return delta < 0 ? (monthKeys.at(-1) ?? currentMonthKey) : monthKeys[0];
  }

  const nextIndex = Math.min(
    Math.max(currentIndex + (delta < 0 ? -1 : 1), 0),
    monthKeys.length - 1,
  );

  return monthKeys[nextIndex];
};

const getDayTicks = (daysInMonth: number) => {
  const ticks = Array.from(
    { length: daysInMonth },
    (_, index) => index + 1,
  ).filter((day) => day === 1 || day === daysInMonth || day % 5 === 0);

  if (!ticks.includes(daysInMonth)) {
    ticks.push(daysInMonth);
  }

  return ticks;
};

const formatChartKg = (value: number) =>
  value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`;

const formatChartNetTons = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number.isFinite(value) ? value : 0) / 1000);

const naturalBreakdownOptions: Array<{
  value: NaturalBreakdownGroup;
  label: string;
}> = [
  { value: "product", label: "Producto" },
  { value: "client", label: "Cliente" },
  { value: "process", label: "Proceso" },
];

const naturalBreakdownLabelMap: Record<NaturalBreakdownGroup, string> = {
  product: "producto",
  client: "cliente",
  process: "proceso",
};

// Registros
const normalizeNaturalEntry = (
  recordId: string,
  entry: Partial<NaturalEntry>,
): NaturalEntry => ({
  id: entry.id?.trim() || recordId,
  entryDate: entry.entryDate ?? getTodayInBuenosAires(),
  truckPlate: entry.truckPlate ?? "",
  client: entry.client ?? "",
  supplier: entry.supplier ?? "",
  product: entry.product ?? "",
  processCode: entry.processCode ?? "",
  grossKg: Number(entry.grossKg ?? entry.netKg ?? 0),
  tareKg: Number(entry.tareKg ?? 0),
  netKg: Number(entry.netKg ?? 0),
  withAnalysis: Boolean(entry.withAnalysis),
  analysisCode: entry.analysisCode ?? "",
  numeroCartaPorte: normalizeUppercaseValue(entry.numeroCartaPorte ?? ""),
  observations: entry.observations ?? "",
  packagingMovements: Array.isArray(entry.packagingMovements)
    ? entry.packagingMovements.map((movement, index) =>
        normalizePackagingMovement(movement, `PKG-${recordId}-${index + 1}`),
      )
    : [],
  analysisSummary: entry.analysisSummary,
});

const getSortedUniqueOptions = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => normalizePackagingText(value ?? ""))
        .filter(Boolean),
    ),
  ).sort((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" }),
  );

const getLatestMonthKey = (entries: NaturalEntry[]) =>
  getMonthKey(
    entries.reduce(
      (latest, entry) => (entry.entryDate > latest ? entry.entryDate : latest),
      entries[0]?.entryDate ?? getTodayInBuenosAires(),
    ),
  );

// Graficos
const NaturalScatterTooltip = ({
  active,
  payload,
}: TooltipProps<number, string>) => {
  const point = payload?.[0]?.payload as MonthlyScatterPoint | undefined;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="natural-chart-tooltip">
      <strong>{`Dia ${String(point.day).padStart(2, "0")}`}</strong>
      <span>
        {point.loads.length} descarga{point.loads.length === 1 ? "" : "s"}
      </span>
      <div className="natural-chart-tooltip__values">
        {point.loads.map((load, index) => (
          <p
            key={`${point.day}-${index}`}
          >{`Ingreso ${index + 1}: ${formatKg(load)}`}</p>
        ))}
      </div>
      {point.loads.length > 1 ? (
        <p>{`Total: ${formatKg(point.netKg)}`}</p>
      ) : null}
    </div>
  );
};

interface NaturalModuleProps {
  dataMode?: DashboardDataMode;
}

// Modulo
export const NaturalModule = ({ dataMode = "live" }: NaturalModuleProps) => {
  const isDemoMode = dataMode === "demo";
  const [entries, setEntries] = useState<NaturalEntry[]>(() =>
    isDemoMode ? createDemoNaturalEntries() : [],
  );
  const [filters, setFilters] = useState({
    client: "",
    supplier: "",
    product: "",
    processCode: "",
    packagingId: "",
    from: "",
    to: "",
    onlyWithAnalysis: false,
  });
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [form, setForm] = useState(createEmptyForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeMonthKey, setActiveMonthKey] = useState(() =>
    getMonthKey(getTodayInBuenosAires()),
  );
  const [breakdownGroup, setBreakdownGroup] =
    useState<NaturalBreakdownGroup>("product");
  const [breakdownYear, setBreakdownYear] = useState("all");
  const [isSyncing, setIsSyncing] = useState(!isDemoMode);
  const [isPersisting, setIsPersisting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Sincronizacion
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setEntries(createDemoNaturalEntries());
      setIsSyncing(false);
      setSyncError(null);
      return;
    }

    const unsubscribe = subscribeToRecords<NaturalEntry>(
      "downloads",
      (records) => {
        const nextEntries = records.map((record) =>
          normalizeNaturalEntry(record.id, record.data),
        );

        setEntries(nextEntries);
        setIsSyncing(false);
        setSyncError(null);
      },
      () => {
        setEntries([]);
        setIsSyncing(false);
        setSyncError(
          "No se pudo sincronizar la coleccion de descargas con Firestore.",
        );
      },
    );

    return unsubscribe;
  }, [isDemoMode]);

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
    filters.product,
    filters.processCode,
    filters.packagingId,
    filters.from,
    filters.to,
    filters.onlyWithAnalysis,
  ]);

  // Filtros
  const relationalFilters: NaturalRelationalFilters = {
    client: filters.client,
    supplier: filters.supplier,
    product: filters.product,
    processCode: filters.processCode,
    packagingId: filters.packagingId,
  };

  const matchesAnalysisFilter = (
    entry: NaturalEntry,
    onlyWithAnalysis: boolean,
  ) => !onlyWithAnalysis || entry.withAnalysis;

  const matchesDateRange = (entry: NaturalEntry, from: string, to: string) => {
    const matchesFrom = !from || entry.entryDate >= from;
    const matchesTo = !to || entry.entryDate <= to;

    return matchesFrom && matchesTo;
  };

  const clientOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "client",
    naturalFilterConfig,
    (entry) =>
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis) &&
      matchesDateRange(entry, filters.from, filters.to),
  );
  const productOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "product",
    naturalFilterConfig,
    (entry) =>
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis) &&
      matchesDateRange(entry, filters.from, filters.to),
  );
  const supplierOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "supplier",
    naturalFilterConfig,
    (entry) =>
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis) &&
      matchesDateRange(entry, filters.from, filters.to),
  );
  const processOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "processCode",
    naturalFilterConfig,
    (entry) =>
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis) &&
      matchesDateRange(entry, filters.from, filters.to),
  );
  const packagingOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "packagingId",
    naturalFilterConfig,
    (entry) =>
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis) &&
      matchesDateRange(entry, filters.from, filters.to),
  );

  const allClientOptions = Array.from(
    new Set(entries.map((entry) => entry.client).filter(Boolean)),
  ).sort();
  const allProductOptions = Array.from(
    new Set(entries.map((entry) => entry.product).filter(Boolean)),
  ).sort();
  const allSupplierOptions = Array.from(
    new Set(entries.map((entry) => entry.supplier).filter(Boolean)),
  ).sort();
  const allProcessOptions = Array.from(
    new Set(entries.map((entry) => entry.processCode).filter(Boolean)),
  ).sort();
  const allAnalysisCodes = Array.from(
    new Set(entries.map((entry) => entry.analysisCode).filter(Boolean)),
  ).sort();
  const formRelations: NaturalFormRelations = {
    client: form.client,
    supplier: form.supplier,
    product: form.product,
    processCode: form.processCode,
    analysisCode: form.analysisCode,
  };
  const formClientOptions = getRelationalOptions(
    entries,
    formRelations,
    "client",
    naturalFormRelationConfig,
  );
  const formSupplierOptions = getRelationalOptions(
    entries,
    formRelations,
    "supplier",
    naturalFormRelationConfig,
  );
  const formProductOptions = getRelationalOptions(
    entries,
    formRelations,
    "product",
    naturalFormRelationConfig,
  );
  const formProcessOptions = getRelationalOptions(
    entries,
    formRelations,
    "processCode",
    naturalFormRelationConfig,
  );
  const formAnalysisOptions = getRelationalOptions(
    entries,
    formRelations,
    "analysisCode",
    naturalFormRelationConfig,
    (entry) => entry.withAnalysis,
  );
  const packagingSuggestionEntries = entries.filter((entry) => {
    const matchesClient = !form.client || entry.client === form.client;
    const matchesSupplier = !form.supplier || entry.supplier === form.supplier;
    const matchesProduct = !form.product || entry.product === form.product;
    const matchesProcess =
      !form.processCode || entry.processCode === form.processCode;
    const matchesAnalysis =
      !form.withAnalysis ||
      (entry.withAnalysis &&
        (!form.analysisCode ||
          (entry.analysisCode ?? "") === form.analysisCode));

    return (
      matchesClient &&
      matchesSupplier &&
      matchesProduct &&
      matchesProcess &&
      matchesAnalysis
    );
  });
  const packagingSuggestionSource = packagingSuggestionEntries.length
    ? packagingSuggestionEntries
    : entries;
  const normalizedPackagingMovements = packagingSuggestionSource.flatMap(
    (entry) =>
      (entry.packagingMovements ?? []).map((movement, index) =>
        normalizePackagingMovement(
          movement,
          `${entry.id}-PACKAGING-${index + 1}`,
        ),
      ),
  );
  const packagingTypeSuggestions = getSortedUniqueOptions([
    ...packagingTypeOptions.filter((option) => option !== "GRANEL"),
    ...normalizedPackagingMovements
      .filter((movement) => movement.packagingType !== "GRANEL")
      .map((movement) => movement.packagingType),
  ]);
  const packagingConditionSuggestions = getSortedUniqueOptions([
    ...packagingConditionOptions,
    ...normalizedPackagingMovements
      .filter((movement) => movement.packagingType !== "GRANEL")
      .map((movement) => movement.packagingCondition),
  ]);
  const packagingKgSuggestions = Array.from(
    new Set(
      normalizedPackagingMovements
        .filter(
          (movement) =>
            movement.packagingType !== "GRANEL" && movement.packagingKg > 0,
        )
        .map((movement) => movement.packagingKg),
    ),
  ).sort((left, right) => left - right);

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: NaturalRelationalFilters = {
        client: current.client,
        supplier: current.supplier,
        product: current.product,
        processCode: current.processCode,
        packagingId: current.packagingId,
      };
      const sanitizedRelational = clearInvalidRelationalSelections(
        entries,
        currentRelational,
        naturalFilterConfig,
        (entry) =>
          matchesAnalysisFilter(entry, current.onlyWithAnalysis) &&
          matchesDateRange(entry, current.from, current.to),
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
    entries,
    filters.client,
    filters.supplier,
    filters.product,
    filters.processCode,
    filters.packagingId,
    filters.from,
    filters.to,
    filters.onlyWithAnalysis,
  ]);

  // Historial
  const filteredEntries = entries.filter((entry) => {
    const matchesClient = !filters.client || entry.client === filters.client;
    const matchesSupplier =
      !filters.supplier || entry.supplier === filters.supplier;
    const matchesProduct =
      !filters.product || entry.product === filters.product;
    const matchesProcess =
      !filters.processCode || entry.processCode === filters.processCode;
    const matchesPackaging =
      !filters.packagingId ||
      getPackagingIdsFromMovements(entry.packagingMovements).includes(
        filters.packagingId,
      );

    return (
      matchesClient &&
      matchesSupplier &&
      matchesProduct &&
      matchesProcess &&
      matchesPackaging &&
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis) &&
      matchesDateRange(entry, filters.from, filters.to)
    );
  });

  useEffect(() => {
    if (!filteredEntries.length) {
      return;
    }

    const hasDataInActiveMonth = filteredEntries.some(
      (entry) => getMonthKey(entry.entryDate) === activeMonthKey,
    );

    if (!hasDataInActiveMonth) {
      setActiveMonthKey(getLatestMonthKey(filteredEntries));
    }
  }, [filteredEntries, activeMonthKey]);

  const sortedEntries = [...filteredEntries].sort((left, right) => {
    const byDate = right.entryDate.localeCompare(left.entryDate);

    return byDate || right.id.localeCompare(left.id);
  });
  const availableMonthKeys = Array.from(
    new Set(filteredEntries.map((entry) => getMonthKey(entry.entryDate))),
  ).sort((left, right) => left.localeCompare(right));

  const totalNetKg = filteredEntries.reduce(
    (accumulator, entry) => accumulator + entry.netKg,
    0,
  );
  const analyzedEntries = filteredEntries.filter(
    (entry) => entry.withAnalysis,
  ).length;
  const selectedFilterItems: PdfExportFilterItem[] = [
    { label: "Cliente", value: filters.client },
    { label: "Proveedor", value: filters.supplier },
    { label: "Proceso", value: filters.processCode },
    { label: "Producto", value: filters.product },
    { label: "Envase", value: filters.packagingId },
    { label: "Desde", value: filters.from ? formatDate(filters.from) : "" },
    { label: "Hasta", value: filters.to ? formatDate(filters.to) : "" },
    ...(filters.onlyWithAnalysis
      ? [{ label: "Analisis", value: "Solo con analisis" }]
      : []),
  ].filter((item) => item.value);
  const pdfEntryPages = chunkPdfItems(sortedEntries);
  const availableBreakdownYears = Array.from(
    new Set(
      filteredEntries
        .map((entry) => entry.entryDate.slice(0, 4))
        .filter(Boolean),
    ),
  ).sort((left, right) => right.localeCompare(left));

  useEffect(() => {
    if (breakdownYear === "all") {
      return;
    }

    if (!availableBreakdownYears.includes(breakdownYear)) {
      setBreakdownYear("all");
    }
  }, [availableBreakdownYears, breakdownYear]);

  const breakdownSourceEntries = filteredEntries.filter((entry) =>
    breakdownYear === "all"
      ? true
      : entry.entryDate.startsWith(`${breakdownYear}-`),
  );
  const breakdownMap = new Map<string, number>();

  breakdownSourceEntries.forEach((entry) => {
    const breakdownKey =
      breakdownGroup === "client"
        ? entry.client
        : breakdownGroup === "process"
          ? entry.processCode
          : entry.product;
    const safeLabel = breakdownKey?.trim() || "SIN DATO";

    breakdownMap.set(
      safeLabel,
      (breakdownMap.get(safeLabel) ?? 0) + entry.netKg,
    );
  });

  const inboundBreakdownData: NaturalBreakdownDatum[] = Array.from(
    breakdownMap.entries(),
  )
    .map(([name, netKg]) => ({ name, netKg }))
    .sort((left, right) => right.netKg - left.netKg);
  const breakdownTitle = `Toneladas por ${naturalBreakdownLabelMap[breakdownGroup]}`;

  const activeMonth = parseMonthKey(activeMonthKey) ?? {
    year: Number(getTodayInBuenosAires().slice(0, 4)),
    monthIndex: Number(getTodayInBuenosAires().slice(5, 7)) - 1,
  };
  const activeMonthDate = new Date(
    activeMonth.year,
    activeMonth.monthIndex,
    1,
    12,
  );
  const daysInActiveMonth = new Date(
    activeMonthDate.getFullYear(),
    activeMonthDate.getMonth() + 1,
    0,
  ).getDate();
  const monthDayTicks = getDayTicks(daysInActiveMonth);

  const inboundByDayMap = new Map<number, number[]>();
  filteredEntries.forEach((entry) => {
    if (getMonthKey(entry.entryDate) !== activeMonthKey) {
      return;
    }

    const day = Number(entry.entryDate.slice(8, 10));
    const currentLoads = inboundByDayMap.get(day) ?? [];
    currentLoads.push(entry.netKg);
    inboundByDayMap.set(day, currentLoads);
  });

  const monthlyScatterData = Array.from(inboundByDayMap.entries())
    .map(([day, loads]) => ({
      day,
      loads: [...loads].sort((left, right) => right - left),
      netKg: loads.reduce((sum, load) => sum + load, 0),
    }))
    .sort((left, right) => left.day - right.day);
  const activeMonthIndex = availableMonthKeys.indexOf(activeMonthKey);
  const hasPreviousMonth = activeMonthIndex > 0;
  const hasNextMonth =
    activeMonthIndex !== -1 && activeMonthIndex < availableMonthKeys.length - 1;

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedEntries = sortedEntries.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Acciones
  const openCreateModal = () => {
    setEditingEntryId(null);
    setForm(createEmptyForm());
    setSyncError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: NaturalEntry) => {
    setEditingEntryId(entry.id);
    setForm(formFromEntry(entry));
    setSyncError(null);
    setIsModalOpen(true);
  };

  const toggleExpandedEntry = (entryId: string) => {
    setExpandedEntryId((current) => (current === entryId ? null : entryId));
  };

  const handleExpandableCardKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    entryId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpandedEntry(entryId);
    }
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setEditingEntryId(null);
    setSyncError(null);
  };

  const handleFilterChange = (
    field: keyof typeof filters,
    value: string | boolean,
  ) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleFormChange = (
    field: keyof NaturalFormState,
    value: string | number | boolean,
  ) => {
    setForm((current) => {
      if (field === "hasPackagingDetails") {
        const hasPackagingDetails = Boolean(value);

        return {
          ...current,
          hasPackagingDetails,
          packagingMovements: hasPackagingDetails
            ? hasExplicitPackagingDetails(current.packagingMovements)
              ? current.packagingMovements.map((movement) =>
                  normalizePackagingMovement(movement, movement.id),
                )
              : [createPackagingMovement("alta")]
            : [createBulkPackagingMovement()],
        };
      }

      if (field === "withAnalysis") {
        return {
          ...current,
          withAnalysis: Boolean(value),
          analysisCode: value ? current.analysisCode : "",
        };
      }

      if (field === "hasCartaPorte") {
        return {
          ...current,
          hasCartaPorte: Boolean(value),
          numeroCartaPorte: value ? current.numeroCartaPorte : "",
        };
      }

      if (field === "netKg" && typeof value === "number") {
        return {
          ...current,
          netKg: Math.max(value, 0),
        };
      }

      if (field === "packagingMovements") {
        return current;
      }

      const normalizedValue =
        typeof value === "string" ? normalizeUppercaseValue(value) : value;

      const nextForm = {
        ...current,
      };
      const mutableForm = nextForm as Record<string, any>;

      mutableForm[field as string] = normalizedValue as any;

      return nextForm as NaturalFormState;
    });
  };

  const handlePackagingMovementChange = (
    movementId: string,
    field: keyof PackagingMovementRecord,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      packagingMovements: current.packagingMovements.map((movement) => {
        if (movement.id !== movementId) {
          return movement;
        }

        if (field === "quantity") {
          return {
            ...movement,
            quantity: Math.max(0, Number(value) || 0),
          };
        }

        if (field === "packagingType") {
          const newPackagingType = normalizePackagingText(String(value));

          return {
            ...movement,
            packagingType: newPackagingType,
          };
        }

        if (field === "packagingKg") {
          return {
            ...movement,
            packagingKg: Math.max(0, Number(value) || 0),
          };
        }

        return {
          ...movement,
          [field]: normalizePackagingText(String(value)),
        };
      }),
    }));
  };

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    setForm((current) => {
      const currentRelations: NaturalFormRelations = {
        client: current.client,
        supplier: current.supplier,
        product: current.product,
        processCode: current.processCode,
        analysisCode: current.analysisCode,
      };
      const autofilledRelations = autofillUniqueRelationalSelections(
        entries,
        currentRelations,
        naturalFormRelationConfig,
        current.withAnalysis ? (entry) => entry.withAnalysis : undefined,
      );
      const nextForm = {
        ...current,
        ...autofilledRelations,
      };
      const changed = !areStringFiltersEqual(
        currentRelations,
        autofilledRelations,
      );

      return changed ? nextForm : current;
    });
  }, [
    isModalOpen,
    entries,
    form.client,
    form.supplier,
    form.product,
    form.processCode,
    form.analysisCode,
    form.withAnalysis,
  ]);

  const handleAddPackagingMovement = () => {
    setForm((current) => ({
      ...current,
      packagingMovements: [
        ...current.packagingMovements,
        createPackagingMovement("alta"),
      ],
    }));
  };

  const handleRemovePackagingMovement = (movementId: string) => {
    setForm((current) => {
      const nextMovements = current.packagingMovements.filter(
        (movement) => movement.id !== movementId,
      );

      return {
        ...current,
        packagingMovements: nextMovements.length
          ? nextMovements
          : [createPackagingMovement("alta")],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSyncError(null);

    const normalizedPackagingMovements = form.hasPackagingDetails
      ? form.packagingMovements
          .map((movement, index) =>
            normalizePackagingMovement(
              movement,
              movement.id || `PKG-${editingEntryId ?? Date.now()}-${index + 1}`,
            ),
          )
          .filter(
            (movement) =>
              movement.packagingType !== "GRANEL" &&
              movement.quantity > 0 &&
              movement.packagingKg > 0,
          )
      : [createBulkPackagingMovement()];

    if (form.hasPackagingDetails && !normalizedPackagingMovements.length) {
      setSyncError(
        "Carga al menos un envase valido con tipo, estado, kg y cantidad.",
      );
      return;
    }

    const nextEntry: NaturalEntry = {
      id: editingEntryId ?? `ING-${Date.now()}`,
      entryDate: form.entryDate,
      truckPlate: "",
      client: form.client.trim(),
      supplier: form.supplier.trim(),
      product: form.product.trim(),
      processCode: form.processCode.trim(),
      grossKg: form.netKg,
      tareKg: 0,
      netKg: form.netKg,
      withAnalysis: form.withAnalysis,
      analysisCode: form.withAnalysis ? form.analysisCode.trim() : "",
      numeroCartaPorte: form.hasCartaPorte ? form.numeroCartaPorte.trim() : "",
      observations: form.observations.trim(),
      packagingMovements: normalizedPackagingMovements,
    };

    setIsPersisting(true);
    setSyncError(null);

    try {
      if (isDemoMode) {
        setEntries((current) =>
          editingEntryId
            ? current.map((entry) =>
                entry.id === editingEntryId ? nextEntry : entry,
              )
            : [nextEntry, ...current],
        );
      } else if (editingEntryId) {
        const currentUserId = getFirebaseAuth().currentUser?.uid;
        await saveRecord<NaturalEntry>(
          "downloads",
          editingEntryId,
          nextEntry,
          currentUserId,
        );
      } else {
        const currentUserId = getFirebaseAuth().currentUser?.uid;
        await createRecord<NaturalEntry>(
          "downloads",
          nextEntry.id,
          nextEntry,
          currentUserId,
        );
      }

      setCurrentPage(1);
      setActiveMonthKey(getMonthKey(form.entryDate));
      setForm(createEmptyForm());
      closeCreateModal();
    } catch {
      setSyncError("No se pudo guardar la descarga en Firestore.");
    } finally {
      setIsPersisting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const entry = entries.find((item) => item.id === entryId);
    const entryLabel = `${entry?.product ?? "REGISTRO"} / ${entry?.entryDate ?? entryId}`;

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Eliminar el ingreso ${entryLabel}?`)
    ) {
      return;
    }

    setIsPersisting(true);
    setSyncError(null);

    try {
      if (isDemoMode) {
        setEntries((current) =>
          current.filter((entry) => entry.id !== entryId),
        );
        setExpandedEntryId((current) => (current === entryId ? null : current));
      } else {
        await deleteRecord("downloads", entryId);
      }
    } catch {
      setSyncError("No se pudo eliminar la descarga en Firestore.");
    } finally {
      setIsPersisting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      flushSync(() => {
        setIsPreparingPdf(true);
      });
      await waitForPdfLayout();

      if (!exportRef.current) {
        return;
      }

      await exportElementToPdf(exportRef.current, "mercaderia-natural.pdf");
    } finally {
      flushSync(() => {
        setIsPreparingPdf(false);
      });
      setIsExporting(false);
    }
  };

  const renderEntryRecord = (
    entry: NaturalEntry,
    {
      expanded,
      exportMode = false,
    }: { expanded: boolean; exportMode?: boolean },
  ) => (
    <article
      key={entry.id}
      className={`samples-record natural-record record-card--light${
        expanded ? " is-expanded" : ""
      }`}
      {...(exportMode
        ? {}
        : {
            role: "button" as const,
            tabIndex: 0,
            "aria-expanded": expanded,
            onClick: () => toggleExpandedEntry(entry.id),
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) =>
              handleExpandableCardKeyDown(event, entry.id),
          })}
    >
      <div className="natural-record__header">
        <div>
          <div className="natural-record__title-line">
            <strong>{entry.product || "SIN PRODUCTO"}</strong>
          </div>
          <p>
            {entry.client || "SIN CLIENTE"} /{" "}
            {entry.supplier || "SIN PROVEEDOR"}
          </p>
          <div className="natural-record__netkg">
            <span className="natural-record__netkg-value">
              {formatKg(entry.netKg)}
            </span>
            <span className="natural-record__netkg-date">
              {formatDate(entry.entryDate)}
            </span>
          </div>
        </div>

        {!exportMode ? (
          <div className="natural-record__actions">
            <button
              type="button"
              className="icon-button compact-icon-button compact-icon-button--view"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpandedEntry(entry.id);
              }}
              aria-label={
                expanded
                  ? "Ocultar detalle de la descarga"
                  : "Ver detalle de la descarga"
              }
              title={expanded ? "Ocultar detalle" : "Vista extendida"}
            >
              {expanded ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="button"
              className="icon-button compact-icon-button compact-icon-button--edit"
              onClick={(event) => {
                event.stopPropagation();
                openEditModal(entry);
              }}
              aria-label="Editar descarga"
              title="Editar"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className="icon-button compact-icon-button compact-icon-button--delete"
              onClick={(event) => {
                event.stopPropagation();
                void handleDeleteEntry(entry.id);
              }}
              aria-label="Eliminar descarga"
              title="Eliminar"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="record-card__extended">
          <div className="record-card__extended-grid">
            <div>
              <span>Proceso</span>
              <strong>{entry.processCode || "Sin proceso"}</strong>
            </div>
            <div>
              <span>Codigo analisis</span>
              <strong>
                {entry.withAnalysis
                  ? entry.analysisCode || "Sin codigo"
                  : "No aplica"}
              </strong>
            </div>
            <div>
              <span>Carta de porte</span>
              <strong>
                {entry.numeroCartaPorte?.trim() || "Sin carta de porte"}
              </strong>
            </div>
          </div>

          <div className="record-card__extended-grid">
            {entry.packagingMovements?.length ? (
              entry.packagingMovements.map((movement) => (
                <div key={movement.id}>
                  <span>Envases</span>
                  <strong>{formatPackagingMovementLabel(movement)}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>Envases</span>
                <strong>granel</strong>
              </div>
            )}
          </div>

          {entry.observations ? (
            <p className="samples-record__notes">{entry.observations}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );

  // Vista
  return (
    <div className="module-stack">
      <div className="metric-grid samples-metric-grid">
        <MetricCard
          label="Registro de descargas"
          value={formatInteger(filteredEntries.length)}
          tone="sand"
        />
        <MetricCard
          label="Stock en planta"
          value={formatKg(totalNetKg)}
          tone="olive"
        />
        <MetricCard
          label="Analisis realizados"
          value={formatInteger(analyzedEntries)}
          tone="forest"
        />
        <button
          type="button"
          className="metric-card metric-card-button tone-rust"
          onClick={openCreateModal}
        >
          <span>Nuevo ingreso</span>
          <strong>Agregar</strong>
          <div className="metric-card-button__icon">
            <Plus size={18} />
          </div>
        </button>
      </div>

      <SectionCard
        title="FILTROS"
        action={
          <div className="section-action-cluster">
            <button
              type="button"
              className="text-button"
              onClick={() => setAreFiltersVisible((current) => !current)}
              aria-expanded={areFiltersVisible}
            >
              {areFiltersVisible ? "Ocultar filtros" : "Mostrar filtros"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setFilters({
                  client: "",
                  supplier: "",
                  product: "",
                  processCode: "",
                  packagingId: "",
                  from: "",
                  to: "",
                  onlyWithAnalysis: false,
                })
              }
            >
              Limpiar
            </button>
          </div>
        }
        className="samples-filters-card"
      >
        {areFiltersVisible ? (
          <div className="samples-filters-bar natural-filters-bar">
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
              Envase
              <select
                value={filters.packagingId}
                onChange={(event) =>
                  handleFilterChange("packagingId", event.target.value)
                }
              >
                <option value="">Todos</option>
                {packagingOptions.map((packagingId) => (
                  <option key={packagingId} value={packagingId}>
                    {packagingId}
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
                onChange={(event) =>
                  handleFilterChange("to", event.target.value)
                }
              />
            </label>

            <label className="checkbox-row natural-filter-toggle">
              <input
                type="checkbox"
                checked={filters.onlyWithAnalysis}
                onChange={(event) =>
                  handleFilterChange("onlyWithAnalysis", event.target.checked)
                }
              />
              <span>Solo con analisis</span>
            </label>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Registro de descargas"
        action={
          <div className="section-action-cluster">
            <span className="samples-list-count">
              {formatInteger(sortedEntries.length)} registros
            </span>
            <button
              type="button"
              className="icon-button compact-icon-button"
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Exportar descargas en PDF"
              title="Exportar PDF"
            >
              <Download size={16} />
            </button>
          </div>
        }
      >
        <div className="samples-inventory-list">
          {paginatedEntries.length ? (
            paginatedEntries.map((entry) =>
              renderEntryRecord(entry, {
                expanded: expandedEntryId === entry.id,
              }),
            )
          ) : (
            <div className="samples-empty-state">
              <strong>Sin descargas para esta vista</strong>
              <p>
                Ajusta los filtros o registra un nuevo ingreso desde el modal.
              </p>
            </div>
          )}
        </div>

        <div className="samples-pagination">
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

      <div className="module-grid natural-analytics-grid">
        <SectionCard
          title={breakdownTitle}
          action={
            <div className="natural-chart-toolbar">
              <div
                className="natural-chart-segments"
                role="tablist"
                aria-label="Agrupar ingresos netos"
              >
                {naturalBreakdownOptions.map((option) => {
                  const isActive = breakdownGroup === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`natural-chart-segment${isActive ? " is-active" : ""}`}
                      onClick={() => setBreakdownGroup(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <label className="samples-filter-field natural-chart-year-field">
                Año
                <select
                  value={breakdownYear}
                  onChange={(event) => setBreakdownYear(event.target.value)}
                >
                  <option value="all">Historico</option>
                  {availableBreakdownYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        >
          <div className="chart-shell natural-chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={inboundBreakdownData}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke={chartGridColor}
                />
                <XAxis
                  type="number"
                  stroke={chartAxisColor}
                  tickFormatter={formatChartNetTons}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  stroke={chartAxisColor}
                />
                <Tooltip
                  formatter={(value: number) => [
                    `${formatChartNetTons(value)} tn`,
                    "TN",
                  ]}
                />
                <Bar dataKey="netKg" radius={[0, 6, 6, 0]} barSize={18}>
                  {inboundBreakdownData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Descargas por fecha"
          action={
            <div className="natural-month-nav">
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() =>
                  setActiveMonthKey((current) =>
                    getAdjacentMonthKey(availableMonthKeys, current, -1),
                  )
                }
                disabled={!hasPreviousMonth}
                aria-label="Mes anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span>{formatMonthLabel(activeMonthKey)}</span>
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() =>
                  setActiveMonthKey((current) =>
                    getAdjacentMonthKey(availableMonthKeys, current, 1),
                  )
                }
                disabled={!hasNextMonth}
                aria-label="Mes siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          }
        >
          <div className="chart-shell natural-chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis
                  type="number"
                  dataKey="day"
                  domain={[1, daysInActiveMonth]}
                  ticks={monthDayTicks}
                  allowDecimals={false}
                  stroke={chartAxisColor}
                  tickFormatter={(value) => String(value).padStart(2, "0")}
                />
                <YAxis
                  type="number"
                  dataKey="netKg"
                  width={72}
                  stroke={chartAxisColor}
                  tickFormatter={formatChartKg}
                />
                <Tooltip
                  cursor={{ stroke: chartGridColor }}
                  content={<NaturalScatterTooltip />}
                />
                <Scatter
                  data={monthlyScatterData}
                  fill="var(--chart-accent-2)"
                  shape="circle"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {isPreparingPdf ? (
        <PdfExportPortal>
          <PdfExportRoot ref={exportRef} className="pdf-export-root--natural">
            {pdfEntryPages.length ? (
              pdfEntryPages.map((entriesPage, pageIndex) => (
                <PdfExportPage
                  key={`natural-pdf-page-${pageIndex}`}
                  className={pageIndex === 0 ? "pdf-export-page--intro" : ""}
                >
                  {pageIndex === 0 ? (
                    <>
                      <div className="metric-grid samples-metric-grid">
                        <MetricCard
                          label="Registro de descargas"
                          value={formatInteger(filteredEntries.length)}
                          tone="sand"
                        />
                        <MetricCard
                          label="Stock en planta"
                          value={formatKg(totalNetKg)}
                          tone="olive"
                        />
                        <MetricCard
                          label="Analisis realizados"
                          value={formatInteger(analyzedEntries)}
                          tone="forest"
                        />
                      </div>

                      <PdfSelectedFiltersSection items={selectedFilterItems} />
                    </>
                  ) : null}

                  <PdfHistoryCardsSection
                    title="Registro de descargas"
                    listClassName="samples-inventory-list"
                  >
                    {entriesPage.map((entry) =>
                      renderEntryRecord(entry, {
                        expanded: true,
                        exportMode: true,
                      }),
                    )}
                  </PdfHistoryCardsSection>
                </PdfExportPage>
              ))
            ) : (
              <PdfExportPage className="pdf-export-page--intro">
                <div className="metric-grid samples-metric-grid">
                  <MetricCard
                    label="Registro de descargas"
                    value={formatInteger(filteredEntries.length)}
                    tone="sand"
                  />
                  <MetricCard
                    label="Stock en planta"
                    value={formatKg(totalNetKg)}
                    tone="olive"
                  />
                  <MetricCard
                    label="Analisis realizados"
                    value={formatInteger(analyzedEntries)}
                    tone="forest"
                  />
                </div>

                <PdfSelectedFiltersSection items={selectedFilterItems} />

                <PdfHistoryCardsSection
                  title="Registro de descargas"
                  listClassName="samples-inventory-list"
                >
                  <div className="samples-empty-state">
                    <strong>Sin descargas para esta vista</strong>
                    <p>
                      Ajusta los filtros o registra un nuevo ingreso desde el
                      modal.
                    </p>
                  </div>
                </PdfHistoryCardsSection>
              </PdfExportPage>
            )}
          </PdfExportRoot>
        </PdfExportPortal>
      ) : null}

      {isModalOpen && hasMounted
        ? createPortal(
            <div
              className="samples-modal-backdrop"
              role="presentation"
              onClick={closeCreateModal}
            >
              <div
                className="samples-modal card natural-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="natural-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="samples-modal__header">
                  <div>
                    <span className="eyebrow">
                      {editingEntryId ? "Editar ingreso" : "Nuevo ingreso"}
                    </span>
                    <h3 id="natural-modal-title">
                      {editingEntryId
                        ? "Editar descarga"
                        : "Registrar descarga"}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={closeCreateModal}
                    aria-label="Cerrar modal"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form className="stack-form" onSubmit={handleSubmit}>
                  <div className="form-grid two-columns">
                    <div className="stack-form">
                      <label>
                        Fecha *
                        <input
                          type="date"
                          required
                          value={form.entryDate}
                          onChange={(event) =>
                            handleFormChange("entryDate", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Cliente *
                        <input
                          type="text"
                          list="natural-client-options"
                          required
                          value={form.client}
                          onChange={(event) =>
                            handleFormChange("client", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Producto *
                        <input
                          type="text"
                          list="natural-product-options"
                          required
                          value={form.product}
                          onChange={(event) =>
                            handleFormChange("product", event.target.value)
                          }
                        />
                      </label>
                      <label className="checkbox-row natural-modal__toggle">
                        <input
                          type="checkbox"
                          checked={form.withAnalysis}
                          onChange={(event) =>
                            handleFormChange(
                              "withAnalysis",
                              event.target.checked,
                            )
                          }
                        />
                        <span>Analisis</span>
                      </label>
                      <label>
                        Codigo de analisis
                        <input
                          type="text"
                          list="natural-analysis-options"
                          disabled={!form.withAnalysis}
                          required={form.withAnalysis}
                          value={form.analysisCode}
                          onChange={(event) =>
                            handleFormChange("analysisCode", event.target.value)
                          }
                          placeholder="MUIN-232"
                        />
                      </label>
                    </div>

                    <div className="stack-form">
                      <label>
                        Proveedor / campo
                        <input
                          type="text"
                          list="natural-supplier-options"
                          value={form.supplier}
                          onChange={(event) =>
                            handleFormChange("supplier", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Cod. de proceso
                        <input
                          type="text"
                          list="natural-process-options"
                          value={form.processCode}
                          onChange={(event) =>
                            handleFormChange("processCode", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Kg neto *
                        <input
                          type="number"
                          min="0"
                          required
                          value={form.netKg}
                          onChange={(event) =>
                            handleFormChange(
                              "netKg",
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>

                      <label className="checkbox-row natural-modal__toggle">
                        <input
                          type="checkbox"
                          checked={form.hasCartaPorte}
                          onChange={(event) =>
                            handleFormChange(
                              "hasCartaPorte",
                              event.target.checked,
                            )
                          }
                        />
                        <span>Carta de porte</span>
                      </label>
                      <label>
                        Numero de carta de porte
                        <input
                          type="text"
                          disabled={!form.hasCartaPorte}
                          required={form.hasCartaPorte}
                          value={form.numeroCartaPorte}
                          onChange={(event) =>
                            handleFormChange(
                              "numeroCartaPorte",
                              event.target.value,
                            )
                          }
                          placeholder="CP-000000"
                        />
                      </label>
                    </div>
                  </div>

                  {syncError ? (
                    <p className="auth-message auth-message--error">
                      {syncError}
                    </p>
                  ) : null}

                  <label className="checkbox-row natural-modal__toggle">
                    <input
                      type="checkbox"
                      checked={form.hasPackagingDetails}
                      onChange={(event) =>
                        handleFormChange(
                          "hasPackagingDetails",
                          event.target.checked,
                        )
                      }
                    />
                    <span>Registrar envases</span>
                  </label>

                  {form.hasPackagingDetails ? (
                    <section className="subsection natural-packaging-section">
                      <div className="card-heading">
                        <div>
                          <h3>Envases</h3>
                          <p>Tipo | Estado | Kg | Cantidad</p>
                        </div>

                        <div className="natural-record__actions">
                          <button
                            type="button"
                            className="ghost-button compact-button"
                            onClick={handleAddPackagingMovement}
                          >
                            <Plus size={14} />
                            Agregar envase
                          </button>
                        </div>
                      </div>

                      <div className="natural-packaging-list">
                        {form.packagingMovements.map((movement) => (
                          <div
                            key={movement.id}
                            className="natural-packaging-row"
                          >
                            <label>
                              Tipo
                              <input
                                type="text"
                                list="natural-packaging-type-options"
                                value={movement.packagingType}
                                onChange={(event) =>
                                  handlePackagingMovementChange(
                                    movement.id,
                                    "packagingType",
                                    event.target.value,
                                  )
                                }
                                placeholder="BOLSON"
                              />
                            </label>

                            <label>
                              Estado
                              <input
                                type="text"
                                list="natural-packaging-condition-options"
                                value={movement.packagingCondition}
                                onChange={(event) =>
                                  handlePackagingMovementChange(
                                    movement.id,
                                    "packagingCondition",
                                    event.target.value,
                                  )
                                }
                                placeholder="USADO"
                              />
                            </label>

                            <label>
                              Kg
                              <input
                                type="number"
                                min="1"
                                list="natural-packaging-kg-options"
                                required={form.hasPackagingDetails}
                                value={movement.packagingKg}
                                onChange={(event) =>
                                  handlePackagingMovementChange(
                                    movement.id,
                                    "packagingKg",
                                    Number(event.target.value),
                                  )
                                }
                              />
                            </label>

                            <label>
                              Cantidad
                              <input
                                type="number"
                                min="1"
                                required={form.hasPackagingDetails}
                                value={movement.quantity}
                                onChange={(event) =>
                                  handlePackagingMovementChange(
                                    movement.id,
                                    "quantity",
                                    Number(event.target.value),
                                  )
                                }
                              />
                            </label>

                            <button
                              type="button"
                              className="ghost-button compact-button danger-button"
                              onClick={() =>
                                handleRemovePackagingMovement(movement.id)
                              }
                            >
                              <Trash2 size={14} />
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <p className="natural-packaging-hint">
                      Si no activas envases, el ingreso se guarda como GRANEL.
                    </p>
                  )}

                  <label>
                    Observaciones
                    <textarea
                      rows={3}
                      value={form.observations}
                      onChange={(event) =>
                        handleFormChange("observations", event.target.value)
                      }
                      placeholder="DETALLE OPERATIVO DEL INGRESO"
                    />
                  </label>

                  <div className="samples-modal__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={closeCreateModal}
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
                        : editingEntryId
                          ? "Guardar cambios"
                          : "Guardar ingreso"}
                    </button>
                  </div>
                </form>

                <datalist id="natural-client-options">
                  {formClientOptions.length
                    ? formClientOptions.map((client) => (
                        <option key={client} value={client} />
                      ))
                    : allClientOptions.map((client) => (
                        <option key={client} value={client} />
                      ))}
                </datalist>

                <datalist id="natural-product-options">
                  {formProductOptions.length
                    ? formProductOptions.map((product) => (
                        <option key={product} value={product} />
                      ))
                    : allProductOptions.map((product) => (
                        <option key={product} value={product} />
                      ))}
                </datalist>

                <datalist id="natural-supplier-options">
                  {formSupplierOptions.length
                    ? formSupplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier} />
                      ))
                    : allSupplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier} />
                      ))}
                </datalist>

                <datalist id="natural-process-options">
                  {formProcessOptions.length
                    ? formProcessOptions.map((processCode) => (
                        <option key={processCode} value={processCode} />
                      ))
                    : allProcessOptions.map((processCode) => (
                        <option key={processCode} value={processCode} />
                      ))}
                </datalist>

                <datalist id="natural-analysis-options">
                  {formAnalysisOptions.length
                    ? formAnalysisOptions.map((analysisCode) => (
                        <option key={analysisCode} value={analysisCode} />
                      ))
                    : allAnalysisCodes.map((analysisCode) => (
                        <option key={analysisCode} value={analysisCode} />
                      ))}
                </datalist>

                <datalist id="natural-packaging-type-options">
                  {packagingTypeSuggestions.map((packagingType) => (
                    <option key={packagingType} value={packagingType} />
                  ))}
                </datalist>

                <datalist id="natural-packaging-condition-options">
                  {packagingConditionSuggestions.map((condition) => (
                    <option key={condition} value={condition} />
                  ))}
                </datalist>

                <datalist id="natural-packaging-kg-options">
                  {packagingKgSuggestions.map((packagingKg) => (
                    <option key={packagingKg} value={String(packagingKg)} />
                  ))}
                </datalist>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};
