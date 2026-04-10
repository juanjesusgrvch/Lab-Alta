// Etapas
export const outputStageOptions = [
  "CLASIFICADORA N\u00b02",
  "DENSIMETRICA",
  "RECHAZO DE DENSIMETRICA",
  "LUSTRADORA",
  "ELECTRONICA",
  "RECHAZO DE ELECTRONICA",
  "ENVASADORA",
] as const;

// Catalogo
export const defectCatalog = [
  "MATERIAS EXTRANAS",
  "TERRON",
  "MAIZ",
  "ALERGENOS",
  "CAIDA BAJO ZARANDA",
  "INSECTOS MUERTOS",
  "GRANO PICADO",
  "GORGOJO VIVO",
  "SEMILLAS CURADAS",
  "ENMOHECIDO",
  "PODRIDO",
  "BROTADO",
  "PARTIDO",
  "QUEBRADO",
  "DESCORTICADO",
  "CASCADO",
  "ROIDO",
  "BOCA DE PESCADO",
  "OMBLIGO ABIERTO (RAJADO)",
  "MANCHADO FUERTE",
  "MANCHADO LEVE",
  "OXIDADO FUERTE",
  "OXIDADO MEDIO",
  "OXIDADO LEVE",
  "DESCOLORIDO",
  "GRANOS OSCUROS",
  "VARIEDAD CONTRASTANTE",
  "VARIEDAD NO CONTRASTANTE",
  "CHUZO",
  "ARDIDO/HELADO",
  "ARRUGADO",
  "VENOSO",
  "REVOLCADO LEVE",
  "DANO MECANICO",
  "DANO POR VAINA",
  "APLASTADO",
  "OLORES OBJETABLES",
] as const;

// Detalle
const defectsWithDetail = new Set<string>([
  "ALERGENOS",
  "VARIEDAD CONTRASTANTE",
  "VARIEDAD NO CONTRASTANTE",
]);

export const normalizeDefectText = (value: string) =>
  value.replace(/\s+/g, " ").trim().toUpperCase();

export const requiresDefectDetail = (name: string) =>
  defectsWithDetail.has(normalizeDefectText(name));

// Formato
export const formatDefectLabel = (name: string, detail?: string) => {
  const normalizedName = normalizeDefectText(name);
  const normalizedDetail = normalizeDefectText(detail ?? "");

  if (!normalizedName) {
    return "";
  }

  if (requiresDefectDetail(normalizedName) && normalizedDetail) {
    return `${normalizedName} (${normalizedDetail})`;
  }

  return normalizedName;
};

// Legado
export const parseLegacyDefectLabel = (rawName: string, rawDetail?: string) => {
  const normalizedName = normalizeDefectText(rawName);
  const normalizedDetail = normalizeDefectText(rawDetail ?? "");

  if (normalizedDetail) {
    return {
      name: normalizedName,
      detail: normalizedDetail,
    };
  }

  const matches = normalizedName.match(/^(.*?)[\s.]*\((.+)\)$/);

  if (!matches) {
    return {
      name: normalizedName,
      detail: "",
    };
  }

  const baseName = matches[1].trim().replace(/[.]+$/, "");
  const detail = matches[2].trim();

  if (!requiresDefectDetail(baseName)) {
    return {
      name: normalizedName,
      detail: "",
    };
  }

  return {
    name: baseName,
    detail,
  };
};
