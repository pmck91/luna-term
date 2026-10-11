export type ShellSession = { username: string; meows: number; lastFortune: number | null };
export function createShellSession(username = 'guest'): ShellSession {
  return { username, meows: 0, lastFortune: null };
}

export const secretCommands = ['ps', 'sudo', 'meow', 'man', 'fortune'];
export const lunaConfig = `# Luna household configuration
breakfast_count=2
respect_closed_doors=false
keyboard_access=unrestricted
preferred_sleep_location=clean_laundry
nap_interval=5m
treat_monitor=enabled`;

export const incidentReport = `HOUSEHOLD INCIDENT REPORT
Case: LUNA-0042
Filed by: Peter

Subject: Unscheduled gravity test
Location: Office desk

A glass of water left the desk at 08:12.
Luna was sitting beside it.

Evidence:
  One wet keyboard.
  One very dry cat.
  Paw prints on the incident form.

Statement from Luna:
  "Mrrp."

Resolution:
  Glass moved to the kitchen.
  Luna returned to the warm laptop.

Status: Closed pending the next glass.`;

export const processTable = `Luna processes (simulated)

 PID  %CPU      TIME  COMMAND
  42  94.0  08:12:03  napd
  73   4.0  00:21:16  birdwatch
 108   2.0  00:09:41  treat-monitor`;

export const lunaManual = `LUNA(1)   Luna Manual   LUNA(1)

NAME
    luna - small black cat

DESCRIPTION
    Lives in Peter's house.
    Keeps track of bowls, doors,
    and unattended keyboards.

ACTIONS
    meow     Request breakfast.
    purr     Open negotiations.
    play     Earn a treat.
    nap      Resume normal duties.

PREFERRED SLEEP LOCATIONS
    Clean laundry.
    The warm part of the couch.
    Whatever Peter is using.

KNOWN BUGS
    Occasionally enters a room
    and forgets why.
    Breakfast requests may repeat
    after successful delivery.

SEE ALSO
    ~/.config/luna.conf, fortune`;

export const meowResponses = ['Mrrp.', 'Meow.', 'MEOW.', 'Peter has heard you.'] as const;
export const fortunes = [
  'A closed door is a temporary implementation detail.',
  'Breakfast is a recurring task.',
  'Never leave a keyboard unattended.',
  'A sock left on the floor is public property.',
  'Check the bowl. The situation may have changed.',
  'A sunbeam is a perfectly good reason to stop.',
  'Clean laundry is a deployment target.',
  'If the cupboard opens, investigate.',
  'The warmest seat belongs to whoever gets there first.',
  'Always check the box before reading the instructions.',
] as const;

export function nextFortune(previous: number | null, random: () => number): number {
  const choices = fortunes.map((_, index) => index).filter(index => index !== previous);
  return choices[Math.floor(random() * choices.length)];
}
