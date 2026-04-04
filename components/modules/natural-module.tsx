"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  MetricCard,
  SectionCard,
  StatusPill,
} from "@/components/dashboard/primitives";
import {
  formatDate,
  formatInteger,
  formatKg,
  getTodayInBuenosAires,
} from "@/lib/format";
import { initialNaturalEntries } from "@/lib/mock-data";
import { exportElementToPdf } from "@/lib/pdf";
import {
  areStringFiltersEqual,
  clearInvalidRelationalSelections,
  getRelationalOptions,
  type RelationalFieldConfig,
} from "@/lib/relational-filters";
import type { NaturalEntry } from "@/types/domain";

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
};

type NaturalRelationalFilters = {
  client: string;
  product: string;
  processCode: string;
};

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
  product: {
    getValues: (entry) => [entry.product],
    matches: (entry, value) => entry.product === value,
  },
  processCode: {
    getValues: (entry) => [entry.processCode],
    matches: (entry, value) => entry.processCode === value,
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
  const ticks = Array.from({ length: daysInMonth }, (_, index) => index + 1).filter(
    (day) => day === 1 || day === daysInMonth || day % 5 === 0,
  );

  if (!ticks.includes(daysInMonth)) {
    ticks.push(daysInMonth);
  }

  return ticks;
};

