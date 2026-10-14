/** Predeclared slice 2f promotion bands. Kept shared between small and whole-town controls. */
export interface DormantMetrics {
  population: number;
  deaths: number;
  cash: number;
  pantry: number;
  grudges: number;
}
export function dormantFidelityGate(initial: DormantMetrics, t2: DormantMetrics, t3: DormantMetrics) {
  const bands: DormantMetrics = {
    population: Math.max(1, initial.population * 0.05),
    deaths: Math.max(1, initial.population * 0.02),
    cash: initial.cash * 0.25,
    pantry: initial.pantry * 0.25,
    grudges: Math.max(1, t2.grudges * 0.2),
  };
  const metrics = (Object.keys(bands) as Array<keyof DormantMetrics>).map((metric) => {
    const gap = Math.abs(t2[metric] - t3[metric]);
    return { metric, band: bands[metric], gap, pass: gap <= bands[metric] };
  });
  return { pass: metrics.every((m) => m.pass), metrics };
}
