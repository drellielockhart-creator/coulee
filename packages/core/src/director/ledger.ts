import type { DirectorState, LedgerRecord } from './state.ts';
export const LEDGER_RETENTION = 90;
export function assess(st: DirectorState, row: LedgerRecord): void {
  st.ledger.push(row);
  if (st.ledger.length > LEDGER_RETENTION) {
    st.ledger_compacted += st.ledger.length - LEDGER_RETENTION;
    st.ledger.splice(0, st.ledger.length - LEDGER_RETENTION);
  }
}
