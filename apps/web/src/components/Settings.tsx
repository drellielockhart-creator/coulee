/**
 * Settings (11 §2.14). OWNER: module:web. Reading (psyche label set) and Debug (God view).
 * God view is opt-in behind a confirm and Chronicle-tagged: it breaks the PC's knowledge gating
 * (P1), so it is never one stray tap away.
 */
import { useState } from 'react';
import { useUi } from '../state/ui.ts';
import { useVm } from './ctx.ts';

export function Settings() {
  const vm = useVm();
  const ui = useUi();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="settings" data-testid="settings">
      <h3 className="section-head">
        <span>Reading</span>
      </h3>
      <label className="field">
        Mind labels
        <select
          value={ui.labelSet}
          onChange={(e) => ui.setLabelSet(e.target.value === 'clinical' ? 'clinical' : 'period')}
        >
          <option value="period">Period (Self-Command, Conscience, Appetite)</option>
          <option value="clinical">Clinical (Ego, Superego, Id)</option>
        </select>
      </label>
      <h3 className="section-head">
        <span>Debug</span>
      </h3>
      {ui.godView ? (
        <>
          <p className="warn">◈ God view is on: you see other minds and what your character cannot know.</p>
          <button type="button" onClick={() => ui.setGodView(false)}>
            Turn God view off
          </button>
        </>
      ) : confirm ? (
        <fieldset className="confirm-box" aria-label="Confirm God view">
          <p>
            God view shows every mind and every off-screen event. Your character’s knowledge doesn’t change, but yours
            does. The Chronicle is marked from this hour on.
          </p>
          <div className="stack-actions">
            <button
              type="button"
              className="consequential"
              onClick={() => {
                ui.setGodView(true, vm.time.t);
                setConfirm(false);
              }}
            >
              Switch God view on
            </button>
            <button type="button" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : (
        <button type="button" onClick={() => setConfirm(true)}>
          God view…
        </button>
      )}
    </div>
  );
}
