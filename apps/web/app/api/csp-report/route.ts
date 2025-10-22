export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.warn("[CSP-REPORT]", body);
  } catch {
    // swallow JSON parsing issues
  }

  return new Response(null, { status: 204 });
}
