import express, { Request, Response } from "express";
import multer from "multer";
import { generateAiaRequestSchema } from "@shared/schema";
import { generateAiaFile } from "./aia-generator";
import { log } from "./vite";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Validation endpoint
router.post("/validate", async (req: Request, res: Response) => {
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

// AIA generation endpoint
router.post("/generate", upload.array('extensions'), async (req: Request, res: Response) => {
  try {
    log(`[INFO] Starting AIA generation with data: ${JSON.stringify(req.body)}`);

    const validatedData = generateAiaRequestSchema.parse(req.body);
    const extensionFiles = req.files as Express.Multer.File[] || [];

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