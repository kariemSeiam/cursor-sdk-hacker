import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const LEDGER_DIR = ".venom-swarm";

/**
 * Create a disposable directory for a faux repo root with optional ledger JSON.
 * @returns {{ root: string, dispose: () => void }}
 */
export function makeTmpRepo(fixtureState = null) {
  const root = mkdtempSync(join(tmpdir(), "ledger-test-"));
  if (fixtureState !== null) {
    const dir = join(root, LEDGER_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ledger.json"), JSON.stringify(fixtureState, null, 2));
  }
  return {
    root,
    dispose: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
