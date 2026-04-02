"use client";

import { useRef, useState, useTransition } from "react";
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
import { Download, Trash2 } from "lucide-react";

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
import type { StoredSample } from "@/types/domain";

const chartColors = ["#355c4b", "#c2703d", "#8f9b62"];

const createEmptyForm = (): Omit<StoredSample, "id"> => ({
  storedAt: getTodayInBuenosAires(),
  sampleCode: "",
  client: "",
  product: "",
  processCode: "",
  relatedAnalysisId: "",
  warehouseZone: "",
  shelf: "",
  quantityKg: 0,
  retentionUntil: "",
  status: "Activa",
  notes: "",
});

export const SamplesModule = () => {
  const [samples, setSamples] = useState(initialStoredSamples);
  const [filters, setFilters] = useState({
    client: "",
    product: "",
    processCode: "",
    zone: "",
    status: "",
  });
  const [form, setForm] = useState(createEmptyForm);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const clientOptions = Array.from(new Set(samples.map((sample) => sample.client))).sort();
  const productOptions = Array.from(new Set(samples.map((sample) => sample.product))).sort();
  const processOptions = Array.from(
    new Set(samples.map((sample) => sample.processCode)),
  ).sort();
  const zoneOptions = Array.from(
    new Set(samples.map((sample) => sample.warehouseZone)),
  ).sort();

  const filteredSamples = samples.filter((sample) => {
    const matchesClient = !filters.client || sample.client === filters.client;
    const matchesProduct = !filters.product || sample.product === filters.product;
    const matchesProcess =
      !filters.processCode || sample.processCode === filters.processCode;
    const matchesZone = !filters.zone || sample.warehouseZone === filters.zone;
    const matchesStatus = !filters.status || sample.status === filters.status;

    return (
      matchesClient &&
      matchesProduct &&
      matchesProcess &&
      matchesZone &&
      matchesStatus
    );
  });

  const totalKg = filteredSamples.reduce(
    (accumulator, sample) => accumulator + sample.quantityKg,
    0,
  );
  const activeSamples = filteredSamples.filter(
    (sample) => sample.status === "Activa",
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

  const zoneMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  filteredSamples.forEach((sample) => {
    zoneMap.set(sample.warehouseZone, (zoneMap.get(sample.warehouseZone) ?? 0) + 1);
    statusMap.set(sample.status, (statusMap.get(sample.status) ?? 0) + 1);
  });

  const zoneData = Array.from(zoneMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));
  const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const handleFormChange = (
    field: keyof Omit<StoredSample, "id">,
    value: string | number,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
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
          warehouseZone: form.warehouseZone.trim(),
          shelf: form.shelf.trim(),
          notes: form.notes.trim(),
        },
        ...current,
      ]);
      setForm(createEmptyForm());
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
      setSamples((current) => current.filter((sample) => sample.id !== sampleId));
    });
  };

  return (
    <div ref={panelRef} className="module-stack">
      <div className="module-header">
        <div>
          <span className="eyebrow">Modulo 3</span>
          <h3>Control de muestras almacenadas</h3>
          <p>
            Registro de resguardo en deposito con trazabilidad por cliente,
            producto, proceso, analisis relacionado y vencimiento.
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

      <div className="metric-grid">
        <MetricCard
          label="Muestras visibles"
          value={formatInteger(filteredSamples.length)}
          caption="Cantidad total para la vista actual."
          tone="olive"
        />
        <MetricCard
          label="Volumen retenido"
          value={formatKg(totalKg)}
          caption="Peso total de muestras almacenadas."
          tone="sand"
        />
        <MetricCard
          label="Activas"
          value={formatInteger(activeSamples)}
          caption="Muestras hoy disponibles para consulta o reclamo."
          tone="forest"
        />
        <MetricCard
          label="Proximas a vencer"
          value={formatInteger(expiringSoon)}
          caption="Muestras activas que expiran dentro de 30 dias."
          tone="rust"
        />
      </div>

      <SectionCard
        title="Filtros de deposito"
        description="Vista por cliente, producto, proceso, zona y estado."
        action={
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setFilters({
                client: "",
                product: "",
                processCode: "",
                zone: "",
                status: "",
              })
            }
          >
            Limpiar filtros
          </button>
        }
      >
        <div className="form-grid four-columns">
          <label>
            Cliente
            <select
              value={filters.client}
              onChange={(event) =>
                setFilters((current) => ({ ...current, client: event.target.value }))
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
          <label>
            Producto
            <select
              value={filters.product}
              onChange={(event) =>
                setFilters((current) => ({ ...current, product: event.target.value }))
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
          <label>
            Codigo de proceso
            <select
              value={filters.processCode}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  processCode: event.target.value,
                }))
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
          <label>
            Zona
            <select
              value={filters.zone}
              onChange={(event) =>
                setFilters((current) => ({ ...current, zone: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {zoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">Todos</option>
              <option value="Activa">Activa</option>
              <option value="Liberada">Liberada</option>
              <option value="Vencida">Vencida</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <div className="module-grid">
        <SectionCard
          title="Nueva muestra almacenada"
          description="Planilla digital para registrar guarda, ubicacion y vencimiento."
        >
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-grid two-columns">
              <label>
                Fecha de guarda
                <input
                  type="date"
                  required
                  value={form.storedAt}
                  onChange={(event) => handleFormChange("storedAt", event.target.value)}
                />
              </label>
              <label>
                Codigo de muestra
                <input
                  type="text"
                  required
                  value={form.sampleCode}
                  onChange={(event) =>
                    handleFormChange("sampleCode", event.target.value)
                  }
                />
              </label>
              <label>
                Cliente
                <input
                  type="text"
                  required
                  value={form.client}
                  onChange={(event) => handleFormChange("client", event.target.value)}
                />
              </label>
              <label>
                Producto
                <input
                  type="text"
                  required
                  value={form.product}
                  onChange={(event) => handleFormChange("product", event.target.value)}
                />
              </label>
              <label>
                Codigo de proceso
                <input
                  type="text"
                  required
                  value={form.processCode}
                  onChange={(event) =>
                    handleFormChange("processCode", event.target.value)
                  }
                />
              </label>
              <label>
                Analisis relacionado
                <input
                  type="text"
                  value={form.relatedAnalysisId}
                  onChange={(event) =>
                    handleFormChange("relatedAnalysisId", event.target.value)
                  }
                  placeholder="Ej. ANA-1004"
                />
              </label>
              <label>
                Zona de deposito
                <input
                  type="text"
                  required
                  value={form.warehouseZone}
                  onChange={(event) =>
                    handleFormChange("warehouseZone", event.target.value)
                  }
                  placeholder="Ej. Zona A"
                />
              </label>
              <label>
                Estante / ubicacion
                <input
                  type="text"
                  required
                  value={form.shelf}
                  onChange={(event) => handleFormChange("shelf", event.target.value)}
                  placeholder="Ej. A-03"
                />
              </label>
              <label>
                Cantidad (kg)
                <input
                  type="number"
                  min="0"
                  value={form.quantityKg}
                  onChange={(event) =>
                    handleFormChange("quantityKg", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Retener hasta
                <input
                  type="date"
                  required
                  value={form.retentionUntil}
                  onChange={(event) =>
                    handleFormChange("retentionUntil", event.target.value)
                  }
                />
              </label>
              <label>
                Estado
                <select
                  value={form.status}
                  onChange={(event) =>
                    handleFormChange("status", event.target.value)
                  }
                >
                  <option value="Activa">Activa</option>
                  <option value="Liberada">Liberada</option>
                  <option value="Vencida">Vencida</option>
                </select>
              </label>
            </div>

            <label>
              Notas
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => handleFormChange("notes", event.target.value)}
                placeholder="Informacion adicional de guarda, destino o referencia."
              />
            </label>

            <button type="submit" className="primary-button" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar muestra"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Muestras por zona"
          description="Distribucion operativa del deposito."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8d0c2" />
                <XAxis dataKey="name" stroke="#50614d" />
                <YAxis stroke="#50614d" />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {zoneData.map((entry, index) => (
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
      </div>

      <div className="module-grid">
        <SectionCard
          title="Estado del resguardo"
          description="Balance de muestras activas, liberadas y vencidas."
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

        <SectionCard
          title="Alerta de retencion"
          description="Muestras activas proximas a vencer."
        >
          <div className="focus-stat">
            <strong>{formatInteger(expiringSoon)}</strong>
            <span>muestras con vencimiento dentro de 30 dias</span>
            <p>
              Este bloque ayuda a ordenar liberaciones, descarte y revision de
              espacio disponible en el deposito.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Inventario de muestras"
        description="Planilla viva para control y trazabilidad del deposito."
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Codigo</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Proceso</th>
                <th>Analisis</th>
                <th>Ubicacion</th>
                <th>Retencion</th>
                <th>Estado</th>
                <th className="table-action-cell">Accion</th>
              </tr>
            </thead>
            <tbody>
              {filteredSamples.map((sample) => (
                <tr key={sample.id}>
                  <td>{formatDate(sample.storedAt)}</td>
                  <td>{sample.sampleCode}</td>
                  <td>{sample.client}</td>
                  <td>{sample.product}</td>
                  <td>{sample.processCode}</td>
                  <td>{sample.relatedAnalysisId || "Sin vinculo"}</td>
                  <td>
                    {sample.warehouseZone} / {sample.shelf}
                  </td>
                  <td>{sample.retentionUntil ? formatDate(sample.retentionUntil) : "-"}</td>
                  <td>
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
                  </td>
                  <td className="table-action-cell">
                    <button
                      type="button"
                      className="ghost-button compact-button danger-button"
                      onClick={() => handleDeleteSample(sample.id)}
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
