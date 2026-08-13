import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { platform } from 'node:os';

const HOOKS_DIR = join(
  new URL('..', import.meta.url).pathname,
  'hooks'
);

describe('session-start.sh', () => {
  // Shell script tests only run on POSIX (Linux / macOS / WSL).
  const runSh = platform() !== 'win32';

  it('outputs valid additionalContext JSON', { skip: !runSh }, () => {
    const output = execSync(
      `sh "${join(HOOKS_DIR, 'session-start.sh')}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim();
    const parsed = JSON.parse(output);
    expect(typeof parsed.additionalContext).toBe('string');
    expect(parsed.additionalContext.length).toBeGreaterThan(0);
    expect(parsed.additionalContext).toContain('instruction-architect');
  });

  it('normalises backslashes to forward slashes in PLUGIN_ROOT', { skip: !runSh }, () => {
    // The normalization logic used by the previous hook scripts still works.
    const raw = '\\home\\user\\.copilot\\installed-plugins\\ia';
    const normalised = execSync(
      `printf '%s' '${raw}' | sed 's|\\\\|/|g'`,
      { encoding: 'utf8' }
    ).trim();
    expect(normalised).toBe('/home/user/.copilot/installed-plugins/ia');
    expect(normalised).not.toContain('\\');
  });
});
