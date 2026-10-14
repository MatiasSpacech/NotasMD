import express from 'express';
import cors from 'cors';
import { getConfig, ensureDir, checkWritable } from './config';
import configRouter from './routes/config';
import notesRouter from './routes/notes';
import foldersRouter from './routes/folders';
import versionsRouter from './routes/versions';
import searchRouter from './routes/search';
import exportRouter from './routes/export';
import formatRouter from './routes/format';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
// Límite alto para permitir POST /api/import/zip en base64.
// App monousuario en localhost (sin autenticación según requisitos).
app.use(express.json({ limit: '100mb' }));

// Health check
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Notas API running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
// configRouter expone GET / y POST / -> montado en /api/config
app.use('/api/config', configRouter);
// notesRouter ya define rutas completas /api/notes...
app.use(notesRouter);
// foldersRouter ya define rutas completas /api/folders...
app.use(foldersRouter);
// versionsRouter ya define rutas completas /api/notes/:id/versions...
app.use(versionsRouter);
// searchRouter ya define GET /api/search
app.use(searchRouter);
// exportRouter: POST /api/export/zip y POST /api/import/zip
app.use(exportRouter);
// formatRouter: POST /api/format (stateless, no escribe disco)
app.use(formatRouter);

// 404 para /api desconocidas
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Handler de errores
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: err?.message });
});

async function start() {
  try {
    const config = getConfig();
    await ensureDir(config.noteFolder);
    await ensureDir(config.historyFolder);
    console.log(`[server] Notas en: ${config.noteFolder}`);
    // Fase 10/67: verificar escritura al arrancar (error claro si no hay permisos)
    const writable = await checkWritable(config.noteFolder);
    if (!writable) {
      console.error(
        `[server] ⚠️ La carpeta de notas NO es escribible: ${config.noteFolder}. ` +
          `Revisa permisos o cambia la ruta con POST /api/config { "noteFolder": "..." }.`,
      );
    }
  } catch (error) {
    console.error('[server] No se pudo crear la carpeta de notas:', error);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  });
}

// No arrancar automáticamente en modo test
if (process.env.NODE_ENV !== 'test') {
  start();
}

export default app;
