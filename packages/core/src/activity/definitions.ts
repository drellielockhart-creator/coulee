/** Stable traversal of string-keyed content definitions. */
export function definitionRows<Row>(table: Record<string, Row>): Row[] {
  const out: Row[] = [];
  for (const key of Object.keys(table).sort()) {
    const row = table[key];
    if (row !== undefined) out.push(row);
  }
  return out;
}
/** Required row after a table's keys have been enumerated. */
export function requiredRow<Row>(table: Record<string, Row> | Record<number, Row>, key: string | number): Row {
  const row = (table as Record<string, Row>)[key];
  if (row === undefined) throw new Error(`Missing row ${key}`);
  return row;
}
