import { describe, expect, it } from 'vitest';
import { ADVENTURE_SAVE_KEY, loadAdventure, saveAdventure } from '../src/adventure-storage';
import { createAdventure, adventureInput } from '../shared/adventure';
describe('adventure browser storage', () => {
  it('creates, saves, and resumes a versioned adventure', () => {
    const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(loadAdventure(storage).status).toBe('new');
    const state = adventureInput(createAdventure(), 'up').state;
    expect(saveAdventure(state, storage)).toBe(true); expect(data.has(ADVENTURE_SAVE_KEY)).toBe(true);
    expect(loadAdventure(storage)).toEqual({ state, status: 'resumed' });
  });
  it('starts fresh for an invalid save and allows it to be replaced', () => {
    let raw = '{'; const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
    expect(loadAdventure(storage)).toEqual({ state: createAdventure(), status: 'invalid' });
    expect(saveAdventure(createAdventure(), storage)).toBe(true); expect(loadAdventure(storage).status).toBe('resumed');
  });
  it('does not prevent playing when reads or writes fail', () => {
    const storage = { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Quota exceeded'); } };
    expect(loadAdventure(storage)).toEqual({ state: createAdventure(), status: 'unavailable' });
    expect(saveAdventure(createAdventure(), storage)).toBe(false);
    expect(adventureInput(loadAdventure(storage).state, 'up').state.room).toBe('upstairs hallway');
  });
});
