import { describe, expect, it } from 'vitest';
import { execute, complete } from '../shared/shell';
import { createShellSession, fortunes, incidentReport, lunaConfig, lunaManual, meowResponses, processTable, type ShellSession } from '../shared/secrets';
import type { Catalog } from '../shared/models';
const catalog: Catalog = { entries: [], socials: [], repositoryUrl: null, albums: [], pictures: [] };

describe('terminal secrets', () => {
  it('prints a clearly simulated process table with napd using the most CPU', () => {
    const result = execute('ps', '/games', catalog);
    expect(result.output).toEqual([{ type: 'text', text: processTable }]);
    expect(processTable).toContain('(simulated)');
    const rows = processTable.split('\n').filter(line => /^\s+\d+/.test(line)).map(line => line.trim().split(/\s+/));
    expect(rows.map(row => row[3])).toEqual(['napd', 'birdwatch', 'treat-monitor']);
    expect(Number(rows[0][1])).toBeGreaterThan(Number(rows[1][1]) + Number(rows[2][1]));
    expect(result.action).toBeUndefined();
  });
  it('hides the virtual config until requested and supports relative/absolute paths and ls -a', () => {
    expect(execute('ls', '/', catalog).output[0]).not.toHaveProperty('text', expect.stringContaining('.config'));
    for (const command of ['ls -a', 'ls --all', 'ls ~ -a']) expect(execute(command, '/', catalog).output[0]).toMatchObject({ text: expect.stringContaining('.config/') });
    expect(execute('cd ~/.config', '/games', catalog).cwd).toBe('/.config');
    for (const [command, cwd] of [['cat ~/.config/luna.conf', '/games'], ['cat luna.conf', '/.config'], ['cat ../.config/luna.conf', '/pictures']]) {
      expect(execute(command, cwd, catalog).output).toEqual([{ type: 'text', text: lunaConfig }]);
    }
    expect(execute('ls', '/.config', catalog).output[0]).toMatchObject({ text: 'luna.conf' });
    expect(execute('cat ~/.config/.env', '/', catalog).output[0]).toMatchObject({ tone: 'error' });
    expect(execute('./.config/luna.conf', '/', catalog).output[0]).toMatchObject({ tone: 'error' });
  });
  it('lets visitors discover and read the hidden incident report without running it', () => {
    expect(execute('ls ~/documents', '/', catalog).output[0]).not.toHaveProperty('text', expect.stringContaining('.incident-report.txt'));
    expect(execute('ls -a ~/documents', '/games', catalog).output[0]).toMatchObject({ text: expect.stringContaining('.incident-report.txt') });
    expect(complete('cat ~/documents/', '/', catalog).candidates).not.toContain('~/documents/.incident-report.txt');
    expect(complete('cat ~/documents/.inc', '/games', catalog).input).toBe('cat ~/documents/.incident-report.txt ');
    expect(complete('ls -a ~/documents/.inc', '/', catalog).input).toBe('ls -a ~/documents/.incident-report.txt ');
    for (const [command, cwd] of [['cat ~/documents/.incident-report.txt', '/games'], ['cat .incident-report.txt', '/documents']]) {
      expect(execute(command, cwd, catalog)).toEqual({ output: [{ type: 'text', text: incidentReport }] });
    }
    expect(execute('~/documents/.incident-report.txt', '/', catalog).output[0]).toMatchObject({ tone: 'error', text: expect.stringContaining('Not a runnable entry') });
  });
  it('uses the visitor username for sudo and treats its arguments as inert text', () => {
    const session = createShellSession('Peter McKinney');
    for (const command of ['sudo', 'sudo cat ~/.config/luna.conf', 'sudo rm -rf /', 'sudo $(id)']) {
      const result = execute(command, '/', catalog, session);
      expect(result.output).toEqual([{ type: 'text', text: 'Peter McKinney is not in the sudoers file. This incident will be ignored.' }]);
      expect(result.action).toBeUndefined(); expect(result.cwd).toBeUndefined(); expect(result.session).toBeUndefined();
    }
    expect(execute('sudo', '/', catalog, createShellSession('<script>alert(1)</script>')).output[0]).toMatchObject({ text: expect.stringContaining('<script>alert(1)</script> is not in') });
  });
  it('changes repeated meows, caps the counter, and preserves unrelated session fields', () => {
    let session: ShellSession = { ...createShellSession('visitor'), lastFortune: 3 };
    for (const response of [...meowResponses, 'Peter has heard you.', 'Peter has heard you.']) {
      const previous = { ...session }, result = execute('meow', '/pictures', catalog, session);
      expect(result.output).toEqual([{ type: 'text', text: response }]); expect(session).toEqual(previous);
      session = result.session!; expect(session.username).toBe('visitor'); expect(session.lastFortune).toBe(3);
    }
    expect(session.meows).toBe(4); expect(createShellSession('visitor').meows).toBe(0);
    expect(execute('meow extra', '/', catalog, session).session).toBeUndefined();
  });
  it('shows the mock manual and handles missing or unknown pages', () => {
    expect(execute('man luna', '/', catalog).output).toEqual([{ type: 'text', text: lunaManual }]);
    expect(lunaManual).toContain('PREFERRED SLEEP LOCATIONS'); expect(lunaManual).toContain('and forgets why.');
    expect(execute('man', '/', catalog).output[0]).toMatchObject({ tone: 'error', text: 'Usage: man <name>' });
    expect(execute('man dog', '/', catalog).output[0]).toMatchObject({ tone: 'error', text: 'No manual entry for dog.' });
  });
  it('chooses fortunes without immediate repeats and leaves the input session immutable', () => {
    for (const random of [() => 0, () => 0.999999]) {
      let session = createShellSession('visitor'), previousText: string | undefined;
      for (let count = 0; count < 20; count++) {
        const before = { ...session }, result = execute('fortune', '/', catalog, session, random);
        const output = result.output[0]; expect(output.type).toBe('text');
        if (output.type !== 'text') throw new Error('Expected text');
        expect(fortunes).toContain(output.text); expect(output.text).not.toBe(previousText); expect(session).toEqual(before);
        session = result.session!; previousText = output.text;
      }
    }
    for (const command of ['fortune extra', 'ps extra', 'man luna extra']) expect(execute(command, '/', catalog).output[0]).toMatchObject({ tone: 'error' });
  });
  it('keeps secrets out of help but completes commands, manual pages and explicit hidden paths', () => {
    const output = execute('help', '/', catalog).output[0]; expect(output.type).toBe('text');
    if (output.type !== 'text') throw new Error('Expected text');
    expect(output.text).not.toMatch(/\b(?:sudo|fortune|meow|napd)\b/);
    expect(complete('for', '/', catalog).input).toBe('fortune ');
    expect(complete('me', '/', catalog).input).toBe('meow ');
    expect(complete('man lu', '/', catalog).input).toBe('man luna ');
    expect(complete('cd ', '/', catalog).candidates).not.toContain('.config/');
    expect(complete('cat ~/', '/', catalog).candidates).not.toContain('~/.config/');
    expect(complete('cd ~/.c', '/', catalog).input).toBe('cd ~/.config/');
    expect(complete('cat ~/.config/lu', '/', catalog).input).toBe('cat ~/.config/luna.conf ');
    expect(complete('ls -a ', '/', catalog).candidates).toContain('.config/');
    expect(complete('ls --a', '/', catalog).input).toBe('ls --all ');
  });
});
