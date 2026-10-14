import { test, expect, request } from '@playwright/test';

const API = 'http://localhost:3001';
const stamp = Date.now();

async function api() {
  return request.newContext({ baseURL: API });
}

test.describe('backend: health y config', () => {
  test('health + config con writable', async () => {
    const ctx = await api();
    const health = await ctx.get('/api');
    expect(health.ok()).toBeTruthy();
    expect((await health.json()).status).toBe('ok');

    const cfg = await ctx.get('/api/config');
    expect(cfg.ok()).toBeTruthy();
    const body = await cfg.json();
    expect(typeof body.noteFolder).toBe('string');
    expect(body.writable).toBe(true);
    await ctx.dispose();
  });
});

test.describe('backend: CRUD notas + versiones', () => {
  test('crear, leer, actualizar (snapshot), restaurar y borrar', async () => {
    const ctx = await api();
    const title = `E2E Nota ${stamp}`;

    const created = await ctx.post('/api/notes', { data: { title, content: 'v0' } });
    expect(created.status()).toBe(201);
    const note = (await created.json()).note;
    expect(note.title).toBe(title);
    const id = note.id as string;

    const got = await ctx.get(`/api/notes/${id}`);
    expect(got.ok()).toBeTruthy();
    expect((await got.json()).note.content).toContain('v0');

    await ctx.put(`/api/notes/${id}`, { data: { content: 'v1' } });
    await ctx.put(`/api/notes/${id}`, { data: { content: 'v2' } });

    const versions = await ctx.get(`/api/notes/${id}/versions`);
    expect(versions.ok()).toBeTruthy();
    const list = (await versions.json()).versions;
    expect(list.length).toBeGreaterThanOrEqual(2);

    const oldest = list[list.length - 1].timestamp;
    const detail = await ctx.get(`/api/notes/${id}/versions/${oldest}`);
    expect(detail.ok()).toBeTruthy();
    expect((await detail.json()).version.content).toContain('v0');

    const bookmark = await ctx.post(`/api/notes/${id}/versions`);
    expect(bookmark.status()).toBe(201);
    expect((await bookmark.json()).version.isBookmark).toBe(true);

    const restore = await ctx.post(`/api/notes/${id}/versions/${oldest}/restore`);
    expect(restore.ok()).toBeTruthy();
    const after = await ctx.get(`/api/notes/${id}`);
    expect((await after.json()).note.content).toContain('v0');

    const del = await ctx.delete(`/api/notes/${id}`);
    expect(del.ok()).toBeTruthy();
    await ctx.dispose();
  });
});

test.describe('backend: carpetas', () => {
  test('crear, mover nota, borrar con y sin force', async () => {
    const ctx = await api();
    const folder = `e2e-f-${stamp}`;
    const title = `E2E Carpeta ${stamp}`;

    const created = await ctx.post('/api/folders', { data: { path: folder } });
    expect(created.status()).toBe(201);

    const note = (
      await (
        await ctx.post('/api/notes', { data: { title, content: 'x' } })
      ).json()
    ).note;

    const moved = await ctx.put('/api/folders/move', { data: { noteId: note.id, folder } });
    expect(moved.ok()).toBeTruthy();
    expect((await moved.json()).note.folder).toBe(folder);

    const tree = await ctx.get('/api/folders');
    expect((await tree.json()).total).toBeGreaterThanOrEqual(1);

    const del409 = await ctx.delete(`/api/folders/${folder}`);
    expect(del409.status()).toBe(409);

    const delForce = await ctx.delete(`/api/folders/${folder}?force=true`);
    expect(delForce.ok()).toBeTruthy();
    await ctx.dispose();
  });
});

