import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

// Determine if we are in production
const isProduction = process.env.NODE_ENV === 'production' || !process.env.VITE_DEV;

if (!isProduction) {
  // In development, Vite handles the dev server with middleware mode
  import('vite').then(async (vite) => {
    const viteServer = await vite.createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(viteServer.middlewares);
    console.log('Vite middleware mounted in development mode');
  }).catch((err) => {
    console.error('Failed to import Vite in development:', err);
  });
} else {
  // In production, serve built static assets from dist folder (or current dir if inside dist)
  const currentDist = path.resolve(__dirname, 'dist');
  const distPath = fs.existsSync(currentDist) && fs.existsSync(path.join(currentDist, 'index.html')) ? currentDist : __dirname;
  app.use(express.static(distPath));
  console.log('Serving static files from:', distPath);

  // Serve index.html for any unmatched route for SPA client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is listening on http://0.0.0.0:${port}`);
});
