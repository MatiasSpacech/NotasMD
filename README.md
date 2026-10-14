# 📝 Notas App

Aplicación web de notas Markdown con referencias cruzadas (`[[wikilinks]]`), historial de versiones, autocompletado, búsqueda y organización por carpetas. Monousuario en localhost, sin autenticación.

## 🚀 Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Editor**: `@uiw/react-md-editor` (modo edición) + toolbar propia
- **Preview**: `react-markdown` + `remark-gfm`
- **Backend**: Express + TypeScript (puerto 3001)
- **Datos**: archivos `.md` con frontmatter YAML en disco local
- **Tests e2e**: Playwright (solo Chromium)

## 📦 Requisitos

- Node.js ≥ 18

## ⚙️ Instalación

```bash
cd notas-app
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

La ruta también se cambia en caliente con `POST /api/config { "noteFolder": "...", "maxVersions": 50 }`.

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

IDs: la ruta relativa con `/` se codifica con `--` (`proyecto-a--mi-nota`). El historial vive en `.notas-history/` (excluido de listados y exports) y se renombra junto con la nota.

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
| Puerto ocupado | Cambia `PORT` (backend) o el `port` en `src/frontend/vite.config.ts` |
| `⚠️ carpeta NO escribible` en logs | Sin permisos: cambia `NOTAS_FOLDER` o la ruta vía `POST /api/config` |
| Toast de error de red | Backend caído: arranca `npm run dev:server` (el frontend lo indica una vez) |
| ZIP no importa | Solo `.md`, sin `..`, máx. 1000 ficheros / 2 MB por fichero |

## 📁 Estructura

```
notas-app/
├── e2e/                     # Tests Playwright
├── playwright.config.ts
├── src/
│   ├── frontend/            # React + Vite (components, hooks, lib)
│   └── backend/             # Express (routes, services, config)
└── ../plan-notas-app.md     # Plan por fases (en la raíz del repo)
```

## 📝 Licencia

MIT
