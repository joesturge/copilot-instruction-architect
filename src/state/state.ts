import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface PluginState {
  baselineVersion: string;
  preferences: {
    language: string;
    style: string;
    autonomy: 'suggest' | 'review' | 'automatic' | 'disabled';
  };
  observations: SessionObservation[];
}

export interface SessionObservation {
  timestamp: string;
  type: 'correction' | 'repeated_failure' | 'repeated_workflow' | 'missing_guidance' | 'documentation_opportunity' | 'testing_opportunity' | 'security_issue';
  description: string;
  confidence: 'high' | 'medium' | 'low';
  repoRoot: string;
}

const STATE_DIR = join(homedir(), '.copilot', 'instruction-architect');
const STATE_FILE = join(STATE_DIR, 'state.json');

const DEFAULT_STATE: PluginState = {
  baselineVersion: '0.0.0',
  preferences: {
    language: 'en',
    style: 'natural',
    autonomy: 'suggest',
  },
  observations: [],
};

export async function loadState(): Promise<PluginState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) } as PluginState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(state: PluginState): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  // Redact sensitive content from observations before persisting.
  const sanitised: PluginState = {
    ...state,
    observations: state.observations.map(redactObservation),
  };
  await writeFile(STATE_FILE, JSON.stringify(sanitised, null, 2), 'utf8');
}

export async function addObservation(
  observation: Omit<SessionObservation, 'timestamp'>
): Promise<void> {
  const state = await loadState();
  state.observations.push({ ...observation, timestamp: new Date().toISOString() });
  // Keep only the last 200 observations to avoid unbounded growth.
  if (state.observations.length > 200) {
    state.observations = state.observations.slice(-200);
  }
  await saveState(state);
}

/** Remove likely secrets and sensitive data from observation descriptions. */
export function redactObservation(obs: SessionObservation): SessionObservation {
  const SECRET_PATTERN =
    /\b(api[_-]?key|password|secret|token|bearer|auth)\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi;
  return {
    ...obs,
    description: obs.description.replace(SECRET_PATTERN, '[REDACTED]'),
  };
}
