import dynamic from "next/dynamic";

const VegaLiteClient = dynamic(() => import("./VegaLiteClient"), { ssr: false });

export default function VegaLiteE2EPage() {
  return <VegaLiteClient />;
}
