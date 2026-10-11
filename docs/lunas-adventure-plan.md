# lunas-adventure

Design for a small text adventure inside the existing terminal. The engine is implemented in `shared/adventure.ts`, with room and item copy in `shared/adventure-content.ts`.

## Premise and scope

Luna is a small, mischievous black cat in Peter's house. She wants breakfast, a treat, and her missing yellow toy mouse. Aim for a first playthrough of about 10–15 minutes, with seven rooms and two small toy puzzles.

No losing, hunger meter, or time limit. Progress resumes in this browser. `restart` asks for confirmation before replacing the save.

## House

All connections work in both directions. There are no additional shortcuts.

```text
             Bedroom
                |
Bathroom -- Upstairs hall -- Office
                |
              stairs
                |
         Downstairs hall
                |
          Sitting room
                |
             Kitchen
```

Start in the downstairs hallway. `go sitting room` moves into an adjacent room. `up` and `down` use the stairs from the appropriate hallway. Accept `upstairs hallway`, `upstairs hall`, `downstairs hallway`, and `downstairs hall` as room aliases. Exits always show the names that commands accept.

Moving to an unconnected room gives the available exits without changing location. For example: `You can't reach the kitchen from here. Exits: upstairs hallway.`

## Objectives

### Get fed

1. The opening description mentions keyboard taps upstairs. Inspecting the upstairs hallway points toward the office.
2. The office door is shut. `inspect door` shows scratch marks; `scratch door` makes Peter open it. Luna slips inside and Peter returns to his desk. The office stays open afterwards.
3. `meow` or `meow peter` gets his attention. He heads to the kitchen and fills Luna's bowl. Luna stays in the office and follows using the normal room connections.
4. `eat` or `eat food` in the kitchen completes breakfast.

Peter starts in the office and stays in the kitchen after filling the bowl. He does not move on a timer. Players cannot miss him. Repeated meows get a short response without producing more food.

### Earn a treat

1. `purr` near Peter makes him fetch the treat jar. This can happen before or after Luna eats, once he is in the kitchen.
2. He drops a ribbon and asks Luna to play.
3. `play ribbon` earns a treat. Luna eats it as part of the response, completing this objective. Playing with the sock or recovered mouse also earns it, if Peter has fetched the jar and is there to watch.

No need to spam actions or guess an affection score. Food, treats, and ribbon responses change when their steps are complete. Playing elsewhere still produces a small room-specific response, but does not earn a treat without Peter watching.

### Find the mouse

Puzzle one, in the office:

