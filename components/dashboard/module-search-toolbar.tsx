"use client";

import { useMemo, useRef, useState } from "react";

import { Search, X } from "lucide-react";

import type { SearchSuggestion } from "@/lib/module-search";

interface ModuleSearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: SearchSuggestion[];
  placeholder: string;
  resultCount: number;
  totalCount: number;
}

export const ModuleSearchToolbar = ({
  value,
  onChange,
  suggestions,
  placeholder,
  resultCount,
  totalCount,
}: ModuleSearchToolbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, string[]>();

    suggestions.forEach((suggestion) => {
      const currentValues = groups.get(suggestion.field) ?? [];
      currentValues.push(suggestion.value);
      groups.set(suggestion.field, currentValues);
    });

    return Array.from(groups.entries());
  }, [suggestions]);
  const hasSearchValue = Boolean(value.trim());
  const showSuggestions =
    isOpen && hasSearchValue && groupedSuggestions.length > 0;
  const summaryLabel = hasSearchValue
    ? `${resultCount} coincidencia${resultCount === 1 ? "" : "s"}`
    : `${totalCount} registro${totalCount === 1 ? "" : "s"} disponibles`;

  const scheduleClose = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const cancelClose = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  return (
    <section className="module-search-toolbar">
      <div className="module-search-toolbar__field">
        <div className="module-search-toolbar__input-shell">
          <Search size={16} strokeWidth={2} />
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => {
              cancelClose();
              setIsOpen(true);
            }}
            onBlur={scheduleClose}
            placeholder={placeholder}
            aria-label={placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          {hasSearchValue ? (
            <button
              type="button"
              className="module-search-toolbar__clear"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange("")}
              aria-label="Limpiar busqueda"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {showSuggestions ? (
          <div
            className="module-search-toolbar__suggestions"
            onMouseDown={(event) => event.preventDefault()}
          >
            {groupedSuggestions.map(([field, values]) => (
              <div
                key={field}
                className="module-search-toolbar__suggestion-group"
              >
                <span className="module-search-toolbar__suggestion-label">
                  {field}
                </span>
                <div className="module-search-toolbar__suggestion-list">
                  {values.map((suggestionValue) => (
                    <button
                      key={`${field}-${suggestionValue}`}
                      type="button"
                      className="module-search-toolbar__suggestion"
                      onClick={() => {
                        onChange(suggestionValue);
                        setIsOpen(false);
                      }}
                    >
                      {suggestionValue}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <span className="module-search-toolbar__summary">{summaryLabel}</span>
    </section>
  );
};
