"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { Download, Plus, Trash2 } from "lucide-react";

import { MetricCard, SectionCard } from "@/components/dashboard/primitives";
import {
  formatDate,
  formatDecimal,
  formatInteger,
  getTodayInBuenosAires,
} from "@/lib/format";
import { initialDefectAnalyses } from "@/lib/mock-data";
import { exportElementToPdf } from "@/lib/pdf";
import {
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

const createEmptyForm = (): Omit<DefectAnalysis, "id"> => ({
  analysisDate: getTodayInBuenosAires(),
  client: "",
  product: "",
  processCode: "",
  lotCode: "",
  operator: "",
  totalUnitsInspected: 400,
  defects: [{ id: crypto.randomUUID(), name: "", count: 0 }],
  observations: "",
});

type DefectRelationalFilters = {
  client: string;
  product: string;
  defect: string;
  processCode: string;
};

const defectFilterConfig: Record<
  keyof DefectRelationalFilters,
  RelationalFieldConfig<DefectAnalysis>
> = {
  client: {
    getValues: (analysis) => [analysis.client],
    matches: (analysis, value) => analysis.client === value,
  },
  product: {
    getValues: (analysis) => [analysis.product],
    matches: (analysis, value) => analysis.product === value,
  },
  defect: {
    getValues: (analysis) => analysis.defects.map((defect) => defect.name),
    matches: (analysis, value) =>
      analysis.defects.some((defect) => defect.name === value),
  },
  processCode: {
    getValues: (analysis) => [analysis.processCode],
    matches: (analysis, value) => analysis.processCode === value,
  },
};

export const DefectsModule = () => {
  const [analyses, setAnalyses] = useState(initialDefectAnalyses);
  const [filters, setFilters] = useState({
    client: "",
    product: "",
    defect: "",
    processCode: "",
    from: "",
    to: "",
  });
  const [form, setForm] = useState(createEmptyForm);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const relationalFilters: DefectRelationalFilters = {
    client: filters.client,
    product: filters.product,
    defect: filters.defect,
    processCode: filters.processCode,
  };

  const matchesDateRange = (analysis: DefectAnalysis, from: string, to: string) => {
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
  const processOptions = getRelationalOptions(
    analyses,
    relationalFilters,
    "processCode",
    defectFilterConfig,
    (analysis) => matchesDateRange(analysis, filters.from, filters.to),
  );

  useEffect(() => {
    setFilters((current) => {
      const currentRelational: DefectRelationalFilters = {
        client: current.client,
        product: current.product,
        defect: current.defect,
        processCode: current.processCode,
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
    filters.product,
    filters.defect,
    filters.processCode,
    filters.from,
    filters.to,
  ]);

  const filteredAnalyses = analyses.filter((analysis) => {
    const matchesClient = !filters.client || analysis.client === filters.client;
    const matchesProduct = !filters.product || analysis.product === filters.product;
    const matchesProcess =
      !filters.processCode || analysis.processCode === filters.processCode;
    const matchesDefect =
      !filters.defect ||
      analysis.defects.some((defect) => defect.name === filters.defect);
    return (
      matchesClient &&
      matchesProduct &&
      matchesProcess &&
      matchesDefect &&
      matchesDateRange(analysis, filters.from, filters.to)
    );
  });

  const totalDefects = filteredAnalyses.reduce(
    (accumulator, analysis) =>
      accumulator +
      analysis.defects.reduce(
        (defectAccumulator, defect) => defectAccumulator + defect.count,
        0,
      ),
    0,
  );

  const totalUnits = filteredAnalyses.reduce(
    (accumulator, analysis) => accumulator + analysis.totalUnitsInspected,
    0,
  );

  const defectMap = new Map<string, number>();
  const clientMap = new Map<string, number>();

  filteredAnalyses.forEach((analysis) => {
    clientMap.set(analysis.client, (clientMap.get(analysis.client) ?? 0) + 1);

    analysis.defects.forEach((defect) => {
      defectMap.set(defect.name, (defectMap.get(defect.name) ?? 0) + defect.count);
    });
  });

  const defectChartData = Array.from(defectMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  const clientChartData = Array.from(clientMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);

  const topDefect = defectChartData[0];

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleFormChange = (
    field: keyof Omit<DefectAnalysis, "id" | "defects">,
    value: string | number,
  ) => {
    setForm((current) => {
      const nextForm = {
        ...current,
      };
      const mutableForm = nextForm as Record<string, any>;

      mutableForm[field as string] = value as any;

      return nextForm as Omit<DefectAnalysis, "id">;
    });
  };

  const handleDefectChange = (
    defectId: string,
    field: keyof DefectItem,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      defects: current.defects.map((defect) =>
        defect.id === defectId
          ? (() => {
              const nextDefect = {
                ...defect,
              };
              const mutableDefect = nextDefect as Record<string, any>;

              mutableDefect[field as string] = value as any;

              return nextDefect as DefectItem;
            })()
          : defect,
      ),
    }));
  };

  const addDefectRow = () => {
    setForm((current) => ({
      ...current,
      defects: [
        ...current.defects,
        { id: crypto.randomUUID(), name: "", count: 0 },
      ],
    }));
  };

  const removeDefectRow = (defectId: string) => {
    setForm((current) => ({
      ...current,
      defects:
        current.defects.length === 1
          ? current.defects
          : current.defects.filter((defect) => defect.id !== defectId),
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedDefects = form.defects.filter(
      (defect) => defect.name.trim() && defect.count > 0,
    );

    if (!normalizedDefects.length) {
      return;
    }

    startTransition(() => {
      setAnalyses((current) => [
        {
          ...form,
          id: `ANA-${Date.now()}`,
          client: form.client.trim(),
          product: form.product.trim(),
          processCode: form.processCode.trim(),
          lotCode: form.lotCode.trim(),
          operator: form.operator.trim(),
          observations: form.observations.trim(),
          defects: normalizedDefects,
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
      await exportElementToPdf(panelRef.current, "defectos-produccion.pdf");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={panelRef} className="module-stack">
      <div className="module-header">
        <div>
          <span className="eyebrow">Modulo 1</span>
          <h3>Base de defectos analizados</h3>
          <p>
            Registro detallado por analisis, con multiples defectos por lote,
            filtros cruzados y resumen visual listo para exportar.
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
          label="Analisis filtrados"
          value={formatInteger(filteredAnalyses.length)}
          caption="Sesiones visibles con la combinacion actual de filtros."
          tone="olive"
        />
        <MetricCard
          label="Defectos detectados"
          value={formatInteger(totalDefects)}
          caption="Suma de defectos declarados en los analisis filtrados."
          tone="rust"
        />
        <MetricCard
          label="Unidades inspeccionadas"
          value={formatInteger(totalUnits)}
          caption="Base sobre la cual se realizo la clasificacion visual."
          tone="sand"
        />
        <MetricCard
          label="Defecto dominante"
          value={topDefect?.name ?? "Sin datos"}
          caption={
            topDefect
              ? `${formatInteger(topDefect.count)} incidencias acumuladas.`
              : "Aun no hay resultados para esta vista."
          }
          tone="forest"
        />
      </div>

      <SectionCard
        title="Filtros analiticos"
        description="Combina cliente, producto, defecto, proceso y rango de fechas."
        action={
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setFilters({
                client: "",
                product: "",
                defect: "",
                processCode: "",
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
          <label>
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
          <label>
            Defecto
            <select
              value={filters.defect}
              onChange={(event) => handleFilterChange("defect", event.target.value)}
            >
              <option value="">Todos</option>
              {defectOptions.map((defect) => (
                <option key={defect} value={defect}>
                  {defect}
                </option>
              ))}
            </select>
          </label>
          <label>
            Codigo de proceso
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
          <label>
            Desde
            <input
              type="date"
              value={filters.from}
              onChange={(event) => handleFilterChange("from", event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filters.to}
              onChange={(event) => handleFilterChange("to", event.target.value)}
            />
          </label>
        </div>
      </SectionCard>

      <div className="module-grid">
        <SectionCard
          title="Nuevo analisis"
          description="Carga un formulario por lote y detalla todos los defectos observados."
        >
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-grid two-columns">
              <label>
                Fecha de analisis
                <input
                  type="date"
                  required
                  value={form.analysisDate}
                  onChange={(event) =>
                    handleFormChange("analysisDate", event.target.value)
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
                  placeholder="Ej. Exportadora Sur"
                />
              </label>
              <label>
                Producto
                <input
                  type="text"
                  required
                  value={form.product}
                  onChange={(event) => handleFormChange("product", event.target.value)}
                  placeholder="Ej. Poroto negro"
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
                  placeholder="Ej. PROC-L1"
                />
              </label>
              <label>
                Lote
                <input
                  type="text"
                  required
                  value={form.lotCode}
                  onChange={(event) => handleFormChange("lotCode", event.target.value)}
                  placeholder="Ej. L-2258"
                />
              </label>
              <label>
                Operador
                <input
                  type="text"
                  required
                  value={form.operator}
                  onChange={(event) =>
                    handleFormChange("operator", event.target.value)
                  }
                  placeholder="Nombre y apellido"
                />
              </label>
              <label>
                Unidades inspeccionadas
                <input
                  type="number"
                  min="0"
                  value={form.totalUnitsInspected}
                  onChange={(event) =>
                    handleFormChange(
                      "totalUnitsInspected",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>

            <div className="subsection">
              <div className="subsection-header">
                <h4>Detalle de defectos</h4>
                <button type="button" className="text-button" onClick={addDefectRow}>
                  <Plus size={14} />
                  Agregar defecto
                </button>
              </div>
              <div className="stack-list">
                {form.defects.map((defect) => (
                  <div key={defect.id} className="inline-form-row">
                    <label>
                      Defecto
                      <input
                        type="text"
                        value={defect.name}
                        onChange={(event) =>
                          handleDefectChange(defect.id, "name", event.target.value)
                        }
                        placeholder="Ej. Partido"
                      />
                    </label>
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min="0"
                        value={defect.count}
                        onChange={(event) =>
                          handleDefectChange(
                            defect.id,
                            "count",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeDefectRow(defect.id)}
                      aria-label="Eliminar defecto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label>
              Observaciones
              <textarea
                rows={4}
                value={form.observations}
                onChange={(event) =>
                  handleFormChange("observations", event.target.value)
                }
                placeholder="Notas sobre hallazgos, acciones sugeridas o contexto del lote."
              />
            </label>

            <button type="submit" className="primary-button" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar analisis"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Severidad por defecto"
          description="Vista rapida para identificar donde esta el mayor peso del rechazo."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defectChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="name" stroke={chartAxisColor} />
                <YAxis stroke={chartAxisColor} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {defectChartData.map((entry, index) => (
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
          title="Distribucion por cliente"
          description="Cantidad de analisis visibles por cliente."
        >
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                >
                  {clientChartData.map((entry, index) => (
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
          title="Intensidad promedio"
          description="Promedio de defectos por analisis dentro de la vista actual."
        >
          <div className="focus-stat">
            <strong>
              {filteredAnalyses.length
                ? formatDecimal(totalDefects / filteredAnalyses.length)
                : "0,0"}
            </strong>
            <span>defectos promedio por analisis</span>
            <p>
              Te sirve para contrastar periodos, procesos y clientes sin perder el
              detalle individual de cada sesion.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Historial de analisis"
        description="Tabla operativa con el detalle principal de cada registro."
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Proceso</th>
                <th>Lote</th>
                <th>Defectos</th>
                <th>Operador</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnalyses.map((analysis) => (
                <tr key={analysis.id}>
                  <td>{formatDate(analysis.analysisDate)}</td>
                  <td>{analysis.client}</td>
                  <td>{analysis.product}</td>
                  <td>{analysis.processCode}</td>
                  <td>{analysis.lotCode}</td>
                  <td>
                    {analysis.defects
                      .map((defect) => `${defect.name} (${defect.count})`)
                      .join(", ")}
                  </td>
                  <td>{analysis.operator}</td>
                  <td>{analysis.observations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
