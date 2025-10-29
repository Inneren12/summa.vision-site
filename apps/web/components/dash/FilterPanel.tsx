"use client";

import { useId } from "react";

import {
  DASH_RANGE_DEFAULT,
  DASH_RANGE_LIMITS,
  createDefaultDashState,
  useDashState,
} from "@/lib/dash/useDashState";

const COUNTRY_OPTIONS = [
  { value: "", label: "Все страны" },
  { value: "CA", label: "Канада" },
  { value: "US", label: "США" },
  { value: "MX", label: "Мексика" },
];

const SECTOR_OPTIONS = [
  { value: "energy", label: "Энергетика" },
  { value: "transport", label: "Транспорт" },
  { value: "finance", label: "Финансы" },
  { value: "agriculture", label: "Агро" },
];

const RANGE_MIN = DASH_RANGE_LIMITS.min;
const RANGE_MAX = DASH_RANGE_LIMITS.max;

const clampRangeValue = (value: number) => Math.min(Math.max(value, RANGE_MIN), RANGE_MAX);

export default function FilterPanel() {
  const multiHintId = useId();
  const rangeHintId = useId();
  const { state, setState } = useDashState();

  const [rawStart, rawEnd] = state.range ?? DASH_RANGE_DEFAULT;
  const rangeStart = clampRangeValue(rawStart);
  const rangeEnd = clampRangeValue(rawEnd);

  return (
    <form
      aria-label="Фильтры дашборда"
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="dash-filter-country">
          Страна
        </label>
        <select
          id="dash-filter-country"
          aria-controls="dash-main"
          className="w-full rounded border border-neutral-300 bg-white p-2 text-sm"
          value={state.country ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            setState((prev) => ({
              ...prev,
              country: value || undefined,
            }));
          }}
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="dash-filter-sectors">
          Сектора
        </label>
        <select
          id="dash-filter-sectors"
          multiple
          size={Math.min(SECTOR_OPTIONS.length, 5)}
          aria-describedby={multiHintId}
          aria-controls="dash-main"
          className="w-full rounded border border-neutral-300 bg-white p-2 text-sm"
          value={state.sectors}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
            setState((prev) => ({
              ...prev,
              sectors: selected,
            }));
          }}
        >
          {SECTOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p id={multiHintId} className="text-xs text-neutral-500">
          Используйте Ctrl/Cmd или Shift для выбора нескольких значений.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="dash-filter-date">
          Дата обновления
        </label>
        <input
          id="dash-filter-date"
          aria-controls="dash-main"
          type="date"
          className="w-full rounded border border-neutral-300 p-2 text-sm"
          value={state.date ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            setState((prev) => ({
              ...prev,
              date: value || undefined,
            }));
          }}
        />
      </div>

      <fieldset aria-describedby={rangeHintId} className="space-y-2">
        <legend className="text-sm font-medium">Диапазон лет</legend>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs" htmlFor="dash-filter-range-start">
            <span className="font-semibold text-neutral-700">Начало</span>
            <input
              id="dash-filter-range-start"
              aria-controls="dash-main"
              type="range"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={1}
              value={rangeStart}
              onChange={(event) => {
                const value = clampRangeValue(Number.parseInt(event.target.value, 10));
                setState((prev) => {
                  const [, endRaw] = prev.range ?? DASH_RANGE_DEFAULT;
                  const end = clampRangeValue(endRaw);
                  return {
                    ...prev,
                    range: [Math.min(value, end), Math.max(value, end)] as [number, number],
                  };
                });
              }}
            />
            <span aria-live="polite" className="text-neutral-600">
              {rangeStart}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs" htmlFor="dash-filter-range-end">
            <span className="font-semibold text-neutral-700">Конец</span>
            <input
              id="dash-filter-range-end"
              aria-controls="dash-main"
              type="range"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={1}
              value={rangeEnd}
              onChange={(event) => {
                const value = clampRangeValue(Number.parseInt(event.target.value, 10));
                setState((prev) => {
                  const [startRaw] = prev.range ?? DASH_RANGE_DEFAULT;
                  const start = clampRangeValue(startRaw);
                  return {
                    ...prev,
                    range: [Math.min(start, value), Math.max(start, value)] as [number, number],
                  };
                });
              }}
            />
            <span aria-live="polite" className="text-neutral-600">
              {rangeEnd}
            </span>
          </label>
        </div>
        <p id={rangeHintId} className="text-xs text-neutral-500">
          Подберите диапазон годов. Значения по умолчанию: {DASH_RANGE_DEFAULT[0]}–
          {DASH_RANGE_DEFAULT[1]}.
        </p>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="button"
          aria-label="Сбросить фильтры"
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          onClick={() => setState(createDefaultDashState())}
        >
          Сбросить
        </button>
      </div>
    </form>
  );
}
