/** Lossless JSON wire encoding. The live World and its canonical hash are unchanged.
 * Shapes and equal subtrees share space on disk; decode creates independent objects.
 */
type Scalar = string | number | boolean | null;
export interface PackedJson {
  format: 'coulee.packed-json.v1';
  shapes: string[][];
  nodes: Array<Scalar | number[]>;
  root: number;
}
export function packJson(value: unknown): PackedJson {
  const shapes: string[][] = [],
    nodes: PackedJson['nodes'] = [];
  const shapeIds = new Map<string, number>(),
    nodeIds = new Map<string, number>();
  const encode = (v: unknown): number => {
    let node: Scalar | number[];
    if (Array.isArray(v)) node = [-1, ...v.map((x) => encode(x ?? null))];
    else if (v !== null && typeof v === 'object') {
      const object = v as Record<string, unknown>;
      const keys = Object.keys(object).filter((key) => object[key] !== undefined);
      const key = JSON.stringify(keys);
      let shape = shapeIds.get(key);
      if (shape === undefined) {
        shape = shapes.length;
        shapes.push(keys);
        shapeIds.set(key, shape);
      }
      node = [shape, ...keys.map((key) => encode(object[key]))];
    } else if (
      v === null ||
      typeof v === 'string' ||
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v))
    )
      node = v;
    else throw new Error('Save contains a non-JSON value');
    const key = JSON.stringify(node);
    let id = nodeIds.get(key);
    if (id === undefined) {
      id = nodes.length;
      nodes.push(node);
      nodeIds.set(key, id);
    }
    return id;
  };
  const root = encode(value);
  return { format: 'coulee.packed-json.v1', shapes, nodes, root };
}
/** Also accepts legacy plain JSON saves. Backward references make cycles impossible. */
export function unpackJson<T>(value: unknown): T {
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'coulee.packed-json.v1')
    return value as T;
  const packed = value as PackedJson;
  const decode = (id: number, before: number): unknown => {
    if (!Number.isInteger(id) || id < 0 || id >= before) throw new Error('Invalid packed save reference');
    const node = packed.nodes[id];
    if (!Array.isArray(node)) return node;
    const [shape, ...children] = node;
    if (shape === -1) return children.map((child) => decode(child, id));
    const keys = shape === undefined ? undefined : packed.shapes[shape];
    if (!keys || keys.length !== children.length) throw new Error('Invalid packed save shape');
    return Object.fromEntries(keys.map((key, i) => [key, decode(children[i] as number, id)]));
  };
  return decode(packed.root, packed.nodes.length) as T;
}
