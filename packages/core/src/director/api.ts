import type { World } from '../world.ts';
import { createDirectorState, type DirectorSettings, directorSettings } from './state.ts';

export { recordProjection } from './threads.ts';
export { directorReport } from './view.ts';
export function configureDirector(world: World, settings: Partial<DirectorSettings>): void {
  const valid = directorSettings(settings);
  world.director ??= createDirectorState(valid);
  const st = world.director;
  st.settings = valid;
}
/** Absent slices are legacy saves; no other slice is touched during migration. */
export function restoreDirector(world: World): void {
  if (!world.director) world.director = createDirectorState();
  if (world.director.version !== 1) throw new Error('Unsupported Director version');
  world.director.settings = directorSettings(world.director.settings);
}
