import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { importAuthenticOrders } from './import-authentic-orders.js';
import { storage } from './storage';
import path from "path";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize POS integration after routes are set up
  try {
    const { posIntegration } = await import('./integrations');
    await posIntegration.startRealTimeSync();
    console.log('POS integration initialized with real-time sync');
  } catch (error) {
    console.error('POS integration initialization failed:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Customer portal endpoint
  app.get('/api/track/:trackingId', async (req, res) => {
    try {
      const { trackingId } = req.params;
      const order = await storage.getOrderByTrackingId(trackingId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json({
        id: order.id,
        trackingId: order.trackingId,
        status: order.status,
        orderType: order.orderType,
        dueDate: order.dueDate,
        customer: {
          name: order.customer.name,
          email: order.customer.email,
        },
        statusHistory: order.statusHistory.map((h: any) => ({
          status: h.toStatus,
          changedAt: h.createdAt,
          reason: h.reason,
        })),
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  // Import all authentic orders endpoint
  app.post('/api/import/all-orders', async (req, res) => {
    try {
      console.log('🚀 Starting import of all authentic orders...');
      const result = await importAuthenticOrders();
      res.json({
        success: true,
        message: 'All authentic orders imported successfully',
        ...result
      });
    } catch (error) {
      console.error('❌ Import failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

    // The catch-all route is handled by serveStatic() in vite.ts

  // Use Railway's PORT environment variable in production, fallback to 5000 for development
  const port = parseInt(process.env.PORT || "5000", 10);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Trying to kill existing process...`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      throw err;
    }
  });

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
