import DashLayout from "@/components/dash/DashLayout";
import FilterPanel from "@/components/dash/FilterPanel";
import VizWidget from "@/components/dash/VizWidget";
import { EC_LINE_MIN, VL_BAR_MIN } from "@/components/dash/vizSpecs";

interface DashboardPageProps {
  params: {
    slug: string;
  };
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const title = `Дашборд: ${decodeURIComponent(params.slug)}`;

  const categoryData = [
    { category: "A", value: 120 },
    { category: "B", value: 98 },
    { category: "C", value: 143 },
    { category: "D", value: 76 },
  ];

  const trendData = [
    { t: "Пн", y: 34 },
    { t: "Вт", y: 48 },
    { t: "Ср", y: 51 },
    { t: "Чт", y: 45 },
    { t: "Пт", y: 62 },
    { t: "Сб", y: 39 },
    { t: "Вс", y: 28 },
  ];

  return (
    <DashLayout title={title} filters={<FilterPanel />}>
      <section aria-label="Визуализации" className="grid gap-4 md:grid-cols-2">
        <VizWidget title="Категории" lib="vega-lite" spec={VL_BAR_MIN} data={categoryData} />
        <VizWidget title="Динамика" lib="echarts" spec={EC_LINE_MIN(trendData)} />
      </section>
      <DataTable />
    </DashLayout>
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
