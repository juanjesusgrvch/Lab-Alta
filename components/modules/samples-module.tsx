"use client";

import { useEffect, useRef, useState } from "react";
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
  autofillUniqueRelationalSelections,
  areStringFiltersEqual,
  clearInvalidRelationalSelections,
  getRelationalOptions,
  type RelationalFieldConfig,
} from "@/lib/relational-filters";
import type { StoredSample } from "@/types/domain";

const chartColors = [
  "var(--chart-accent-5)",
  "var(--chart-accent-4)",
  "var(--chart-accent-3)",
];
const chartGridColor = "var(--chart-grid)";
const chartAxisColor = "var(--chart-axis)";
const PAGE_SIZE = 10;

const isCompleteDateInput = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));

const addDaysToDateString = (value: string, days: number) => {
  if (!isCompleteDateInput(value)) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
  }).format(date);
};

const getSampleStatus = (
  sample: Pick<StoredSample, "status" | "retentionUntil">,
  today = getTodayInBuenosAires(),
): StoredSample["status"] => {
  if (sample.status === "Liberada") {
    return "Liberada";
  }

  if (isCompleteDateInput(sample.retentionUntil) && sample.retentionUntil < today) {
    return "Vencida";
  }

  return "Activa";
};

const createEmptyForm = (): Omit<StoredSample, "id"> => {
  const today = getTodayInBuenosAires();

  return {
    storedAt: today,
    sampleCode: "",
    client: "",
    supplier: "",
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

const formFromSample = (sample: StoredSample): Omit<StoredSample, "id"> => ({
  storedAt: sample.storedAt,
  sampleCode: sample.sampleCode,
  client: sample.client,
  supplier: sample.supplier,
  product: sample.product,
  processCode: sample.processCode,
  relatedAnalysisId: sample.relatedAnalysisId,
  warehouseZone: sample.warehouseZone,
  shelf: sample.shelf,
  quantityKg: sample.quantityKg,
  retentionUntil: sample.retentionUntil,
  status: sample.status,
  notes: sample.notes,
});

const normalizeUppercaseValue = (value: string) =>
  value.replace(/\s+/g, " ").replace(/^\s+/, "").toUpperCase();

const normalizeStoredSample = (
  recordId: string,
  sample: Partial<StoredSample>,
): StoredSample => ({
  id: sample.id?.trim() || recordId,
  storedAt: sample.storedAt ?? getTodayInBuenosAires(),
  sampleCode: sample.sampleCode ?? "",
  client: sample.client ?? "",
  supplier: sample.supplier ?? "",
  product: sample.product ?? "",
  processCode: sample.processCode ?? "",
  relatedAnalysisId: sample.relatedAnalysisId ?? "",
  warehouseZone: sample.warehouseZone ?? "Pendiente",
  shelf: sample.shelf ?? "Sin asignar",
  quantityKg: Number(sample.quantityKg ?? 0),
  retentionUntil:
    sample.retentionUntil ?? addDaysToDateString(getTodayInBuenosAires(), 90),
  status: sample.status ?? "Activa",
  notes: sample.notes ?? "",
});

type SampleRelationalFilters = {
  client: string;
  supplier: string;
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
  supplier: {
    getValues: (sample) => [sample.supplier],
    matches: (sample, value) => sample.supplier === value,
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
    getValues: (sample) => [getSampleStatus(sample)],
    matches: (sample, value) => getSampleStatus(sample) === value,
  },
};

type SampleFormRelations = Pick<
  StoredSample,
  "client" | "supplier" | "product" | "processCode" | "relatedAnalysisId"
>;

const sampleFormRelationConfig: Record<
  keyof SampleFormRelations,
  RelationalFieldConfig<StoredSample>
> = {
  client: {
    getValues: (sample) => [sample.client],
    matches: (sample, value) => sample.client === value,
  },
  supplier: {
    getValues: (sample) => [sample.supplier],
    matches: (sample, value) => sample.supplier === value,
  },
  product: {
    getValues: (sample) => [sample.product],
    matches: (sample, value) => sample.product === value,
  },
  processCode: {
    getValues: (sample) => [sample.processCode],
    matches: (sample, value) => sample.processCode === value,
  },
  relatedAnalysisId: {
    getValues: (sample) => [sample.relatedAnalysisId],
    matches: (sample, value) => sample.relatedAnalysisId === value,
  },
};

export const SamplesModule = () => {
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [filters, setFilters] = useState({
    client: "",
    supplier: "",
    product: "",
    processCode: "",
    status: "",
  });
  const [form, setForm] = useState(createEmptyForm);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRetentionPreset, setIsRetentionPreset] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isPersisting, setIsPersisting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToRecords<StoredSample>(
      "samples",
      (records) => {
        setSamples(
          records.map((record) =>
            normalizeStoredSample(record.id, record.data),
          ),
        );
        setIsSyncing(false);
        setSyncError(null);
      },
      () => {
        setSamples([]);
        setIsSyncing(false);
        setSyncError(
          "No se pudo sincronizar la coleccion de muestras con Firestore.",
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
    filters.status,
  ]);

  const relationalFilters: SampleRelationalFilters = {
    client: filters.client,
    supplier: filters.supplier,
    product: filters.product,
    processCode: filters.processCode,
    status: filters.status,
  };

  const allClientOptions = Array.from(
    new Set(samples.map((sample) => sample.client)),
  ).sort();
  const allSupplierOptions = Array.from(
    new Set(samples.map((sample) => sample.supplier)),
  ).sort();
  const allProductOptions = Array.from(
    new Set(samples.map((sample) => sample.product)),
  ).sort();
  const allProcessOptions = Array.from(
    new Set(samples.map((sample) => sample.processCode)),
  ).sort();
  const allRelatedAnalysisOptions = Array.from(
    new Set(samples.map((sample) => sample.relatedAnalysisId).filter(Boolean)),
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
  const supplierOptions = getRelationalOptions(
    samples,
    relationalFilters,
    "supplier",
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

  const formRelations: SampleFormRelations = {
    client: form.client,
    supplier: form.supplier,
    product: form.product,
    processCode: form.processCode,
    relatedAnalysisId: form.relatedAnalysisId,
  };
  const formClientOptions = getRelationalOptions(
    samples,
    formRelations,
    "client",
    sampleFormRelationConfig,
  );
  const formSupplierOptions = getRelationalOptions(
    samples,
    formRelations,
    "supplier",
    sampleFormRelationConfig,
  );
  const formProductOptions = getRelationalOptions(
    samples,
    formRelations,
    "product",
    sampleFormRelationConfig,
  );
  const formProcessOptions = getRelationalOptions(
    samples,
    formRelations,
    "processCode",
    sampleFormRelationConfig,
  );
  const formRelatedAnalysisOptions = getRelationalOptions(
    samples,
    formRelations,
    "relatedAnalysisId",
    sampleFormRelationConfig,
  );

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: SampleRelationalFilters = {
        client: current.client,
        supplier: current.supplier,
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
    filters.supplier,
    filters.product,
    filters.processCode,
    filters.status,
  ]);

  const filteredSamples = samples.filter((sample) => {
    const matchesClient = !filters.client || sample.client === filters.client;
    const matchesSupplier =
      !filters.supplier || sample.supplier === filters.supplier;
    const matchesProduct =
      !filters.product || sample.product === filters.product;
    const matchesProcess =
      !filters.processCode || sample.processCode === filters.processCode;
    const matchesStatus =
      !filters.status || getSampleStatus(sample) === filters.status;

    return (
      matchesClient &&
      matchesSupplier &&
      matchesProduct &&
      matchesProcess &&
      matchesStatus
    );
  });

  const sortedFilteredSamples = [...filteredSamples].sort((left, right) => {
    const byDate = right.storedAt.localeCompare(left.storedAt);

    return byDate || right.id.localeCompare(left.id);
  });

  const today = getTodayInBuenosAires();
  const expiringSoonLimit = addDaysToDateString(today, 15);

  const totalActiveSamples = filteredSamples.filter(
    (sample) => getSampleStatus(sample, today) === "Activa",
  ).length;
  const totalExpiredSamples = filteredSamples.filter(
    (sample) => getSampleStatus(sample, today) === "Vencida",
  ).length;
  const expiringSoon = filteredSamples.filter((sample) => {
    if (getSampleStatus(sample, today) !== "Activa") {
      return false;
    }

    if (!isCompleteDateInput(sample.retentionUntil) || !expiringSoonLimit) {
      return false;
    }

    return sample.retentionUntil >= today && sample.retentionUntil <= expiringSoonLimit;
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

    const computedStatus = getSampleStatus(sample, today);
    statusMap.set(computedStatus, (statusMap.get(computedStatus) ?? 0) + 1);
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

  const totalPages = Math.max(
    1,
    Math.ceil(sortedFilteredSamples.length / PAGE_SIZE),
  );
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
    setEditingSampleId(null);
    setForm(createEmptyForm());
    setIsRetentionPreset(true);
    setIsModalOpen(true);
  };

  const openEditModal = (sample: StoredSample) => {
    setEditingSampleId(sample.id);
    setForm(formFromSample(sample));
    setIsRetentionPreset(false);
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setEditingSampleId(null);
  };

  const toggleExpandedSample = (sampleId: string) => {
    setExpandedSampleId((current) => (current === sampleId ? null : sampleId));
  };

  const handleExpandableCardKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    sampleId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpandedSample(sampleId);
    }
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleFormChange = (
    field: keyof Omit<StoredSample, "id">,
    value: string | number,
  ) => {
    setForm((current) => {
      const nextValue =
        field === "quantityKg" && typeof value === "number"
          ? Math.max(value, 0)
          : value;

      const nextForm = {
        ...current,
      };
      const mutableForm = nextForm as Record<string, any>;

      mutableForm[field as string] = nextValue as any;

      if (
        field === "storedAt" &&
        isRetentionPreset &&
        typeof nextValue === "string"
      ) {
        const nextRetentionUntil = addDaysToDateString(nextValue, 90);

        if (nextRetentionUntil) {
          nextForm.retentionUntil = nextRetentionUntil;
        }
      }

      return nextForm as Omit<StoredSample, "id">;
    });
  };

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    setForm((current) => {
      const currentRelations: SampleFormRelations = {
        client: current.client,
        supplier: current.supplier,
        product: current.product,
        processCode: current.processCode,
        relatedAnalysisId: current.relatedAnalysisId,
      };
      const autofilledRelations = autofillUniqueRelationalSelections(
        samples,
        currentRelations,
        sampleFormRelationConfig,
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
    samples,
    form.client,
    form.supplier,
    form.product,
    form.processCode,
    form.relatedAnalysisId,
  ]);

  const handleRetentionUntilChange = (value: string) => {
    setIsRetentionPreset(false);
    setForm((current) => ({ ...current, retentionUntil: value }));
  };

  const handleUppercaseInputChange = (
    field:
      | "client"
      | "supplier"
      | "product"
      | "processCode"
      | "sampleCode"
      | "relatedAnalysisId",
    value: string,
  ) => {
    handleFormChange(field, normalizeUppercaseValue(value));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSample: StoredSample = {
      ...form,
      id: editingSampleId ?? `SMP-${Date.now()}`,
      client: form.client.trim(),
      supplier: form.supplier.trim(),
      product: form.product.trim(),
      processCode: form.processCode.trim(),
      sampleCode: form.sampleCode.trim(),
      relatedAnalysisId: form.relatedAnalysisId.trim(),
      notes: form.notes.trim(),
      warehouseZone: "Pendiente",
      shelf: "Sin asignar",
      status: "Activa",
    };

    setIsPersisting(true);
    setSyncError(null);

    try {
      if (editingSampleId) {
        await saveRecord<StoredSample>(
          "samples",
          editingSampleId,
          nextSample,
          getFirebaseAuth().currentUser?.uid,
        );
      } else {
        await createRecord<StoredSample>(
          "samples",
          nextSample.id,
          nextSample,
          getFirebaseAuth().currentUser?.uid,
        );
      }

      setCurrentPage(1);
      setForm(createEmptyForm());
      setIsRetentionPreset(true);
      closeCreateModal();
    } catch {
      setSyncError("No se pudo guardar la muestra en Firestore.");
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

    setIsPersisting(true);
    setSyncError(null);

    void deleteRecord("samples", sampleId)
      .catch(() => {
        setSyncError("No se pudo eliminar la muestra en Firestore.");
      })
      .finally(() => {
        setIsPersisting(false);
      });
  };

  return (
    <div ref={panelRef} className="module-stack">
      <div className="metric-grid samples-metric-grid">
        <MetricCard
          label="Total muestras activas"
          value={formatInteger(totalActiveSamples)}
          tone="forest"
        />
        <MetricCard
          label="Total muestras vencidas"
          value={formatInteger(totalExpiredSamples)}
          tone="rust"
        />
        <MetricCard
          label="Proximas a vencer"
          value={formatInteger(expiringSoon)}
          tone="sand"
        />
        <button
          type="button"
          className="metric-card metric-card-button tone-rust"
          onClick={openCreateModal}
        >
          <span>Nueva muestra</span>
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
                status: "",
              })
            }
          >
            Limpiar
          </button>
        }
        className="samples-filters-card"
      >
        <div className="samples-filters-bar">
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
              onChange={(event) =>
                handleFilterChange("status", event.target.value)
              }
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Inventario reciente"
        action={
          <div className="section-action-cluster">
            <span className="samples-list-count">
              {formatInteger(sortedFilteredSamples.length)} registros
            </span>
            <button
              type="button"
              className="icon-button compact-icon-button"
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Exportar muestras en PDF"
              title="Exportar PDF"
            >
              <Download size={16} />
            </button>
          </div>
        }
        className="samples-inventory-card"
      >
        <div className="samples-inventory-list">
          {paginatedSamples.length ? (
            paginatedSamples.map((sample) => {
              const sampleStatus = getSampleStatus(sample, today);

              return (
                <article
                  key={sample.id}
                  className={`samples-record record-card--light${
                    expandedSampleId === sample.id ? " is-expanded" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedSampleId === sample.id}
                  onClick={() => toggleExpandedSample(sample.id)}
                  onKeyDown={(event) =>
                    handleExpandableCardKeyDown(event, sample.id)
                  }
                >
                <div className="samples-record__primary">
                  <div>
                    <div className="samples-record__title">
                      <strong>{sample.sampleCode || "Sin codigo"}</strong>
                    </div>
                    <p>{sample.product || "Sin producto"}</p>
                    <p className="record-card__summary">{sampleStatus}</p>
                  </div>

                  <div className="natural-record__actions">
                    <button
                      type="button"
                      className="icon-button compact-icon-button compact-icon-button--view"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpandedSample(sample.id);
                      }}
                      aria-label={
                        expandedSampleId === sample.id
                          ? "Ocultar detalle de la muestra"
                          : "Ver detalle de la muestra"
                      }
                      title={
                        expandedSampleId === sample.id
                          ? "Ocultar detalle"
                          : "Vista extendida"
                      }
                    >
                      {expandedSampleId === sample.id ? (
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
                        openEditModal(sample);
                      }}
                      aria-label="Editar muestra"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button compact-icon-button compact-icon-button--delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteSample(sample.id);
                      }}
                      aria-label="Eliminar muestra"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {expandedSampleId === sample.id ? (
                  <div className="record-card__extended">
                    <div className="record-card__extended-grid">
                      <div>
                        <span>Cliente</span>
                        <strong>{sample.client || "Sin cliente"}</strong>
                      </div>
                      <div>
                        <span>Proceso</span>
                        <strong>{sample.processCode || "Sin proceso"}</strong>
                      </div>
                      <div>
                        <span>Proveedor</span>
                        <strong>{sample.supplier || "Sin proveedor"}</strong>
                      </div>
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
                        <strong>
                          {sample.relatedAnalysisId || "Sin vinculo"}
                        </strong>
                      </div>
                      <div>
                        <span>Cantidad lote</span>
                        <strong>
                          {sample.quantityKg > 0
                            ? formatKg(sample.quantityKg)
                            : "No aplica"}
                        </strong>
                      </div>
                    </div>

                    {sample.notes ? (
                      <p className="samples-record__notes">{sample.notes}</p>
                    ) : null}
                  </div>
                ) : null}
                </article>
              );
            })
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
        <SectionCard title="Muestras por producto">
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="name" stroke={chartAxisColor} />
                <YAxis allowDecimals={false} stroke={chartAxisColor} />
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

        <SectionCard title="Estado de resguardo">
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
                    <h3 id="samples-modal-title">
                      {editingSampleId
                        ? "Editar muestra"
                        : "Agregar nueva muestra"}
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
                            handleUppercaseInputChange(
                              "client",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Proveedor
                        <input
                          type="text"
                          list="samples-supplier-options"
                          className="samples-uppercase-input"
                          value={form.supplier}
                          onChange={(event) =>
                            handleUppercaseInputChange(
                              "supplier",
                              event.target.value,
                            )
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
                            handleUppercaseInputChange(
                              "product",
                              event.target.value,
                            )
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
                            handleUppercaseInputChange(
                              "processCode",
                              event.target.value,
                            )
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
                            handleUppercaseInputChange(
                              "sampleCode",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Analisis relacionado
                        <input
                          type="text"
                          list="samples-related-analysis-options"
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
                            handleFormChange(
                              "quantityKg",
                              Number(event.target.value),
                            )
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
                      onChange={(event) =>
                        handleFormChange("notes", event.target.value)
                      }
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
                      disabled={isPersisting}
                    >
                      {isPersisting
                        ? "Guardando..."
                        : editingSampleId
                          ? "Guardar cambios"
                          : "Guardar muestra"}
                    </button>
                  </div>
                </form>

                <datalist id="samples-client-options">
                  {formClientOptions.length
                    ? formClientOptions.map((client) => (
                        <option key={client} value={client} />
                      ))
                    : allClientOptions.map((client) => (
                        <option key={client} value={client} />
                      ))}
                </datalist>

                <datalist id="samples-product-options">
                  {formProductOptions.length
                    ? formProductOptions.map((product) => (
                        <option key={product} value={product} />
                      ))
                    : allProductOptions.map((product) => (
                        <option key={product} value={product} />
                      ))}
                </datalist>

                <datalist id="samples-supplier-options">
                  {formSupplierOptions.length
                    ? formSupplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier} />
                      ))
                    : allSupplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier} />
                      ))}
                </datalist>

                <datalist id="samples-process-options">
                  {formProcessOptions.length
                    ? formProcessOptions.map((processCode) => (
                        <option key={processCode} value={processCode} />
                      ))
                    : allProcessOptions.map((processCode) => (
                        <option key={processCode} value={processCode} />
                      ))}
                </datalist>

                <datalist id="samples-related-analysis-options">
                  {formRelatedAnalysisOptions.length
                    ? formRelatedAnalysisOptions.map((analysisId) => (
                        <option key={analysisId} value={analysisId} />
                      ))
                    : allRelatedAnalysisOptions.map((analysisId) => (
                        <option key={analysisId} value={analysisId} />
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
