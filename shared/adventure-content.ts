export const roomIds = ['downstairs hallway', 'sitting room', 'kitchen', 'upstairs hallway', 'bedroom', 'office', 'bathroom'] as const;
export type RoomId = typeof roomIds[number];
export const rooms: Record<RoomId, { name: string; exits: RoomId[]; description: string }> = {
  'downstairs hallway': { name: 'Downstairs hallway', exits: ['sitting room', 'upstairs hallway'], description: "Peter's shoes are beside the doormat. A coat hangs low enough to hide behind." },
  'sitting room': { name: 'Sitting room', exits: ['downstairs hallway', 'kitchen'], description: 'The sofa has a blue cushion at one end. Your scratching post stands beside the window.' },
  kitchen: { name: 'Kitchen', exits: ['sitting room'], description: 'Your bowl is beside the treat cupboard. A shopping list is stuck to the fridge.' },
  'upstairs hallway': { name: 'Upstairs hallway', exits: ['downstairs hallway', 'bathroom', 'bedroom', 'office'], description: 'A rug runs past the office door. A patch of sunlight warms the floor.' },
  bedroom: { name: 'Bedroom', exits: ['upstairs hallway'], description: "Peter's bed is empty. The duvet hangs over the edge, beside a laundry basket and a wardrobe." },
  office: { name: 'Office', exits: ['upstairs hallway'], description: "A chair is tucked against Peter's desk. Above it, a book leans on a low shelf." },
  bathroom: { name: 'Bathroom', exits: ['upstairs hallway'], description: 'The sink tap drips. A roll of toilet paper hangs within paw range, above the bathmat.' },
};
export const interactionVerbs = ['inspect', 'climb', 'knock', 'push', 'sniff', 'paw', 'scratch', 'hide', 'sit', 'roll', 'play', 'take', 'drop', 'eat', 'read', 'meow', 'purr'] as const;
export type InteractionVerb = typeof interactionVerbs[number];
type Flavour = { first: string; again: string };
export type AdventureObject = {
  name: string; aliases?: string[]; room?: RoomId; inspect: string;
  actions: Partial<Record<Exclude<InteractionVerb, 'inspect'>, Flavour | 'story'>>;
};
const flavour = (first: string, again: string): Flavour => ({ first, again });
export const objects = {
  shoes: { name: 'shoes', aliases: ["peter's shoes"], room: 'downstairs hallway', inspect: 'Mud on the soles. Peter has been out. The laces are worth a sniff.', actions: { sniff: flavour('Damp grass, pavement, and Peter. You put your nose inside one shoe.', 'Still a shoe. Still smells of Peter.') } },
  doormat: { name: 'doormat', aliases: ['mat'], room: 'downstairs hallway', inspect: 'Rough fibres, good for a scratch. Plenty of room to roll on it.', actions: { paw: flavour('You lift a corner of the mat. Nothing underneath. You check the other corner anyway.', 'You flatten the corner with one paw.'), scratch: flavour('You hook your claws into the mat and pull. It makes a good noise.', 'A few more pulls. The mat can take it.'), roll: flavour('You flop onto the mat, paws up. A bit of leaf sticks to your fur.', 'Another roll gets the leaf off.') } },
  coat: { name: 'coat', aliases: ['hanging coat'], room: 'downstairs hallway', inspect: 'The coat nearly touches the floor. You could hide behind it.', actions: { hide: flavour('You slip behind the coat. Your tail is still showing.', 'You tuck your tail in this time.') } },
  sofa: { name: 'sofa', room: 'sitting room', inspect: 'The sofa is low enough to climb. The blue cushion is easier to reach from up there.', actions: { climb: 'story', sit: 'story' } },
  cushion: { name: 'blue cushion', aliases: ['cushion', 'sofa cushion'], room: 'sitting room', inspect: 'Something makes a small lump behind the cushion. You need to climb the sofa to push it aside.', actions: { push: 'story', paw: 'story', knock: 'story' } },
  post: { name: 'scratching post', aliases: ['post'], room: 'sitting room', inspect: 'Well-used rope. Your claws fit the old grooves.', actions: { scratch: flavour('You stretch up the post and drag both paws down. Much better.', 'You work on the other side of the post.') } },
  window: { name: 'window', room: 'sitting room', inspect: 'A pigeon is on the wall outside. It has not noticed your teeth making little clicking noises.', actions: {} },
  bowl: { name: 'bowl', aliases: ['food', 'breakfast', 'food bowl'], room: 'kitchen', inspect: 'Your food bowl. Peter knows what goes in it.', actions: { eat: 'story', sniff: 'story' } },
  cupboard: { name: 'treat cupboard', aliases: ['cupboard'], room: 'kitchen', inspect: "The treat cupboard is shut. Peter can open it. A purr might help once he's here.", actions: { sniff: flavour('You press your nose to the cupboard door. Definitely treats in there.', 'The smell has not improved your patience.') } },
  jar: { name: 'treat jar', aliases: ['jar', 'treats'], room: 'kitchen', inspect: 'Through the cupboard glass, you can see the treat jar. Peter can reach it.', actions: {} },
  list: { name: 'shopping list', aliases: ['list'], room: 'kitchen', inspect: 'The shopping list is low on the fridge. You can read it from here.', actions: { read: flavour('Milk. Bread. Cat food.\nCat food has been underlined twice.', 'Cat food. Still underlined twice.') } },
  ribbon: { name: 'ribbon', aliases: ['string'], room: 'kitchen', inspect: 'A loose ribbon, waiting for a paw. Peter is watching.', actions: { play: 'story', paw: 'story' } },
  duvet: { name: 'duvet', aliases: ['blanket', 'bed'], room: 'bedroom', inspect: 'Warm underneath, dark enough to hide. Peter is not in there.', actions: { hide: flavour('You crawl under the duvet. One small black lump in a very large bed.', 'Back under the duvet. The warm spot is still yours.') } },
  wardrobe: { name: 'wardrobe', room: 'bedroom', inspect: "The wardrobe doors are shut. Peter's dressing gown is caught in one of them.", actions: {} },
  basket: { name: 'laundry basket', aliases: ['basket'], room: 'bedroom', inspect: 'Laundry leans over the rim. Peter really should fold it.', actions: {} },
  sock: { name: 'sock', aliases: ['stray sock'], inspect: 'A soft sock, small enough to carry. You can paw it, push it, or play with it.', actions: { take: 'story', drop: 'story', play: 'story', paw: 'story', push: flavour('You push the sock across the floor. It folds itself into a better shape for pouncing.', 'Another shove sends the sock a little farther.'), sniff: flavour('Clean cotton and a faint smell of Peter. You approve.', 'You check the heel. Same sock.') } },
  chair: { name: 'chair', room: 'office', inspect: 'The chair gives you a route to the desk and shelf. You can climb or sit on it.', actions: { climb: 'story', sit: 'story' } },
  desk: { name: 'desk', room: 'office', inspect: 'The desk is reachable from the chair. The shelf is just above it.', actions: { climb: 'story' } },
  shelf: { name: 'shelf', room: 'office', inspect: 'Up the chair, across the desk, then onto the shelf. A folded corner of paper sticks out behind the book.', actions: { climb: 'story' } },
  book: { name: 'book', room: 'office', inspect: 'The book is near the edge of the shelf. Climb up and you could knock it over.', actions: { knock: 'story' } },
  keyboard: { name: 'keyboard', room: 'office', inspect: 'The keyboard is on the desk. Several keys could do with a paw.', actions: { paw: flavour('You plant a paw on the keyboard. A long row of letters fills the screen.', 'Another paw. Another row of letters.') } },
  note: { name: 'note', aliases: ['paper', 'clue'], room: 'office', inspect: "Peter's folded note. You remember what it says.", actions: { read: 'story' } },
  peter: { name: 'Peter', aliases: ['owner'], inspect: 'Peter. Opens doors, fills bowls, has the treat jar. Meow or purr to get his attention.', actions: { meow: 'story', purr: 'story' } },
  sink: { name: 'sink', room: 'bathroom', inspect: 'A drop of water circles the plug. The tap is close enough to paw.', actions: {} },
  tap: { name: 'tap', aliases: ['dripping tap'], room: 'bathroom', inspect: 'One drop at a time. Try catching one with your paw.', actions: { paw: flavour('You catch a drop. Then shake your paw as though this was the tap\'s fault.', 'Another drop. Your paw is wet again.') } },
  bathmat: { name: 'bathmat', aliases: ['bath mat'], room: 'bathroom', inspect: 'Soft and dry. A good place to sit.', actions: { sit: flavour('You sit on the bathmat with all four paws tucked in.', 'Still dry. You settle down again.') } },
  paper: { name: 'toilet paper', aliases: ['toilet roll', 'roll'], room: 'bathroom', inspect: 'A loose end hangs from the roll. One paw would pull it down.', actions: { paw: flavour('You hook the loose end. Paper rolls across the tiles. Quite a lot of paper.', 'You pat the pile. Enough for now.') } },
  door: { name: 'office door', aliases: ['door'], room: 'upstairs hallway', inspect: 'The office door is open. You can go straight in.', actions: {} },
  rug: { name: 'rug', room: 'upstairs hallway', inspect: 'A soft rug, with a patch flattened by your usual rolling spot.', actions: { sniff: flavour('You sniff along the edge of the rug. Peter walked this way.', 'You recognise every bit of this rug.'), roll: flavour('You roll onto your back and wriggle across the rug.', 'A second roll. No particular reason.') } },
  sun: { name: 'sun patch', aliases: ['sunlight', 'patch of sunlight', 'sun'], room: 'upstairs hallway', inspect: 'Sunlight falls across the floor. Just enough for one cat to sit in.', actions: { sit: flavour('You sit in the sun patch. The tip of your tail goes warm first.', 'You move a paw back into the sunlight.') } },
  mouse: { name: 'yellow mouse', aliases: ['mouse', 'toy', 'toy mouse', 'yellow toy mouse'], inspect: 'Your yellow toy mouse. Slightly chewed. You can take it or play with it.', actions: { take: 'story', drop: 'story', play: 'story', sniff: flavour('It smells of the sofa, dust, and you. Definitely your mouse.', 'Still yours. You give it another sniff.') } },
} satisfies Record<string, AdventureObject>;
export type ObjectId = keyof typeof objects;
export const objectIds = Object.keys(objects) as ObjectId[];
export const objectDefinitions: Record<ObjectId, AdventureObject> = objects;
export const flavourActionIds = objectIds.flatMap(id => Object.entries(objectDefinitions[id].actions).filter(([, action]) => action !== 'story').map(([verb]) => `${verb}:${id}`));

