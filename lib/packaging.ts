// Opciones
export const packagingTypeOptions = [
  "GRANEL",
  "BOLSA",
  "BOLSON",
  "OTRO",
] as const;

export const packagingConditionOptions = [
  "NUEVO",
  "USADO",
  "VIEJO",
] as const;

// Tipos
export type PackagingTypeOption = (typeof packagingTypeOptions)[number];
export type PackagingConditionOption = (typeof packagingConditionOptions)[number];
export type PackagingMovementType = "alta" | "baja";

export interface PackagingMovementRecord {
  id: string;
  movementType: PackagingMovementType;
  packagingType: string;
  packagingCondition: string;
  packagingKg: number;
  quantity: number;
}

const LEGACY_TYPE_PARSERS: Array<{
  match: RegExp;
  type: Exclude<PackagingTypeOption, "GRANEL">;
  packagingKg: number;
}> = [
  { match: /^BOLSA 25 KG$/i, type: "BOLSA", packagingKg: 25 },
  { match: /^BOLSA 50 KG$/i, type: "BOLSA", packagingKg: 50 },
  { match: /^BOLSON DE 1000 KG$/i, type: "BOLSON", packagingKg: 1000 },
];

const normalizeTypeSegment = (value: string) =>
  value.replace(/\s+/g, " ").trim().toUpperCase();

const compactIdSegment = (value: string) =>
  normalizeTypeSegment(value).replace(/\s+/g, "_");

const deriveLegacyPackagingShape = (
  rawType: string,
  rawKg: number | null | undefined,
) => {
  const normalizedType = normalizeTypeSegment(rawType);
  const explicitKg = Math.max(0, Number(rawKg ?? 0));

  if (normalizedType === "GRANEL") {
    return {
      packagingType: "GRANEL",
      packagingKg: 0,
    } as const;
  }

  const legacyMatch = LEGACY_TYPE_PARSERS.find(({ match }) =>
    match.test(normalizedType),
  );

  if (legacyMatch) {
    return {
      packagingType: legacyMatch.type,
      packagingKg: explicitKg || legacyMatch.packagingKg,
    } as const;
  }

  if (normalizedType === "OTROS") {
    return {
      packagingType: "OTRO",
      packagingKg: explicitKg,
    } as const;
  }

  return {
    packagingType: normalizedType || "OTRO",
    packagingKg: explicitKg,
  } as const;
};

// Normalizacion
export const normalizePackagingText = (value: string) =>
  value.replace(/\s+/g, " ").trim().toUpperCase();

export const createPackagingMovement = (
  movementType: PackagingMovementType = "alta",
): PackagingMovementRecord => ({
  id: crypto.randomUUID(),
  movementType,
  packagingType: "BOLSON",
  packagingCondition: "USADO",
  packagingKg: 1000,
  quantity: 1,
});

export const createBulkPackagingMovement = (): PackagingMovementRecord => ({
  id: crypto.randomUUID(),
  movementType: "alta",
  packagingType: "GRANEL",
  packagingCondition: "",
  packagingKg: 0,
  quantity: 0,
});

export const normalizePackagingMovement = (
  movement: Partial<PackagingMovementRecord> | null | undefined,
  fallbackId: string,
): PackagingMovementRecord => {
  const derivedShape = deriveLegacyPackagingShape(
    movement?.packagingType ?? "GRANEL",
    movement?.packagingKg,
  );

  const isBulk = derivedShape.packagingType === "GRANEL";

  return {
    id: movement?.id?.trim() || fallbackId,
    movementType: movement?.movementType === "baja" ? "baja" : "alta",
    packagingType: derivedShape.packagingType,
    packagingCondition: isBulk
      ? ""
      : normalizePackagingText(movement?.packagingCondition ?? "USADO"),
    packagingKg: isBulk ? 0 : Math.max(0, Number(derivedShape.packagingKg ?? 0)),
    quantity: isBulk ? 0 : Math.max(0, Number(movement?.quantity ?? 0)),
  };
};

export const getPackagingMovementId = (
  movement: Partial<PackagingMovementRecord> | null | undefined,
) => {
  const normalized = normalizePackagingMovement(
    movement,
    movement?.id?.trim() || "PACKAGING-ID",
  );

  if (normalized.packagingType === "GRANEL") {
    return "GRANEL";
  }

  const conditionSegment = normalized.packagingCondition || "SIN_ESTADO";
  const kgSegment = normalized.packagingKg > 0 ? `${normalized.packagingKg}KG` : "0KG";

  return [
    compactIdSegment(normalized.packagingType),
    compactIdSegment(conditionSegment),
    compactIdSegment(kgSegment),
  ].join("_");
};

export const getPackagingIdsFromMovements = (
  movements: Array<Partial<PackagingMovementRecord> | null | undefined> | null | undefined,
) => {
  const safeMovements = movements?.length ? movements : [createBulkPackagingMovement()];

  return Array.from(
    new Set(
      safeMovements.map((movement) => getPackagingMovementId(movement)).filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
};

export const hasExplicitPackagingDetails = (
  movements: Array<Partial<PackagingMovementRecord> | null | undefined> | null | undefined,
) =>
  (movements ?? []).some((movement) => {
    const normalized = normalizePackagingMovement(
      movement,
      movement?.id?.trim() || "PACKAGING-CHECK",
    );

    return normalized.packagingType !== "GRANEL" && normalized.quantity > 0;
  });

const packagingTypeLabelMap: Record<string, string> = {
  GRANEL: "granel",
  BOLSA: "bolsa",
  BOLSON: "bolson",
  OTRO: "envase",
};

const packagingConditionLabelMap: Record<string, string> = {
  NUEVO: "nuevo",
  USADO: "usado",
  VIEJO: "viejo",
};

export const formatPackagingMovementLabel = (
  movement: Partial<PackagingMovementRecord> | null | undefined,
) => {
  const normalized = normalizePackagingMovement(
    movement,
    movement?.id?.trim() || "PACKAGING-LABEL",
  );

  if (normalized.packagingType === "GRANEL") {
    return "granel";
  }

  const typeLabel =
    packagingTypeLabelMap[normalized.packagingType] ?? normalized.packagingType.toLowerCase();
  const conditionLabel =
    packagingConditionLabelMap[normalized.packagingCondition] ??
    normalized.packagingCondition.toLowerCase();
  const prefix = normalized.movementType === "baja" ? "- " : "";

  return `${prefix}${normalized.quantity} ${typeLabel} ${conditionLabel} ${normalized.packagingKg} kg`;
};

// Resumen
export const formatPackagingSummary = (
  movements: Array<Partial<PackagingMovementRecord> | null | undefined> | null | undefined,
) => {
  const safeMovements = (movements ?? []).map((movement, index) =>
    normalizePackagingMovement(movement, `PACKAGING-SUMMARY-${index + 1}`),
  );

  if (!safeMovements.length) {
    return "granel";
  }

  return safeMovements.map((movement) => formatPackagingMovementLabel(movement)).join(" | ");
};
