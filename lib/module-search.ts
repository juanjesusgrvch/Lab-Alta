export type SearchFieldConfig<T> = {
  label: string;
  getValues: (item: T) => Array<string | number | null | undefined>;
};

export type SearchSuggestion = {
  field: string;
  value: string;
};

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizeSearchValue = (value: string) =>
  stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim();

const getSearchTokens = (value: string) =>
  normalizeSearchValue(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

const getIndexedTokens = (value: string) => {
  const normalizedValue = normalizeSearchValue(value);

  return normalizedValue
    ? Array.from(new Set([normalizedValue, ...getSearchTokens(normalizedValue)]))
    : [];
};

const matchesQueryTokens = (queryTokens: string[], value: string) => {
  if (!queryTokens.length) {
    return true;
  }

  const indexedTokens = getIndexedTokens(value);

  return queryTokens.every((queryToken) =>
    indexedTokens.some((token) => token.startsWith(queryToken)),
  );
};

export const matchesSearchTerm = <T>(
  item: T,
  term: string,
  fieldConfigs: Record<string, SearchFieldConfig<T>>,
) => {
  const queryTokens = getSearchTokens(term);

  if (!queryTokens.length) {
    return true;
  }

  return Object.values(fieldConfigs).some((fieldConfig) =>
    fieldConfig.getValues(item).some((value) =>
      matchesQueryTokens(queryTokens, String(value ?? "")),
    ),
  );
};

export const getSearchSuggestions = <T>(
  items: T[],
  term: string,
  fieldConfigs: Record<string, SearchFieldConfig<T>>,
  limit = 12,
  limitPerField = 4,
) => {
  const queryTokens = getSearchTokens(term);

  if (!queryTokens.length) {
    return [] as SearchSuggestion[];
  }

  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();

  for (const fieldConfig of Object.values(fieldConfigs)) {
    const values = Array.from(
      new Set(
        items
          .flatMap((item) => fieldConfig.getValues(item))
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    ).sort((left, right) =>
      left.localeCompare(right, "es", { sensitivity: "base" }),
    );

    let fieldMatches = 0;

    for (const value of values) {
      if (!matchesQueryTokens(queryTokens, value)) {
        continue;
      }

      const suggestionKey = `${fieldConfig.label}::${value}`;

      if (seen.has(suggestionKey)) {
        continue;
      }

      suggestions.push({
        field: fieldConfig.label,
        value,
      });
      seen.add(suggestionKey);
      fieldMatches += 1;

      if (fieldMatches >= limitPerField || suggestions.length >= limit) {
        break;
      }
    }

    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
};

