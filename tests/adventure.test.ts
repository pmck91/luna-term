import { describe, expect, it } from 'vitest';
import { adventureInput, completeAdventure, createAdventure, describeRoom, interactionTargets, peterRoom, restoreAdventure, visibleObjects, type AdventureState } from '../shared/adventure';
import { adventureHelp, interactionVerbs, objectDefinitions, rooms, roomIds, type InteractionVerb, type RoomId } from '../shared/adventure-content';
import { complete, execute } from '../shared/shell';
import type { Catalog } from '../shared/models';
const catalog: Catalog = { entries: [], socials: [], repositoryUrl: null };
const text = (state: AdventureState, command: string) => adventureInput(state, command).output.map(line => line.text).join('\n');
function walk(state: AdventureState, commands: string[]) {
  for (const command of commands) {
    const response = adventureInput(state, command);
    expect(response.output.some(line => line.tone === 'error'), command).toBe(false);
    expect(restoreAdventure(JSON.stringify(response.state)), command).toEqual(response.state);
    state = response.state;
  }
  return state;
}
function goTo(state: AdventureState, destination: RoomId) {
  const queue: { room: RoomId; path: RoomId[] }[] = [{ room: state.room, path: [] }], seen = new Set<RoomId>();
  while (queue.length) {
    const { room, path } = queue.shift()!;
    if (room === destination) return walk(state, path.map(next => `go ${next}`));
    if (seen.has(room)) continue;
    seen.add(room); for (const exit of rooms[room].exits) queue.push({ room: exit, path: [...path, exit] });
  }
  throw new Error('Unreachable room');
}
const office = () => walk(createAdventure(), ['up', 'go office']);
const sofa = () => walk(createAdventure(), ['go sitting room', 'climb sofa']);
const shelf = () => walk(office(), ['climb shelf']);
const breakfast = () => goTo(walk(office(), ['meow']), 'kitchen');
function objective(state: AdventureState, goal: 'food' | 'treats' | 'toy') {
  if (goal === 'toy') {
    if (state.mouseFound) return state;
    state = walk(goTo(state, 'office'), ['climb shelf', 'knock book']);
    return walk(goTo(state, 'sitting room'), ['climb sofa', 'push cushion', 'take mouse']);
  }
  if (!state.bowlFilled) state = walk(goTo(state, 'office'), ['meow']);
  return walk(goTo(state, 'kitchen'), goal === 'food' ? ['eat'] : ['purr', 'play ribbon']);
}
describe('Luna house and parser', () => {
  it('uses exactly the specified bidirectional connections', () => {
    expect(Object.fromEntries(roomIds.map(id => [id, [...rooms[id].exits].sort()]))).toEqual({
      'downstairs hallway': ['sitting room', 'upstairs hallway'], 'sitting room': ['downstairs hallway', 'kitchen'], kitchen: ['sitting room'],
      'upstairs hallway': ['bathroom', 'bedroom', 'downstairs hallway', 'office'], bedroom: ['upstairs hallway'], office: ['upstairs hallway'], bathroom: ['upstairs hallway'],
    });
    for (const from of roomIds) for (const to of roomIds) {
      const state = goTo(createAdventure(), from), response = adventureInput(state, `go ${to}`);
      expect(response.state.room).toBe(rooms[from].exits.includes(to) ? to : from);
      if (rooms[from].exits.includes(to)) expect(rooms[to].exits).toContain(from);
    }
  });
  it('accepts natural multiword names, casing, aliases, and prepositions', () => {
    let state = walk(createAdventure(), [' GO the UPSTAIRS HALL ', 'walk office', 'climb onto the shelf']);
    expect(state.position).toBe('shelf');
    expect(adventureInput(state, 'look at the book').output).toEqual(adventureInput(state, 'inspect book').output);
    state = walk(state, ['climb down', 'go "upstairs hallway"', 'go bedroom', 'crawl under the duvet', 'get the sock', 'play with the sock']);
    expect(state.items.sock).toBe('carried');
    expect(text(state, 'inv')).toContain('sock');
  });
  it('explains missing targets, invalid rooms, reach, and unsafe-looking input without changing progress', () => {
    const initial = createAdventure();
    for (const command of ['go kitchen', 'go cellar', 'go', 'inspect', 'climb', 'take shoes', 'take Peter', 'eat', 'meow peter', 'drop mouse', 'read note', 'help extra', 'map extra', 'hint nope', 'constructor', 'toString', '$(id)', 'eval alert(1)', '<script>alert(1)</script>', 'x'.repeat(513)]) {
      const response = adventureInput(initial, command); expect(response.state, command).toEqual(initial); expect(response.output[0].tone, command).toBe('error');
    }
    expect(text(initial, 'go kitchen')).toContain('Exits: sitting room, upstairs hallway');
    expect(text(initial, 'sniff')).toContain('shoes');
    expect(adventureInput(initial, '   ').output).toEqual([]);
    expect(text(goTo(initial, 'sitting room'), 'push cushion')).toContain('sofa is low enough to climb');
    expect(text(office(), 'knock book')).toContain('climb the shelf');
  });
  it('shows all visible room objects, inventory, and useful room details', () => {
    const initial = createAdventure();
    expect(describeRoom(initial).map(line => line.text).join('\n')).toContain('Keyboard taps come from upstairs');
    const state = walk(goTo(initial, 'bedroom'), ['take sock']);
    expect(describeRoom(state).map(line => line.text).join('\n')).toContain('Carrying: sock');
    expect(describeRoom(state).find(line => line.text.startsWith('Nearby:'))?.text).not.toContain('sock');
    expect(text(state, 'map')).toContain('You are in: Bedroom');
  });
});
describe('Luna quests and items', () => {
  it.each([
    ['food', 'treats', 'toy'], ['food', 'toy', 'treats'], ['toy', 'food', 'treats'],
    ['toy', 'treats', 'food'], ['treats', 'food', 'toy'], ['treats', 'toy', 'food'],
  ] as const)('completes objectives in order %s, %s, %s', (...order) => {
    let state = createAdventure(); for (const goal of order) state = objective(state, goal);
    expect(state).toMatchObject({ completed: true, fed: true, treatEarned: true, mouseFound: true });
    expect(text(state, 'goals')).toBe('[x] Breakfast eaten\n[x] Treat earned\n[x] Mouse found');
    for (const command of ['look', 'hint', 'eat', 'purr', 'map']) expect(text(state, command)).not.toContain('You sit down for a wash');
  });
  it('finds the mouse early, with each cushion action, without requiring the note', () => {
    for (const verb of ['push', 'paw', 'knock']) {
      const state = walk(sofa(), [`${verb} the blue cushion`, 'take toy mouse']);
      expect(state).toMatchObject({ mouseFound: true, noteFound: false, items: { mouse: 'carried' } });
    }
  });
  it('changes descriptions and prevents repeated rewards or repeated puzzle events', () => {
    const fed = walk(breakfast(), ['eat']);
    expect(text(fed, 'eat')).toContain('already eaten');
    expect(text(fed, 'meow')).toContain("You've had breakfast");
    expect(text(fed, 'inspect bowl')).toContain('licked clean');
    const rewarded = walk(fed, ['purr', 'play ribbon']);
    expect(text(rewarded, 'play ribbon')).toContain('had your treat');
    expect(text(rewarded, 'purr')).toContain('jar stays shut');
    const note = walk(shelf(), ['knock book']);
    expect(text(note, 'knock book')).toContain('already on the carpet');
    const officeText = describeRoom(note).map(line => line.text).join('\n');
    expect(officeText).toContain('book is on the carpet'); expect(officeText).not.toContain('book leans');
    expect(text(goTo(note, 'bathroom'), 'read note')).toContain('blue sofa cushion');
    expect(text(office(), 'paw keyboard')).toContain('Peter lifts your paw');
    expect(text(goTo(rewarded, 'office'), 'paw keyboard')).not.toContain('Peter lifts your paw');
    expect(text(goTo(rewarded, 'upstairs hallway'), 'inspect door')).toContain('went to the kitchen');
  });
  it('keeps Peter in a findable room and the furniture position local to its room', () => {
    expect(peterRoom(createAdventure())).toBe('office');
    const state = walk(shelf(), ['meow']);
    expect(peterRoom(state)).toBe('kitchen');
    expect(state.room).toBe('office');
    expect(goTo(state, 'bedroom').position).toBe('floor');
    expect(walk(shelf(), ['down']).position).toBe('floor');
    expect(text(office(), 'purr')).toContain('A meow might explain');
  });
  it.each(['ribbon', 'sock', 'mouse'] as const)('earns a treat playing with %s, with Peter watching', item => {
    let state = createAdventure();
    if (item === 'sock') state = walk(goTo(state, 'bedroom'), ['take sock']);
    if (item === 'mouse') state = walk(goTo(state, 'sitting room'), ['climb sofa', 'push cushion', 'take mouse']);
    state = walk(goTo(state, 'office'), ['meow']);
    state = walk(goTo(state, 'kitchen'), ['purr']);
    expect(state.treatEarned).toBe(false);
    state = walk(state, [`play ${item}`]); expect(state.treatEarned).toBe(true);
  });
  it('moves carried items, keeps dropped items retrievable, and preserves the found-mouse objective', () => {
    let state = walk(sofa(), ['push cushion', 'take mouse']);
    state = walk(goTo(state, 'bedroom'), ['take sock']);
    state = walk(goTo(state, 'bathroom'), ['drop sock', 'drop mouse']);
    expect(state.items).toEqual({ sock: 'bathroom', mouse: 'bathroom' }); expect(state.mouseFound).toBe(true);
    expect(visibleObjects(goTo(state, 'bedroom'))).not.toContain('sock');
    expect(visibleObjects(state)).toEqual(expect.arrayContaining(['sock', 'mouse']));
    expect(text(state, 'inventory')).toContain('not carrying');
    state = walk(state, ['play mouse', 'take sock', 'take mouse']);
    expect(state.items).toEqual({ sock: 'carried', mouse: 'carried' });
    state = walk(state, ['push sock']); expect(state.items.sock).toBe('bathroom'); state = walk(state, ['take sock']);
    state = objective(objective(state, 'food'), 'treats');
    state = walk(state, ['drop mouse']); expect(state.completed).toBe(true);
  });
  it('offers each advertised interaction a working, reachable target', () => {
    const base = createAdventure(), bedroom = goTo(base, 'bedroom'), bathroom = goTo(base, 'bathroom');
    const examples: Record<InteractionVerb, [AdventureState, string]> = {
      inspect: [base, 'shoes'], climb: [office(), 'shelf'], knock: [shelf(), 'book'], push: [sofa(), 'cushion'], sniff: [base, 'shoes'],
      paw: [bathroom, 'tap'], scratch: [goTo(base, 'sitting room'), 'post'], hide: [bedroom, 'duvet'], sit: [bathroom, 'bathmat'],
      roll: [goTo(base, 'upstairs hallway'), 'rug'], play: [bedroom, 'sock'], take: [bedroom, 'sock'], drop: [walk(bedroom, ['take sock']), 'sock'],
      eat: [breakfast(), 'bowl'], read: [goTo(base, 'kitchen'), 'shopping list'], meow: [office(), 'peter'], purr: [breakfast(), 'peter'],
    };
    for (const verb of interactionVerbs) {
      expect(adventureHelp).toContain(verb);
      const [state, target] = examples[verb], response = adventureInput(state, `${verb} ${target}`);
      expect(response.output.length, verb).toBeGreaterThan(0); expect(response.output.some(line => line.tone === 'error'), verb).toBe(false);
      expect(interactionTargets(state, verb).length, verb).toBeGreaterThan(0);
    }
  });
  it('keeps inspected actions and completion consistent with actual item behaviour', () => {
    const stages = [createAdventure(), breakfast(), walk(breakfast(), ['purr']), walk(shelf(), ['knock book']), walk(sofa(), ['push cushion', 'take mouse']), walk(goTo(createAdventure(), 'bedroom'), ['take sock'])];
    const samples = stages.flatMap(stage => roomIds.map(room => goTo(stage, room)));
    samples.push(shelf(), sofa());
    for (const state of samples) for (const id of visibleObjects(state)) {
      expect(text(state, `inspect ${objectDefinitions[id].name}`)).not.toContain("You can't");
      for (const verb of Object.keys(objectDefinitions[id].actions) as InteractionVerb[]) {
        const candidates = completeAdventure(`${verb} `, state).candidates;
        const expected = verb !== 'drop' || (id === 'sock' || id === 'mouse') && state.items[id] === 'carried';
        expect(candidates.includes(objectDefinitions[id].name), `${verb} ${id}`).toBe(expected);
      }
    }
    // Optional interactions never make the quests impossible to finish.
    let state = walk(createAdventure(), ['scratch doormat', 'hide coat', 'roll doormat']);
    state = walk(goTo(state, 'bathroom'), ['paw tap', 'paw toilet paper', 'sit bathmat', 'paw toilet paper']);
    for (const goal of ['toy', 'treats', 'food'] as const) state = objective(state, goal);
    expect(state.completed).toBe(true);
  });
});
describe('adventure hints, completion, and saves', () => {
  it('escalates hints only for the requested quest step and resets on progress', () => {
    let state = createAdventure();
    const one = adventureInput(state, 'hint toy'); state = one.state; expect(one.output[0].text).toContain('paper');
    const two = adventureInput(state, 'hint toy'); state = two.state; expect(two.output[0].text).toContain('shelf');
    const three = adventureInput(state, 'hint toy'); state = three.state; expect(three.output[0].text).toContain('climb shelf, then knock book');
    expect(text(state, 'hint toy')).toBe(three.output[0].text);
    expect(text(state, 'hint food')).toContain('typing upstairs');
    state = walk(goTo(state, 'office'), ['climb shelf']); expect(text(state, 'hint toy')).toContain('paper is still trapped');
    state = walk(state, ['knock book']); expect(text(state, 'hint toy')).toContain('somewhere soft');
    state = walk(goTo(state, 'sitting room'), ['climb sofa', 'push cushion']); expect(text(state, 'hint toy')).toContain('out of the way');
    state = walk(state, ['take mouse']); expect(text(state, 'hint toy')).toContain('found your mouse');
  });
  it('completes verbs, connected rooms, multiword items, aliases and discovered targets', () => {
    expect(completeAdventure('ins', createAdventure()).input).toBe('inspect ');
    expect(completeAdventure('go sit', createAdventure()).input).toBe('go sitting room ');
    expect(completeAdventure('go to the sit', createAdventure()).input).toBe('go to the sitting room ');
    expect(completeAdventure('walk sit', createAdventure()).input).toBe('walk sitting room ');
    expect(completeAdventure('go office', createAdventure()).candidates).toEqual([]);
    expect(completeAdventure('look at the sh', createAdventure()).input).toBe('look at the shoes ');
    expect(completeAdventure('scratch sc', goTo(createAdventure(), 'sitting room')).input).toBe('scratch scratching post ');
    expect(completeAdventure('knock b', office()).input).toBe('knock book ');
    expect(completeAdventure('climb d', shelf()).candidates).toContain('down');
    expect(completeAdventure('hint tr', createAdventure()).input).toBe('hint treats ');
    expect(completeAdventure('play ', goTo(createAdventure(), 'sitting room')).candidates).toEqual([]);
    expect(completeAdventure('read ', office()).candidates).not.toContain('note');
    const note = walk(shelf(), ['knock book']); expect(completeAdventure('read n', goTo(note, 'bathroom')).input).toBe('read note ');
    const found = walk(sofa(), ['push cushion']); expect(completeAdventure('take y', found).input).toBe('take yellow mouse ');
    expect(completeAdventure('take mo', found).input).toBe('take mouse ');
    expect(completeAdventure('sniff cu', goTo(createAdventure(), 'kitchen')).input).toBe('sniff cupboard ');
  });
  it('round-trips saves throughout a walkthrough and discards unknown save fields', () => {
    let state = createAdventure(); for (const goal of ['toy', 'treats', 'food'] as const) state = objective(state, goal);
    expect(restoreAdventure(JSON.stringify({ ...state, unexpected: '<script>', items: { ...state.items, extra: 'thing' } }))).toEqual(state);
    expect(restoreAdventure(JSON.stringify(state))).not.toBe(state);
    expect(restoreAdventure(JSON.stringify(state))?.items).not.toBe(state.items);
  });
  it.each([
    { version: 2 }, { room: 'cellar' }, { room: '__proto__' }, { position: 'shelf' }, { position: 'sofa' }, { position: {} },
    { fed: true }, { jarReady: true }, { treatEarned: true }, { completed: true }, { noteFound: true }, { mouseFound: true },
    { bowlFilled: 'true' }, { cushionMoved: true }, { items: { sock: 'cellar', mouse: null } }, { items: { sock: 'bedroom', mouse: 'carried' } },
    { done: ['unknown'] }, { done: ['paw:tap', 'paw:tap'] }, { hints: {} }, { hints: { ...createAdventure().hints, 'food-find': 4 } },
  ])('rejects invalid or impossible save data: %j', patch => expect(restoreAdventure(JSON.stringify({ ...createAdventure(), ...patch }))).toBeNull());
  it('rejects broken and oversized saves', () => { for (const raw of ['{', 'null', '[]', 'true', 'x'.repeat(16001)]) expect(restoreAdventure(raw)).toBeNull(); });
  it('requires restart confirmation in the UI and treats quit as an explicit action', () => {
    const state = office(); expect(adventureInput(state, 'restart')).toMatchObject({ state, action: 'restart' });
    expect(adventureInput(state, 'quit')).toMatchObject({ state, action: 'quit' });
  });
});
describe('adventure virtual entry', () => {
  it('lists, reads, and runs the game without changing existing game filenames', () => {
    expect(execute('ls games', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('lunas-adventure-readme.txt  lunas-adventure.game') });
    expect(execute('cat ~/games/lunas-adventure-readme.txt', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('Every interaction has an object') });
    expect(execute('cat lunas-adventure.game', '/games', catalog).output[0]).toMatchObject({ text: expect.stringContaining('small black cat') });
    expect(execute('./lunas-adventure.game', '/games', catalog).action).toBe('adventure');
    expect(execute('~/games/../games/lunas-adventure.game', '/projects', catalog).action).toBe('adventure');
    expect(execute('./games/lunas-adventure.game extra', '/', catalog).output[0]).toMatchObject({ tone: 'error' });
    expect(complete('./lunas-adventure.g', '/games', catalog).input).toBe('./lunas-adventure.game ');
    expect(execute('help', '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('./games/lunas-adventure.game') });
  });
});
