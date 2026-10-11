import { createAdventure, restoreAdventure, type AdventureState } from '../shared/adventure';
export const ADVENTURE_SAVE_KEY = 'luna-adventure-save';
export type AdventureLoad = { state: AdventureState; status: 'new' | 'resumed' | 'invalid' | 'unavailable' };
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function loadAdventure(storage?: SaveStorage): AdventureLoad {
  try {
    const raw = (storage ?? localStorage).getItem(ADVENTURE_SAVE_KEY);
    if (raw === null) return { state: createAdventure(), status: 'new' };
    const state = restoreAdventure(raw);
    return state ? { state, status: 'resumed' } : { state: createAdventure(), status: 'invalid' };
  } catch { return { state: createAdventure(), status: 'unavailable' }; }
}
export function saveAdventure(state: AdventureState, storage?: SaveStorage): boolean {
  try { (storage ?? localStorage).setItem(ADVENTURE_SAVE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
