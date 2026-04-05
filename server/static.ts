import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Serve chaperone app — same React app but with chaperone PWA manifest
  // Also serve at /driver (clean path the SW has never cached)
  app.get(["/chaperone-app", "/driver"], (_req, res) => {
    let html = fs.readFileSync(path.resolve(distPath, "index.html"), "utf8");
    // Swap manifest to chaperone version
    html = html.replace('href="./manifest.json"', 'href="/manifest-chaperone.json"');
    // Swap app title for iOS PWA
    html = html.replace('content="HomeDirectAI"', 'content="Chaperone"');
    // Swap theme color to dark
    html = html.replace('content="#2D7A4F"', 'content="#0d1a12"');
    // Swap page title
    html = html.replace('HomeDirectAI - Buy &amp; Sell Homes Without Agents', 'HomeDirectAI Chaperone');
    // Force hash to chaperone-app route
    html = html.replace('</body>', '<script>if(!window.location.hash.includes("chaperone-app")){window.location.hash="#/chaperone-app";}</script></body>');
    // Unregister any existing service worker AND don't register new one
    html = html.replace(
      "navigator.serviceWorker.register('/sw.js')",
      "navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister()})})"      
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
