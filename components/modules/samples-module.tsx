"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Download,
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
import { initialStoredSamples } from "@/lib/mock-data";
import { exportElementToPdf } from "@/lib/pdf";
import {
  areStringFiltersEqual,
  clearInvalidRelationalSelections,
  getRelationalOptions,
  type RelationalFieldConfig,
} from "@/lib/relational-filters";
import type { StoredSample } from "@/types/domain";

const chartColors = ["#355c4b", "#c2703d", "#8f9b62"];
const PAGE_SIZE = 10;

const addDaysToDateString = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
  }).format(date);
};

const createEmptyForm = (): Omit<StoredSample, "id"> => {
  const today = getTodayInBuenosAires();

  return {
    storedAt: today,
    sampleCode: "",
    client: "",
    product: "",
    processCode: "",
    relatedAnalysisId: "",
    warehouseZone: "Pendiente",
    shelf: "Sin asignar",
    quantityKg: 0,
    retentionUntil: addDaysToDateString(today, 90),
    status: "Activa",
    notes: "",
  };
};

const normalizeUppercaseValue = (value: string) =>
  value.replace(/\s+/g, " ").replace(/^\s+/, "").toUpperCase();

type SampleRelationalFilters = {
  client: string;
  product: string;
  processCode: string;
  status: string;
};

const sampleFilterConfig: Record<
  keyof SampleRelationalFilters,
  RelationalFieldConfig<StoredSample>
> = {
  client: {
    getValues: (sample) => [sample.client],
    matches: (sample, value) => sample.client === value,
  },
  product: {
    getValues: (sample) => [sample.product],
    matches: (sample, value) => sample.product === value,
  },
  processCode: {
    getValues: (sample) => [sample.processCode],
    matches: (sample, value) => sample.processCode === value,
  },
  status: {
    getValues: (sample) => [sample.status],
    matches: (sample, value) => sample.status === value,
  },
};

