// Opciones
export const packagingTypeOptions = [
  "GRANEL",
  "BOLSA 25 KG",
  "BOLSA 50 KG",
  "BOLSON DE 1000 KG",
  "OTROS",
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
  quantity: number;
}

// Normalizacion
export const normalizePackagingText = (value: string) =>
  value.replace(/\s+/g, " ").trim().toUpperCase();

export const createPackagingMovement = (
  movementType: PackagingMovementType = "alta",
): PackagingMovementRecord => ({
  id: crypto.randomUUID(),
  movementType,
  packagingType: "BOLSON DE 1000 KG",
  packagingCondition: "USADO",
  quantity: 0,
});

export const normalizePackagingMovement = (
  movement: Partial<PackagingMovementRecord> | null | undefined,
  fallbackId: string,
): PackagingMovementRecord => ({
  id: movement?.id?.trim() || fallbackId,
  movementType: movement?.movementType === "baja" ? "baja" : "alta",
  packagingType: normalizePackagingText(
    movement?.packagingType ?? "BOLSON DE 1000 KG",
  ),
  packagingCondition: normalizePackagingText(
    movement?.packagingCondition ?? "USADO",
  ),
  quantity: Math.max(0, Number(movement?.quantity ?? 0)),
});

const packagingTypeLabelMap: Record<string, { singular: string; plural: string }> = {
  GRANEL: { singular: "granel", plural: "granel" },
  "BOLSA 25 KG": { singular: "bolsa de 25 kg", plural: "bolsas de 25 kg" },
  "BOLSA 50 KG": { singular: "bolsa de 50 kg", plural: "bolsas de 50 kg" },
  "BOLSON DE 1000 KG": { singular: "bolson de 1000 kg", plural: "bolsones de 1000 kg" },
  OTROS: { singular: "envase", plural: "envases" },
};

const packagingConditionLabelMap: Record<string, string> = {
  NUEVO: "nuevos",
  USADO: "usados",
  VIEJO: "viejos",
};

// Resumen
const formatSinglePackagingSummary = (movement: PackagingMovementRecord) => {
  const typeLabel =
    packagingTypeLabelMap[movement.packagingType] ?? packagingTypeLabelMap.OTROS;
  const conditionLabel =
    packagingConditionLabelMap[movement.packagingCondition] ?? "sin estado";
  const quantityLabel =
    movement.quantity === 1 ? typeLabel.singular : typeLabel.plural;
  const prefix = movement.movementType === "baja" ? "-" : "";

  return `${prefix}${movement.quantity} ${quantityLabel} ${conditionLabel}`;
};

export const formatPackagingSummary = (
  movements: PackagingMovementRecord[] | null | undefined,
) => {
  const safeMovements = (movements ?? []).filter(
    (movement) => movement.quantity > 0 && movement.packagingType,
  );

  if (!safeMovements.length) {
    return "Sin envases";
  }

  return safeMovements.map(formatSinglePackagingSummary).join(" | ");
};
