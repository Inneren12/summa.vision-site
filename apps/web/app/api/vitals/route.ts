import { NextResponse } from "next/server";

type VitalsPayload = {
  type?: string;
  value?: unknown;
  rating?: unknown;
  navigationType?: unknown;
  url?: unknown;
};

export async function POST(request: Request) {
  try {
    const data = (await request.json().catch(() => null)) as VitalsPayload | null;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // TODO: заменить на ваш логер/ингестер
    console.log("[vitals]", data);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
