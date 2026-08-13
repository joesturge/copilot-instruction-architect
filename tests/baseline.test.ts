import { describe, it, expect } from 'vitest';
import { getBaseline, BASELINE_VERSION } from '../src/baseline/baseline.js';

describe('baseline', () => {
  it('returns a versioned baseline', () => {
    const b = getBaseline();
    expect(b.version).toBe(BASELINE_VERSION);
    expect(b.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('contains all required sections', () => {
    const b = getBaseline();
    expect(b.globalInstructions).toContain('## Documentation');
    expect(b.globalInstructions).toContain('## Testing');
    expect(b.globalInstructions).toContain('## Security');
    expect(b.globalInstructions).toContain('## Code quality');
    expect(b.globalInstructions).toContain('## Collaboration');
  });

  it('describes behaviour not repository facts', () => {
    const b = getBaseline();
    // Should not mention specific technology stacks
    expect(b.globalInstructions).not.toMatch(/\bpnpm\b/);
    expect(b.globalInstructions).not.toMatch(/\bnpm\b/);
    expect(b.globalInstructions).not.toMatch(/\byarn\b/);
  });
});
