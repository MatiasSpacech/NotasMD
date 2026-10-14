// Phase 1 Wave 1: Setup base del proyecto
await runs.all([
  {
    key: "project-config",
    agent: "worker",
    cwd: "./notas-app",
    task: `Crear archivos de configuración del proyecto en C:/Users/Mi PC/Desktop/testlocal/notas-app/:

1. package.json — monorepo con scripts dev/dev:server/dev:all/build/preview. Deps: express, cors, uuid, yaml, glob, concurrently. DevDeps: typescript, @types/node, vite, @vitejs/plugin-react, react, react-dom, @types/react, @types/react-dom, tailwindcss, postcss, autoprefixer, eslint, prettier.

2. tsconfig.json — ES2020, ESNext module, react-jsx, strict, paths @/* -> ../frontend/*

3. vite.config.ts — plugin react, root ./src/frontend, proxy /api -> localhost:3001

4. tailwind.config.ts — content ./src/frontend/**/*.{ts,tsx}, darkMode class, theme slate/amber

5. postcss.config.js — tailwindcss + autoprefixer

6. .gitignore — node_modules, dist, .env, *.log, .notas-history

Usar write tool para crear cada archivo. Crear carpetas con mkdir -p antes.`,
  },
  {
    key: "backend-core",
    agent: "worker",
    cwd: "./notas-app",
    task: `Crear backend en C:/Users/Mi PC/Desktop/testlocal/notas-app/src/backend/:

1. server.ts — Express app con cors, json parser, health check GET /api, listen 3001

2. config.ts — NOTA_FOLDER default ~/Notas, HISTORY_FOLDER, MAX_VERSIONS 50, ensureDir function

3. services/filesystem.ts — readNote, writeNote, deleteNote, getAllMdFiles, getNoteId, getNotePath, fileExists, dirExists, createFolder, deleteFolder

4. services/frontmatter.ts — parseFrontmatter (yaml), buildFrontmatter, createDefaultFrontmatter, updateTimestamps

5. services/versioning.ts — saveVersion, getVersions, getVersion, restoreVersion, createBookmark, cleanupOldVersions

Cada servicio con TypeScript types, async/await, error handling, JSDoc.`,
  },
  {
    key: "frontend-core",
    agent: "worker",
    cwd: "./notas-app",
    task: `Crear frontend en C:/Users/Mi PC/Desktop/testlocal/notas-app/src/frontend/:

1. App.tsx — Layout 3 paneles: Sidebar(280px) | Editor(flex) | Preview(320px). Estado notes, selectedNote, theme toggle.

2. main.tsx — React render de App en #root

3. index.css — @tailwind base/components/utilities, variables tema oscuro/claro, estilos base

4. components/Sidebar.tsx — Lista de notas con carpetas, búsqueda, botones nueva nota/carpeta

5. components/NoteEditor.tsx — Textarea markdown, toolbar formato, auto-save debounce

6. components/NotePreview.tsx — Render markdown básico con CSS

7. hooks/useNotes.ts — CRUD hooks llamando a /api/notes

8. hooks/useFolders.ts — Folder CRUD hooks

9. hooks/useTheme.ts — Dark/light theme persistence

Crear con write tool. Código TypeScript funcional.`,
  },
]);
