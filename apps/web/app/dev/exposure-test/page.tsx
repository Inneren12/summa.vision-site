import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExposureTestPage() {
  cookies().set("sv_exposure_mark", "identical-gate", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return (
    <main className="p-6 space-y-3">
      <div data-testid="exp-a">exp-a</div>
      <div data-testid="exp-b">exp-b</div>
      <div data-testid="exp-c">exp-c</div>
    </main>
  );
}
