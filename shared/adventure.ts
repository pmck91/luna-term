import { adventureHelp, copy, flavourActionIds, houseMap, interactionVerbs, objectDefinitions, objectIds, rooms, roomIds, type InteractionVerb, type ObjectId, type RoomId } from './adventure-content';

export type AdventureLine = { text: string; tone?: 'heading' | 'dim' | 'error' | 'success'; map?: boolean };
export const hintSteps = ['food-find', 'food-eat', 'treats-find', 'treats-purr', 'treats-play', 'toy-shelf', 'toy-book', 'toy-sofa', 'toy-cushion', 'toy-take'] as const;
type HintStep = typeof hintSteps[number];
export type AdventureState = {
  version: 1; room: RoomId; position: 'floor' | 'chair' | 'shelf' | 'sofa';
  bowlFilled: boolean; fed: boolean; jarReady: boolean; treatEarned: boolean;
  bookDown: boolean; noteFound: boolean; cushionMoved: boolean; mouseFound: boolean; completed: boolean;
  items: { sock: RoomId | 'carried'; mouse: RoomId | 'carried' | null };
  done: string[]; hints: Record<HintStep, number>;
};
export type AdventureResult = { state: AdventureState; output: AdventureLine[]; action?: 'quit' | 'restart' };
export const adventureCommands = ['look', 'go', 'up', 'down', ...interactionVerbs, 'inventory', 'goals', 'map', 'hint', 'help', 'restart', 'quit'];
const verbAliases: Record<string, string> = { l: 'look', examine: 'inspect', get: 'take', q: 'quit', i: 'inventory', inv: 'inventory', walk: 'go', bat: 'paw', crawl: 'hide' };
const canonicalVerb = (verb: string) => Object.hasOwn(verbAliases, verb) ? verbAliases[verb] : verb;
export function createAdventure(): AdventureState {
  return { version: 1, room: 'downstairs hallway', position: 'floor', bowlFilled: false, fed: false, jarReady: false, treatEarned: false, bookDown: false, noteFound: false, cushionMoved: false, mouseFound: false, completed: false, items: { sock: 'bedroom', mouse: null }, done: [], hints: Object.fromEntries(hintSteps.map(step => [step, 0])) as Record<HintStep, number> };
}
const isRoom = (value: unknown): value is RoomId => typeof value === 'string' && roomIds.includes(value as RoomId);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function restoreAdventure(raw: string): AdventureState | null {
  if (raw.length > 16000) return null;
  try {
    const value: unknown = JSON.parse(raw); if (!isRecord(value)) return null;
    const defaults = createAdventure();
    if (value.version !== 1 || !isRoom(value.room) || !['floor', 'chair', 'shelf', 'sofa'].includes(String(value.position))) return null;
    for (const key of Object.keys(defaults).filter(k => typeof defaults[k as keyof AdventureState] === 'boolean')) if (typeof value[key] !== 'boolean') return null;
    if (value.position === 'sofa' && value.room !== 'sitting room' || ['chair', 'shelf'].includes(String(value.position)) && value.room !== 'office') return null;
    if (value.fed && !value.bowlFilled || value.jarReady && !value.bowlFilled || value.treatEarned && !value.jarReady || value.bookDown !== value.noteFound || value.mouseFound && !value.cushionMoved || value.completed !== (!!value.fed && !!value.treatEarned && !!value.mouseFound)) return null;
    if (!isRecord(value.items) || !(isRoom(value.items.sock) || value.items.sock === 'carried') || !(value.items.mouse === null || value.items.mouse === 'carried' || isRoom(value.items.mouse))) return null;
    if (value.cushionMoved !== (value.items.mouse !== null) || !value.mouseFound && value.items.mouse !== null && value.items.mouse !== 'sitting room') return null;
    if (!Array.isArray(value.done) || value.done.length > flavourActionIds.length || !value.done.every(id => typeof id === 'string' && flavourActionIds.includes(id)) || new Set(value.done).size !== value.done.length) return null;
    const savedHints = value.hints;
    if (!isRecord(savedHints) || Object.keys(savedHints).length !== hintSteps.length || !hintSteps.every(step => Number.isInteger(savedHints[step]) && Number(savedHints[step]) >= 0 && Number(savedHints[step]) <= 3)) return null;
    // Copy only known fields, so unknown save data cannot enter the engine.
    const state = { ...defaults };
    for (const key of Object.keys(defaults).filter(k => !['items', 'done', 'hints'].includes(k))) (state as unknown as Record<string, unknown>)[key] = value[key];
    state.items = { sock: value.items.sock as AdventureState['items']['sock'], mouse: value.items.mouse as AdventureState['items']['mouse'] };
    state.done = [...value.done] as string[];
    state.hints = Object.fromEntries(hintSteps.map(step => [step, savedHints[step]])) as Record<HintStep, number>;
    return state;
  } catch { return null; }
}
export function peterRoom(state: AdventureState): RoomId { return state.bowlFilled ? 'kitchen' : 'office'; }
export function visibleObjects(state: AdventureState): ObjectId[] {
  return objectIds.filter(id => {
    if (id === 'peter') return state.room === peterRoom(state);
    if (id === 'sock' || id === 'mouse') return state.items[id] === state.room || state.items[id] === 'carried';
    if (id === 'note') return state.noteFound && state.room === 'office';
    if (id === 'ribbon') return state.jarReady && state.room === 'kitchen';
    return objectDefinitions[id].room === state.room;
  });
}
export function describeRoom(state: AdventureState): AdventureLine[] {
  let description = rooms[state.room].description;
  if (state.room === 'office' && state.bookDown) description = "A chair is tucked against Peter's desk. There is a gap on the low shelf above it.";
  if (!state.bowlFilled && ['downstairs hallway', 'upstairs hallway'].includes(state.room)) description += state.room === 'downstairs hallway' ? ' Keyboard taps come from upstairs.' : ' Keyboard taps come from the office.';
  if (state.room === 'office') description += state.bowlFilled ? " Peter's chair is empty." : ' Peter is at the screen, typing.';
  if (state.room === 'kitchen') description += state.bowlFilled ? state.fed ? ' Peter is here. Your bowl is licked clean.' : ' Peter is here. Your bowl is full.' : ' Your bowl is empty.';
  if (state.room === 'office' && state.bookDown) description += ' The book is on the carpet. The note is on the shelf.';
  if (state.room === 'sitting room' && state.cushionMoved) description += ' The blue cushion has been pushed aside.';
  const nearby = visibleObjects(state).filter(id => !(id === 'sock' || id === 'mouse') || state.items[id] !== 'carried');
  const carried = (['sock', 'mouse'] as const).filter(id => state.items[id] === 'carried');
  return [
    { text: rooms[state.room].name, tone: 'heading' }, { text: description },
    { text: `Nearby: ${nearby.map(id => objectDefinitions[id].name).join(', ')}.` },
    ...(carried.length ? [{ text: `Carrying: ${carried.map(id => objectDefinitions[id].name).join(', ')}.`, tone: 'dim' as const }] : []),
    ...(state.position !== 'floor' ? [{ text: `You're on the ${state.position}.`, tone: 'dim' as const }] : []),
    { text: `Exits: ${rooms[state.room].exits.join(', ')}`, tone: 'dim' },
  ];
}
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
function targetText(value: string): string {
  let target = normalize(value).replace(/^(?:at|on|onto|under|behind|with|over) /, '').replace(/^the /, '');
  if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) target = target.slice(1, -1).replace(/^the /, '');
  return target;
}
function roomTarget(value: string): string {
  const target = targetText(value).replace(/^to /, '').replace(/^the /, '');
  return target === 'upstairs hall' || target === 'upstairs' ? 'upstairs hallway' : target === 'downstairs hall' || target === 'downstairs' ? 'downstairs hallway' : target;
}
function objectTarget(value: string): ObjectId | undefined {
  const target = targetText(value);
  return objectIds.find(id => normalize(objectDefinitions[id].name) === target || objectDefinitions[id].aliases?.includes(target));
}
function objectAvailable(state: AdventureState, id: ObjectId, verb: InteractionVerb) {
  return visibleObjects(state).includes(id) || id === 'note' && verb === 'read' && state.noteFound;
}
export function interactionTargets(state: AdventureState, verb: InteractionVerb): ObjectId[] {
  if (verb === 'drop') return (['sock', 'mouse'] as const).filter(id => state.items[id] === 'carried');
  const ids = visibleObjects(state);
  if (verb === 'read' && state.noteFound && !ids.includes('note')) ids.push('note');
  return ids.filter(id => verb === 'inspect' || !!objectDefinitions[id].actions[verb]);
}
function result(state: AdventureState, text: string, tone?: AdventureLine['tone']): AdventureResult { return { state, output: [{ text, tone }] }; }
function change(state: AdventureState, patch: Partial<AdventureState>, text: string): AdventureResult { return result({ ...state, ...patch }, text); }
function move(state: AdventureState, target: string): AdventureResult {
  const destination = roomTarget(target);
  if (!target) return result(state, `Go where? Exits: ${rooms[state.room].exits.join(', ')}.`, 'error');
  if (!isRoom(destination)) return result(state, `There isn't a room called ${target}. Exits: ${rooms[state.room].exits.join(', ')}.`, 'error');
  if (destination === state.room) return result(state, `You're already in the ${state.room}.`);
  if (!rooms[state.room].exits.includes(destination)) return result(state, `You can't reach the ${destination} from here. Exits: ${rooms[state.room].exits.join(', ')}.`, 'error');
  const next: AdventureState = { ...state, room: destination, position: 'floor' };
  return { state: next, output: describeRoom(next) };
}
function inspect(state: AdventureState, id: ObjectId): AdventureResult {
  if (id === 'bowl') return result(state, state.fed ? 'The bowl is licked clean. No crumbs left to argue about.' : state.bowlFilled ? 'Food in the bowl. Finally. You can eat it.' : "The bowl is empty. Find Peter and meow. He'll know what you mean.");
  if (id === 'book' && state.bookDown) return result(state, 'The book is on the carpet now. The note it hid is worth reading.');
  if (id === 'shelf' && state.noteFound) return result(state, 'The book has left a gap on the shelf. You remember the note.');
  if (id === 'cushion' && state.cushionMoved) return result(state, 'The cushion is pushed aside. No more toys hiding behind it.');
  if (id === 'jar' && state.jarReady) return result(state, state.treatEarned ? 'Peter has shut the jar again. You have had your treat.' : 'The jar is open. Peter is waiting to see you play.');
  if (id === 'peter') return result(state, state.bowlFilled ? state.treatEarned ? 'Peter watches you. Breakfast and treats have both been dealt with.' : state.jarReady ? 'Peter has the jar open. Play with the ribbon, sock, or mouse while he watches.' : 'Peter is by the counter. A purr might persuade him to fetch treats.' : 'Peter is typing. He has forgotten the empty bowl. A meow should remind him.');
  if (id === 'door') return result(state, state.bowlFilled ? 'The office door is open. Peter went to the kitchen.' : 'The office door is open. Peter is typing inside. You can go straight in.');
  const actions = Object.keys(objectDefinitions[id].actions).filter(verb => verb !== 'drop' || (id === 'sock' || id === 'mouse') && state.items[id] === 'carried');
  return result(state, objectDefinitions[id].inspect + (actions.length ? `\nTry: ${actions.join(', ')}.` : ''));
}
function story(state: AdventureState, verb: InteractionVerb, id: ObjectId): AdventureResult {
  if (id === 'peter') {
    if (verb === 'meow') return state.bowlFilled ? result(state, state.fed ? '"You\'ve had breakfast, Luna." Peter gives you a scratch behind the ears.' : '"It\'s in your bowl." Peter points at the food.') : change(state, { bowlFilled: true }, copy.feed);
    if (!state.bowlFilled) return result(state, 'You purr against his leg. Peter scratches your head and keeps typing.\nA meow might explain the empty stomach better.');
    return state.treatEarned ? result(state, 'Peter gives you another scratch. The treat jar stays shut.') : state.jarReady ? result(state, '"Go on, then." Peter points at the ribbon. The treat jar is open.') : change(state, { jarReady: true }, copy.purr);
  }
  if (verb === 'climb' || verb === 'sit' && (id === 'chair' || id === 'sofa')) {
    const position = id === 'sofa' ? 'sofa' : id === 'shelf' ? 'shelf' : 'chair';
    if (state.position === position) return result(state, `You're already on the ${id === 'desk' ? 'chair beside the desk' : id}.`);
    return change(state, { position }, id === 'shelf' ? 'Up the chair. Across the desk. Onto the shelf.\nThe book is within reach. Paper sticks out behind it.' : id === 'sofa' ? 'You hop onto the sofa. The blue cushion is within paw range.' : 'You hop onto the chair, then lean across the desk.');
  }
  if (id === 'book') {
    if (state.bookDown) return result(state, 'The book is already on the carpet. You remember the note it hid.');
    if (state.position !== 'shelf') return result(state, 'The book is too high. You can reach it if you climb the shelf.', 'error');
    return change(state, { bookDown: true, noteFound: true }, `${copy.book}\n"${copy.note}"${state.room === peterRoom(state) ? '\nPeter looks up. "I was reading that."' : ''}`);
  }
  if (id === 'cushion') {
    if (state.cushionMoved) return result(state, 'The cushion is already out of the way.');
    if (state.position !== 'sofa') return result(state, "You stretch up from the floor. Your paw doesn't reach.\nThe sofa is low enough to climb.", 'error');
    return change(state, { cushionMoved: true, items: { ...state.items, mouse: 'sitting room' } }, copy.mouse);
  }
  if (id === 'note') return result(state, `You remember Peter's note:\n"${copy.note}"`);
  if (id === 'bowl') {
    if (verb === 'sniff') return result(state, state.fed ? 'An empty bowl that smells of breakfast. You got every bit.' : state.bowlFilled ? 'Proper breakfast. Time to eat.' : 'The bowl smells of yesterday. Peter needs reminding.');
    if (!state.bowlFilled) return result(state, 'You lick the empty bowl. Nothing. Find Peter and meow.', 'error');
    return state.fed ? result(state, 'You have already eaten. The bowl is clean.') : change(state, { fed: true }, 'You eat every bit, then check the edge of the bowl. Breakfast sorted.');
  }
  if (id === 'sock' || id === 'mouse') {
    if (verb === 'take') return state.items[id] === 'carried' ? result(state, `You're already carrying the ${id}.`) : change(state, { items: { ...state.items, [id]: 'carried' }, ...(id === 'mouse' ? { mouseFound: true } : {}) }, `You pick up the ${id} in your mouth.${id === 'mouse' ? ' Found it.' : ''}`);
    if (verb === 'drop') return state.items[id] === 'carried' ? change(state, { items: { ...state.items, [id]: state.room } }, `You put the ${id} down in the ${state.room}.`) : result(state, `You're not carrying the ${id}.`, 'error');
  }
  let play = id === 'ribbon' ? 'You pin the ribbon, let it escape, then land on it with both paws.' : id === 'sock' ? 'You fling the sock a short distance and pounce on it.' : 'You bat the mouse across the floor, then pin it by the tail.';
  if ((id === 'sock' || id === 'mouse') && state.items[id] === 'carried') play += ' You pick it up again.';
  return state.jarReady && !state.treatEarned && state.room === peterRoom(state) ? change(state, { treatEarned: true }, `${play}\nPeter puts a treat beside you. Gone in one bite.`) : result(state, `${play}${state.treatEarned && state.room === peterRoom(state) ? '\nPeter watches. You have had your treat.' : ''}`);
}
function interact(state: AdventureState, verb: InteractionVerb, target: string): AdventureResult {
  let id = objectTarget(target);
  if (!target && (verb === 'meow' || verb === 'purr')) {
    if (state.room !== peterRoom(state)) return result(state, verb === 'meow' ? "You meow into the house. Peter isn't in this room." : 'You purr quietly to yourself. Peter is elsewhere.');
    id = 'peter';
  }
  if (!target && verb === 'eat' && state.room === 'kitchen') id = 'bowl';
  if (!id) {
    const targets = interactionTargets(state, verb).map(key => objectDefinitions[key].name);
    return result(state, target ? `You can't ${verb} ${target} here.${targets.length ? ` Try: ${targets.join(', ')}.` : ' Look around or try another room.'}` : `${verb[0].toUpperCase() + verb.slice(1)} what?${targets.length ? ` Try: ${targets.join(', ')}.` : ' Nothing suitable here. Look around or try another room.'}`, 'error');
  }
  if (!objectAvailable(state, id, verb)) return result(state, `There's no ${objectDefinitions[id].name} here. Look around to see what's nearby.`, 'error');
  if (verb === 'inspect') return inspect(state, id);
  const action = objectDefinitions[id].actions[verb];
  if (!action) {
    if (verb === 'take') return result(state, id === 'peter' ? "Peter won't fit in your mouth." : `You can't carry the ${objectDefinitions[id].name}. Try the sock or your mouse.`, 'error');
    const possible = Object.keys(objectDefinitions[id].actions).filter(key => key !== 'drop');
    return result(state, `You can't ${verb} the ${objectDefinitions[id].name}.${possible.length ? ` Try: ${possible.join(', ')}.` : ' Try inspecting it.'}`, 'error');
  }
  if (action === 'story') return story(state, verb, id);
  const key = `${verb}:${id}`, seen = state.done.includes(key);
  const response = action[seen ? 'again' : 'first'] + (id === 'keyboard' && state.room === peterRoom(state) ? '\nPeter lifts your paw. "Very helpful, Luna."' : '');
  return change(state, { done: seen ? state.done : [...state.done, key], ...(id === 'sock' && verb === 'push' && state.items.sock === 'carried' ? { items: { ...state.items, sock: state.room } } : {}) }, response);
}
function hint(state: AdventureState, requested: string): AdventureResult {
  const quest = requested || (!state.fed ? 'food' : !state.treatEarned ? 'treats' : 'toy');
  if (!['food', 'treats', 'toy'].includes(quest)) return result(state, 'Try hint food, hint treats, or hint toy.', 'error');
  if (quest === 'food' && state.fed || quest === 'treats' && state.treatEarned || quest === 'toy' && state.mouseFound) return result(state, quest === 'food' ? 'Breakfast is already eaten.' : quest === 'treats' ? 'You have earned your treat.' : 'You have found your mouse.');
  let step: HintStep;
  let hints: string[];
  if (quest === 'food' && !state.bowlFilled || quest === 'treats' && !state.bowlFilled) { step = quest === 'food' ? 'food-find' : 'treats-find'; hints = ['Peter has been typing upstairs.', 'Find Peter in the office and get his attention.', 'Go upstairs to the office, then type meow.']; }
  else if (quest === 'food') { step = 'food-eat'; hints = ['Peter has opened a cupboard downstairs.', 'Your bowl is full in the kitchen.', 'Go to the kitchen, then type eat.']; }
  else if (quest === 'treats' && !state.jarReady) { step = 'treats-purr'; hints = ['Peter might have something better than breakfast.', 'He is in the kitchen, beside the treat cupboard.', 'Go to the kitchen, then type purr.']; }
  else if (quest === 'treats') { step = 'treats-play'; hints = ['Peter has the jar open. Give him a reason.', 'Play with something while Peter watches in the kitchen.', 'In the kitchen, type play ribbon. A sock or your mouse works too.']; }
  else if (state.cushionMoved) { step = 'toy-take'; hints = ['The cushion is out of the way now.', 'Your yellow mouse is on the sofa in the sitting room.', 'In the sitting room, type take mouse.']; }
  else if (!state.noteFound) {
    step = state.room === 'office' && state.position === 'shelf' ? 'toy-book' : 'toy-shelf';
    hints = step === 'toy-book' ? ['The paper is still trapped behind the book.', 'A paw would move the book out of the way.', 'Type knock book.'] : ["There's paper sticking out behind a book in the office.", "Luna can reach the shelf from Peter's desk.", 'In the office, type climb shelf, then knock book.'];
  } else {
    step = state.room === 'sitting room' && state.position === 'sofa' ? 'toy-cushion' : 'toy-sofa';
    hints = step === 'toy-cushion' ? ['Something is tucked behind the blue cushion.', 'Push the cushion out of the way.', 'Type push cushion, then take mouse.'] : ['The note mentioned somewhere soft downstairs.', 'Check the blue cushion on the sitting-room sofa.', 'In the sitting room, type climb sofa, then push cushion.'];
  }
  return change(state, { hints: { ...state.hints, [step]: Math.min(3, state.hints[step] + 1) } }, hints[Math.min(2, state.hints[step])]);
}
function run(state: AdventureState, input: string): AdventureResult {
  if (input.length > 512) return result(state, 'That is a long command. Try a verb and an item, such as sniff shoes.', 'error');
  const line = normalize(input); if (!line) return { state, output: [] };
  const split = line.indexOf(' '), rawVerb = split < 0 ? line : line.slice(0, split), rawTarget = split < 0 ? '' : line.slice(split + 1);
  const verb = canonicalVerb(rawVerb);
  const target = targetText(rawTarget);
  if (verb === 'go') return move(state, rawTarget);
  if (verb === 'up' || verb === 'down' || verb === 'climb' && target === 'down') {
    if (rawTarget && !(verb === 'climb' && target === 'down')) return result(state, `Use ${verb} on its own.`, 'error');
    if ((verb === 'down' || verb === 'climb') && state.position !== 'floor') return change(state, { position: 'floor' }, 'You hop down onto the floor.');
    if (verb === 'up' && state.room === 'downstairs hallway') return move(state, 'upstairs hallway');
    if (verb === 'down' && state.room === 'upstairs hallway') return move(state, 'downstairs hallway');
    return result(state, verb === 'climb' ? "You're already on the floor." : 'The stairs connect the two hallways. You need to be in the hallway to use them.', 'error');
  }
  if (verb === 'look') return target ? interact(state, 'inspect', target) : { state, output: describeRoom(state) };
  if (interactionVerbs.includes(verb as InteractionVerb)) return interact(state, verb as InteractionVerb, target);
  if (verb === 'hint') return hint(state, target);
  if (!['inventory', 'goals', 'map', 'help', 'restart', 'quit'].includes(verb)) return result(state, `Luna doesn't know ${rawVerb}. Type help, or try inspect followed by an item.`, 'error');
  if (target) return result(state, `Use ${verb} on its own.`, 'error');
  if (verb === 'help') return result(state, adventureHelp);
  if (verb === 'inventory') { const carried = (['sock', 'mouse'] as const).filter(id => state.items[id] === 'carried'); return result(state, carried.length ? `Carrying: ${carried.map(id => objectDefinitions[id].name).join(', ')}.` : "You're not carrying anything."); }
  if (verb === 'goals') return result(state, `${state.fed ? '[x]' : '[ ]'} Breakfast eaten\n${state.treatEarned ? '[x]' : '[ ]'} Treat earned\n${state.mouseFound ? '[x]' : '[ ]'} Mouse found`);
  if (verb === 'map') return { state, output: [{ text: `You are in: ${rooms[state.room].name}`, tone: 'heading' }, { text: houseMap, map: true }] };
  if (verb === 'quit') return { state, output: [], action: 'quit' };
  return { state, output: [{ text: 'Start a new adventure? Type yes to restart or no to keep playing.', tone: 'dim' }], action: 'restart' };
}
export function adventureInput(state: AdventureState, input: string): AdventureResult {
  const response = run(state, input);
  if (!response.state.completed && response.state.fed && response.state.treatEarned && response.state.mouseFound) {
    response.state = { ...response.state, completed: true };
    response.output.push({ text: copy.ending, tone: 'success' });
  }
  return response;
}
export function completeAdventure(input: string, state: AdventureState): { input: string; candidates: string[] } {
  const text = input.replace(/^\s+/, ''), space = text.indexOf(' ');
  let before = '', partial = normalize(text), candidates: string[];
  if (space < 0) candidates = adventureCommands.filter(command => command.startsWith(partial));
  else {
    const verb = canonicalVerb(normalize(text.slice(0, space))); before = text.slice(0, space + 1); partial = normalize(text.slice(space + 1));
    if (verb === 'go') {
      const prefix = partial.match(/^(?:to )?(?:the )?/)?.[0] ?? '';
      before += prefix; partial = partial.slice(prefix.length);
      candidates = rooms[state.room].exits.filter(room => room.startsWith(partial));
    }
    else if (verb === 'hint') candidates = ['food', 'treats', 'toy'].filter(quest => quest.startsWith(partial));
    else {
      let action = verb;
      if (action === 'look') action = 'inspect';
      const prefix = partial.match(/^(?:(?:at|on|onto|under|behind|with|over) )?(?:the )?/)?.[0] ?? '';
      before += prefix; partial = partial.slice(prefix.length);
      candidates = interactionVerbs.includes(action as InteractionVerb) ? interactionTargets(state, action as InteractionVerb).flatMap(id => {
        const object = objectDefinitions[id];
        if (normalize(object.name).startsWith(partial)) return [object.name];
        const alias = object.aliases?.find(name => name.startsWith(partial));
        return alias ? [alias] : [];
      }) : [];
      if (action === 'climb' && state.position !== 'floor' && 'down'.startsWith(partial)) candidates.push('down');
    }
  }
  if (!candidates.length) return { input, candidates };
  let common = candidates[0]; for (const candidate of candidates.slice(1)) while (!normalize(candidate).startsWith(normalize(common))) common = common.slice(0, -1);
  return { input: before + common + (candidates.length === 1 ? ' ' : ''), candidates };
}
