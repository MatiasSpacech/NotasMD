import express from 'express';
import { formatNoteContent } from '../services/markdown-format';

const router = express.Router();

const MAX_FORMAT_CHARS = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// POST /api/format — auto-formatear Markdown (stateless, no escribe disco)
// Body: { content: string (cuerpo o nota completa con frontmatter) }
// ---------------------------------------------------------------------------
router.post('/api/format', async (req, res) => {
  try {
    const { content } = req.body as { content?: string };
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Se requiere content (string)' });
    }
    if (content.length > MAX_FORMAT_CHARS) {
      return res.status(400).json({ error: 'Contenido demasiado grande' });
    }
    const { formatted, changed } = await formatNoteContent(content);
    res.json({ formatted, changed });
  } catch (error: any) {
    res.status(500).json({ error: `Error al formatear: ${error.message}` });
  }
});

export default router;
