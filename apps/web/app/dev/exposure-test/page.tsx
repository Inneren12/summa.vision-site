import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  const jar = cookies();
  jar.set({
    name: "sv_exposure_mark",
    value: "betaUI",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
  });

  return (
    <main className="p-6 space-y-3">
      <div data-testid="exp-a">exp-a</div>
      <div data-testid="exp-b">exp-b</div>
      <div data-testid="exp-c">exp-c</div>
    </main>
  );
}
