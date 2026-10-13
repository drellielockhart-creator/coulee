import { useEffect, useMemo, useRef, useState } from 'react';
import { SPEEDS, type Speed } from '../protocol.ts';
import { type SceneActor, SiteRenderer } from '../scene/SiteRenderer.ts';
import { useUi } from '../state/ui.ts';
import { useSimCtx, useVm } from './ctx.ts';

export function SiteMap({ speed }: { speed: Speed }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<SiteRenderer | null>(null);
  const vm = useVm();
  const { actions } = useSimCtx();
  const [tools, setTools] = useState(false);
  const selectedActor = useUi((s) => s.selectedActor);
  const selectedPlace = useUi((s) => s.selectedPlace);
  // Content flags, not ids: who is asleep, and which activities keep folk at home (data over code).
  const indoorsOf = useMemo(() => {
    const m = new Map<string, 'asleep' | 'home'>();
    for (const a of actions.activities) {
      if (a.asleep) m.set(a.id, 'asleep');
      else if (a.at === 'home') m.set(a.id, 'home');
    }
    return m;
  }, [actions.activities]);
  useEffect(() => {
    if (!host.current) return;
    const r = new SiteRenderer(host.current);
    renderer.current = r;
    r.onPick = (hit) => {
      // A tap on the map opens the peek card first (11 §2.3); the sheet grows from there.
      if (hit?.kind === 'actor') useUi.getState().selectActor(hit.id, { fromMap: true });
      if (hit?.kind === 'place') useUi.getState().selectPlace(hit.id);
      if (hit?.kind === 'stack') useUi.getState().chooseFrom(hit.ids);
    };
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, []);
  const { site, places, actors, time } = vm;
  useEffect(() => {
    const r = renderer.current;
    if (r && site) r.setSite(site, places);
  }, [site, places]);
  useEffect(() => {
    renderer.current?.setTime(time);
  }, [time]);
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    r.setActors(
      actors.map(
        (a): SceneActor => ({
          id: a.id,
          label: a.shortName,
          placeId: a.placeId,
          travelingTo: a.activity.travelingTo,
          arriveAt: a.activity.arriveAt,
          since: a.activity.since,
          isPlayer: a.isPlayer,
          child: a.age < 16,
          alive: a.alive,
          indoors:
            a.activity.travelingTo === null && a.activity.activityId !== null
              ? (indoorsOf.get(a.activity.activityId) ?? null)
              : null,
        }),
      ),
      time.t,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000 / ((SPEEDS[speed] || SPEEDS.x1) * 60),
    );
  }, [actors, time.t, speed, indoorsOf]);
  useEffect(() => {
    renderer.current?.setSelection(selectedActor, selectedPlace);
  }, [selectedActor, selectedPlace]);
  return (
    <section className="site-map" aria-label={`${site?.name ?? vm.scenario.name} site view`}>
      <div className="site-host" ref={host} hidden={!site} />
      {!site ? <p role="status">On the road. Open Act for your route, supplies, and Stop or Camp.</p> : null}
      <fieldset className="map-tools" aria-label="Camera controls" hidden={!site}>
        <button type="button" onClick={() => renderer.current?.frameTown()}>
          Fit
        </button>
        <button
          type="button"
          aria-label="More camera controls"
          aria-expanded={tools}
          onClick={() => setTools((t) => !t)}
        >
          ⋯
        </button>
        {tools ? (
          <>
            <button type="button" aria-label="Zoom in" onClick={() => renderer.current?.zoomBy(1.3)}>
              +
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => renderer.current?.zoomBy(1 / 1.3)}>
              −
            </button>
            <button type="button" onClick={() => renderer.current?.setTilt('plan')}>
              Plan
            </button>
            <button type="button" onClick={() => renderer.current?.setTilt('survey')}>
              Survey
            </button>
          </>
        ) : null}
      </fieldset>
    </section>
  );
}
