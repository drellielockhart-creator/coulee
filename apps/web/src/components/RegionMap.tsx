import { useEffect, useRef, useState } from 'react';
import { ago, num } from '../lib/format.ts';
import {
  fitRegion,
  type MapCamera,
  type Point,
  type RegionMapData,
  roadPosition,
  zoomRegion,
} from '../lib/regionMap.ts';

/** Geography is already knowledge-filtered in the worker's fair observation. */
export function RegionMap({
  map,
  name,
  destinations,
  busy,
  onDestination,
}: {
  map: RegionMapData;
  name: string;
  destinations: readonly string[];
  busy: boolean;
  onDestination: (nodeId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 390, height: 500 });
  const [camera, setCamera] = useState<MapCamera>(() => fitRegion(map.sites, 390, 500));
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: Point; nodeId: string | null; moved: boolean } | null>(null);
  const sites = useRef(map.sites);
  sites.current = map.sites;
  const sitesKey = map.sites.map((n) => `${n.id}:${n.x}:${n.y}`).join('|');
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (sitesKey) setCamera(fitRegion(sites.current, size.width, size.height));
  }, [size.width, size.height, sitesKey]);
  const screen = (p: Point) => ({ x: camera.x + p.x * camera.scale, y: camera.y + p.y * camera.scale });
  const position = roadPosition(map);
  const toward = map.sites.find((n) => n.id === map.position?.towardNodeId);
  const local = (e: { clientX: number; clientY: number }): Point => {
    const rect = host.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };
  const zoom = (factor: number) =>
    setCamera((c) => zoomRegion(c, factor, { x: size.width / 2, y: size.height * 0.38 }));
  return (
    <section className="site-map region-map" aria-label={`${name} region view`} data-testid="region-map">
      <div
        className="region-surface"
        ref={host}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const p = local(e);
          pointers.current.set(e.pointerId, p);
          const button = (e.target as Element).closest<HTMLElement>('[data-region-node]');
          if (pointers.current.size === 1)
            gesture.current = { start: p, nodeId: button?.dataset.regionNode ?? null, moved: false };
          else if (gesture.current) gesture.current.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const before = pointers.current.get(e.pointerId);
          if (!before) return;
          const after = local(e);
          const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
          if (gesture.current && Math.hypot(after.x - gesture.current.start.x, after.y - gesture.current.start.y) > 6)
            gesture.current.moved = true;
          pointers.current.set(e.pointerId, after);
          if (!gesture.current?.moved) return;
          if (other) {
            const oldDistance = Math.hypot(before.x - other.x, before.y - other.y);
            const newDistance = Math.hypot(after.x - other.x, after.y - other.y);
            const oldCenter = { x: (before.x + other.x) / 2, y: (before.y + other.y) / 2 };
            const newCenter = { x: (after.x + other.x) / 2, y: (after.y + other.y) / 2 };
            if (oldDistance > 0)
              setCamera((c) => {
                const z = zoomRegion(c, newDistance / oldDistance, oldCenter);
                return { ...z, x: z.x + newCenter.x - oldCenter.x, y: z.y + newCenter.y - oldCenter.y };
              });
          } else setCamera((c) => ({ ...c, x: c.x + after.x - before.x, y: c.y + after.y - before.y }));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          pointers.current.delete(e.pointerId);
          if (!pointers.current.size) {
            gesture.current = null;
            if (g && !g.moved && g.nodeId && destinations.includes(g.nodeId) && !busy) onDestination(g.nodeId);
          }
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          gesture.current = null;
        }}
        onLostPointerCapture={(e) => {
          pointers.current.delete(e.pointerId);
          if (!pointers.current.size) gesture.current = null;
        }}
        onWheel={(e) => {
          setCamera((c) => zoomRegion(c, Math.exp(-e.deltaY * 0.002), local(e)));
        }}
      >
        <svg width="100%" height="100%" role="img" aria-label="Known sites and roads">
          <title>Known sites and roads</title>
          <defs>
            <marker
              id="region-direction"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {map.roads.map((road) => {
            const a = map.sites.find((n) => n.id === road.a),
              b = map.sites.find((n) => n.id === road.b);
            if (!a || !b) return null;
            const from = screen(a),
              to = screen(b);
            return (
              <g key={road.id}>
                <line className="region-road" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <text
                  className="region-road-name"
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 + 46}
                  textAnchor="middle"
                >
                  {road.name}
                </text>
              </g>
            );
          })}
          {position
            ? (() => {
                const p = screen(position),
                  from = screen(position.from),
                  to = screen(position.to);
                const length = Math.hypot(to.x - p.x, to.y - p.y);
                const ahead = Math.min(32, length) / Math.max(1, length);
                return (
                  <g
                    className="region-traveler"
                    data-testid="region-position"
                    data-progress={map.position?.progressPermille}
                  >
                    <line className="region-progress" x1={from.x} y1={from.y} x2={p.x} y2={p.y} />
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x + (to.x - p.x) * ahead}
                      y2={p.y + (to.y - p.y) * ahead}
                      stroke="currentColor"
                      strokeWidth="3"
                      markerEnd="url(#region-direction)"
                    />
                    <circle cx={p.x} cy={p.y} r="8" fill="currentColor" />
                    <text x={p.x} y={p.y - 24} textAnchor="middle">
                      You
                    </text>
                  </g>
                );
              })()
            : null}
        </svg>
        {map.sites.map((node) => {
          const p = screen(node);
          return (
            <button
              key={node.id}
              type="button"
              className={`region-node${map.currentNodeId === node.id ? ' current' : ''}`}
              style={{ left: p.x, top: p.y }}
              data-region-node={node.id}
              aria-label={destinations.includes(node.id) ? `Route to ${node.name}` : node.name}
              aria-current={map.currentNodeId === node.id ? 'location' : undefined}
              aria-disabled={busy || !destinations.includes(node.id)}
              onClick={(e) => {
                if (e.detail === 0 && !busy && destinations.includes(node.id)) onDestination(node.id);
              }}
            >
              {node.name}
              {map.currentNodeId === node.id ? <small>You are here</small> : null}
            </button>
          );
        })}
      </div>
      <p className="region-caption">Known roads · schematic, not to scale</p>
      {!map.sites.length ? <p className="region-empty">No regional geography is known yet.</p> : null}
      {map.position ? (
        <p className="region-status" role="status">
          {map.position.status} toward {toward?.name ?? 'the next site'} ·{' '}
          {Math.floor(map.position.progressPermille / 10)}% of this road
          <br />
          {num(map.position.feet)} / {num(map.position.distanceFt)} ft
        </p>
      ) : null}
      {map.reports.length ? (
        <details className="region-reports">
          <summary>Dated reports</summary>
          {map.reports.map((r) => (
            <p key={`${r.nodeId}:${r.at}:${r.text}`}>
              {r.text} · reported {ago(map.observedAt - r.at)}
            </p>
          ))}
        </details>
      ) : null}
      <fieldset className="map-tools" aria-label="Region camera controls">
        <button type="button" onClick={() => setCamera(fitRegion(map.sites, size.width, size.height))}>
          Fit
        </button>
        <button type="button" aria-label="Zoom region in" onClick={() => zoom(1.3)}>
          +
        </button>
        <button type="button" aria-label="Zoom region out" onClick={() => zoom(1 / 1.3)}>
          −
        </button>
      </fieldset>
    </section>
  );
}
