import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") {
    notFound();
  }
  const DevFlags = (await import("../../../components/dev/DevFlagsPage")).default; // ленивый импорт — вырежется из prod бандлов
  return <DevFlags />;
}
