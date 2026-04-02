"use client";

import { useRef, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";

import {
  MetricCard,
  SectionCard,
  StatusPill,
} from "@/components/dashboard/primitives";
import {
  formatDate,
  formatInteger,
  formatKg,
  formatPercent,
  getTodayInBuenosAires,
} from "@/lib/format";
import { initialNaturalEntries } from "@/lib/mock-data";
import { exportElementToPdf } from "@/lib/pdf";
import type { NaturalEntry } from "@/types/domain";

const chartColors = ["#355c4b", "#c2703d", "#8f9b62", "#d7b377"];

const createEmptyForm = (): Omit<NaturalEntry, "id" | "netKg"> => ({
  entryDate: getTodayInBuenosAires(),
  truckPlate: "",
  client: "",
  supplier: "",
  product: "",
  processCode: "",
  grossKg: 0,
  tareKg: 0,
  withAnalysis: false,
  analysisSummary: {
    humidityPct: 0,
    brokenPct: 0,
    foreignMatterPct: 0,
    notes: "",
  },
});

export const NaturalModule = () => {
  const [entries, setEntries] = useState(initialNaturalEntries);
  const [filters, setFilters] = useState({
    client: "",
    product: "",
    processCode: "",
    analysis: "all",
    from: "",
    to: "",
  });
  const [form, setForm] = useState(createEmptyForm);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const clientOptions = Array.from(new Set(entries.map((entry) => entry.client))).sort();
  const productOptions = Array.from(new Set(entries.map((entry) => entry.product))).sort();
  const processOptions = Array.from(
    new Set(entries.map((entry) => entry.processCode)),
  ).sort();

  const filteredEntries = entries.filter((entry) => {
    const matchesClient = !filters.client || entry.client === filters.client;
    const matchesProduct = !filters.product || entry.product === filters.product;
    const matchesProcess =
      !filters.processCode || entry.processCode === filters.processCode;
    const matchesAnalysis =
      filters.analysis === "all" ||
      (filters.analysis === "with" && entry.withAnalysis) ||
      (filters.analysis === "without" && !entry.withAnalysis);
    const matchesFrom = !filters.from || entry.entryDate >= filters.from;
    const matchesTo = !filters.to || entry.entryDate <= filters.to;

    return (
      matchesClient &&
      matchesProduct &&
      matchesProcess &&
      matchesAnalysis &&
      matchesFrom &&
      matchesTo
    );
  });

  const totalNetKg = filteredEntries.reduce(
    (accumulator, entry) => accumulator + entry.netKg,
    0,
  );
  const analyzedEntries = filteredEntries.filter((entry) => entry.withAnalysis).length;

  const inboundByProductMap = new Map<string, number>();
  const inboundTrendMap = new Map<string, number>();
  const analysisPieData = [
    {
      name: "Con analisis",
      value: filteredEntries.filter((entry) => entry.withAnalysis).length,
    },
    {
      name: "Sin analisis",
      value: filteredEntries.filter((entry) => !entry.withAnalysis).length,
    },
  ];

  filteredEntries.forEach((entry) => {
    inboundByProductMap.set(
      entry.product,
      (inboundByProductMap.get(entry.product) ?? 0) + entry.netKg,
    );
    inboundTrendMap.set(
      entry.entryDate,
      (inboundTrendMap.get(entry.entryDate) ?? 0) + entry.netKg,
    );
  });

  const inboundByProduct = Array.from(inboundByProductMap.entries())
    .map(([name, netKg]) => ({ name, netKg }))
    .sort((left, right) => right.netKg - left.netKg);

  const inboundTrend = Array.from(inboundTrendMap.entries())
    .map(([date, netKg]) => ({ date, netKg }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const handleEntryChange = (
    field: keyof Omit<NaturalEntry, "id" | "analysisSummary" | "netKg">,
    value: string | number | boolean,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAnalysisChange = (
    field: keyof NonNullable<NaturalEntry["analysisSummary"]>,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      analysisSummary: {
        humidityPct: current.analysisSummary?.humidityPct ?? 0,
        brokenPct: current.analysisSummary?.brokenPct ?? 0,
        foreignMatterPct: current.analysisSummary?.foreignMatterPct ?? 0,
        notes: current.analysisSummary?.notes ?? "",
        [field]: value,
      },
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const netKg = Math.max(form.grossKg - form.tareKg, 0);

    startTransition(() => {
      setEntries((current) => [
        {
          ...form,
          id: `ING-${Date.now()}`,
          netKg,
          client: form.client.trim(),
          supplier: form.supplier.trim(),
          truckPlate: form.truckPlate.trim(),
          product: form.product.trim(),
          processCode: form.processCode.trim(),
          analysisSummary: form.withAnalysis ? form.analysisSummary : undefined,
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
          <h3>Base de mercaderia al natural</h3>
          <p>
            Control de stock entrante a planta por camion, con analisis optativo
            integrado en la misma carga de recepcion.
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
          label="Stock entrante visible"
          value={formatKg(totalNetKg)}
          caption="Suma neta de los ingresos filtrados en la tabla."
          tone="olive"
        />
        <MetricCard
          label="Camiones visibles"
          value={formatInteger(filteredEntries.length)}
          caption="Registros de descarga dentro del conjunto actual."
          tone="sand"
        />
        <MetricCard
          label="Ingresos analizados"
          value={formatInteger(analyzedEntries)}
          caption="Recepciones que incluyen el check y resumen de analisis."
          tone="forest"
        />
        <MetricCard
          label="Promedio por camion"
          value={
            filteredEntries.length
              ? formatKg(Math.round(totalNetKg / filteredEntries.length))
              : "0 kg"
          }
          caption="Carga media neta por descarga visible."
          tone="rust"
        />
      </div>

      <SectionCard
        title="Filtros de recepcion"
        description="Seguimiento por cliente, producto, proceso y estado del analisis."
        action={
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setFilters({
                client: "",
                product: "",
                processCode: "",
                analysis: "all",
                from: "",
                to: "",
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
            Estado del analisis
            <select
              value={filters.analysis}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  analysis: event.target.value,
                }))
              }
            >
              <option value="all">Todos</option>
              <option value="with">Con analisis</option>
              <option value="without">Sin analisis</option>
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((current) => ({ ...current, from: event.target.value }))
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
        </div>
      </SectionCard>

      <div className="module-grid">
        <SectionCard
          title="Nueva descarga de camion"
          description="Cada recepcion puede registrar stock y opcionalmente adjuntar analisis."
        >
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-grid two-columns">
              <label>
                Fecha de ingreso
                <input
                  type="date"
                  required
                  value={form.entryDate}
                  onChange={(event) =>
                    handleEntryChange("entryDate", event.target.value)
                  }
                />
              </label>
              <label>
                Patente del camion
                <input
                  type="text"
                  required
                  value={form.truckPlate}
                  onChange={(event) =>
                    handleEntryChange("truckPlate", event.target.value)
                  }
                  placeholder="Ej. AE123ZX"
                />
              </label>
              <label>
                Cliente
                <input
                  type="text"
                  required
                  value={form.client}
                  onChange={(event) => handleEntryChange("client", event.target.value)}
                />
              </label>
              <label>
                Proveedor / campo
                <input
                  type="text"
                  required
                  value={form.supplier}
                  onChange={(event) =>
                    handleEntryChange("supplier", event.target.value)
                  }
                />
              </label>
              <label>
                Producto
                <input
                  type="text"
                  required
                  value={form.product}
                  onChange={(event) =>
                    handleEntryChange("product", event.target.value)
                  }
                />
              </label>
              <label>
                Codigo de proceso
                <input
                  type="text"
                  required
                  value={form.processCode}
                  onChange={(event) =>
                    handleEntryChange("processCode", event.target.value)
                  }
                />
              </label>
              <label>
                Peso bruto (kg)
                <input
                  type="number"
                  min="0"
                  value={form.grossKg}
                  onChange={(event) =>
                    handleEntryChange("grossKg", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Tara (kg)
                <input
                  type="number"
                  min="0"
                  value={form.tareKg}
                  onChange={(event) =>
                    handleEntryChange("tareKg", Number(event.target.value))
                  }
                />
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.withAnalysis}
                onChange={(event) =>
                  handleEntryChange("withAnalysis", event.target.checked)
                }
              />
              <span>Esta entrada requiere cargar analisis</span>
            </label>

            {form.withAnalysis ? (
              <div className="subsection">
                <div className="subsection-header">
                  <h4>Resumen del analisis</h4>
                  <StatusPill value="Analisis habilitado" tone="good" />
                </div>
                <div className="form-grid two-columns">
                  <label>
                    Humedad (%)
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.analysisSummary?.humidityPct ?? 0}
                      onChange={(event) =>
                        handleAnalysisChange(
                          "humidityPct",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Partido (%)
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.analysisSummary?.brokenPct ?? 0}
                      onChange={(event) =>
                        handleAnalysisChange(
                          "brokenPct",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Materia extrana (%)
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.analysisSummary?.foreignMatterPct ?? 0}
                      onChange={(event) =>
                        handleAnalysisChange(
                          "foreignMatterPct",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>
                <label>
                  Notas del analisis
                  <textarea
                    rows={3}
                    value={form.analysisSummary?.notes ?? ""}
                    onChange={(event) =>
                      handleAnalysisChange("notes", event.target.value)
                    }
                  />
                </label>
              </div>
            ) : null}

            <button type="submit" className="primary-button" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar ingreso"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Ingreso neto por producto"
          description="Volumen descargado acumulado para la vista actual."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inboundByProduct}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8d0c2" />
                <XAxis dataKey="name" stroke="#50614d" />
                <YAxis stroke="#50614d" />
                <Tooltip />
                <Bar dataKey="netKg" radius={[8, 8, 0, 0]}>
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
      </div>

      <div className="module-grid">
        <SectionCard
          title="Tendencia diaria de ingreso"
          description="Evolucion del neto descargado por fecha."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inboundTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8d0c2" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(value)}
                  stroke="#50614d"
                />
                <YAxis stroke="#50614d" />
                <Tooltip
                  formatter={(value: number) => formatKg(value)}
                  labelFormatter={(label: string) => formatDate(label)}
                />
                <Line
                  type="monotone"
                  dataKey="netKg"
                  stroke="#355c4b"
                  strokeWidth={3}
                  dot={{ fill: "#c2703d", r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Cobertura analitica"
          description="Relacion entre camiones con y sin analisis cargado."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysisPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                >
                  {analysisPieData.map((entry, index) => (
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

      <SectionCard
        title="Historial de descargas"
        description="Control operativo del stock entrante, con resumen del analisis cuando exista."
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Camion</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Proceso</th>
                <th>Neto</th>
                <th>Analisis</th>
                <th>Resumen</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.entryDate)}</td>
                  <td>{entry.truckPlate}</td>
                  <td>{entry.client}</td>
                  <td>{entry.product}</td>
                  <td>{entry.processCode}</td>
                  <td>{formatKg(entry.netKg)}</td>
                  <td>
                    <StatusPill
                      value={entry.withAnalysis ? "Si" : "No"}
                      tone={entry.withAnalysis ? "good" : "warn"}
                    />
                  </td>
                  <td>
                    {entry.analysisSummary ? (
                      <span>
                        H {formatPercent(entry.analysisSummary.humidityPct)} / P{" "}
                        {formatPercent(entry.analysisSummary.brokenPct)} / ME{" "}
                        {formatPercent(entry.analysisSummary.foreignMatterPct)}
                      </span>
                    ) : (
                      "Sin analisis adjunto"
                    )}
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
