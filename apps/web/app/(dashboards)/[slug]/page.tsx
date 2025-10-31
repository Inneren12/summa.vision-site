"use client";

import { useMemo } from "react";

import DashLayout from "@/components/dash/DashLayout";
import DataTable from "@/components/dash/DataTable";
import VizWidget from "@/components/dash/VizWidget";
import { useDashDataset } from "@/lib/dash/data";
import { useDashState } from "@/lib/dash/useDashState";

const COUNTRY_OPTIONS = [
  { value: "", label: "Все страны" },
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
];

export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { state, setFilters } = useDashState();
  const { dataset, isLoading } = useDashDataset(slug, state.filters);

  const countryValue = useMemo(() => {
    const raw = state.filters?.country;
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  }, [state.filters]);

  const filters = (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Страна</span>
        <select
          value={countryValue}
          onChange={(event) => {
            const next = event.target.value;
            setFilters((prev) => {
              const draft = { ...prev };
              if (next) {
                draft.country = next;
              } else {
                delete draft.country;
              }
              return draft;
            });
          }}
          className="rounded border px-2 py-1"
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="text-xs text-gray-500">Всего историй: {dataset?.items.length ?? 0}</div>
    </div>
  );

  const storyList = dataset?.items ?? [];

  return (
    <DashLayout title={`Дашборд: ${slug}`} filters={filters}>
      <VizWidget title="График A">
        <div className="text-sm text-gray-600">
          {isLoading && <span>Загрузка данных…</span>}
          {!isLoading && storyList.length === 0 && <span>Данные не найдены.</span>}
          {!isLoading && storyList.length > 0 && (
            <ul className="list-disc pl-5">
              {storyList.map((story) => (
                <li key={story.slug}>
                  <span className="font-medium">{story.title}</span>
                  <span className="text-gray-500"> · {story.country ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </VizWidget>
      <VizWidget title="График B" />
      <DataTable />
    </DashLayout>
  );
}