- Inspect the shelf or book. A folded corner of paper is visible behind the book.
- `climb shelf` takes Luna up via the chair and desk. The description makes this route clear; separate chair and desk commands are optional.
- `knock book` tips the book onto the carpet, exposing Peter's note: `Remember to get Luna's mouse out from behind the blue couch cushion.`
- `read note` reads it again. `down` or `climb down` returns to the floor. Moving to another room also puts Luna safely on the floor.

Puzzle two, in the sitting room:

- After finding the note, `inspect couch` identifies the blue cushion. From the floor, Luna cannot get behind it.
- `climb couch` brings the cushion within reach.
- `push cushion` moves it and releases the mouse. Accept `paw cushion` and `knock cushion` too.
- `take mouse` picks it up. Accept `toy` and `toy mouse` as aliases. `play mouse` then gets a short celebratory response.

Finding the note reveals the cushion in room descriptions, inspection targets, and Tab completion. Cushion actions are unavailable before that discovery. Wrong actions explain the problem. There are no disposable tools or irreversible puzzle failures. Existing saves from before this change retain any mouse progress.

All three objectives complete the adventure. Show a short ending and allow continued exploration, quitting, or restarting. The bedroom and bathroom puzzles are optional and do not change this ending.

## Optional puzzles and kitchen scene

### Bedroom: wardrobe den

`inspect wardrobe` reveals the dressing gown sleeve trapped under the door and folded jumpers inside. `paw dressing gown` frees it; `push wardrobe door` opens the wardrobe; `hide wardrobe` claims the den. The gown is not an interaction target until discovered. Early attempts give clues, and completed steps cannot be undone. Luna can revisit her den after completing the puzzle. `hint bedroom` progresses from inspecting the wardrobe through freeing the sleeve, opening the door, and hiding inside.

### Bathroom: ping-pong ball

`inspect sink` reveals the ball stuck in the plug recess and the rubber plug. `climb sink` reaches the rim, `push plug` closes the drain, and `paw tap` adds a little water. Luna closes the tap as soon as the ball floats. `paw ball` knocks it onto the bathmat, completes the optional puzzle, and brings Luna back to the floor. Water without the plug drains away; pawing the stuck ball only spins it. No timers, overflow, or losing.

The rescued ball can be played with, carried, dropped, and retrieved. Playing with it near Peter can earn the existing treat. It is separate from the missing yellow mouse. `hint bathroom` follows discovery, reaching the rim, closing the plug, filling the basin, and rescuing the ball. Optional progress is saved and appears under `Optional` in `goals`; plain `hint` still follows the main objectives.

### Kitchen: fox friend

The kitchen includes a glass back door. `look at back door` or `inspect back door` shows the neighbourhood fox on the patio. Luna's tail puffs up with excitement and she presses her nose to the glass. A repeat visit has a shorter response. This scene does not affect any puzzle or main objective.

## Room interactions

Descriptions mention interactable objects. `inspect` adds useful detail or a small response. Every room has at least three optional interactions, apart from movement and quest actions.

| Room | Objects and actions | Purpose |
| --- | --- | --- |
| Downstairs hallway | Sniff Peter's shoes; paw the doormat; hide behind a hanging coat | Introduce Luna, orient the player, and point upstairs toward keyboard taps |
| Sitting room | Climb the couch; push the blue cushion; scratch the scratching post; inspect the window | Mouse puzzle and harmless distractions |
| Kitchen | Inspect/eat from the bowl; sniff the treat cupboard; inspect the jar; read the shopping list; play with Peter's ribbon | Breakfast and treat quests |
| Bedroom | Hide under the duvet; inspect the wardrobe; paw, play with, or take the sock beside the laundry basket | Optional hiding place and play; wardrobe den puzzle |
| Office | Inspect Peter; meow/purr; climb the chair or shelf; knock the book; paw the keyboard; read the note | Find Peter and uncover the toy clue |
| Bathroom | Inspect the sink; paw the dripping tap; sit on the bathmat; paw the toilet paper to unroll it | Cat reactions and small, harmless messes |
| Upstairs hallway | Inspect the office door; sniff the rug; roll on the rug; sit in the patch of sunlight | Point toward Peter and connect the upstairs rooms |

Peter reacts to the keyboard and falling book if present. When absent, descriptions reflect his empty chair. Flavour actions do not block quest progress. Repeated actions have sensible follow-up text rather than replaying an event that has already happened.

## Targets for every interaction

Every interaction verb in `help` must have a reachable, working target. Some targets appear as the story advances, but none exist only as examples in the instructions. These are minimum targets; objects may support several actions.

| Verb | Working targets | Availability or response |
| --- | --- | --- |
| `inspect` / `look at` | Every visible object, and Peter | Identify useful details and suggest sensible actions |
| `climb` | Chair, shelf, couch | Chair and shelf in the office; couch in the sitting room |
| `knock` | Book, cushion | Book is reachable from the shelf; cushion from the couch |
| `push` | Cushion, sock | Cushion advances the puzzle; sock slides across the bedroom floor |
| `sniff` | Shoes, rug, cupboard, sock, mouse | Available objects have their own short responses |
| `paw` | Doormat, tap, keyboard, toilet paper, cushion, sock | Tap splashes; keyboard gets Peter's reaction; paper unrolls |
| `scratch` | Scratching post, doormat | Post is in the sitting room; mat in the downstairs hallway |
| `hide` | Coat, duvet | Hide behind the coat or under the duvet; the next action comes back out |
| `sit` | Bathmat, chair, couch, sun patch | Rest briefly on a suitable surface |
| `roll` | Rug, doormat | Roll on the upstairs rug or downstairs mat |
| `play` | Sock, ribbon, mouse | Sock is available from the start; ribbon after Peter fetches treats; mouse after finding it |
| `take` | Sock, mouse | Carry in Luna's mouth; the mouse must first be uncovered |
| `drop` | A carried sock or mouse | Put it in the current room, where it stays available to retrieve |
| `eat` | Food / bowl | Peter fills the kitchen bowl after Luna gets his attention |
| `read` | Shopping list, note | List is on the kitchen fridge from the start; note is revealed by the book |
| `meow` | Peter | With Peter present, use bare `meow` or `meow peter`; elsewhere Luna calls into the house |
| `purr` | Peter | With Peter present, use bare `purr` or `purr peter`; elsewhere Luna purrs to herself |

`look` names visible objects in the room description. `inspect <item>` gives practical clues, such as `The couch is low enough to climb.` or `A soft sock, small enough to carry. You can paw it, push it, or play with it.` Furniture, a closed cupboard, and Peter cannot be picked up. Explain that in plain language if attempted.

Completion and missing-target messages use the same per-object action definitions as the game engine. Only suggest targets that are present, carried, or explicitly visible but out of reach. Reachable actions work immediately; out-of-reach ones explain how Luna can get closer. Hidden objects do not appear in completion until discovered. This keeps help, hints, object descriptions, and actual commands consistent.

Carryable objects remain usable after moving between rooms. Dropping the mouse does not erase the fact that Luna found it or undo completion; its saved location lets her retrieve it again. No object can be destroyed or dropped somewhere inaccessible.

## Commands and terminal behaviour

Launch `~/games/lunas-adventure.game`, or `./lunas-adventure.game` from `~/games`. Add `~/games/lunas-adventure-readme.txt`. Keep `2048-readme.txt` and `bonsai-readme.txt` unchanged. Do not add a shell alias for the first version.

Use `luna>` as the active prompt. Each action is echoed and its response appends to scrollback. Room names, exits, dialogue, and items remain selectable terminal text, with restrained colours from the active theme. There are no buttons, inventory panels, clickable command choices, or separate game layout.

Support:

```text
look                         Describe this room again
look at <item> / inspect      Inspect an object or Peter
go <room>                    Use a connected exit
up / down                    Use stairs, or climb down from furniture
meow / purr                  Get Peter's attention or ask for treats
climb / knock / push <item>   Interact with furniture and objects
sniff / paw / scratch <item>  Explore as a cat
hide / sit / roll <item>      Optional room actions
play <item>                  Play with something
take / drop <item>           Carry an object or put it down
eat [food|bowl]              Eat breakfast
read <item>                  Read the shopping list or discovered note
inventory                    List carried items
goals                        Show breakfast, treat, and mouse progress
map                          Show the house and current room
hint [food|treats|toy]        Give the next useful hint
help                         List commands and examples
restart                      Confirm a fresh game with yes/no
quit                         Save and return to the shell
```

Allow case-insensitive input, optional `the`, natural multiword object names, and a small explicit set of aliases. Bare `inspect` or `climb` asks for a target and lists relevant nearby objects. Unsupported actions give an example instead of generic failure text. Do not promise arbitrary natural-language parsing.

Tab completes verbs, adjacent rooms, and available targets, including multiword names. Up/Down use an adventure-specific history; game actions do not enter shell history. Enter submits on desktop and mobile. Preserve selection/copy, Escape to focus the prompt, and Page Up/Down to scroll. Ctrl+C saves and exits unless text is selected, in which case it copies. Ctrl+L clears scrollback and prints the current room again without resetting progress. Quitting restores the previous shell directory and history.

The existing fixed-height terminal and persistent command line stay in place. Keep output blocks short and let only terminal scrollback grow. No animation is necessary.

## Hints

Hints depend on current progress. `hint` prioritises the next unfinished step; named hints let players choose a quest. Repeated requests for the same step move from a nudge, to the relevant object, to the exact command. Reset that hint sequence when the step changes. No penalty for asking, and no automatic spoilers.

Example toy hints before finding the note:

1. `There's paper sticking out behind a book in the office.`
2. `Luna can reach the shelf from Peter's desk.`
3. `In the office, type climb shelf, then knock book.`

