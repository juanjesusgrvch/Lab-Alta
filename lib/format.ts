export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

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

export const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");
