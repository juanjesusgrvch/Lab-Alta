const parseDateOnlyValue = (value: string) => {
  const trimmedValue = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, monthIndex, day, 12));

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== monthIndex ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
};

// Fechas
export const formatDate = (value: string) => {
  const parsedDate = parseDateOnlyValue(value);

  if (!parsedDate) {
    return value.trim() || "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
};

// Numeros
export const formatInteger = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);

export const formatDecimal = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

export const formatCompactDecimal = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);

export const formatKg = (value: number) => `${formatInteger(value)} kg`;

export const formatGrams = (value: number) =>
  `${formatCompactDecimal(Number.isFinite(value) ? value : 0, 2)} gr`;

export const formatHundredths = (value: number) =>
  `${formatInteger(Math.round(Number.isFinite(value) ? value : 0))}/100g`;

export const formatPercent = (value: number) => `${formatDecimal(value)} %`;

export const getTodayInBuenosAires = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
  }).format(new Date());

// Clases
export const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");