After the note, hints point to climbing the couch and pushing the cushion. If the mouse has already been found, hints stop suggesting either toy puzzle.

## Copy examples

Use short, concrete sentences, plain dialogue, and a little dry humour. Avoid stock adventure introductions, grand descriptions, em dashes, and repeated praise after actions. Do not narrate every harmless action as a major event.

Opening:

```text
lunas-adventure

You're Luna. A small black cat. Empty stomach.
Peter is somewhere upstairs. Your yellow mouse is missing.

Downstairs hallway
Peter's shoes are beside the doormat. A coat hangs low enough to hide behind. Keyboard taps come from upstairs.

Nearby: shoes, doormat, coat.

Exits: sitting room, upstairs hallway
Type help for commands, or hint if you're stuck.
```

Getting attention:

```text
luna> meow
Peter looks away from the screen.
"Breakfast? Right. Come on."
He heads downstairs. A cupboard opens in the kitchen. Your bowl is full.
```

Treats:

```text
luna> purr
You rub against Peter's ankle. He reaches for the treat jar.
"Only after you hunt for it!"
He drops a ribbon onto the floor.

luna> play ribbon
You pin the ribbon, let it escape, then land on it with both paws.
Peter puts a treat beside you. Gone in one bite.
```

Book puzzle:

```text
luna> knock book
One paw does it. The book lands on the carpet.
A folded note is left on the shelf.
"Remember to get Luna's mouse out from behind the blue couch cushion."
Peter looks up. "I was reading that."
```