export const copy = {
  opening: "You're Luna. Small black cat. Empty stomach.\nPeter is somewhere upstairs. Your yellow mouse is missing.",
  feed: 'Peter looks away from the screen.\n"Breakfast? Right. Come on."\nHe heads downstairs. A cupboard opens in the kitchen. Your bowl is full.',
  purr: 'You rub against Peter\'s ankle. He reaches for the treat jar.\n"One. Show me what you\'ve got."\nHe drops a ribbon onto the floor.',
  note: 'Get Luna\'s mouse out from behind the blue sofa cushion.',
  book: 'One paw does it. The book lands on the carpet.\nA folded note is left on the shelf.',
  mouse: 'You push the cushion aside. A yellow mouse rolls onto the seat.\nThere you are.',
  ending: 'Breakfast eaten. Treat earned. Mouse found.\nYou sit down for a wash. Peter can get back to whatever he was doing.\n\nYou can keep exploring, restart, or quit.',
};
export const houseMap = `             Bedroom
                |
Bathroom -- Upstairs hall -- Office
                |
              stairs
                |
         Downstairs hall
                |
          Sitting room
                |
             Kitchen`;
export const adventureHelp = `Luna's adventure

look / look at <item>       Look around or inspect something
go <room> / up / down      Move through the house
inspect <item>             Find useful details and actions
climb / knock / push       Furniture and puzzle actions
sniff / paw / scratch      Things to investigate
hide / sit / roll          Find a comfortable spot
play <item>                Sock, ribbon, or mouse
take / drop <item>         Carry something or put it down
eat [food|bowl]            Eat breakfast
read <item>                Shopping list or discovered note
meow / purr                Get Peter's attention
inventory / goals / map   Check your things and progress
hint [food|treats|toy]     Ask for a nudge, then clearer help
restart                    Start again after confirmation
quit                       Save and return to the shell

Examples: go sitting room, sniff shoes, climb shelf.
Inspect items for ideas. Tab completes available targets.
Up/Down: history. Ctrl+L: clear. Ctrl+C: save and quit.
Selected text can be copied. No time limit or losing.`;
export const adventureInstructions = `lunas-adventure

Be Luna, Peter's small black cat. Find breakfast, earn a treat,
and track down your missing yellow mouse.

Run ~/games/lunas-adventure.game, or ./lunas-adventure.game
from ~/games. Type help inside the game for commands.

Use go <room> to move; up/down use the stairs.
Look around, inspect objects, and try meow, purr, or play.
Every interaction has an object to try it on.
Hint gives a nudge; ask again for more specific help.
Your progress is saved in this browser. Quit returns to the shell.
Restart asks for confirmation. There is no time limit or losing.`;
