// Неблокирующие счётчики производительности (in-memory, без внешних сервисов)
const counters: Record<string, number> = Object.create(null);

export function perfInc(name: string, delta = 1) {
  counters[name] = (counters[name] || 0) + delta;
}

export function perfGet(name: string): number {
  return counters[name] || 0;
}

export function perfReset(names?: string[]) {
  if (!names) {
    for (const k of Object.keys(counters)) delete counters[k];
    return;
  }
  for (const k of names) delete counters[k];
}

// Для юнит‑тестов: единым объектом
export function perfSnapshot() {
  return { ...counters };
}

const perfExports = { perfInc, perfGet, perfReset, perfSnapshot };

export default perfExports;