Repeating the keyboard interaction while Peter is still in the office:

```text
luna> paw keyboard
You plant a paw on the keyboard. A long row of letters fills the screen.
Peter lifts your paw. "Very helpful, Luna."

luna> paw keyboard
Another paw sends the important message to Peter's boss.
Peter lifts your paw. "Very helpful, Luna."
```

Incorrect reach:

```text
luna> push cushion
You stretch up from the floor. Your paw doesn't reach.
The couch is low enough to climb.
```

Ending:

```text
Breakfast eaten. Treat earned. Mouse found.
You sit down for a well earned purr and a loaf. Peter can get back to whatever he was doing.

You can keep exploring, restart, or quit.
```

## Implementation

- Add a pure TypeScript adventure engine in `shared/`, containing room connections, command parsing, state transitions, text responses, hints, and completion. Use explicit state and allowlisted actions, not evaluated input or a language model.
- Keep room descriptions and dialogue in a separate content module so copy can be edited without changing puzzle logic.
- Extend the virtual shell with the new runnable entry and readme, then integrate adventure mode with the existing input, output blocks, focus, and keyboard handling in `Terminal.tsx`.
- Store a small versioned save under a dedicated browser-storage key. Validate room IDs, item IDs, flags, and quest prerequisites before restoring. Save after state changes, including completion. If storage is unavailable, allow play for this session and state that it will not be saved. If a save is incompatible or corrupt, explain briefly and start fresh.
- Inventory contains the sock, mouse, and rescued ping-pong ball when collected. Save their room locations when dropped. Version-two saves include the office door, optional puzzle flags, sink-rim position, ball location, and fox visit. Version-one saves migrate with existing progress intact and an open office door. The note stays readable after discovery. Food, treats, and furniture remain room state, rather than requiring a general use-item system.
- No backend, database migration, admin editor, new dependency, or uploaded media is needed for this version.

## Verification

Unit tests cover the exact bidirectional house graph, invalid movement, object reach and presence, parser aliases, Tab completion, repeated actions, hint stages, all quest transitions, optional puzzles in every order with the main ending, office-door access, fox visits, legacy-save migration, cushion discovery after the note, out-of-order objectives, completion, and save validation. Include complete walkthroughs and ensure no reachable quest state requires restarting. Add a coverage check that every advertised interaction verb has at least one reachable target and a successful response; test that suggested object actions match the engine. Verify carrying, dropping, retrieving, and playing with items across rooms, including earning a treat with each playable object and retaining the found-mouse objective after dropping it.

Browser checks cover launching through virtual paths, adventure history, prompts and keyboard controls, save/resume, confirmed restart, storage failure, quitting back to the shell, selection/copy, internal scrollback, and retained progress after clearing. Verify room text and the map at desktop and small mobile sizes, including a shortened keyboard viewport. Check theme inheritance, a visible focused prompt, and no page scrolling. Run the existing 2048, bonsai, terminal, contact, and admin regression checks before completing implementation.
