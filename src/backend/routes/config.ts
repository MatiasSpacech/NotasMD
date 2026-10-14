import express from 'express';
import { spawn } from 'child_process';
import { getConfig, validateConfig, ensureDir, updateConfig, checkWritable } from '../config';
import { getAllMdFiles } from '../services/filesystem';

const router = express.Router();

/**
 * Ruta de configuración de la aplicación
 * GET  /api/config  — Obtener configuración actual
 * POST /api/config  — Actualizar configuración
 */

// ============================================================
// GET /api/config — Retorna configuración y estado del sistema
// ============================================================
router.get('/', async (req, res) => {
  try {
    // Obtener configuración actual
    const config = getConfig();

    // Validar accesibilidad de carpetas
    const isValid = await validateConfig(config);

    // Contar notas existentes
    let noteCount = 0;
    try {
      const files = await getAllMdFiles(config.noteFolder);
      noteCount = files.length;
    } catch {
      // Si la carpeta no existe aún, el conteo es 0
      noteCount = 0;
    }

    // Retornar respuesta con estado de la configuración
    res.json({
      noteFolder: config.noteFolder,
      historyFolder: config.historyFolder,
      maxVersions: config.maxVersions,
      isValid,
      writable: await checkWritable(config.noteFolder),
      noteCount,
    });
  } catch (error: any) {
    console.error('[routes/config] Error en GET /api/config:', error);
    res.status(500).json({
      error: 'Error al obtener la configuración',
      details: error.message,
    });
  }
});

// ============================================================
// POST /api/config/open-folder — Abre la carpeta de notas en el explorador
// (solo la carpeta configurada, sin parámetros: el backend corre en localhost)
// ============================================================
router.post('/open-folder', async (req, res) => {
  try {
    const config = getConfig();
    await ensureDir(config.noteFolder);
    const bin =
      process.platform === 'win32'
        ? 'explorer.exe'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open';
    // Fire-and-forget: explorer.exe devuelve código 1 aunque abra bien,
    // así que no esperamos su salida (detached + unref).
    const child = spawn(bin, [config.noteFolder], {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (spawnError) => {
      console.error('[routes/config] No se pudo abrir la carpeta:', spawnError.message);
    });
    child.unref();
    res.json({ opened: config.noteFolder });
  } catch (error: any) {
    console.error('[routes/config] Error en POST /api/config/open-folder:', error);
    res.status(500).json({
      error: 'No se pudo abrir la carpeta en el explorador',
      details: error.message,
    });
  }
});

// ============================================================
// POST /api/config — Actualiza la configuración
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { noteFolder, maxVersions } = req.body as {
      noteFolder?: string;
      maxVersions?: number;
    };

    // Validar campos requeridos
    if (noteFolder === undefined && maxVersions === undefined) {
      return res.status(400).json({
        error: 'Se requiere al menos un campo: noteFolder o maxVersions',
      });
    }

    // Validar maxVersions si se proporciona
    if (maxVersions !== undefined) {
      if (!Number.isInteger(maxVersions) || maxVersions < 1) {
        return res.status(400).json({
          error: 'maxVersions debe ser un número entero positivo',
        });
      }
    }

    // Validar noteFolder si se proporciona
    if (noteFolder !== undefined) {
      if (typeof noteFolder !== 'string' || noteFolder.trim().length === 0) {
        return res.status(400).json({
          error: 'noteFolder debe ser una cadena no vacía',
        });
      }
    }

    // Actualizar + persistir (updateConfig crea los directorios)
    let newConfig;
    try {
      newConfig = await updateConfig(
        noteFolder !== undefined
          ? { noteFolder: noteFolder.trim(), maxVersions }
          : { maxVersions },
      );
    } catch (createError: any) {
      return res.status(400).json({
        error: 'No se pudo actualizar la configuración',
        details: createError.message,
      });
    }

    const isValid = await validateConfig(newConfig);
    let noteCount = 0;
    try {
      const files = await getAllMdFiles(newConfig.noteFolder);
      noteCount = files.length;
    } catch {
      noteCount = 0;
    }

    // Retornar la nueva configuración
    res.json({
      noteFolder: newConfig.noteFolder,
      historyFolder: newConfig.historyFolder,
      maxVersions: newConfig.maxVersions,
      isValid,
      writable: await checkWritable(newConfig.noteFolder),
      noteCount,
      message: 'Configuración actualizada correctamente',
    });
  } catch (error: any) {
    console.error('[routes/config] Error en POST /api/config:', error);
    res.status(500).json({
      error: 'Error al actualizar la configuración',
      details: error.message,
    });
  }
});

export default router;
