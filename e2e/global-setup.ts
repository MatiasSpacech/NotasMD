import fs from 'fs';
import { E2E_DIR, E2E_CONFIG } from './paths';

/** Limpieza global: empezar cada run con la carpeta vacía. */
async function globalSetup() {
  await fs.promises.rm(E2E_DIR, { recursive: true, force: true });
  await fs.promises.rm(E2E_CONFIG, { force: true });
  await fs.promises.mkdir(E2E_DIR, { recursive: true });
}

export default globalSetup;
