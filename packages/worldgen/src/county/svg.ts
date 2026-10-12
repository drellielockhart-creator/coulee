import type { GeneratedCounty } from './types.ts';

const xmlEscape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
/** Self-contained SVG; click the legend to toggle groups in a browser. No runtime host dependency. */
export function renderCountySvg(c: GeneratedCounty): string {
  const w = c.recipe.size.width,
    h = c.recipe.size.height,
    scale = 7;
  const xy = (id: number) => `${(id % w) * scale + scale / 2},${Math.floor(id / w) * scale + scale / 2}`;
  const rect = (id: number, fill: string, extra = '') =>
    `<rect x="${(id % w) * scale}" y="${Math.floor(id / w) * scale}" width="${scale}" height="${scale}" fill="${fill}" ${extra}/>`;
  const palette = {
    goat_prairie: '#bead68',
    maple_basswood: '#547b52',
    oak_savanna: '#a7b67a',
    floodplain_forest: '#3d796e',
    oak_woodland: '#829765',
  };
  // Quantized elevation and vegetation are merged into same-color horizontal runs.
  const raster = (colors: string[]) => {
    const paths = new Map<string, string[]>();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; ) {
        const color = colors[y * w + x] as string,
          start = x;
        while (x < w && colors[y * w + x] === color) x++;
        if (!color) continue;
        if (!paths.has(color)) paths.set(color, []);
        paths
          .get(color)
          ?.push(`M${start * scale},${y * scale}h${(x - start) * scale}v${scale}h-${(x - start) * scale}z`);
      }
    return [...paths].map(([color, path]) => `<path fill="${color}" d="${path.join('')}"/>`).join('');
  };
  // Reserve settlement labels first, then fit important geographic labels into
  // free space. Boxes make the static PNG readable as well as the interactive SVG.
  const occupied: Array<{ x: number; y: number; width: number; height: number }> = c.settlements.map((s) => {
    const x = (s.cell % w) * scale + scale / 2,
      y = Math.floor(s.cell / w) * scale + scale / 2;
    const width = s.name.length * (s.kind === 'farm' ? 5 : 6) + 10;
    return { x: x > w * scale - 140 ? x - width : x, y: y - 10, width, height: 14 };
  });
  const geographicLabels: string[] = [];
  const featureLabels = [...(c.namedFeatures ?? [])]
    .filter((f) => f.major)
    .sort(
      (a, b) =>
        (a.kind === 'valley' ? 1 : 0) - (b.kind === 'valley' ? 1 : 0) ||
        b.cells.length - a.cells.length ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  for (const f of featureLabels) {
    const candidates = [f.labelCell, ...f.cells.filter((_, i) => i % 4 === 0)];
    for (const cell of candidates) {
      const x = (cell % w) * scale + 6,
        y = Math.floor(cell / w) * scale - 3;
      const box = { x, y: y - 9, width: f.name.length * 5 + 4, height: 13 };
      if (
        box.x + box.width > w * scale ||
        box.y < 0 ||
        occupied.some(
          (b) =>
            box.x < b.x + b.width + 4 &&
            box.x + box.width + 4 > b.x &&
            box.y < b.y + b.height + 4 &&
            box.y + box.height + 4 > b.y,
        )
      )
        continue;
      occupied.push(box);
      geographicLabels.push(
        `<text x="${x}" y="${y}" font-family="serif" font-size="10" font-style="italic" fill="${f.kind === 'creek' ? '#18527c' : '#70583e'}" paint-order="stroke" stroke="#faf5e8" stroke-width="2">${xmlEscape(f.name)}</text>`,
      );
      break;
    }
  }
  const groups: Record<string, string> = {
    elevation: raster(
      c.terrain.map((t) => {
        const v = Math.max(70, Math.min(240, Math.round((100 + (t.elevationFt - 600) / 3) / 4) * 4));
        return `rgb(${v},${v},${v})`;
      }),
    ),
    vegetation: `<g opacity="0.38">${raster(c.ecology.map((e) => palette[e.vegetation]))}</g>`,
    water: c.hydrology
      .map((v) => {
        const [x, y] = xy(v.cell).split(',');
        const channel =
          v.kind === 'river'
            ? rect(v.cell, '#18527c')
            : v.kind === 'creek' && v.downstream !== null
              ? `<polyline points="${xy(v.cell)} ${xy(v.downstream)}" fill="none" stroke="#438ead" stroke-width="${0.6 + v.order / 4}"/>`
              : '';
        return channel + (v.spring ? `<circle cx="${x}" cy="${y}" r="1" fill="#70cad8"/>` : '');
      })
      .join(''),
    bluffs: c.terrain
      .filter((t) => t.bluff)
      .map(
        (t) =>
          `<path d="M${t.x * scale + 2},${t.y * scale + 2}l${['N', 'S'].includes(t.aspect) ? 3 : 1},${['E', 'W'].includes(t.aspect) ? 3 : 1}" stroke="#75604e" stroke-width="1"/>`,
      )
      .join(''),
    fae: [2, 3, 4, 5]
      .map((fi) => `<g opacity="${fi / 10}">${raster(c.fae.intensity.map((v) => (v === fi ? '#ac3ea9' : '')))}</g>`)
      .join(''),
    roads: c.graph.edges
      .filter((e) => e.kind !== 'fae_path')
      .map(
        (e) =>
          `<polyline points="${e.cells.map(xy).join(' ')}" fill="none" stroke="${e.kind === 'river' ? '#082c54' : e.kind === 'ridge_road' ? '#803b20' : '#ece0aa'}" stroke-width="1.8"/>`,
      )
      .join(''),
    settlements: c.settlements
      .map((s) => {
        const [x, y] = xy(s.cell).split(',');
        const left = Number(x) > w * scale - 140;
        return `<circle cx="${x}" cy="${y}" r="4" fill="#202027"/><text x="${Number(x) + (left ? -6 : 6)}" y="${y}" text-anchor="${left ? 'end' : 'start'}" font-size="${s.kind === 'farm' ? 9 : 11}" paint-order="stroke" stroke="white" stroke-width="2">${xmlEscape(s.name)}</text>`;
      })
      .join(''),
    geography: geographicLabels.join(''),
    protected: c.terrain
      .filter((t) => t.protected)
      .map((t) => rect(t.id, 'none', 'stroke="#e52e2e" stroke-width="2"'))
      .join(''),
  };
  const keys = Object.keys(groups);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * scale + 170} ${h * scale}" role="img"><title>County seed ${c.recipe.seed}; 40-acre cells; north up</title><rect width="100%" height="100%" fill="#faf5e8"/>${keys.map((k) => `<g id="${k}"${k === 'fae' ? ' style="display:none"' : ''}>${groups[k]}</g>`).join('')}<g font-family="sans-serif" font-size="12"><text x="${w * scale + 10}" y="20">Seed ${c.recipe.seed} · ${c.recipe.preset}</text><text x="${w * scale + 10}" y="40">Click layers to toggle</text>${keys.map((k, i) => `<text x="${w * scale + 10}" y="${65 + i * 25}" style="cursor:pointer" onclick="var g=document.getElementById('${k}');g.style.display=g.style.display==='none'?'inline':'none'">${k}</text>`).join('')}<text x="${w * scale + 10}" y="290">N ↑ · cell = ¼ mile</text></g></svg>`;
}
