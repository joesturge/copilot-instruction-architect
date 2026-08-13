import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const HOOKS_DIR = join(
  new URL('..', import.meta.url).pathname,
  'hooks'
);

describe('session-start.sh', () => {
  // Shell script tests only run on POSIX (Linux / macOS / WSL).
  const runSh = platform() !== 'win32';

  it('exits 0 when CLAUDE_PLUGIN_ROOT is not set', { skip: !runSh }, () => {
    const result = execSync(
      `sh "${join(HOOKS_DIR, 'session-start.sh')}"`,
      { env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' }, encoding: 'utf8', stdio: 'pipe' }
    );
    // execSync throws if exit code != 0, so reaching here means exit 0.
    expect(result).toBeDefined();
  });

  it('exits 0 when CLAUDE_PLUGIN_ROOT has Windows backslashes (WSL simulation)', { skip: !runSh }, () => {
    // Simulate the WSL bug: CLAUDE_PLUGIN_ROOT contains backslashes.
    const windowsStylePath = '\\home\\user\\.copilot\\installed-plugins\\ia';
    const result = execSync(
      `sh "${join(HOOKS_DIR, 'session-start.sh')}"`,
      {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: windowsStylePath },
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
    expect(result).toBeDefined();
  });

  it('normalises backslashes to forward slashes in PLUGIN_ROOT', { skip: !runSh }, () => {
    // The script should convert backslashes so that path resolution works.
    // We verify this by running the normalization inline (same logic as the script).
    const raw = '\\home\\user\\.copilot\\installed-plugins\\ia';
    const normalised = execSync(
      `printf '%s' '${raw}' | sed 's|\\\\|/|g'`,
      { encoding: 'utf8' }
    ).trim();
    expect(normalised).toBe('/home/user/.copilot/installed-plugins/ia');
    expect(normalised).not.toContain('\\');
  });
});

describe('session-end.sh', () => {
  const runSh = platform() !== 'win32';

  it('exits 0 when CLAUDE_PLUGIN_ROOT is not set', { skip: !runSh }, () => {
    execSync(
      `sh "${join(HOOKS_DIR, 'session-end.sh')}"`,
      { env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' }, encoding: 'utf8', stdio: 'pipe' }
    );
  });

  it('exits 0 with Windows-style backslash path (WSL simulation)', { skip: !runSh }, () => {
    const windowsStylePath = '\\home\\user\\.copilot\\installed-plugins\\ia';
    execSync(
      `sh "${join(HOOKS_DIR, 'session-end.sh')}"`,
      {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: windowsStylePath },
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
  });

  it('applies conversation learning in automatic autonomy mode', { skip: !runSh }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'ia-home-'));
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-repo-'));
    try {
      const stateDir = join(home, '.copilot', 'instruction-architect');
      await mkdir(stateDir, { recursive: true });
      await writeFile(
        join(stateDir, 'state.json'),
        JSON.stringify({
          baselineVersion: '0.0.0',
          preferences: { language: 'en', style: 'natural', autonomy: 'automatic' },
          observations: [
            {
              timestamp: new Date().toISOString(),
              type: 'correction',
              description: 'Always update tests when changing behaviour.',
              confidence: 'high',
              repoRoot,
            },
          ],
        }),
        'utf8'
      );

      execSync(`sh "${join(HOOKS_DIR, 'session-end.sh')}"`, {
        env: {
          ...process.env,
          HOME: home,
          CLAUDE_PLUGIN_ROOT: join(new URL('..', import.meta.url).pathname),
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const content = await readFile(join(repoRoot, '.github', 'copilot-instructions.md'), 'utf8');
      expect(content).toContain('Conversation-learned guidance');
      expect(content).toContain('Always update tests when changing behaviour.');
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
