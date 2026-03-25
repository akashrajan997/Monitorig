import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config for the server
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  console.log(`[SERVER] Starting WorkPulse Enterprise Server...`);
  console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Policy Engine
  const DEFAULT_POLICY = {
    mode: "baseline",
    modules: {
      activityTracking: true,
      urlTracking: true,
      fileTracking: false,
      screenshot: true
    },
    screenshotInterval: 300,
    heartbeatInterval: 60
  };

  // Agent Registration & Policy Fetch
  app.get("/api/v1/agent/policy", async (req, res) => {
    const deviceId = req.headers["x-device-id"];
    
    try {
      const policyDoc = await getDoc(doc(db, 'settings', 'global_policy'));
      if (policyDoc.exists()) {
        res.json(policyDoc.data());
      } else {
        res.json(DEFAULT_POLICY);
      }
    } catch (error) {
      console.error('[POLICY FETCH ERROR]', error);
      res.json(DEFAULT_POLICY);
    }
  });

  // Enterprise Ingestion Endpoint (Batch)
  app.post("/api/v1/agent/ingest", async (req, res) => {
    const { deviceId, timestamp, events } = req.body;
    
    try {
      // 1. Update Employee/Device Record
      const employeeRef = doc(db, 'employees', deviceId);
      const lastEvent = events.length > 0 ? events[events.length - 1] : null;
      const currentApp = lastEvent?.details?.WindowTitle || lastEvent?.details?.appName || 'Active';
      
      await setDoc(employeeRef, {
        id: deviceId,
        name: `Device ${deviceId.substring(0, 8)}`,
        email: `${deviceId}@enterprise.local`,
        status: 'active',
        lastSeen: new Date().toISOString(),
        department: 'Remote Operations',
        currentApp: currentApp,
        agentSecret: 'workpulse-agent-secret-2026'
      }, { merge: true });

      // 2. Store Events in Activity Logs
      const logsRef = collection(db, 'activity_logs');
      for (const event of events) {
        const details = event.details || {};
        // Map WindowTitle to appName for UI consistency if needed
        if (details.WindowTitle && !details.appName) {
          details.appName = details.WindowTitle;
        }

        // Clean undefined values from details
        Object.keys(details).forEach(key => {
          if (details[key] === undefined) {
            delete details[key];
          }
        });

        await addDoc(logsRef, {
          employeeId: deviceId,
          type: event.type || 'unknown',
          timestamp: event.timestamp || new Date().toISOString(),
          details: details,
          agentSecret: 'workpulse-agent-secret-2026'
        });
      }

      console.log(`[INGEST] Processed ${events.length} events from ${deviceId}`);
      res.status(202).json({ status: "accepted", serverTime: new Date().toISOString() });
    } catch (error: any) {
      console.error('[INGEST ERROR]', error);
      res.status(500).json({ error: "Internal Server Error", details: error.message, stack: error.stack });
    }
  });

  // Screenshot Upload (Blob Storage Proxy)
  app.post("/api/v1/agent/screenshot", express.raw({ type: 'image/jpeg', limit: '5mb' }), (req, res) => {
    const deviceId = req.headers["x-device-id"];
    const timestamp = req.headers["x-timestamp"];
    
    // Upload to Azure Blob Storage
    console.log(`[SCREENSHOT] Received capture from ${deviceId} at ${timestamp}`);
    
    res.status(201).json({ status: "stored" });
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: "API route not found", path: req.url });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
