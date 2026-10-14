# 📝 Notas App

Aplicación web de notas en Markdown, pensada para tomar apuntes, organizar ideas y conectarlas entre sí. Todo se guarda como archivos `.md` con frontmatter YAML en una carpeta local de tu disco (sin base de datos ni cuentas): tus notas son ficheros que puedes abrir, copiar y respaldar con cualquier herramienta.

Monousuario en localhost, sin autenticación: frontend en `http://localhost:3000` y backend en `http://localhost:3001`.

## ✨ Funcionalidades

- **Notas Markdown**: editor con toolbar propia, autoguardado y vista previa en vivo.
- **Referencias cruzadas**: enlaza notas con `[[wikilinks]]`, con autocompletado mientras escribes y panel de **backlinks** (qué notas enlazan a la actual).
- **Historial de versiones**: cada guardado crea un snapshot; puedes ver el historial, crear bookmarks manuales y restaurar versiones anteriores.
- **Organización por carpetas**: árbol de carpetas, crear/renombrar/mover/eliminar, y mover notas entre carpetas.
- **Búsqueda**: por título, contenido, etiquetas o todo a la vez, con quick open (`Ctrl+P`).
- **Plantillas**: crea notas desde plantillas predefinidas.
- **Auto-formateo**: normaliza el Markdown con vista previa de cambios antes de aplicar.
- **Importar / exportar**: ZIP completo (incluye `.md`, `.txt` y `.pdf`, que se convierten a `.md`) y descarga de respaldo en `.zip`.
- **Configuración** (botón ⚙️ o `Ctrl+,`): cambia la carpeta donde se guardan los `.md`, el máximo de versiones por nota, el tema claro/oscuro, si la vista previa y los backlinks arrancan visibles, y restablece los anchos de los paneles.
- **Tema claro/oscuro** y paneles redimensionables (sidebar y vista previa).

## 🚀 Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Editor**: `@uiw/react-md-editor` (modo edición) + toolbar propia
- **Preview**: `react-markdown` + `remark-gfm`
- **Backend**: Express + TypeScript (puerto 3001)
- **Datos**: archivos `.md` con frontmatter YAML en disco local
- **Tests e2e**: Playwright (solo Chromium)

## 📦 Requisitos

- Node.js ≥ 18

## 📥 Instalación

```bash
cd NotasMD
npm install

# Desarrollo: frontend (3000) + backend (3001)
npm run dev:all

# O por separado:
npm run dev          # frontend http://localhost:3000
npm run dev:server   # backend  http://localhost:3001
```

El frontend proxea `/api` → `http://localhost:3001`, así que basta abrir http://localhost:3000.

## 🔧 Variables de entorno

| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `NOTAS_FOLDER` | `~/Notas` | Carpeta raíz de notas `.md` |
| `NOTAS_CONFIG_PATH` | `~/.notas-app-config.json` | Persistencia de `POST /api/config` |
| `PORT` | `3001` | Puerto del backend |
| `NODE_ENV=test` | — | No arranca el servidor al importar (tests) |

La ruta también se cambia en caliente con `POST /api/config { "noteFolder": "...", "maxVersions": 50 }` o desde la interfaz con el botón de configuración (⚙️).

## ⚙️ Configuración (diálogo de la app)

Botón ⚙️ en la barra superior o atajo `Ctrl+,`:

| Opción | Qué hace |
|--------|----------|
| Carpeta de notas | Dónde se guardan los `.md`. Muestra nº de notas, si es escribible y la ruta del historial. Al guardar, se recargan notas y carpetas |
| Máx. versiones por nota | Entero 1–500 para el historial (`POST /api/config { maxVersions }`) |
| Tema | Claro / oscuro (se guarda en el navegador) |
| Vista previa / backlinks al arrancar | Se aplican al recargar la página |
| Restablecer anchos | Borra los anchos personalizados de sidebar y vista previa |

## 📜 Scripts

| Script | Acción |
|--------|--------|
| `npm run dev` / `dev:server` / `dev:all` | Frontend / backend / ambos |
| `npm run build` | `tsc` + build de producción a `dist/public` |
| `npm run preview` | Sirve el build |
| `npm run test:e2e` | Tests Playwright (levanta backend+frontend solos) |

## 🔌 API

