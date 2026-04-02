export type RelationalFieldConfig<T> = {
  getValues: (item: T) => string[];
  matches: (item: T, value: string) => boolean;
};

const getFields = <K extends string>(fields: Record<K, unknown>) =>
  Object.keys(fields) as K[];

const uniqueSorted = (values: string[]) =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));

export const getRelationalOptions = <T, K extends string>(
  items: T[],
  filters: Record<K, string>,
  field: K,
  fieldConfigs: Record<K, RelationalFieldConfig<T>>,
  baseMatch?: (item: T) => boolean,
) => {
  const fields = getFields(fieldConfigs);

  return uniqueSorted(
    items
      .filter((item) => {
        if (baseMatch && !baseMatch(item)) {
          return false;
        }

        return fields.every((key) => {
          if (key === field) {
            return true;
          }

          const selectedValue = filters[key];
          return !selectedValue || fieldConfigs[key].matches(item, selectedValue);
        });
      })
      .flatMap((item) => fieldConfigs[field].getValues(item)),
  );
};

export const clearInvalidRelationalSelections = <T, K extends string>(
  items: T[],
  filters: Record<K, string>,
  fieldConfigs: Record<K, RelationalFieldConfig<T>>,
  baseMatch?: (item: T) => boolean,
) => {
  const nextFilters = { ...filters };
  let hasChanges = false;

  for (const field of getFields(fieldConfigs)) {
    const selectedValue = nextFilters[field];

    if (!selectedValue) {
      continue;
    }

    const options = getRelationalOptions(
      items,
      nextFilters,
      field,
      fieldConfigs,
      baseMatch,
    );

    if (!options.includes(selectedValue)) {
      nextFilters[field] = "";
      hasChanges = true;
    }
  }

  return hasChanges ? nextFilters : filters;
};

export const areStringFiltersEqual = <T extends Record<string, string>>(
  left: T,
  right: T,
) =>
  (Object.keys(left) as Array<keyof T>).every((key) => left[key] === right[key]);
