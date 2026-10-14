import path from 'path';
import os from 'os';

/** Carpeta de notas aislada para e2e (fuera del repo, se limpia en cada run). */
export const E2E_DIR = path.join(os.tmpdir(), 'notas-app-e2e');
export const E2E_CONFIG = path.join(os.tmpdir(), 'notas-app-e2e-config.json');
