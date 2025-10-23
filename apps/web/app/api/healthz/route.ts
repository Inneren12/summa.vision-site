export const dynamic = "force-dynamic";

export async function GET() {
  const body = {
    status: "ok",
    ok: true,
    ts: new Date().toISOString(),
  };

  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
