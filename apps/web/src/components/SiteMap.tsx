import { useEffect, useRef } from 'react';
import { SPEEDS, type Speed } from '../protocol.ts';
import { SiteRenderer } from '../scene/SiteRenderer.ts';
import { useUi } from '../state/ui.ts';
import { useVm } from './ctx.ts';

export function SiteMap({ speed }: { speed: Speed }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<SiteRenderer | null>(null);
  const vm = useVm();
  const selectedActor = useUi((s) => s.selectedActor);
  const selectedPlace = useUi((s) => s.selectedPlace);
  useEffect(() => {
    if (!host.current) return;
    const r = new SiteRenderer(host.current);
    renderer.current = r;
    r.onPick = (hit) => {
      if (hit?.kind === 'actor') useUi.getState().selectActor(hit.id);
      if (hit?.kind === 'place') useUi.getState().selectPlace(hit.id);
    };
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    if (vm.site) r.setSite(vm.site, vm.places);
    r.setTime(vm.time);
    r.setActors(
      vm.actors.map((a) => ({
        id: a.id,
        label: a.shortName,
        placeId: a.placeId,
        travelingTo: a.activity.travelingTo,
        arriveAt: a.activity.arriveAt,
        since: a.activity.since,
        isPlayer: a.isPlayer,
        child: a.age < 16,
        alive: a.alive,
      })),
      vm.time.t,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000 / ((SPEEDS[speed] || SPEEDS.x1) * 60),
    );
  }, [vm, speed]);
  useEffect(() => {
    renderer.current?.setSelection(selectedActor, selectedPlace);
  }, [selectedActor, selectedPlace]);
  return (
    <section className="site-map" aria-label="Iron Ford site view">
      <div className="site-host" ref={host} />
      <div className="map-title">
        <strong>{vm.site?.name ?? vm.scenario.name}</strong>
        <span>Survey of the settlement</span>
      </div>
      <fieldset className="map-tools" aria-label="Camera controls">
        <button type="button" aria-label="Zoom in" onClick={() => renderer.current?.zoomBy(1.3)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => renderer.current?.zoomBy(1 / 1.3)}>
          −
        </button>
        <button type="button" onClick={() => renderer.current?.frameTown()}>
          Fit
        </button>
        <button type="button" onClick={() => renderer.current?.setTilt('plan')}>
          Plan
        </button>
        <button type="button" onClick={() => renderer.current?.setTilt('survey')}>
          Survey
        </button>
        <button type="button" onClick={() => useUi.getState().open('map')}>
          Places
        </button>
      </fieldset>
    </section>
  );
}
