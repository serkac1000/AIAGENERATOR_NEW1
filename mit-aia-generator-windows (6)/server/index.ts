import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

const app = express();

// Debug middleware to log all incoming requests
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  log(`[DEBUG] Incoming request: ${req.method} ${req.url} Body: ${JSON.stringify(req.body)}`);

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `[DEBUG] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }
    log(logLine);
  });

  next();
});

// Register routes before Vite to ensure API precedence
(async () => {
  const PORT = process.env.PORT || 5000;
  try {
    // Add middleware for parsing JSON with error handling
    app.use(express.json({ 
      limit: '50mb',
      verify: (req, res, buf) => {
        try {
          JSON.parse(buf.toString());
        } catch (e) {
          res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body',
            error: 'Malformed JSON'
          });
          throw new Error('Invalid JSON');
        }
      }
    }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Add CORS headers for development
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Register API routes first
    await registerRoutes(app);

    // Vite setup for development (after API routes)
    if (app.get("env") === "development") {
      await setupVite(app);
    } else {
      serveStatic(app);
    }

    // Add middleware to ensure JSON responses for API routes
    app.use('/api/*', (req, res, next) => {
      res.setHeader('Content-Type', 'application/json');
      next();
    });

    // Add error handling middleware
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server error:', error);
      
      // Ensure JSON response for API routes
      if (req.path.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        res.status(error.status || 500).json({
          success: false,
          message: error.message || 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
      }
    });

    // Create HTTP server
    const server = createServer(app);

    server.listen(PORT, '0.0.0.0', () => {
      log(`[INFO] Server running at http://0.0.0.0:${PORT}`);
      log(`API endpoints available at:`);
      log(`  POST /api/validate - Validate AIA configuration`);
      log(`  POST /api/generate - Generate AIA file`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();