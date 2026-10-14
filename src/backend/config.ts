import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Configuración global de la aplicación
 */
export interface AppConfig {
  /** Carpeta raíz donde se almacenan las notas .md */
  noteFolder: string;
  /** Carpeta para historial de versiones */
  historyFolder: string;
  /** Máximo de versiones por nota */
  maxVersions: number;
}

/** Fichero donde se persiste la configuración (para que POST /api/config sobreviva reinicios) */
function getPersistPath(): string {
  if (process.env.NOTAS_CONFIG_PATH) return process.env.NOTAS_CONFIG_PATH;
  return path.join(os.homedir(), '.notas-app-config.json');
}

interface PersistedConfig {
  noteFolder?: string;
  maxVersions?: number;
}

/** Leer config persistida de disco (si existe). Nunca lanza. */
function loadPersisted(): PersistedConfig {
  try {
    const p = getPersistPath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedConfig;
    return {
      noteFolder: typeof parsed.noteFolder === 'string' ? parsed.noteFolder : undefined,
      maxVersions:
        typeof parsed.maxVersions === 'number' &&
        Number.isInteger(parsed.maxVersions) &&
        parsed.maxVersions > 0
          ? parsed.maxVersions
          : undefined,
    };
  } catch {
    return {};
  }
}

/** Overrides en memoria (hidratados desde disco al arrancar) */
let overrides: PersistedConfig = loadPersisted();

/** Recargar overrides desde disco (útil en tests) */
export function reloadConfig(): void {
  overrides = loadPersisted();
}

/**
 * Obtener la carpeta de notas (por defecto ~/Notas)
 * Prioridad: override persistido > env NOTAS_FOLDER > ~/Notas
 */
function getNoteFolder(): string {
  if (overrides.noteFolder) return overrides.noteFolder;
  const envFolder = process.env.NOTAS_FOLDER;
  if (envFolder) return envFolder;

  return path.join(os.homedir(), 'Notas');
}

/**
 * Obtener la carpeta de historial
 */
function getHistoryFolder(noteFolder: string): string {
  return path.join(noteFolder, '.notas-history');
}

/**
 * Crear directorio si no existe
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`[config] Creada carpeta: ${dirPath}`);
    }
  } catch (error) {
    console.error(`[config] Error creando carpeta ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Obtener configuración completa
 */
export function getConfig(): AppConfig {
  const noteFolder = getNoteFolder();
  const maxVersions = overrides.maxVersions ?? 50;
  return {
    noteFolder,
    historyFolder: getHistoryFolder(noteFolder),
    maxVersions,
  };
}

/**
 * Actualizar configuración y persistirla en disco.
 * Crea los directorios necesarios.
 */
export async function updateConfig(patch: {
  noteFolder?: string;
  maxVersions?: number;
}): Promise<AppConfig> {
  if (patch.noteFolder !== undefined) {
    const trimmed = patch.noteFolder.trim();
    if (!trimmed) throw new Error('noteFolder no puede estar vacío');
    overrides.noteFolder = trimmed;
  }
  if (patch.maxVersions !== undefined) {
    if (!Number.isInteger(patch.maxVersions) || patch.maxVersions < 1) {
      throw new Error('maxVersions debe ser un entero positivo');
    }
    overrides.maxVersions = patch.maxVersions;
  }

  // Persistir a disco (best-effort: si falla, se mantiene en memoria)
  try {
    await fs.promises.writeFile(
      getPersistPath(),
      JSON.stringify(
        { noteFolder: overrides.noteFolder, maxVersions: overrides.maxVersions },
        null,
        2,
      ),
      'utf-8',
    );
  } catch (error) {
    console.error('[config] No se pudo persistir configuración:', error);
  }

  const config = getConfig();
  await ensureDir(config.noteFolder);
  await ensureDir(config.historyFolder);
  return config;
}

/**
 * Validar que la carpeta de notas existe y es accesible
 */
export async function validateConfig(config: AppConfig): Promise<boolean> {
  try {
    await ensureDir(config.noteFolder);
    await ensureDir(config.historyFolder);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verificar que una carpeta existe y es escribible (Fase 10, item 67).
 * Escribe y borra un fichero de prueba.
 */
export async function checkWritable(dirPath: string): Promise<boolean> {
  try {
    await ensureDir(dirPath);
    const probe = path.join(dirPath, '.write-test');
    await fs.promises.writeFile(probe, 'ok', 'utf-8');
    await fs.promises.unlink(probe);
    return true;
  } catch {
    return false;
  }
}
