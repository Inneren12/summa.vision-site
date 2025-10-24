/** Constant-time string compare to mitigate timing attacks on tokens. */
export function tscmp(a?: string | null, b?: string | null): boolean {
  const A = a ?? "";
  const B = b ?? "";
  if (A.length !== B.length) return false;
  let r = 0;
  for (let i = 0; i < A.length; i++) {
    r |= A.charCodeAt(i) ^ B.charCodeAt(i);
  }
  return r === 0;
}
