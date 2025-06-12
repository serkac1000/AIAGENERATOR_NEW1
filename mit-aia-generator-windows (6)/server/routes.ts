import express, { Request, Response } from "express";
import multer from "multer";
import { generateAiaRequestSchema } from "@shared/schema";
import { generateAiaFile, saveConfiguration, loadConfiguration } from "./aia-generator";
import { log } from "./vite";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Validation endpoint
router.post("/api/validate", async (req: Request, res: Response) => {
  try {
    const validatedData = generateAiaRequestSchema.parse(req.body);
    log(`[INFO] Validation successful for project: ${validatedData.projectName}`);

    res.json({
      success: true,
      message: "Configuration is valid",
      data: validatedData
    });
  } catch (error: any) {
    log(`[ERROR] Validation failed: ${error.message}`);
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.errors || [{ message: error.message }]
    });
  }
});

// Save configuration endpoint
router.post("/api/save-config", async (req: Request, res: Response) => {
  try {
    const { userId, apiKey, cseId } = req.body;
    
    if (!userId || !apiKey || !cseId) {
      return res.status(400).json({
        success: false,
        message: "Missing required configuration fields"
      });
    }

    const saved = saveConfiguration(userId, apiKey, cseId);
    
    if (saved) {
      log(`[INFO] Configuration saved for user: ${userId}`);
      res.json({
        success: true,
        message: "Configuration saved successfully"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to save configuration"
      });
    }
  } catch (error: any) {
    log(`[ERROR] Configuration save failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to save configuration",
      error: error.message
    });
  }
});

// Load configuration endpoint
router.get("/api/load-config", async (req: Request, res: Response) => {
  try {
    const config = loadConfiguration();
    
    if (config) {
      log(`[INFO] Configuration loaded for user: ${config.userId}`);
      res.json({
        success: true,
        data: config
      });
    } else {
      res.json({
        success: false,
        message: "No saved configuration found"
      });
    }
  } catch (error: any) {
    log(`[ERROR] Configuration load failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to load configuration",
      error: error.message
    });
  }
});

// AIA generation endpoint
router.post("/api/generate", upload.array('extensions'), async (req: Request, res: Response) => {
  try {
    log(`[INFO] Starting AIA generation with data: ${JSON.stringify(req.body)}`);

    const validatedData = generateAiaRequestSchema.parse(req.body);
    const extensionFiles = req.files as Express.Multer.File[] || [];

    // Save configuration if requested
    if (validatedData.saveConfig) {
      saveConfiguration(validatedData.userId, validatedData.apiKey, validatedData.cseId);
    }

    // Generate the AIA file using the proper generator
    const aiaBuffer = await generateAiaFile(validatedData, extensionFiles);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${validatedData.projectName}.aia"`);
    res.setHeader('Content-Length', aiaBuffer.length.toString());

    log(`[INFO] AIA file generated successfully for project: ${validatedData.projectName}`);
    res.send(aiaBuffer);

  } catch (error: any) {
    log(`[ERROR] AIA generation failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to generate AIA file",
      error: error.message
    });
  }
});

export async function registerRoutes(app: express.Express) {
  app.use(router);
  log("[INFO] API routes registered successfully");
  return app;
}