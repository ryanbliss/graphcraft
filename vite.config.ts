import { defineConfig, type Plugin } from "vite";
import { graphFromDirectory } from "./scripts/read-project.ts";
import { isAbsolute } from "node:path";
function localProjects(): Plugin {
  return {
    name: "local-projects",
    configureServer(server) {
      server.middlewares.use("/api/project", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Only POST is allowed." }));
          return;
        }
        if (req.headers.origin !== `http://${req.headers.host}`) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              error: "Project scans require a same-origin request.",
            }),
          );
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          res.statusCode = 415;
          res.end(JSON.stringify({ error: "Expected a JSON project path." }));
          return;
        }
        void (async () => {
          let body = "";
          for await (const chunk of req) {
            body += String(chunk);
            if (body.length > 8192)
              throw new Error("Project path request exceeds 8 KB.");
          }
          const data: unknown = JSON.parse(body);
          if (!data || typeof data !== "object" || !("path" in data))
            throw new Error("A project directory path is required.");
          if (typeof data.path !== "string")
            throw new Error("The project directory path must be a string.");
          if (!isAbsolute(data.path))
            throw new Error("Enter an absolute directory path.");
          const graph = await graphFromDirectory(data.path);
          res.end(JSON.stringify(graph));
        })().catch((error: unknown) => {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        });
      });
    },
  };
}
export default defineConfig({
  plugins: [localProjects()],
  // The parser worker loads on first directory scan; prebundle it before a world opens.
  optimizeDeps: { include: ["@babel/parser", "@babel/types", "minimatch"] },
  // Babel's AST guards use this build flag in development worker dependencies.
  define: { "process.env.BABEL_TYPES_8_BREAKING": "false" },
  server: { host: "127.0.0.1" },
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 900 },
});