Base `http://localhost:3001/api`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api` | Health check |
| `GET/POST` | `/api/config` | Ver/actualizar `{noteFolder, maxVersions}` |
| `GET/POST` | `/api/notes` | Listar / crear `{title, folder?, content?, tags?}` |
| `GET/PUT/DELETE` | `/api/notes/:id` | Leer / actualizar / eliminar (crea snapshot) |
| `GET` | `/api/notes/:id/backlinks` | Notas que enlazan a esta |
| `GET` | `/api/notes/:id/versions` | Listar versiones |
| `GET` | `/api/notes/:id/versions/:ts` | Detalle de versión |
| `POST` | `/api/notes/:id/versions` | Bookmark manual |
| `POST` | `/api/notes/:id/versions/:ts/restore` | Restaurar (bookmarkea el estado actual) |
| `GET/POST` | `/api/folders` | Árbol / crear `{path}` |
| `PUT` | `/api/folders/move` | Mover nota `{noteId, folder}` o carpeta `{source, target}` |
| `DELETE` | `/api/folders/:id` | Eliminar (vacía, o `?force=true`) |
| `GET` | `/api/search?q=&scope=` | Buscar (`all\|title\|content\|tags`) |
| `POST` | `/api/export/zip` | Descargar ZIP (`{folder?}`) |
| `POST` | `/api/import/zip` | Importar ZIP en base64 (`{data, overwrite?}`; acepta `.md`, `.txt` y `.pdf`) |
| `POST` | `/api/import/file` | Importar fichero suelto (`{filename, content?, data?, overwrite?}`; `.txt`/`.pdf` → `.md`) |
| `POST` | `/api/format` | Auto-formatear Markdown (`{content}` → `{formatted, changed}`) |

IDs: la ruta relativa con `/` se codifica con `--` (`proyecto-a--mi-nota`) y en las URLs viaja con `encodeURIComponent` (nombres con espacios, acentos o `# ? &` funcionan). El historial vive en `.notas-history/` (excluido de listados y exports) y se renombra junto con la nota.

## 🗂️ Datos en disco

```
~/Notas/
├── proyecto-a/
│   ├── idea.md            # frontmatter: title, folder, created, updated, tags
│   └── docs/
├── diario/
└── .notas-history/        # snapshots {nota-id}/{timestamp}.md (+ bookmark-*)
```

## ⌨️ Atajos

| Atajo | Acción |
|-------|--------|
| `Ctrl+B` / `Ctrl+I` / `Ctrl+S` | Negrita / cursiva / guardar (en el editor) |
| `Ctrl+F` / `Ctrl+P` | Buscar / quick open |
| `Ctrl+N` | Nueva nota (plantilla) |
| `Ctrl+D` | Eliminar nota actual |
| `Ctrl+Shift+H/M/B` | Historial / ayuda MD / backlinks |
| `Ctrl+Shift+F` | Auto-formatear Markdown (con preview) |
| `Ctrl+,` | Abrir configuración |
| `Ctrl+?` | Ayuda Markdown (en el editor) |
| `Tab` / `Esc` / `↑↓` | Aceptar / cerrar / navegar sugerencias |

> `Ctrl+N` y `Ctrl+Shift+B` están reservados por algunos navegadores y puede que no lleguen a la app (mejor esfuerzo con `preventDefault`).

## 🧪 Tests e2e (Playwright)

```bash
npx playwright install chromium   # solo la primera vez
npm run test:e2e
```

Los tests levantan backend (`NOTAS_FOLDER` temporal aislado) + frontend y cubren: health, CRUD de notas, versiones (snapshot/restore), carpetas (crear/mover/borrar), búsqueda, export/import ZIP y humo de UI (crear nota desde plantilla, autocompletado `[[`). Ver `e2e/`.

## 🩺 Troubleshooting

| Problema | Causa probable |
|----------|----------------|
| `npx` bloqueado en Windows | ExecutionPolicy: usa `node ./node_modules/...` directo o `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `concurrently` no se reconoce | Falta `npm install` en esta carpeta (no hay `node_modules`) |
| Puerto ocupado | Cambia `PORT` (backend) o el `port` en `src/frontend/vite.config.ts` |
| `⚠️ carpeta NO escribible` en logs | Sin permisos: cambia `NOTAS_FOLDER` o la ruta desde el diálogo de configuración |
| Toast de error de red | Backend caído: arranca `npm run dev:server` (el frontend lo indica una vez) |
| `Nota no encontrada` al guardar | Nombre de fichero con espacios finales u otros caracteres raros: evita espacios al final del nombre del `.md` |
| ZIP no importa | Solo `.md`, sin `..`, máx. 1000 ficheros / 2 MB por fichero |

## 📁 Estructura

```
NotasMD/
├── README.md
├── index.html
├── e2e/                     # Tests Playwright
├── playwright.config.ts
├── dist/                     # Build de producción (generado, ignorado por git)
└── src/
    ├── frontend/            # React + Vite (components, hooks, lib)
    └── backend/             # Express (routes, services, config)
```

## 📝 Licencia

MIT