const formatChartKg = (value: number) =>
  value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`;

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
          <p key={`${point.day}-${index}`}>{`Ingreso ${index + 1}: ${formatKg(load)}`}</p>
        ))}
      </div>
      {point.loads.length > 1 ? <p>{`Total: ${formatKg(point.netKg)}`}</p> : null}
    </div>
  );
};

export const NaturalModule = () => {
  const [entries, setEntries] = useState(initialNaturalEntries);
  const [filters, setFilters] = useState({
    client: "",
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
    getLatestMonthKey(initialNaturalEntries),
  );
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
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
    filters.product,
    filters.processCode,
    filters.onlyWithAnalysis,
  ]);

  const relationalFilters: NaturalRelationalFilters = {
    client: filters.client,
    product: filters.product,
    processCode: filters.processCode,
  };

  const matchesAnalysisFilter = (entry: NaturalEntry, onlyWithAnalysis: boolean) =>
    !onlyWithAnalysis || entry.withAnalysis;

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

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: NaturalRelationalFilters = {
        client: current.client,
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
    filters.product,
    filters.processCode,
    filters.onlyWithAnalysis,
  ]);

  const filteredEntries = entries.filter((entry) => {
    const matchesClient = !filters.client || entry.client === filters.client;
    const matchesProduct = !filters.product || entry.product === filters.product;
    const matchesProcess =
      !filters.processCode || entry.processCode === filters.processCode;

    return (
      matchesClient &&
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
  const analyzedEntries = filteredEntries.filter((entry) => entry.withAnalysis).length;

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

      const normalizedValue =
        typeof value === "string" ? normalizeUppercaseValue(value) : value;

      return {
        ...current,
        [field]: normalizedValue,
      };
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(() => {
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
      };

      setEntries((current) => {
        if (!editingEntryId) {
          return [nextEntry, ...current];
        }

        return current.map((entry) =>
          entry.id === editingEntryId ? nextEntry : entry,
        );
      });

      setCurrentPage(1);
      setActiveMonthKey(getMonthKey(form.entryDate));
      setForm(createEmptyForm());
      closeCreateModal();
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    const entry = entries.find((item) => item.id === entryId);
    const entryLabel = `${entry?.product ?? "REGISTRO"} / ${entry?.entryDate ?? entryId}`;

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Eliminar el ingreso ${entryLabel}?`)
    ) {
      return;
    }

    startTransition(() => {
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    });
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
      <div className="module-header">
        <div>
          <span className="eyebrow">Modulo 2</span>
          <h3>Recepcion de mercaderia al natural</h3>
          <p>
            Descargas recientes, stock en planta y seguimiento rapido del analisis
            asociado.
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download size={16} />
          {isExporting ? "Generando..." : "Exportar PDF"}
        </button>
      </div>

      <div className="metric-grid samples-metric-grid">
        <MetricCard
          label="Registro de descargas"
          value={formatInteger(filteredEntries.length)}
          caption="Ingresos visibles con la combinacion actual de filtros."
          tone="sand"
        />
        <MetricCard
          label="Stock en planta"
          value={formatKg(totalNetKg)}
          caption="Suma neta de mercaderia al natural actualmente visible."
          tone="olive"
        />
        <MetricCard
          label="Analisis realizados"
          value={formatInteger(analyzedEntries)}
          caption="Descargas que ya tienen analisis asociado."
          tone="forest"
        />
        <button
          type="button"
          className="metric-card metric-card-button tone-rust"
          onClick={openCreateModal}
        >
          <span>Nuevo ingreso</span>
          <strong>Abrir formulario</strong>
          <p>Carga una nueva descarga y registra el codigo de analisis si aplica.</p>
          <div className="metric-card-button__icon">
            <Plus size={18} />
          </div>
        </button>
      </div>

      <section className="card samples-filters-card">
        <div className="samples-filters-bar natural-filters-bar">
          <div className="samples-filters-bar__label">
            <span className="eyebrow">Filtros</span>
            <p>Cliente, proceso, producto y analisis.</p>
          </div>

          <label className="samples-filter-field">
            Cliente
            <select
              value={filters.client}
              onChange={(event) => handleFilterChange("client", event.target.value)}
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
              onChange={(event) => handleFilterChange("product", event.target.value)}
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

          <button
            type="button"
            className="text-button samples-filters-bar__reset"
            onClick={() =>
              setFilters({
                client: "",
                product: "",
                processCode: "",
                onlyWithAnalysis: false,
              })
            }
          >
            Limpiar
          </button>
        </div>
      </section>

      <SectionCard
        title="Registro de descargas"
        description="Ultimos 5 ingresos por pagina, ordenados desde la fecha mas reciente."
        action={
          <span className="samples-list-count">
            {formatInteger(sortedEntries.length)} registros
          </span>
        }
      >
        <div className="samples-inventory-list">
          {paginatedEntries.length ? (
            paginatedEntries.map((entry) => (
              <article key={entry.id} className="samples-record natural-record">
                <div className="natural-record__header">
                  <div>
                    <div className="natural-record__title-line">
                      <strong>{entry.product}</strong>
                      <span className="natural-record__amount-inline">
                        {formatKg(entry.netKg)}
                      </span>
                    </div>
                    <p>
                      {entry.client} / {entry.supplier || "Sin proveedor"}
                    </p>
                  </div>

                  <div className="natural-record__actions">
                    <StatusPill
                      value={entry.withAnalysis ? "Analisis si" : "Analisis no"}
                      tone={entry.withAnalysis ? "good" : "warn"}
                    />
                    <button
                      type="button"
                      className="ghost-button compact-button"
                      onClick={() => openEditModal(entry)}
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ghost-button compact-button danger-button"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="samples-record__meta natural-record__meta">
                  <div>
                    <span>Fecha</span>
                    <strong>{formatDate(entry.entryDate)}</strong>
                  </div>
                  <div>
                    <span>Proceso</span>
                    <strong>{entry.processCode || "Sin codigo"}</strong>
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
                    <span>Proveedor / campo</span>
                    <strong>{entry.supplier || "Sin dato"}</strong>
                  </div>
                </div>

                {entry.observations ? (
                  <p className="samples-record__notes">{entry.observations}</p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="samples-empty-state">
              <strong>Sin descargas para esta vista</strong>
              <p>Ajusta los filtros o registra un nuevo ingreso desde el modal.</p>
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
          title="Ingreso kg netos por producto"
          description="Comparacion horizontal de kilos netos por producto."
        >
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
                <Tooltip formatter={(value: number) => [formatKg(value), "Kg netos"]} />
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
          description="Puntos diarios del mes activo, sin lineas de conexion."
          action={
            <div className="natural-month-nav">
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => setActiveMonthKey((current) => shiftMonthKey(current, -1))}
                aria-label="Mes anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span>{formatMonthLabel(activeMonthKey)}</span>
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => setActiveMonthKey((current) => shiftMonthKey(current, 1))}
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
                      {editingEntryId ? "Editar descarga" : "Registrar descarga"}
                    </h3>
                    <p>Formulario corto para stock neto, proceso, analisis y observaciones.</p>
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
                            handleFormChange("netKg", Number(event.target.value))
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
                            handleFormChange("withAnalysis", event.target.checked)
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
                      disabled={isPending}
                    >
                      {isPending
                        ? "Guardando..."
                        : editingEntryId
                          ? "Guardar cambios"
                          : "Guardar ingreso"}
                    </button>
                  </div>
                </form>

                <datalist id="natural-client-options">
                  {allClientOptions.map((client) => (
                    <option key={client} value={client} />
                  ))}
                </datalist>

                <datalist id="natural-product-options">
                  {allProductOptions.map((product) => (
                    <option key={product} value={product} />
                  ))}
                </datalist>

                <datalist id="natural-supplier-options">
                  {allSupplierOptions.map((supplier) => (
                    <option key={supplier} value={supplier} />
                  ))}
                </datalist>

                <datalist id="natural-process-options">
                  {allProcessOptions.map((processCode) => (
                    <option key={processCode} value={processCode} />
                  ))}
                </datalist>

                <datalist id="natural-analysis-options">
                  {allAnalysisCodes.map((analysisCode) => (
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
