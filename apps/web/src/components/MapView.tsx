import { useState } from 'react';
import type { Speed } from '../protocol.ts';
import { useUi } from '../state/ui.ts';
import { useSimCtx } from './ctx.ts';
import { RegionMap } from './RegionMap.tsx';
import { SiteMap } from './SiteMap.tsx';

export function MapView({ speed }: { speed: Speed }) {
  const sim = useSimCtx();
  const region = sim.play?.observation.region;
  const [chosen, setChosen] = useState<'site' | 'region' | null>(null);
  const view = region?.map ? (chosen ?? (region.location.kind === 'edge' ? 'region' : 'site')) : 'site';
  const routes = sim.play?.observation.actions.filter((a) => a.id.startsWith('route:')) ?? [];
  return (
    <div className="map-view">
      {region?.map ? (
        <nav className="map-switch" aria-label="Map view">
          <button type="button" aria-pressed={view === 'site'} onClick={() => setChosen('site')}>
            Site
          </button>
          <button type="button" aria-pressed={view === 'region'} onClick={() => setChosen('region')}>
            Region
          </button>
        </nav>
      ) : null}
      {view === 'region' && region?.map ? (
        <RegionMap
          name={region.name}
          map={region.map}
          busy={sim.busy}
          destinations={routes.map((a) => a.id.slice('route:'.length))}
          onDestination={(id) => {
            const action = routes.find((a) => a.id === `route:${id}`);
            if (!action) return;
            const ui = useUi.getState();
            ui.openAct(null);
            ui.showRoute(id, 'Reading the route…', sim.play?.observation.time.t ?? 0);
            void sim.order(action.command, action.label).then((result) => {
              if (useUi.getState().routePreview?.nodeId === id)
                useUi.getState().showRoute(id, result.text ?? result.reason ?? 'No route report available.', result.t);
            });
          }}
        />
      ) : (
        <SiteMap speed={speed} />
      )}
    </div>
  );
}
