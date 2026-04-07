"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { exportElementToPdf } from "@/lib/pdf";
import {
  createPackagingMovement,
  formatPackagingSummary,
  normalizePackagingMovement,
  normalizePackagingText,
  packagingConditionOptions,
  packagingTypeOptions,
  type PackagingMovementRecord,
  type PackagingMovementType,
} from "@/lib/packaging";
import {
  autofillUniqueRelationalSelections,
  areStringFiltersEqual,
  clearInvalidRelationalSelections,
  getRelationalOptions,
  type RelationalFieldConfig,
} from "@/lib/relational-filters";
import type { NaturalEntry, PackagingMovement } from "@/types/domain";

const chartColors = [
  "var(--chart-accent-1)",
  "var(--chart-accent-2)",
  "var(--chart-accent-3)",
  "var(--chart-accent-4)",
];
const chartGridColor = "var(--chart-grid)";
const chartAxisColor = "var(--chart-axis)";
const PAGE_SIZE = 5;

type NaturalFormState = {
  entryDate: string;
  client: string;
  product: string;
  netKg: number;
  supplier: string;
  processCode: string;
  withAnalysis: boolean;
  analysisCode: string;
  observations: string;
  packagingMovements: PackagingMovementRecord[];
};

type NaturalRelationalFilters = {
  client: string;
  supplier: string;
  product: string;
  processCode: string;
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
  observations: "",
  packagingMovements: [createPackagingMovement("alta")],
});

const formFromEntry = (entry: NaturalEntry): NaturalFormState => ({
  entryDate: entry.entryDate,
  client: entry.client,
  product: entry.product,
  netKg: entry.netKg,
  supplier: entry.supplier,
  processCode: entry.processCode,
  withAnalysis: entry.withAnalysis,
  analysisCode: entry.analysisCode ?? "",
  observations: entry.observations ?? entry.analysisSummary?.notes ?? "",
  packagingMovements: entry.packagingMovements?.length
    ? entry.packagingMovements.map((movement, index) =>
        normalizePackagingMovement(
          movement,
          movement.id?.trim() || `PKG-${entry.id}-${index + 1}`,
        ),
      )
    : [createPackagingMovement("alta")],
});

const getMonthKey = (value: string) => value.slice(0, 7);

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
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Buenos_Aires",
  }).format(new Date(`${monthKey}-01T12:00:00`));

  return label.charAt(0).toUpperCase() + label.slice(1);
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
  observations: entry.observations ?? "",
  packagingMovements: Array.isArray(entry.packagingMovements)
    ? entry.packagingMovements.map((movement, index) =>
        normalizePackagingMovement(movement, `PKG-${recordId}-${index + 1}`),
      )
    : [],
  analysisSummary: entry.analysisSummary,
});

const getLatestMonthKey = (entries: NaturalEntry[]) =>
  getMonthKey(
    entries.reduce(
      (latest, entry) => (entry.entryDate > latest ? entry.entryDate : latest),
      entries[0]?.entryDate ?? getTodayInBuenosAires(),
    ),
  );

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

