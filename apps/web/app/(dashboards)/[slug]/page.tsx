import E2ESelectFallback from "../_components/E2ESelectFallback";

import DashLayout from "@/components/dash/DashLayout";
import FilterPanel from "@/components/dash/FilterPanel";

interface DashboardPageProps {
  params: {
    slug: string;
  };
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const title = `Дашборд: ${decodeURIComponent(params.slug)}`;

  return (
    <DashLayout title={title} filters={<FilterPanel />}>
      <E2ESelectFallback />
      <section aria-label="Визуализации" className="grid gap-4 md:grid-cols-2">
        <VizWidget title="График A" />
        <VizWidget title="График B" />
      </section>
      <DataTable />
    </DashLayout>
  );
}

function VizWidget({ title }: { title: string }) {
  const safeId = `viz-${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  }`;
  return (
    <article
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
      aria-labelledby={safeId}
      role="region"
    >
      <h2 id={safeId} className="text-lg font-semibold text-neutral-900">
        {title}
      </h2>
      <p className="text-sm text-neutral-600">
        Данные появятся здесь. Используйте фильтры слева, чтобы уточнить визуализацию.
      </p>
      <div className="flex h-40 items-center justify-center rounded bg-neutral-100 text-sm text-neutral-500">
        Заглушка графика
      </div>
    </article>
  );
}

function DataTable() {
  return (
    <section
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
      aria-labelledby="dash-table-title"
    >
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <h2 id="dash-table-title" className="text-base font-semibold text-neutral-900">
          Таблица данных
        </h2>
        <p className="text-xs text-neutral-600">
          Табличные значения синхронизируются с выбранными фильтрами и обновятся автоматически.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th scope="col" className="px-4 py-2">
                Показатель
              </th>
              <th scope="col" className="px-4 py-2">
                Значение
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            <tr>
              <th scope="row" className="px-4 py-2 font-medium text-neutral-800">
                Placeholder
              </th>
              <td className="px-4 py-2 text-neutral-700">0</td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2 font-medium text-neutral-800">
                Placeholder 2
              </th>
              <td className="px-4 py-2 text-neutral-700">0</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