export const SamplesModule = () => {
  const [samples, setSamples] = useState(initialStoredSamples);
  const [filters, setFilters] = useState({
    client: "",
    product: "",
    processCode: "",
    status: "",
  });
  const [form, setForm] = useState(createEmptyForm);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRetentionPreset, setIsRetentionPreset] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
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
  }, [filters.client, filters.product, filters.processCode, filters.status]);

  const relationalFilters: SampleRelationalFilters = {
    client: filters.client,
    product: filters.product,
    processCode: filters.processCode,
    status: filters.status,
  };

  const allClientOptions = Array.from(
    new Set(samples.map((sample) => sample.client)),
  ).sort();
  const allProductOptions = Array.from(
    new Set(samples.map((sample) => sample.product)),
  ).sort();
  const allProcessOptions = Array.from(
    new Set(samples.map((sample) => sample.processCode)),
  ).sort();

  const clientOptions = getRelationalOptions(
    samples,
    relationalFilters,
    "client",
    sampleFilterConfig,
  );
  const productOptions = getRelationalOptions(
    samples,
    relationalFilters,
    "product",
    sampleFilterConfig,
  );
  const processOptions = getRelationalOptions(
    samples,
    relationalFilters,
    "processCode",
    sampleFilterConfig,
  );
  const statusOptions = getRelationalOptions(
    samples,
    relationalFilters,
    "status",
    sampleFilterConfig,
  );

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: SampleRelationalFilters = {
        client: current.client,
        product: current.product,
        processCode: current.processCode,
        status: current.status,
      };
      const sanitizedRelational = clearInvalidRelationalSelections(
        samples,
        currentRelational,
        sampleFilterConfig,
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
    samples,
    filters.client,
    filters.product,
    filters.processCode,
    filters.status,
  ]);

  const filteredSamples = samples.filter((sample) => {
    const matchesClient = !filters.client || sample.client === filters.client;
    const matchesProduct = !filters.product || sample.product === filters.product;
    const matchesProcess =
      !filters.processCode || sample.processCode === filters.processCode;
    const matchesStatus = !filters.status || sample.status === filters.status;

    return matchesClient && matchesProduct && matchesProcess && matchesStatus;
  });

  const sortedFilteredSamples = [...filteredSamples].sort((left, right) => {
    const byDate = right.storedAt.localeCompare(left.storedAt);

    return byDate || right.id.localeCompare(left.id);
  });

  const totalActiveSamples = filteredSamples.filter(
    (sample) => sample.status === "Activa",
  ).length;
  const totalExpiredSamples = filteredSamples.filter(
    (sample) => sample.status === "Vencida",
  ).length;
  const expiringSoon = filteredSamples.filter((sample) => {
    if (sample.status !== "Activa") {
      return false;
    }

    const now = new Date(`${getTodayInBuenosAires()}T00:00:00`);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 30);

    const retention = new Date(`${sample.retentionUntil}T00:00:00`);
    return retention <= limit;
  }).length;

  const productMap = new Map<string, { count: number; totalKg: number }>();
  const statusMap = new Map<StoredSample["status"], number>([
    ["Activa", 0],
    ["Liberada", 0],
    ["Vencida", 0],
  ]);

  filteredSamples.forEach((sample) => {
    const productEntry = productMap.get(sample.product) ?? {
      count: 0,
      totalKg: 0,
    };

    productEntry.count += 1;
    productEntry.totalKg += sample.quantityKg;
    productMap.set(sample.product, productEntry);

    statusMap.set(sample.status, (statusMap.get(sample.status) ?? 0) + 1);
  });

  const productData = Array.from(productMap.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
      totalKg: value.totalKg,
    }))
    .sort((left, right) => right.count - left.count);

  const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const totalPages = Math.max(1, Math.ceil(sortedFilteredSamples.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSamples = sortedFilteredSamples.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreateModal = () => {
    setForm(createEmptyForm());
    setIsRetentionPreset(true);
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
  };

  const handleFilterChange = (
    field: keyof typeof filters,
    value: string,
  ) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleFormChange = (
    field: keyof Omit<StoredSample, "id">,
    value: string | number,
  ) => {
    setForm((current) => {
      const nextValue =
        field === "quantityKg" && typeof value === "number" ? Math.max(value, 0) : value;

      const nextForm = {
        ...current,
        [field]: nextValue,
      };

      if (field === "storedAt" && isRetentionPreset && typeof nextValue === "string") {
        nextForm.retentionUntil = addDaysToDateString(nextValue, 90);
      }

      return nextForm;
    });
  };

  const handleRetentionUntilChange = (value: string) => {
    setIsRetentionPreset(false);
    setForm((current) => ({ ...current, retentionUntil: value }));
  };

  const handleUppercaseInputChange = (
    field:
      | "client"
      | "product"
      | "processCode"
      | "sampleCode"
      | "relatedAnalysisId",
    value: string,
  ) => {
    handleFormChange(field, normalizeUppercaseValue(value));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(() => {
      setSamples((current) => [
        {
          ...form,
          id: `SMP-${Date.now()}`,
          client: form.client.trim(),
          product: form.product.trim(),
          processCode: form.processCode.trim(),
          sampleCode: form.sampleCode.trim(),
          relatedAnalysisId: form.relatedAnalysisId.trim(),
          notes: form.notes.trim(),
          warehouseZone: "Pendiente",
          shelf: "Sin asignar",
          status: "Activa",
        },
        ...current,
      ]);
      setCurrentPage(1);
      setForm(createEmptyForm());
      setIsRetentionPreset(true);
      closeCreateModal();
    });
  };

  const handleExport = async () => {
    if (!panelRef.current) {
      return;
    }

    setIsExporting(true);

    try {
      await exportElementToPdf(panelRef.current, "muestras-deposito.pdf");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteSample = (sampleId: string) => {
    const sample = samples.find((item) => item.id === sampleId);
    const sampleLabel = sample?.sampleCode ?? sampleId;

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Eliminar la muestra ${sampleLabel} del inventario?`)
    ) {
      return;
    }

    startTransition(() => {
      setSamples((current) => current.filter((sampleItem) => sampleItem.id !== sampleId));
    });
  };

  return (
    <div ref={panelRef} className="module-stack">
      <div className="module-header">
        <div>
          <span className="eyebrow">Modulo 3</span>
          <h3>Control de muestras almacenadas</h3>
          <p>
            Una vista mas compacta para filtrar, revisar el inventario reciente y
            cargar nuevas muestras sin interrumpir la lectura del tablero.
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
          label="Total muestras activas"
          value={formatInteger(totalActiveSamples)}
          caption="Registros activos dentro de la vista filtrada."
          tone="forest"
        />
        <MetricCard
          label="Total muestras vencidas"
          value={formatInteger(totalExpiredSamples)}
          caption="Muestras cuyo periodo de retencion ya finalizo."
          tone="rust"
        />
        <MetricCard
          label="Proximas a vencer"
          value={formatInteger(expiringSoon)}
          caption="Muestras activas con vencimiento dentro de 30 dias."
          tone="sand"
        />
        <button
          type="button"
          className="metric-card metric-card-button tone-olive"
          onClick={openCreateModal}
        >
          <span>Agregar nueva muestra</span>
          <strong>Nuevo registro</strong>
          <p>Abre un modal compacto para cargar la muestra y retencion.</p>
          <div className="metric-card-button__icon">
            <Plus size={18} />
          </div>
        </button>
      </div>

      <section className="card samples-filters-card">
        <div className="samples-filters-bar">
          <div className="samples-filters-bar__label">
            <span className="eyebrow">Filtros</span>
            <p>Vista rapida del inventario.</p>
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
            Estado
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="text-button samples-filters-bar__reset"
            onClick={() =>
              setFilters({
                client: "",
                product: "",
                processCode: "",
                status: "",
              })
            }
          >
            Limpiar
          </button>
        </div>
      </section>

      <SectionCard
        title="Inventario reciente"
        description="Registros ordenados del mas nuevo al mas antiguo. Cada pagina muestra hasta 10 muestras."
        action={
          <span className="samples-list-count">
            {formatInteger(sortedFilteredSamples.length)} registros
          </span>
        }
        className="samples-inventory-card"
      >
        <div className="samples-inventory-list">
          {paginatedSamples.length ? (
            paginatedSamples.map((sample) => (
              <article key={sample.id} className="samples-record">
                <div className="samples-record__primary">
                  <div>
                    <div className="samples-record__title">
                      <strong>{sample.sampleCode || "Sin codigo"}</strong>
                      <StatusPill
                        value={sample.status}
                        tone={
                          sample.status === "Activa"
                            ? "good"
                            : sample.status === "Vencida"
                              ? "alert"
                              : "neutral"
                        }
                      />
                    </div>
                    <p>
                      {sample.client} · {sample.product} · {sample.processCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="ghost-button compact-button danger-button"
                    onClick={() => handleDeleteSample(sample.id)}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>

                <div className="samples-record__meta">
                  <div>
                    <span>Fecha</span>
                    <strong>{formatDate(sample.storedAt)}</strong>
                  </div>
                  <div>
                    <span>Retener hasta</span>
                    <strong>{formatDate(sample.retentionUntil)}</strong>
                  </div>
                  <div>
                    <span>Analisis relacionado</span>
                    <strong>{sample.relatedAnalysisId || "Sin vinculo"}</strong>
                  </div>
                  <div>
                    <span>Cantidad lote</span>
                    <strong>{formatKg(sample.quantityKg)}</strong>
                  </div>
                </div>

                {sample.notes ? (
                  <p className="samples-record__notes">{sample.notes}</p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="samples-empty-state">
              <strong>Sin resultados para esta vista</strong>
              <p>
                Ajusta los filtros o agrega una nueva muestra para poblar el
                inventario.
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

      <div className="module-grid samples-analytics-grid">
        <SectionCard
          title="Muestras por producto"
          description="Conteo de muestras dentro del filtro actual."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8d0c2" />
                <XAxis dataKey="name" stroke="#50614d" />
                <YAxis allowDecimals={false} stroke="#50614d" />
                <Tooltip
                  formatter={(value: number) => [
                    `${formatInteger(value)} muestras`,
                    "Muestras",
                  ]}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {productData.map((entry, index) => (
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
          title="Estado de resguardo"
          description="Distribucion de activas, liberadas y vencidas."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
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
                className="samples-modal card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="samples-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
            <div className="samples-modal__header">
              <div>
                <span className="eyebrow">Nueva muestra</span>
                <h3 id="samples-modal-title">Agregar nueva muestra</h3>
                <p>Registro rapido en dos columnas, con retencion predefinida a 90 dias.</p>
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
                    * Fecha hoy
                    <input
                      type="date"
                      required
                      value={form.storedAt}
                      onChange={(event) =>
                        handleFormChange("storedAt", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    * Cliente
                    <input
                      type="text"
                      list="samples-client-options"
                      required
                      className="samples-uppercase-input"
                      value={form.client}
                      onChange={(event) =>
                        handleUppercaseInputChange("client", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    * Producto
                    <input
                      type="text"
                      list="samples-product-options"
                      required
                      className="samples-uppercase-input"
                      value={form.product}
                      onChange={(event) =>
                        handleUppercaseInputChange("product", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    * Proceso
                    <input
                      type="text"
                      list="samples-process-options"
                      required
                      className="samples-uppercase-input"
                      value={form.processCode}
                      onChange={(event) =>
                        handleUppercaseInputChange("processCode", event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="stack-form">
                  <label>
                    Codigo de muestra
                    <input
                      type="text"
                      className="samples-uppercase-input"
                      value={form.sampleCode}
                      onChange={(event) =>
                        handleUppercaseInputChange("sampleCode", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Analisis relacionado
                    <input
                      type="text"
                      className="samples-uppercase-input"
                      value={form.relatedAnalysisId}
                      onChange={(event) =>
                        handleUppercaseInputChange(
                          "relatedAnalysisId",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    Retener hasta
                    <input
                      type="date"
                      value={form.retentionUntil}
                      onChange={(event) =>
                        handleRetentionUntilChange(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Cantidad kg de lote
                    <input
                      type="number"
                      min="0"
                      value={form.quantityKg}
                      onChange={(event) =>
                        handleFormChange("quantityKg", Number(event.target.value))
                      }
                    />
                  </label>
                </div>
              </div>

              <label>
                Observaciones o notas
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => handleFormChange("notes", event.target.value)}
                  placeholder="Detalle operativo, contexto del lote o aclaraciones de retencion."
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
                  {isPending ? "Guardando..." : "Guardar muestra"}
                </button>
              </div>
            </form>

            <datalist id="samples-client-options">
              {allClientOptions.map((client) => (
                <option key={client} value={client} />
              ))}
            </datalist>

            <datalist id="samples-product-options">
              {allProductOptions.map((product) => (
                <option key={product} value={product} />
              ))}
            </datalist>

            <datalist id="samples-process-options">
              {allProcessOptions.map((processCode) => (
                <option key={processCode} value={processCode} />
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
