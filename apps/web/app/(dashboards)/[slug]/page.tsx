import DashLayout from "@/components/dash/DashLayout";
import DataTable from "@/components/dash/DataTable";
import VizWidget from "@/components/dash/VizWidget";

export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
  return (
    <DashLayout title={`Дашборд: ${slug}`}>
      <VizWidget title="График A" />
      <VizWidget title="График B" />
      <DataTable />
    </DashLayout>
  );
}
