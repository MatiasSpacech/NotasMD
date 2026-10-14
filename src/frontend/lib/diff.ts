/**
 * Diff sencillo línea a línea (Fase 6) mediante LCS.
 * Para notas (textos pequeños); con límite para no bloquear el render.
 */

export interface DiffRow {
  type: 'same' | 'add' | 'del';
  text: string;
}

const MAX_CELLS = 250000;

/**
 * Comparar `oldText` (versión) con `newText` (actual).
 * `add` = líneas que tiene el actual y la versión no; `del` = al revés.
 */
export function diffLines(oldText: string, newText: string): DiffRow[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');

  if (a.length * b.length > MAX_CELLS) {
    return [{ type: 'same', text: `(diff omitido: ${a.length} vs ${b.length} líneas)` }];
  }

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', text: a[i] });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: 'del', text: a[i++] });
  while (j < m) rows.push({ type: 'add', text: b[j++] });
  return rows;
}

/**
 * Formatear un timestamp de versión `2026-10-14T04-46-35-097Z`
 * (o `bookmark-...`) como `2026-10-14 04:46:35`. Fallback: raw.
 */
export function formatVersionTimestamp(timestamp: string): string {
  const clean = timestamp.startsWith('bookmark-') ? timestamp.slice('bookmark-'.length) : timestamp;
  const m = clean.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-\d+Z$/);
  if (m) return `${m[1]} ${m[2]}:${m[3]}:${m[4]}`;
  // ISO estándar por si cambia el formato en el futuro
  const d = new Date(clean);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  return timestamp;
}
