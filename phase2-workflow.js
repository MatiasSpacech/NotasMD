// Fase 2: Implementar rutas del backend (config + notes)
await runs.all([
  {
    key: "config-routes",
    agent: "worker",
    cwd: "./notas-app",
    task: `Implementar Express router en src/backend/routes/config.ts para la app de notas.

Contexto:
- CWD: C:/Users/Mi PC/Desktop/testlocal/notas-app
- Usa Express.js con TypeScript
- Importa de: import { getConfig, validateConfig, ensureDir, AppConfig } from '../config';
- Importa de: import { parseFrontmatter, buildFrontmatter, createDefaultFrontmatter, rebuildContent } from '../services/frontmatter';
- Importa de: import { getAllMdFiles, getNoteId, fileExists, dirExists } from '../services/filesystem';

Endpoints:
1. GET /api/config — Retorna { noteFolder, historyFolder, maxVersions, isValid, noteCount }
   - getConfig() para obtener configuración
   - validateConfig() para verificar accesibilidad
   - getAllMdFiles() para contar notas

2. POST /api/config — Actualiza configuración
   - Body: { noteFolder?: string, maxVersions?: number }
   - Si noteFolder cambia: validar que existe o crear, actualizar directorios
   - Retorna nueva configuración

Exportar: const router = express.Router(); y module.exports = router;

Código completo y funcional con TypeScript, manejo de errores, comentarios en español.`,
  },
  {
    key: "notes-routes",
    agent: "worker",
    cwd: "./notas-app",
    task: `Implementar Express router en src/backend/routes/notes.ts para la app de notas.

Contexto:
- CWD: C:/Users/Mi PC/Desktop/testlocal/notas-app
- Usa Express.js con TypeScript
- Importa de: import { getConfig } from '../config';
- Importa de: import { parseFrontmatter, buildFrontmatter, createDefaultFrontmatter, updateTimestamps, rebuildContent, NoteFrontmatter } from '../services/frontmatter';
- Importa de: import { getAllMdFiles, getNoteId, getNotePath, fileExists, readNote, writeNote, deleteNote, getFileNameWithoutExt } from '../services/filesystem';
- Importa de: import { extractWikilinks, normalizePath } from '../services/wikilink-parser';

Interfaz Note:
interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
  wordCount: number;
}

Endpoints:
1. GET /api/notes — Listar todas las notas
   - Obtener todas las notas con getAllMdFiles()
   - Para cada nota: leer contenido, parsear frontmatter, calcular wordCount
   - Retornar: { notes: Note[], total: number }

2. GET /api/notes/:id — Obtener nota individual
   - Obtener ruta con getNotePath(id, noteFolder)
   - Leer archivo, parsear frontmatter
   - Retornar: { note: Note, wikilinks: string[], brokenWikilinks: string[] }

3. POST /api/notes — Crear nueva nota
   - Body: { title: string, folder?: string, content?: string, tags?: string[] }
   - Generar ID desde título (slug)
   - Crear frontmatter por defecto
   - Escribir archivo .md
   - Retornar nota creada

4. PUT /api/notes/:id — Actualizar nota
   - Body: { title?: string, content?: string, tags?: string[], folder?: string }
   - Leer nota actual
   - Actualizar frontmatter (timestamps, title, tags)
   - Si cambió title, renombrar archivo
   - Retornar nota actualizada

5. DELETE /api/notes/:id — Eliminar nota
   - Obtener ruta con getNotePath(id, noteFolder)
   - Eliminar archivo
   - Retornar { success: true, message: 'Nota eliminada' }

Exportar: const router = express.Router(); y module.exports = router;

Código completo y funcional con TypeScript, manejo de errores, comentarios en español.`,
  },
]);
