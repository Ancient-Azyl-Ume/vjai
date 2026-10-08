import { call } from "../../rpc";

// User config: ~/.config/vjai/config.json under Tauri, localStorage in the browser.
// It holds everything that is not part of the show: api key, recent files, ui prefs,
// and the autosave copy of the document.
export type Config = {
  apiKey?: string;
  recent?: string[];
  accent?: string;
  previewScale?: number;
  autosave?: { doc: unknown; at: number; name: string };
  lastSave?: { path: string; at: number };
  [k: string]: unknown;
};

export async function readConfig(): Promise<Config> {
  try {
    return (await call<Config>("get_config")) ?? {};
  } catch {
    return {};
  }
}

// Always read-modify-write, and serialized: the chat api key, the recent list and the
// autosave all land in the same file, and two overlapping writes would drop keys.
let queue: Promise<unknown> = Promise.resolve();
export function writeConfig(part: Config): Promise<Config> {
  const run = async () => {
    const cfg = { ...(await readConfig()), ...part };
    await call("set_config", { config: cfg });
    return cfg;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

export async function addRecent(path: string): Promise<string[]> {
  const cfg = await readConfig();
  const recent = [path, ...(cfg.recent ?? []).filter((p) => p !== path)].slice(0, 8);
  await writeConfig({ recent });
  return recent;
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}
