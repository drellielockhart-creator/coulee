import type { RoutePreview } from '@coulee/play';
import { num } from '../lib/format.ts';

const markers = { ok: '✓ OK', short: '! Short', watch: '! Watch', unknown: '? Unconfirmed' } as const;
export function routeDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return [hours ? `${hours} h` : '', rest || !hours ? `${rest} min` : ''].filter(Boolean).join(' ');
}
export function routeDistance(feet: number): string {
  return `${(feet / 5280).toFixed(1)} mi · ${num(feet)} ft`;
}

export function RouteCard({
  route,
  busy,
  canGo,
  onGo,
  onCancel,
}: {
  route: RoutePreview;
  busy: boolean;
  canGo: boolean;
  onGo: () => void;
  onCancel: () => void;
}) {
  const f = route.forecast;
  const review = f.warnings.length > 0 || route.checks.some((c) => c.status !== 'ok');
  return (
    <article className="route-preview" aria-label={`Route to ${route.destination}`} data-testid="route-preview">
      <header>
        <span className="route-eyebrow">Route on foot</span>
        <h3>{route.destination}</h3>
        <p className="hint">Leaving {route.departure}</p>
      </header>
      <dl className="route-facts">
        <div>
          <dt>Distance</dt>
          <dd>{routeDistance(route.distanceFt)}</dd>
        </div>
        <div>
          <dt>Estimated duration</dt>
          <dd>{routeDuration(f.elapsedMinutes)}</dd>
        </div>
        <div className="route-arrival">
          <dt>{f.arrived ? 'Estimated arrival' : 'Arrival if the stop is resolved'}</dt>
          <dd>{route.arrival}</dd>
        </div>
      </dl>
      {f.walkingMinutes === undefined ? null : (
        <p className="hint">{routeDuration(f.walkingMinutes)} walking · estimates include hourly arrival boundaries.</p>
      )}
      <h4>Path</h4>
      <ol className="route-legs">
        {route.legs.map((leg) => (
          <li className="route-leg" key={leg.edgeId}>
            <strong>
              {leg.from} → {leg.to}
            </strong>
            <span className="route-leg-caption">
              {leg.name} · {routeDistance(leg.distanceFt)}
            </span>
          </li>
        ))}
      </ol>
      <h4>
        Readiness · {f.arrived ? (review ? 'Review before leaving' : 'OK in this projection') : 'Decision required'}
      </h4>
      {!f.arrived ? (
        <p className="warn">The supply projection stopped before arrival. Tend to the stop and preview again.</p>
      ) : null}
      <ul className="route-checks" aria-label="Trip readiness">
        {route.checks.map((check) => (
          <li key={check.id} className={`route-check ${check.status}`}>
            <div>
              <strong>{check.label}</strong>
              <span className="route-marker">{markers[check.status]}</span>
            </div>
            <p>{check.detail}</p>
          </li>
        ))}
      </ul>
      <p className="route-weather">
        <strong>Departure weather:</strong> {route.weather.temperatureF}°F, {route.weather.raining ? 'rain' : 'dry'}.
        Departure weather is assumed along the route.
      </p>
      {f.warnings.length ? (
        <ul className="route-warnings">
          {f.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <details className="route-details">
        <summary>Provisions & forecast limits</summary>
        <p>
          {num(f.kcal)} kcal eaten · protein {f.proteinG} g · fat {f.fatG} g · fresh {f.freshPoints} · fuel used{' '}
          {f.fuelUsed}
        </p>
        <ul>
          {f.foods.map((food, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the forecast can include several stacks of the same food
            <li key={`${food.id}:${i}`}>
              {food.name}: {food.servingsPm / 1000} servings used, {food.remainingPm / 1000} left; spoilage{' '}
              {food.spoilage}/1000.
            </li>
          ))}
        </ul>
        <p>Projected rest: {f.needs.rest ?? '?'}/1000.</p>
        {[...(f.risks ?? []), ...f.uncertainty].map((line) => (
          <p key={line}>{line}</p>
        ))}
      </details>
      {!canGo ? (
        <p className="warn">Departure is unavailable. Review your load and the route's crossing or hazard limits.</p>
      ) : null}
      <div className="route-actions">
        <button type="button" className="route-action primary" disabled={busy || !canGo} onClick={onGo}>
          Go to {route.destination}
        </button>
        <button type="button" className="route-action" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </article>
  );
}
