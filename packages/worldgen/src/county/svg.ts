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
    protected: c.terrain
      .filter((t) => t.protected)
      .map((t) => rect(t.id, 'none', 'stroke="#e52e2e" stroke-width="2"'))
      .join(''),
  };
  const keys = Object.keys(groups);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * scale + 170} ${h * scale}" role="img"><title>County seed ${c.recipe.seed}; 40-acre cells; north up</title><rect width="100%" height="100%" fill="#faf5e8"/>${keys.map((k) => `<g id="${k}"${k === 'fae' ? ' style="display:none"' : ''}>${groups[k]}</g>`).join('')}<g font-family="sans-serif" font-size="12"><text x="${w * scale + 10}" y="20">Seed ${c.recipe.seed} · ${c.recipe.preset}</text><text x="${w * scale + 10}" y="40">Click layers to toggle</text>${keys.map((k, i) => `<text x="${w * scale + 10}" y="${65 + i * 25}" style="cursor:pointer" onclick="var g=document.getElementById('${k}');g.style.display=g.style.display==='none'?'inline':'none'">${k}</text>`).join('')}<text x="${w * scale + 10}" y="290">N ↑ · cell = ¼ mile</text></g></svg>`;
}
