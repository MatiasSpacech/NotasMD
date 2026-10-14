/**
 * Plantillas de nota nueva (Fase 7, item 49):
 * Reunión, Idea, Tarea, Diario (+ En blanco).
 */

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  defaultTitle: () => string;
  content: (title: string) => string;
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'En blanco',
    description: 'Nota vacía con título',
    tags: [],
    defaultTitle: () => 'Nueva nota',
    content: (title) => `# ${title}\n`,
  },
  {
    id: 'reunion',
    name: 'Reunión',
    description: 'Asistentes, temas y acuerdos',
    tags: ['reunión'],
    defaultTitle: () => `Reunión ${today()}`,
    content: (title) =>
      `# ${title}\n\n## Asistentes\n- \n\n## Temas\n- \n\n## Acuerdos\n- [ ] \n`,
  },
  {
    id: 'idea',
    name: 'Idea',
    description: 'Descripción y próximos pasos',
    tags: ['idea'],
    defaultTitle: () => 'Nueva idea',
    content: (title) =>
      `# ${title}\n\n## Descripción\n\n## Por qué importa\n\n## Próximo paso\n- [ ] \n`,
  },
  {
    id: 'tarea',
    name: 'Tarea',
    description: 'Lista de pasos pendientes',
    tags: ['tarea'],
    defaultTitle: () => 'Nueva tarea',
    content: (title) => `# ${title}\n\n- [ ] Primer paso\n- [ ] Segundo paso\n`,
  },
  {
    id: 'diario',
    name: 'Diario',
    description: 'Entrada diaria con fecha',
    tags: ['diario'],
    defaultTitle: () => today(),
    content: (title) => `# ${title}\n\n## Hoy\n\n## Pendientes\n- [ ] \n`,
  },
];

export function getTemplate(id: string): NoteTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
