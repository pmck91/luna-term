import { describe, expect, it } from 'vitest';
import { adventureInput, completeAdventure, createAdventure, describeRoom, hintSteps, interactionTargets, peterRoom, restoreAdventure, visibleObjects, type AdventureState } from '../shared/adventure';
import { adventureHelp, copy, interactionVerbs, objectDefinitions, rooms, roomIds, type InteractionVerb, type RoomId } from '../shared/adventure-content';
import { complete, execute } from '../shared/shell';
import type { Catalog } from '../shared/models';
const catalog: Catalog = { entries: [], socials: [], repositoryUrl: null };
const text = (state: AdventureState, command: string) => adventureInput(state, command).output.map(line => line.text).join('\n');
function walk(state: AdventureState, commands: string[]) {
  for (const command of commands) {
    const response = adventureInput(state, command);
    expect(response.output.some(line => line.tone === 'error'), command).toBe(false);
    expect(restoreAdventure(JSON.stringify(response.state)), command).toEqual(response.state);
    expect(response.output.filter(line => line.text === copy.ending), command).toHaveLength(!state.completed && response.state.completed ? 1 : 0);
    state = response.state;
  }
  return state;
}
function goTo(state: AdventureState, destination: RoomId) {
  const queue: { room: RoomId; path: RoomId[] }[] = [{ room: state.room, path: [] }], seen = new Set<RoomId>();
  while (queue.length) {
    const { room, path } = queue.shift()!;
    if (room === destination) return walk(state, path.map(next => next === 'office' && !state.officeDoorOpen ? 'scratch door' : `go ${next}`));
    if (seen.has(room)) continue;
    seen.add(room); for (const exit of rooms[room].exits) queue.push({ room: exit, path: [...path, exit] });
  }
  throw new Error('Unreachable room');
}
const office = () => walk(createAdventure(), ['up', 'scratch door']);
const shelf = () => walk(office(), ['climb shelf']);
const couch = () => walk(goTo(walk(shelf(), ['knock book']), 'sitting room'), ['climb couch']);
const breakfast = () => goTo(walk(office(), ['meow']), 'kitchen');
const den = (state = createAdventure()) => walk(goTo(state, 'bedroom'), ['inspect wardrobe', 'paw dressing gown', 'push wardrobe door', 'hide wardrobe']);
const rescueBall = (state = createAdventure()) => walk(goTo(state, 'bathroom'), ['inspect sink', 'climb sink', 'push plug', 'paw tap', 'paw ball']);
function objective(state: AdventureState, goal: 'food' | 'treats' | 'toy') {
  if (goal === 'toy') {
    if (state.mouseFound) return state;
    state = walk(goTo(state, 'office'), ['climb shelf', 'knock book']);
    return walk(goTo(state, 'sitting room'), ['climb couch', 'push cushion', 'take mouse']);
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
      const state = goTo({ ...createAdventure(), officeDoorOpen: true }, from), response = adventureInput(state, `go ${to}`);
      expect(response.state.room).toBe(rooms[from].exits.includes(to) ? to : from);
      if (rooms[from].exits.includes(to)) expect(rooms[to].exits).toContain(from);
    }
  });
  it('accepts natural multiword names, casing, aliases, and prepositions', () => {
    let state = walk(createAdventure(), [' GO the UPSTAIRS HALL ', 'scratch door', 'walk office', 'climb onto the shelf']);
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
    expect(text(walk(couch(), ['climb down']), 'push cushion')).toContain('couch is low enough to climb');
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
  it('requires scratching the office door and leaves it open after Peter returns to his desk', () => {
    const hallway = walk(createAdventure(), ['up']);
    expect(text(hallway, 'inspect door')).toContain('scratches near the bottom');
    expect(adventureInput(hallway, 'go office')).toMatchObject({ state: hallway, output: [{ tone: 'error', text: expect.stringContaining('scratch door') }] });
    expect(completeAdventure('scratch of', hallway).input).toBe('scratch office door ');
    const entered = adventureInput(hallway, 'scratch door');
    expect(entered.state).toMatchObject({ room: 'office', position: 'floor', officeDoorOpen: true, bowlFilled: false });
    expect(entered.output.map(line => line.text).join('\n')).toContain('He goes back to his desk');
    expect(peterRoom(entered.state)).toBe('office');
    const fed = walk(entered.state, ['meow', 'go upstairs hallway']);
    expect(text(fed, 'scratch door')).toContain('already open');
    expect(walk(fed, ['go office']).room).toBe('office');
    expect(peterRoom(fed)).toBe('kitchen');
  });
  it('reveals the dressing gown by inspecting the wardrobe and claims a reusable den', () => {
    let state = goTo(createAdventure(), 'bedroom');
    expect(visibleObjects(state)).not.toContain('gown');
    expect(completeAdventure('paw dr', state).candidates).toEqual([]);
    expect(adventureInput(state, 'paw dressing gown').state).toEqual(state);
    expect(text(state, 'push wardrobe door')).toContain('sleeve is caught');
    expect(text(state, 'hide wardrobe')).toContain('gap is too narrow');
    state = walk(state, ['look at wardrobe']);
    expect(visibleObjects(state)).toContain('gown');
    expect(completeAdventure('paw dr', state).input).toBe('paw dressing gown ');
    state = walk(state, ['paw sleeve', 'push wardrobe door', 'hide wardrobe']);
    expect(state).toMatchObject({ denClaimed: true, wardrobeOpen: true, gownFreed: true, completed: false });
    expect(text(state, 'look')).toContain('Your den is waiting');
    expect(text(state, 'hide wardrobe')).toContain('just as you left it');
    expect(text(state, 'push wardrobe')).toContain('already open');
    expect(text(state, 'paw gown')).toContain('already clear');
    expect(text(goTo(state, 'bathroom'), 'hide wardrobe')).toContain("There's no wardrobe here");
    expect(text(state, 'goals')).toContain('[x] Wardrobe den claimed');
  });
  it('requires discovery, reaching the rim, plugging the drain, and floating the ball', () => {
    let state = goTo(createAdventure(), 'bathroom');
    expect(visibleObjects(state)).not.toContain('ball'); expect(visibleObjects(state)).not.toContain('plug');
    expect(completeAdventure('paw ba', state).candidates).toEqual([]);
    state = walk(state, ['paw tap']); expect(text(state, 'paw tap')).toContain('Another drop');
    state = walk(state, ['inspect sink']);
    expect(visibleObjects(state)).toEqual(expect.arrayContaining(['ball', 'plug']));
    expect(text(state, 'push plug')).toContain('out of reach');
    expect(text(state, 'take ball')).toContain('out of reach');
    state = walk(state, ['climb sink']);
    expect(text(state, 'paw ball')).toContain('spins in the recess');
    expect(text(state, 'paw tap')).toContain('straight down the drain');
    expect(adventureInput(state, 'paw tap').state.basinFilled).toBe(false);
    state = walk(state, ['push sink plug', 'paw tap']);
    expect(state).toMatchObject({ plugClosed: true, basinFilled: true, ballRescued: false });
    expect(text(state, 'paw tap')).toContain('enough water');
    expect(adventureInput(state, 'take ball').state.ballRescued).toBe(false);
    state = walk(state, ['go upstairs hallway', 'go bathroom']);
    expect(state.position).toBe('floor'); expect(state.basinFilled).toBe(true);
    state = walk(state, ['climb sink', 'paw ball']);
    expect(state).toMatchObject({ ballRescued: true, position: 'floor', items: { ball: 'bathroom' }, mouseFound: false, completed: false });
    expect(text(state, 'hint bathroom')).toContain('already out');
    state = walk(state, ['take ping pong ball']);
    state = walk(goTo(state, 'office'), ['drop ball', 'take ball', 'play ball']);
    expect(state.items.ball).toBe('carried');
    expect(text(state, 'inventory')).toContain('ping-pong ball');
    expect(completeAdventure('drop b', state).input).toBe('drop ball ');
    expect(text(state, 'goals')).toContain('[x] Ping-pong ball rescued');
  });
  it('keeps both optional puzzles independent of the main ending in any order', () => {
    for (const order of [['den', 'ball', 'main'], ['den', 'main', 'ball'], ['ball', 'den', 'main'], ['ball', 'main', 'den'], ['main', 'den', 'ball'], ['main', 'ball', 'den']]) {
      let state = createAdventure();
      for (const step of order) {
        state = step === 'den' ? den(state) : step === 'ball' ? rescueBall(state) : objective(objective(objective(state, 'food'), 'treats'), 'toy');
        if (step !== 'main' && !order.slice(0, order.indexOf(step)).includes('main')) expect(state.completed).toBe(false);
      }
      expect(state).toMatchObject({ completed: true, denClaimed: true, ballRescued: true });
      expect(text(state, 'hide wardrobe')).not.toContain('Breakfast eaten. Treat earned. Mouse found.');
    }
  });
  it('shows Luna greeting her fox through the kitchen back door', () => {
    const kitchen = goTo(createAdventure(), 'kitchen');
    expect(text(kitchen, 'look')).toContain('glass back door');
    expect(completeAdventure('look at back d', kitchen).input).toBe('look at back door ');
    const first = adventureInput(kitchen, 'look at back door');
    expect(first.output[0].text).toContain('friend the neighbourhood fox');
    expect(first.output[0].text).toContain('Your tail puffs up');
    expect(first.state).toEqual({ ...kitchen, foxSeen: true });
    expect(text(first.state, 'inspect glass door')).toContain('tail has settled down');
    expect(text(first.state, 'inspect cupboard')).toContain('Peter can open it');
    expect(text(first.state, 'inspect jar')).toContain('cupboard glass');
  });
  it.each([
    ['food', 'treats', 'toy'], ['food', 'toy', 'treats'], ['toy', 'food', 'treats'],
    ['toy', 'treats', 'food'], ['treats', 'food', 'toy'], ['treats', 'toy', 'food'],
  ] as const)('completes objectives in order %s, %s, %s', (...order) => {
    let state = createAdventure(); for (const goal of order) state = objective(state, goal);
    expect(state).toMatchObject({ completed: true, fed: true, treatEarned: true, mouseFound: true });
    expect(text(state, 'goals')).toContain('[x] Breakfast eaten\n[x] Treat earned\n[x] Mouse found');
    expect(state.denClaimed).toBe(false); expect(state.ballRescued).toBe(false);
    for (const command of ['look', 'hint', 'eat', 'purr', 'map']) expect(text(state, command)).not.toContain(copy.ending);
  });
  it('hides the cushion and its actions until the note is found', () => {
    const state = walk(createAdventure(), ['go sitting room', 'climb couch']);
    expect(visibleObjects(state)).not.toContain('cushion');
    expect(describeRoom(state).map(line => line.text).join('\n')).not.toContain('cushion');
    expect(text(state, 'inspect couch')).not.toContain('cushion');
    expect(text(walk(state, ['climb down']), 'climb couch')).not.toContain('cushion');
    for (const verb of ['inspect', 'look', 'push', 'paw', 'knock']) for (const alias of ['cushion', 'blue cushion', 'couch cushion']) {
      const response = adventureInput(state, `${verb} ${alias}`);
      expect(response.state).toEqual(state);
      expect(response.output[0].tone).toBe('error');
      expect(completeAdventure(`${verb} ${alias}`, state).candidates).toEqual([]);
    }
    expect(interactionTargets(state, 'inspect')).not.toContain('cushion');
    expect(text(state, 'inspect')).not.toContain('cushion');
    expect(text(state, 'push')).not.toContain('cushion');
    const revealed = couch();
    expect(visibleObjects(revealed)).toContain('cushion');
    expect(describeRoom(revealed).map(line => line.text).join('\n')).toContain('blue cushion');
    expect(text(revealed, 'inspect couch')).toContain('blue cushion');
    expect(text(revealed, 'inspect cushion')).toContain('small lump');
    expect(completeAdventure('inspect cu', revealed).input).toBe('inspect cushion ');
    expect(completeAdventure('look at the blue c', revealed).input).toBe('look at the blue cushion ');
  });
  it('finds the mouse with each cushion action after finding the note', () => {
    for (const verb of ['push', 'paw', 'knock']) {
      const state = walk(couch(), [`${verb} the blue cushion`, 'take toy mouse']);
      expect(state).toMatchObject({ mouseFound: true, noteFound: true, items: { mouse: 'carried' } });
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
    expect(text(goTo(note, 'bathroom'), 'read note')).toContain('blue couch cushion');
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
  it.each(['ribbon', 'sock', 'mouse', 'ball'] as const)('earns a treat playing with %s, with Peter watching', item => {
    let state = createAdventure();
    if (item === 'sock') state = walk(goTo(state, 'bedroom'), ['take sock']);
    if (item === 'mouse') state = objective(state, 'toy');
    if (item === 'ball') state = walk(goTo(state, 'bathroom'), ['inspect sink', 'climb sink', 'push plug', 'paw tap', 'paw ball', 'take ball']);
    state = walk(goTo(state, 'office'), ['meow']);
    state = walk(goTo(state, 'kitchen'), ['purr']);
    expect(state.treatEarned).toBe(false);
    state = walk(state, [`play ${item}`]); expect(state.treatEarned).toBe(true);
  });
  it('moves carried items, keeps dropped items retrievable, and preserves the found-mouse objective', () => {
    let state = walk(couch(), ['push cushion', 'take mouse']);
    state = walk(goTo(state, 'bedroom'), ['take sock']);
    state = walk(goTo(state, 'bathroom'), ['drop sock', 'drop mouse']);
    expect(state.items).toEqual({ sock: 'bathroom', mouse: 'bathroom', ball: null }); expect(state.mouseFound).toBe(true);
    expect(visibleObjects(goTo(state, 'bedroom'))).not.toContain('sock');
    expect(visibleObjects(state)).toEqual(expect.arrayContaining(['sock', 'mouse']));
    expect(text(state, 'inventory')).toContain('not carrying');
    state = walk(state, ['play mouse', 'take sock', 'take mouse']);
    expect(state.items).toEqual({ sock: 'carried', mouse: 'carried', ball: null });
    state = walk(state, ['push sock']); expect(state.items.sock).toBe('bathroom'); state = walk(state, ['take sock']);
    state = objective(objective(state, 'food'), 'treats');
    state = walk(state, ['drop mouse']); expect(state.completed).toBe(true);
  });
  it('offers each advertised interaction a working, reachable target', () => {
    const base = createAdventure(), bedroom = goTo(base, 'bedroom'), bathroom = goTo(base, 'bathroom');
    const examples: Record<InteractionVerb, [AdventureState, string]> = {
      inspect: [base, 'shoes'], climb: [office(), 'shelf'], knock: [shelf(), 'book'], push: [couch(), 'cushion'], sniff: [base, 'shoes'],
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
    const stages = [createAdventure(), breakfast(), walk(breakfast(), ['purr']), walk(shelf(), ['knock book']), walk(couch(), ['push cushion', 'take mouse']), walk(goTo(createAdventure(), 'bedroom'), ['take sock']), den(), walk(rescueBall(), ['take ball']), walk(goTo(createAdventure(), 'bathroom'), ['inspect sink', 'climb sink', 'push plug'])];
    const samples = stages.flatMap(stage => roomIds.map(room => goTo(stage, room)));
    samples.push(shelf(), couch());
    for (const state of samples) for (const id of visibleObjects(state)) {
      expect(text(state, `inspect ${objectDefinitions[id].name}`)).not.toContain("You can't");
      for (const verb of Object.keys(objectDefinitions[id].actions) as InteractionVerb[]) {
        const candidates = completeAdventure(`${verb} `, state).candidates;
        const expected = verb !== 'drop' || (id === 'sock' || id === 'mouse' || id === 'ball') && state.items[id] === 'carried';
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
  it('gives separate progressive hints for the door and optional puzzles', () => {
    let state = createAdventure();
    for (const expected of ['closed office door', 'scratches', 'scratch door']) {
      const response = adventureInput(state, 'hint food'); state = response.state; expect(response.output[0].text).toContain(expected);
    }
    expect(completeAdventure('hint bed', state).input).toBe('hint bedroom ');
    expect(completeAdventure('hint bath', state).input).toBe('hint bathroom ');
    for (const expected of ['does not quite shut', 'closely', 'inspect wardrobe']) {
      const response = adventureInput(state, 'hint bedroom'); state = response.state; expect(response.output[0].text).toContain(expected);
    }
    expect(text(state, 'hint')).toContain('scratch door');
    state = walk(goTo(state, 'bedroom'), ['inspect wardrobe']); expect(text(state, 'hint bedroom')).toContain('caught');
    state = walk(state, ['paw gown']); expect(text(state, 'hint bedroom')).toContain('clear now');
    state = walk(state, ['push wardrobe']); expect(text(state, 'hint bedroom')).toContain('good bed');
    state = walk(state, ['hide wardrobe']); expect(text(state, 'hint bedroom')).toContain('already claimed');
    state = goTo(state, 'bathroom'); expect(text(state, 'hint bathroom')).toContain('bathroom sink');
    state = walk(state, ['inspect sink']); expect(text(state, 'hint bathroom')).toContain('reach the tap');
    state = walk(state, ['climb sink']); expect(text(state, 'hint bathroom')).toContain('float');
    state = walk(state, ['push plug']); expect(text(state, 'hint bathroom')).toContain('hold a little water');
    state = walk(state, ['paw tap']); expect(text(state, 'hint bathroom')).toContain('floating near the rim');
    state = walk(state, ['paw ball']); expect(text(state, 'hint bathroom')).toContain('already out');
  });
  it('migrates real version-one shapes and validates optional puzzle state', () => {
    const current = objective(objective(objective(createAdventure(), 'food'), 'treats'), 'toy');
    const oldFields = ['bowlFilled', 'fed', 'jarReady', 'treatEarned', 'bookDown', 'noteFound', 'cushionMoved', 'mouseFound', 'completed'] as const;
    const legacy = { version: 1, room: current.room, position: current.position, ...Object.fromEntries(oldFields.map(key => [key, current[key]])), items: { sock: current.items.sock, mouse: current.items.mouse }, done: ['paw:tap'], hints: Object.fromEntries(hintSteps.slice(0, 10).map(step => [step, 2])) };
    const restored = restoreAdventure(JSON.stringify(legacy));
    expect(restored).toMatchObject({ version: 2, officeDoorOpen: true, completed: true, denClaimed: false, ballRescued: false, items: { ball: null }, done: ['paw:tap'] });
    expect(restored!.hints['toy-book']).toBe(2); expect(restored!.hints['bathroom-plug']).toBe(0);
    expect(den(rescueBall(restored!))).toMatchObject({ completed: true, denClaimed: true, ballRescued: true });
    expect(restoreAdventure(JSON.stringify({ ...legacy, fed: undefined }))).toBeNull();
    expect(restoreAdventure(JSON.stringify({ ...legacy, hints: {} }))).toBeNull();
    for (const patch of [{ position: ['floor'] }, { position: 'sink' }, { officeDoorOpen: 'yes' }, { gownFreed: true }, { wardrobeOpen: true }, { denClaimed: true }, { plugClosed: true }, { basinFilled: true }, { ballRescued: true }, { foxSeen: 'yes' }, { items: { ...createAdventure().items, ball: 'carried' } }]) {
      expect(restoreAdventure(JSON.stringify({ ...createAdventure(), ...patch })), JSON.stringify(patch)).toBeNull();
    }
  });
  it('escalates hints only for the requested quest step and resets on progress', () => {
    let state = createAdventure();
    state = office();
    const one = adventureInput(state, 'hint toy'); state = one.state; expect(one.output[0].text).toContain('paper');
    const two = adventureInput(state, 'hint toy'); state = two.state; expect(two.output[0].text).toContain('shelf');
    const three = adventureInput(state, 'hint toy'); state = three.state; expect(three.output[0].text).toContain('climb shelf, then knock book');
    expect(text(state, 'hint toy')).toBe(three.output[0].text);
    expect(text(state, 'hint food')).toContain('typing upstairs');
    state = walk(goTo(state, 'office'), ['climb shelf']); expect(text(state, 'hint toy')).toContain('paper is still trapped');
    state = walk(state, ['knock book']); expect(text(state, 'hint toy')).toContain('somewhere soft');
    state = walk(goTo(state, 'sitting room'), ['climb couch', 'push cushion']); expect(text(state, 'hint toy')).toContain('out of the way');
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
    const found = walk(couch(), ['push cushion']); expect(completeAdventure('take y', found).input).toBe('take yellow mouse ');
    expect(completeAdventure('take mo', found).input).toBe('take mouse ');
    expect(completeAdventure('sniff cu', goTo(createAdventure(), 'kitchen')).input).toBe('sniff cupboard ');
  });
  it('round-trips saves throughout a walkthrough and discards unknown save fields', () => {
    let state = createAdventure(); for (const goal of ['toy', 'treats', 'food'] as const) state = objective(state, goal);
    expect(restoreAdventure(JSON.stringify({ ...state, unexpected: '<script>', items: { ...state.items, extra: 'thing' } }))).toEqual(state);
    expect(restoreAdventure(JSON.stringify(state))).not.toBe(state);
    expect(restoreAdventure(JSON.stringify(state))?.items).not.toBe(state.items);
  });
  it('preserves mouse progress in older saves made before finding the note', () => {
    const olderSave = { ...walk(couch(), ['push cushion', 'take mouse']), noteFound: false, bookDown: false };
    const restored = restoreAdventure(JSON.stringify(olderSave));
    expect(restored).toEqual(olderSave);
    expect(text(restored!, 'inventory')).toContain('yellow mouse');
    expect(visibleObjects(restored!)).not.toContain('cushion');
    expect(objective(objective(restored!, 'food'), 'treats').completed).toBe(true);
  });
  it.each([
    { version: 99 }, { room: 'cellar' }, { room: '__proto__' }, { position: 'shelf' }, { position: 'couch' }, { position: {} },
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
