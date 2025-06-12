import { Router, Request, Response } from "express";
import { z } from "zod";
import * as admZip from "adm-zip";
import * as path from "path";
import * as fs from "fs";
import express from "express";
import { generateAiaRequestSchema } from "@shared/schema";

const router = Router();

// Use the shared schema for consistency
const generateSchema = generateAiaRequestSchema;

// Function to generate .aia file
function generateAiaFile(searchPrompt: string, appName: string): string {
  const zip = new admZip();

  // Create project.properties
  const projectProperties = `
name=${appName}
main=appinventor.ai_serkac100.${appName}.Screen1
versionname=1.0
versioncode=1
assets=../assets
source=../src
build=../build
`;
  zip.addFile("youngandroidproject/project.properties", Buffer.from(projectProperties));

  // Create Screen1.scm with dynamic searchPrompt
  const screen1Scm = `
#|
$JSON
{
  "authURL": ["ai2.appinventor.mit.edu"],
  "YaVersion": "232",
  "Source": "Form",
  "Properties": {
    "$Name": "Screen1",
    "$Type": "Form",
    "$Version": "31",
    "ActionBar": true,
    "AppName": "${appName}",
    "Title": "${appName} Search",
    "Uuid": "0",
    "$Components": [
      {
        "$Name": "SearchBox",
        "$Type": "TextBox",
        "$Version": "6",
        "Uuid": "879363160",
        "Hint": "Enter search query",
        "Text": "${searchPrompt}",
        "Width": "Fill"
      },
      {
        "$Name": "SearchButton",
        "$Type": "Button",
        "$Version": "7",
        "Uuid": "182715260",
        "Text": "Search",
        "BackgroundColor": "&HFF4CAF50",
        "TextColor": "&HFFFFFFFF",
        "Width": "Fill"
      },
      {
        "$Name": "Web1",
        "$Type": "Web",
        "$Version": "6",
        "Uuid": "995117567"
      },
      {
        "$Name": "ResultLabel",
        "$Type": "Label",
        "$Version": "6",
        "Uuid": "479436357",
        "Text": "Search results will appear here",
        "FontSize": "16sp",
        "TextAlignment": "center",
        "Width": "Fill",
        "Height": "WrapContent"
      }
    ]
  }
}
|#
`;
  zip.addFile(`src/appinventor/ai_serkac100/${appName}/Screen1.scm`, Buffer.from(screen1Scm));

  // Add Screen1.bky (from your provided file)
  const screen1Bky = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="component_event" x="50" y="50">
    <mutation component_type="Button" event_name="Click" component_id="SearchButton"></mutation>
    <field name="component_id">SearchButton</field>
    <field name="event_name">Click</field>
    <statement name="DO">
      <block type="component_method">
        <mutation component_type="Web" method_name="Url" number_of_parameters="1"></mutation>
        <field name="component_id">Web1</field>
        <field name="method_name">Url</field>
        <value name="arg0">
          <block type="text_join">
            <mutation items="4"></mutation>
            <value name="ADD0">
              <block type="text">
                <field name="TEXT">https://www.googleapis.com/customsearch/v1?key=</field>
              </block>
            </value>
            <value name="ADD1">
              <block type="text">
                <field name="TEXT">AIzaSyAywYenAfHuXtEhYc0NQdZ09kdG5r967Vk</field>
              </block>
            </value>
            <value name="ADD2">
              <block type="text">
                <field name="TEXT">&cx=b0c556cb0efcb482a&q=</field>
              </block>
            </value>
            <value name="ADD3">
              <block type="component_get_property">
                <mutation component_type="TextBox" property_name="Text"></mutation>
                <field name="component_id">SearchBox</field>
                <field name="property_name">Text</field>
              </block>
            </value>
          </block>
        </value>
        <next>
          <block type="component_method">
            <mutation component_type="Web" method_name="Get"></mutation>
            <field name="component_id">Web1</field>
            <field name="method_name">Get</field>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="component_event" x="50" y="300">
    <mutation component_type="Web" event_name="GotText" component_id="Web1"></mutation>
    <field name="component_id">Web1</field>
    <field name="event_name">GotText</field>
    <statement name="DO">
      <block type="controls_if">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A">
              <block type="variable_get">
                <field name="VAR">responseCode</field>
              </block>
            </value>
            <value name="B">
              <block type="math_number">
                <field name="NUM">200</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="component_set_get_property">
            <mutation component_type="Label" property_name="Text"></mutation>
            <field name="component_id">ResultLabel</field>
            <field name="property_name">Text</field>
            <value name="VALUE">
              <block type="variable_get">
                <field name="VAR">responseContent</field>
              </block>
            </value>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
`;
  zip.addFile(`src/appinventor/ai_serkac100/${appName}/Screen1.bky`, Buffer.from(screen1Bky));

  // Save .aia file
  const outputPath = path.join(__dirname, `${appName}.aia`);
  zip.writeZip(outputPath);
  return outputPath;
}

// Register routes
export async function registerRoutes(app: express.Express) {
  // Validation endpoint
  router.post("/api/validate", async (req: Request, res: Response) => {
    try {
      console.log("Validation request received:", req.body);
      
      // Validate the request data
      const validatedData = generateAiaRequestSchema.parse(req.body);
      
      // Perform additional validation checks
      const validationResults = {
        valid: true,
        message: "Configuration is valid",
        detectedFeatures: {
          use_list_view: validatedData.requirements?.toLowerCase().includes('list view') || false,
          play_sound: validatedData.requirements?.toLowerCase().includes('sound') || false,
        },
        warnings: [] as string[]
      };

      // Check for potential issues
      if (!validatedData.apiKey || validatedData.apiKey.length < 30) {
        validationResults.warnings.push("API key appears to be too short");
      }
      
      if (!validatedData.cseId || validatedData.cseId.length < 10) {
        validationResults.warnings.push("CSE ID appears to be too short");
      }

      console.log("Validation successful:", validationResults);
      res.json(validationResults);
      
    } catch (error) {
      console.error("Validation error:", error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          valid: false,
          message: "Validation failed",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        res.status(500).json({
          valid: false,
          message: "Internal server error during validation",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  router.post("/api/generate", async (req: Request, res: Response) => {
    try {
      const validatedData = generateSchema.parse(req.body);
      const { searchPrompt, projectName } = validatedData;
      const aiaPath = generateAiaFile(searchPrompt, projectName);
      res.download(aiaPath, `${projectName}.aia`, (err) => {
        if (err) {
          res.status(500).json({ message: "Failed to send .aia file" });
        }
        fs.unlinkSync(aiaPath);
      });
    } catch (error) {
      res.status(400).json({ valid: false, message: (error as Error).message, errors: error });
    }
  });

  app.use(router);
  return app.listen();
}