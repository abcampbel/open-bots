import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { processChat, getApiKeys } from './api/chat';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Health & Status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  const { xaiKey, geminiKey, xaiModel, anthropicKey, anthropicModel, localBaseUrl, localModel } = getApiKeys();
  res.json({
    status: 'online',
    platform: 'OpenBots',
    version: '2.5.0',
    activeAgents: 4,
    xaiModel,
    hasXaiKey: !!xaiKey,
    hasGeminiKey: !!geminiKey,
    anthropicModel,
    hasAnthropicKey: !!anthropicKey,
    localModel: localBaseUrl ? localModel : null,
    hasLocalModel: !!localBaseUrl,
  });
});

// Chat endpoint for Agents
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const result = await processChat(req.body);
    if (result.error && !result.reply) {
      return res.status(502).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error('Unhandled server error in /api/chat:', err);
    return res.status(500).json({
      error: 'Internal server error while processing agent request.',
      details: err?.message || String(err),
    });
  }
});

// Start Express Server with Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenBots Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