export const NaturalModule = () => {
  const [entries, setEntries] = useState<NaturalEntry[]>([]);
  const [filters, setFilters] = useState({
    client: "",
    supplier: "",
    product: "",
    processCode: "",
    onlyWithAnalysis: false,
  });
  const [form, setForm] = useState(createEmptyForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeMonthKey, setActiveMonthKey] = useState(() =>
    getMonthKey(getTodayInBuenosAires()),
  );
  const [isSyncing, setIsSyncing] = useState(true);
  const [isPersisting, setIsPersisting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
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
    filters.product,
    filters.processCode,
    filters.onlyWithAnalysis,
  ]);

  const relationalFilters: NaturalRelationalFilters = {
    client: filters.client,
    supplier: filters.supplier,
    product: filters.product,
    processCode: filters.processCode,
  };

  const matchesAnalysisFilter = (
    entry: NaturalEntry,
    onlyWithAnalysis: boolean,
  ) => !onlyWithAnalysis || entry.withAnalysis;

  const clientOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "client",
    naturalFilterConfig,
    (entry) => matchesAnalysisFilter(entry, filters.onlyWithAnalysis),
  );
  const productOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "product",
    naturalFilterConfig,
    (entry) => matchesAnalysisFilter(entry, filters.onlyWithAnalysis),
  );
  const supplierOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "supplier",
    naturalFilterConfig,
    (entry) => matchesAnalysisFilter(entry, filters.onlyWithAnalysis),
  );
  const processOptions = getRelationalOptions(
    entries,
    relationalFilters,
    "processCode",
    naturalFilterConfig,
    (entry) => matchesAnalysisFilter(entry, filters.onlyWithAnalysis),
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

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: NaturalRelationalFilters = {
        client: current.client,
        supplier: current.supplier,
        product: current.product,
        processCode: current.processCode,
      };
      const sanitizedRelational = clearInvalidRelationalSelections(
        entries,
        currentRelational,
        naturalFilterConfig,
        (entry) => matchesAnalysisFilter(entry, current.onlyWithAnalysis),
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
    filters.onlyWithAnalysis,
  ]);

  const filteredEntries = entries.filter((entry) => {
    const matchesClient = !filters.client || entry.client === filters.client;
    const matchesSupplier =
      !filters.supplier || entry.supplier === filters.supplier;
    const matchesProduct =
      !filters.product || entry.product === filters.product;
    const matchesProcess =
      !filters.processCode || entry.processCode === filters.processCode;

    return (
      matchesClient &&
      matchesSupplier &&
      matchesProduct &&
      matchesProcess &&
      matchesAnalysisFilter(entry, filters.onlyWithAnalysis)
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

  const totalNetKg = filteredEntries.reduce(
    (accumulator, entry) => accumulator + entry.netKg,
    0,
  );
  const analyzedEntries = filteredEntries.filter(
    (entry) => entry.withAnalysis,
  ).length;

  const inboundByProductMap = new Map<string, number>();
  filteredEntries.forEach((entry) => {
    inboundByProductMap.set(
      entry.product,
      (inboundByProductMap.get(entry.product) ?? 0) + entry.netKg,
    );
  });

  const inboundByProduct = Array.from(inboundByProductMap.entries())
    .map(([name, netKg]) => ({ name, netKg }))
    .sort((left, right) => right.netKg - left.netKg);

  const activeMonthDate = new Date(`${activeMonthKey}-01T12:00:00`);
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

  const openCreateModal = () => {
    setEditingEntryId(null);
    setForm(createEmptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (entry: NaturalEntry) => {
    setEditingEntryId(entry.id);
    setForm(formFromEntry(entry));
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
      if (field === "withAnalysis") {
        return {
          ...current,
          withAnalysis: Boolean(value),
          analysisCode: value ? current.analysisCode : "",
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
    field: keyof PackagingMovement,
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

        if (field === "movementType") {
          return {
            ...movement,
            movementType: value === "baja" ? "baja" : "alta",
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

  const handleAddPackagingMovement = (movementType: PackagingMovementType) => {
    setForm((current) => ({
      ...current,
      packagingMovements: [
        ...current.packagingMovements,
        createPackagingMovement(movementType),
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
      observations: form.observations.trim(),
      packagingMovements: form.packagingMovements
        .map((movement, index) =>
          normalizePackagingMovement(
            movement,
            movement.id || `PKG-${editingEntryId ?? Date.now()}-${index + 1}`,
          ),
        )
        .filter((movement) => movement.quantity > 0),
    };

    setIsPersisting(true);
    setSyncError(null);

    try {
      const currentUserId = getFirebaseAuth().currentUser?.uid;

      if (editingEntryId) {
        await saveRecord<NaturalEntry>(
          "downloads",
          editingEntryId,
          nextEntry,
          currentUserId,
        );
      } else {
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
      await deleteRecord("downloads", entryId);
    } catch {
      setSyncError("No se pudo eliminar la descarga en Firestore.");
    } finally {
      setIsPersisting(false);
    }
  };

  const handleExport = async () => {
    if (!panelRef.current) {
      return;
    }

    setIsExporting(true);

    try {
      await exportElementToPdf(panelRef.current, "mercaderia-natural.pdf");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={panelRef} className="module-stack">
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
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setFilters({
                client: "",
                supplier: "",
                product: "",
                processCode: "",
                onlyWithAnalysis: false,
              })
            }
          >
            Limpiar
          </button>
        }
        className="samples-filters-card"
      >
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
            paginatedEntries.map((entry) => (
              <article
                key={entry.id}
                className={`samples-record natural-record record-card--light${
                  expandedEntryId === entry.id ? " is-expanded" : ""
                }`}
                role="button"
                tabIndex={0}
                aria-expanded={expandedEntryId === entry.id}
                onClick={() => toggleExpandedEntry(entry.id)}
                onKeyDown={(event) =>
                  handleExpandableCardKeyDown(event, entry.id)
                }
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
                    <p className="record-card__summary">
                      {formatKg(entry.netKg)} / {formatDate(entry.entryDate)}
                    </p>
                  </div>

                  <div className="natural-record__actions">
                    <button
                      type="button"
                      className="icon-button compact-icon-button compact-icon-button--view"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpandedEntry(entry.id);
                      }}
                      aria-label={
                        expandedEntryId === entry.id
                          ? "Ocultar detalle de la descarga"
                          : "Ver detalle de la descarga"
                      }
                      title={
                        expandedEntryId === entry.id
                          ? "Ocultar detalle"
                          : "Vista extendida"
                      }
                    >
                      {expandedEntryId === entry.id ? (
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
                </div>

                {expandedEntryId === entry.id ? (
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
                    </div>

                    <div className="record-card__extended-grid">
                      {entry.packagingMovements?.length ? (
                        entry.packagingMovements.map((movement) => (
                          <div key={movement.id}>
                            <span>Envases</span>
                            <strong>
                              {movement.quantity}{" "}
                              {movement.packagingType.toLowerCase()}{" "}
                              {movement.packagingCondition.toLowerCase()}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <div>
                          <span>Envases</span>
                          <strong>Sin envases cargados</strong>
                        </div>
                      )}
                    </div>

                    {entry.observations ? (
                      <p className="samples-record__notes">
                        {entry.observations}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
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
        <SectionCard title="Ingreso kg netos por producto">
          <div className="chart-shell natural-chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={inboundByProduct}
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
                  tickFormatter={formatChartKg}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  stroke={chartAxisColor}
                />
                <Tooltip
                  formatter={(value: number) => [formatKg(value), "Kg netos"]}
                />
                <Bar dataKey="netKg" radius={[0, 6, 6, 0]} barSize={18}>
                  {inboundByProduct.map((entry, index) => (
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
                  setActiveMonthKey((current) => shiftMonthKey(current, -1))
                }
                aria-label="Mes anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span>{formatMonthLabel(activeMonthKey)}</span>
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() =>
                  setActiveMonthKey((current) => shiftMonthKey(current, 1))
                }
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
                        />
                      </label>
                    </div>
                  </div>

                  <section className="subsection natural-packaging-section">
                    <div className="card-heading">
                      <div>
                        <h3>Envases</h3>
                      </div>

                      <div className="natural-record__actions">
                        <button
                          type="button"
                          className="ghost-button compact-button"
                          onClick={() => handleAddPackagingMovement("alta")}
                        >
                          <Plus size={14} />
                          Agregar otro envase
                        </button>
                        <button
                          type="button"
                          className="ghost-button compact-button"
                          onClick={() => handleAddPackagingMovement("baja")}
                        >
                          <Plus size={14} />
                          Agregar una baja
                        </button>
                      </div>
                    </div>

                    <div className="natural-packaging-list">
                      {form.packagingMovements.map((movement) => (
                        <div
                          key={movement.id}
                          className={`natural-packaging-row${
                            movement.movementType === "baja"
                              ? " natural-packaging-row--out"
                              : ""
                          }`}
                        >
                          <label>
                            Movimiento
                            <select
                              value={movement.movementType}
                              onChange={(event) =>
                                handlePackagingMovementChange(
                                  movement.id,
                                  "movementType",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="alta">Ingreso</option>
                              <option value="baja">Baja</option>
                            </select>
                          </label>

                          <label>
                            Tipo de envase
                            <select
                              value={movement.packagingType}
                              onChange={(event) =>
                                handlePackagingMovementChange(
                                  movement.id,
                                  "packagingType",
                                  event.target.value,
                                )
                              }
                            >
                              {packagingTypeOptions.map((packagingType) => (
                                <option
                                  key={packagingType}
                                  value={packagingType}
                                >
                                  {packagingType}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Estado
                            <select
                              value={movement.packagingCondition}
                              onChange={(event) =>
                                handlePackagingMovementChange(
                                  movement.id,
                                  "packagingCondition",
                                  event.target.value,
                                )
                              }
                            >
                              {packagingConditionOptions.map((condition) => (
                                <option key={condition} value={condition}>
                                  {condition}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Cantidad
                            <input
                              type="number"
                              min="0"
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
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};
