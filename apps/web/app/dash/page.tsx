import nextDynamic from "next/dynamic";

import DashLayout from "@/components/dash/DashLayout";
import DataTable from "@/components/dash/DataTable";
import FilterPanel from "@/components/dash/FilterPanel";
import VizWidget from "@/components/dash/VizWidget";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DashE2EProbe = nextDynamic(() => import("./_components/DashE2EProbe"), { ssr: false });

export default function DashPage() {
  return (
    <DashLayout
      title="Дашборд"
      description="Интерактивная сводка ключевых метрик"
      filters={<FilterPanel />}
    >
      <DashE2EProbe />
      <section aria-label="Визуализации" className="grid gap-4 md:grid-cols-2">
        <VizWidget title="График A" />
        <VizWidget title="График B" />
      </section>
      <DataTable />
    </DashLayout>
  );
}
