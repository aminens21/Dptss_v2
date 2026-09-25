// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var port = process.env.PORT || 3e3;
app.use(express.json());
var isProduction = process.env.NODE_ENV === "production" || !process.env.VITE_DEV;
if (!isProduction) {
  import("vite").then(async (vite) => {
    const viteServer = await vite.createServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(viteServer.middlewares);
    console.log("Vite middleware mounted in development mode");
  }).catch((err) => {
    console.error("Failed to import Vite in development:", err);
  });
} else {
  const distPath = path.resolve(__dirname, "dist");
  app.use(express.static(distPath));
  console.log("Serving static files from:", distPath);
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is listening on http://0.0.0.0:${port}`);
});