test.describe('backend: búsqueda y export/import', () => {
  test('scopes, export ZIP e import roundtrip', async () => {
    const ctx = await api();
    const word = `kiwi${stamp}`;
    await ctx.post('/api/notes', { data: { title: `Fruta ${word}`, content: `me gusta ${word}`, tags: [`tag-${stamp}`] } });

    const all = await ctx.get(`/api/search?q=${word}`);
    expect((await all.json()).total).toBeGreaterThanOrEqual(1);

    const byTitle = await ctx.get(`/api/search?q=${word}&scope=title`);
    expect((await byTitle.json()).total).toBeGreaterThanOrEqual(1);

    const byTag = await ctx.get(`/api/search?q=tag-${stamp}&scope=tags`);
    expect((await byTag.json()).total).toBeGreaterThanOrEqual(1);

    const noQ = await ctx.get('/api/search');
    expect(noQ.status()).toBe(400);

    const exp = await ctx.post('/api/export/zip', { data: {} });
    expect(exp.ok()).toBeTruthy();
    expect(exp.headers()['content-type']).toContain('application/zip');
    const zipBytes = await exp.body();
    expect(zipBytes.length).toBeGreaterThan(0);

    const imp = await ctx.post('/api/import/zip', {
      data: { data: zipBytes.toString('base64') },
    });
    expect(imp.ok()).toBeTruthy();
    // Ya existen → omitidas sin overwrite
    expect((await imp.json()).skipped).toBeGreaterThanOrEqual(1);

    const bad = await ctx.post('/api/import/zip', { data: { data: 'bm8temlw' } });
    expect(bad.status()).toBe(400);
    await ctx.dispose();
  });

  test('importa .txt (en ZIP y suelto) convertido a .md', async () => {
    const ctx = await api();
    const base = `e2etxt${stamp}`;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(`${base}.txt`, 'contenido plano');
    zip.file(`${base}b.md`, '# Ya existe md');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const imp = await ctx.post('/api/import/zip', {
      data: { data: buf.toString('base64'), overwrite: true },
    });
    expect(imp.ok()).toBeTruthy();
    expect((await imp.json()).imported).toBeGreaterThanOrEqual(2);

    const list = await ctx.get('/api/notes');
    const notes = (await list.json()).notes;
    // El .txt llega como .md con título del fichero
    const fromTxt = notes.find((n: { id: string }) => n.id === base);
    expect(fromTxt).toBeTruthy();
    expect(fromTxt.folder).toBe('');

    // Fichero suelto .txt en subcarpeta
    const one = await ctx.post('/api/import/file', {
      data: { filename: `sub${stamp}/suelto.txt`, content: 'hola suelto' },
    });
    expect(one.status()).toBe(201);
    expect((await one.json()).imported).toBe(`sub${stamp}/suelto.md`);

    const dup = await ctx.post('/api/import/file', {
      data: { filename: `sub${stamp}/suelto.txt`, content: 'otro' },
    });
    expect(dup.status()).toBe(409);

    const badExt = await ctx.post('/api/import/file', {
      data: { filename: 'x.png', content: 'binario' },
    });
    expect(badExt.status()).toBe(400);

    const traversal = await ctx.post('/api/import/file', {
      data: { filename: '../evil.md', content: 'x' },
    });
    expect(traversal.status()).toBe(400);

    // Limpieza
    const ids: string[] = [fromTxt.id, `${base}b`, `sub${stamp}--suelto`];
    for (const id of new Set(ids)) {
      await ctx.delete(`/api/notes/${id}`);
    }
    await ctx.delete(`/api/folders/sub${stamp}?force=true`);
    await ctx.dispose();
  });

  test('importa .pdf convertido a .md', async () => {
    const ctx = await api();
    const base = `e2epdf${stamp}`;
    const text = `hola pdf ${stamp}`;
    const pdf = minimalPdf(text);

    const one = await ctx.post('/api/import/file', {
      data: { filename: `${base}.pdf`, data: pdf.toString('base64') },
    });
    expect(one.status()).toBe(201);
    expect((await one.json()).imported).toBe(`${base}.md`);

    const got = await ctx.get(`/api/notes/${base}`);
    expect(got.ok()).toBeTruthy();
    expect((await got.json()).note.content).toContain(text);

    // Binario que no es PDF → 400 claro
    const bad = await ctx.post('/api/import/file', {
      data: { filename: 'x.pdf', data: Buffer.from('no es un pdf').toString('base64') },
    });
    expect(bad.status()).toBe(400);

    await ctx.delete(`/api/notes/${base}`);
    await ctx.dispose();
  });

  test('auto-formatea markdown sin romper wikilinks (idempotente)', async () => {
    const ctx = await api();
    const messy = '#Titulo\n\nTexto   con    espacios\n\n- [ ]tarea\n\nVer [[Mi Nota]] y [[Otra|alias]]\n\n```python\n# comentario intacto\n```\n';
    const first = await ctx.post('/api/format', { data: { content: messy } });
    expect(first.ok()).toBeTruthy();
    const { formatted, changed } = await first.json();
    expect(changed).toBe(true);
    expect(formatted).toContain('# Titulo');
    expect(formatted).toContain('- [ ] tarea');
    expect(formatted).toContain('[[Mi Nota]]');
    expect(formatted).toContain('[[Otra|alias]]');
    expect(formatted).toContain('# comentario intacto');

    const second = await ctx.post('/api/format', { data: { content: formatted } });
    const again = await second.json();
    expect(again.changed).toBe(false);
    expect(again.formatted).toBe(formatted);

    const bad = await ctx.post('/api/format', { data: {} });
    expect(bad.status()).toBe(400);
    await ctx.dispose();
  });

  test('formateo: listas pegadas sí, énfasis y negativos no', async () => {
    const ctx = await api();
    const messy = '-item\n1.item\n2)otro\n*cursiva* resto\n-5 grados\n-nota-\n';
    const res = await ctx.post('/api/format', { data: { content: messy } });
    expect(res.ok()).toBeTruthy();
    const { formatted } = await res.json();
    expect(formatted).toContain('- item');
    expect(formatted).toContain('1. item');
    expect(formatted).toContain('2. otro');
    // énfasis intacto como cursiva (prettier canonicaliza el marcador, mismo render)
    expect(formatted).toMatch(/[*_]cursiva[*_]/);
    expect(formatted).not.toContain('- cursiva');
    expect(formatted).toContain('-5 grados');
    expect(formatted).toContain('-nota-');

    const again = await ctx.post('/api/format', { data: { content: formatted } });
    expect((await again.json()).changed).toBe(false);
    await ctx.dispose();
  });
});

/** PDF mínimo válido de 1 página (para probar extracción sin fixtures). */function minimalPdf(text: string): Buffer {
  const esc = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 24 Tf 100 700 Td (${esc}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    out += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
