
import { Router, Request, Response } from "express";
import multer from "multer";
import admZip from "adm-zip";
import { generateAiaRequestSchema, type GenerateAiaRequest } from "../shared/schema";
import { log } from "./vite";

const router = Router();
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
    const { projectName, userId, searchPrompt } = validatedData;
    
    // Generate the AIA file
    const aiaBuffer = generateAiaFile(searchPrompt, projectName, userId);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${projectName}.aia"`);
    res.setHeader('Content-Length', aiaBuffer.length.toString());
    
    log(`[INFO] AIA file generated successfully for project: ${projectName}`);
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

function generateAiaFile(searchPrompt: string, appName: string, userId: string): Buffer {
  log(`[DEBUG] Generating .aia file for appName: ${appName}, searchPrompt: ${searchPrompt}, userId: ${userId}`);
  const zip = new admZip();

  // Create project.properties
  const projectProperties = `main=appinventor.ai_${userId}.${appName}.Screen1
name=${appName}
assets=../assets
source=../src
build=../build
versioncode=1
versionname=1.0
useslocation=false
aname=${appName}
sizing=Responsive
showlistsasjson=true
actionbar=false
theme=AppTheme.Light.DarkActionBar
color.primary=&HFF3F51B5
color.primary.dark=&HFF303F9F
color.accent=&HFFFF4081
color.primary.light=&HFFC5CAE9
`;
  zip.addFile("youngandroidproject/project.properties", Buffer.from(projectProperties));

  // Create Screen1.scm with proper structure
  const screen1Scm = `#|
$JSON
{
  "authURL": ["ai2.appinventor.mit.edu"],
  "YaVersion": "232",
  "Source": "Form",
  "Properties": {
    "$Name": "Screen1",
    "$Type": "Form",
    "$Version": "31",
    "ActionBar": false,
    "AppName": "${appName}",
    "BackgroundColor": "&HFFFFFFFF",
    "Icon": "icon.png",
    "Sizing": "Responsive",
    "Title": "${appName}",
    "TitleVisible": true,
    "Uuid": "0",
    "$Components": [
      {
        "$Name": "VerticalArrangement1",
        "$Type": "VerticalArrangement",
        "$Version": "4",
        "AlignHorizontal": "3",
        "AlignVertical": "2",
        "Height": "-2",
        "Width": "-2",
        "Uuid": "123456789",
        "$Components": [
          {
            "$Name": "TitleLabel",
            "$Type": "Label",
            "$Version": "6",
            "FontBold": true,
            "FontSize": "24",
            "Text": "${appName} Search",
            "TextAlignment": "1",
            "TextColor": "&HFF3F51B5",
            "Width": "-2",
            "Height": "-1",
            "Uuid": "987654321"
          },
          {
            "$Name": "SearchBox",
            "$Type": "TextBox",
            "$Version": "6",
            "Hint": "Enter your search query",
            "Text": "${searchPrompt || ''}",
            "Width": "-2",
            "Height": "-1",
            "FontSize": "16",
            "Uuid": "879363160"
          },
          {
            "$Name": "SearchButton",
            "$Type": "Button",
            "$Version": "7",
            "BackgroundColor": "&HFF4CAF50",
            "FontBold": true,
            "FontSize": "18",
            "Text": "Search",
            "TextColor": "&HFFFFFFFF",
            "Width": "-2",
            "Height": "-1",
            "Uuid": "182715260"
          },
          {
            "$Name": "Web1",
            "$Type": "Web",
            "$Version": "6",
            "Height": "-1",
            "Width": "-1",
            "Uuid": "995117567"
          },
          {
            "$Name": "ScrollableArrangement1",
            "$Type": "VerticalScrollArrangement",
            "$Version": "5",
            "AlignHorizontal": "3",
            "BackgroundColor": "&HFF00FFFFFF",
            "Height": "-1",
            "Width": "-2",
            "Uuid": "456789123",
            "$Components": [
              {
                "$Name": "ResultLabel",
                "$Type": "Label",
                "$Version": "6",
                "FontSize": "14",
                "Text": "Search results will appear here. Tap the Search button to begin.",
                "TextAlignment": "0",
                "Width": "-2",
                "Height": "-1",
                "Uuid": "479436357"
              }
            ]
          }
        ]
      }
    ]
  }
}
|#`;

  zip.addFile(`src/appinventor/ai_${userId}/${appName}/Screen1.scm`, Buffer.from(screen1Scm));

  // Create Screen1.bky (blocks file) with proper Google Custom Search implementation
  const screen1Bky = `<xml xmlns="https://developers.google.com/blockly/xml">
  <variables>
    <variable id="searchQuery">searchQuery</variable>
    <variable id="apiUrl">apiUrl</variable>
    <variable id="results">results</variable>
  </variables>
  <block type="component_event" id="SearchButton_Click" x="20" y="20">
    <mutation component_type="Button" instance_name="SearchButton" event_name="Click"></mutation>
    <statement name="DO">
      <block type="lexical_variable_set" id="setSearchQuery">
        <field name="VAR">searchQuery</field>
        <value name="VALUE">
          <block type="component_method" id="getSearchText">
            <mutation component_type="TextBox" method_name="Text" instance_name="SearchBox"></mutation>
          </block>
        </value>
        <next>
          <block type="controls_if" id="checkNotEmpty">
            <value name="IF0">
              <block type="logic_compare" id="compareLength">
                <field name="OP">GT</field>
                <value name="A">
                  <block type="text_length" id="textLength">
                    <value name="VALUE">
                      <block type="lexical_variable_get" id="getSearchQuery">
                        <field name="VAR">searchQuery</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="zeroNumber">
                    <field name="NUM">0</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="component_set_get" id="setResultText">
                <mutation component_type="Label" set_or_get="set" property_name="Text" instance_name="ResultLabel"></mutation>
                <value name="VALUE">
                  <block type="text" id="searchingText">
                    <field name="TEXT">Searching...</field>
                  </block>
                </value>
                <next>
                  <block type="lexical_variable_set" id="setApiUrl">
                    <field name="VAR">apiUrl</field>
                    <value name="VALUE">
                      <block type="text_join" id="buildUrl">
                        <mutation items="6"></mutation>
                        <value name="ADD0">
                          <block type="text" id="baseUrl">
                            <field name="TEXT">https://www.googleapis.com/customsearch/v1?key=</field>
                          </block>
                        </value>
                        <value name="ADD1">
                          <block type="text" id="apiKey">
                            <field name="TEXT">YOUR_API_KEY_HERE</field>
                          </block>
                        </value>
                        <value name="ADD2">
                          <block type="text" id="cxParam">
                            <field name="TEXT">&amp;cx=</field>
                          </block>
                        </value>
                        <value name="ADD3">
                          <block type="text" id="cseId">
                            <field name="TEXT">YOUR_CSE_ID_HERE</field>
                          </block>
                        </value>
                        <value name="ADD4">
                          <block type="text" id="qParam">
                            <field name="TEXT">&amp;q=</field>
                          </block>
                        </value>
                        <value name="ADD5">
                          <block type="lexical_variable_get" id="getSearchQueryForUrl">
                            <field name="VAR">searchQuery</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="component_method" id="webGet">
                        <mutation component_type="Web" method_name="Get" instance_name="Web1"></mutation>
                        <value name="ARG0">
                          <block type="lexical_variable_get" id="getApiUrlForWeb">
                            <field name="VAR">apiUrl</field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="component_set_get" id="setEmptyText">
                <mutation component_type="Label" set_or_get="set" property_name="Text" instance_name="ResultLabel"></mutation>
                <value name="VALUE">
                  <block type="text" id="emptyQueryText">
                    <field name="TEXT">Please enter a search query</field>
                  </block>
                </value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="component_event" id="Web1_GotText" x="20" y="400">
    <mutation component_type="Web" instance_name="Web1" event_name="GotText"></mutation>
    <value name="ARG0">
      <block type="lexical_variable_get" id="urlArg">
        <field name="VAR">url</field>
      </block>
    </value>
    <value name="ARG1">
      <block type="lexical_variable_get" id="responseCodeArg">
        <field name="VAR">responseCode</field>
      </block>
    </value>
    <value name="ARG2">
      <block type="lexical_variable_get" id="responseTypeArg">
        <field name="VAR">responseType</field>
      </block>
    </value>
    <value name="ARG3">
      <block type="lexical_variable_get" id="responseContentArg">
        <field name="VAR">responseContent</field>
      </block>
    </value>
    <statement name="DO">
      <block type="controls_if" id="checkResponseCode">
        <value name="IF0">
          <block type="logic_compare" id="responseCodeCheck">
            <field name="OP">EQ</field>
            <value name="A">
              <block type="lexical_variable_get" id="getResponseCode">
                <field name="VAR">responseCode</field>
              </block>
            </value>
            <value name="B">
              <block type="math_number" id="successCode">
                <field name="NUM">200</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="component_set_get" id="setSuccessResult">
            <mutation component_type="Label" set_or_get="set" property_name="Text" instance_name="ResultLabel"></mutation>
            <value name="VALUE">
              <block type="text_join" id="successMessage">
                <mutation items="2"></mutation>
                <value name="ADD0">
                  <block type="text" id="successPrefix">
                    <field name="TEXT">Search Results:\\n</field>
                  </block>
                </value>
                <value name="ADD1">
                  <block type="lexical_variable_get" id="getResponseContent">
                    <field name="VAR">responseContent</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="component_set_get" id="setErrorResult">
            <mutation component_type="Label" set_or_get="set" property_name="Text" instance_name="ResultLabel"></mutation>
            <value name="VALUE">
              <block type="text_join" id="errorMessage">
                <mutation items="2"></mutation>
                <value name="ADD0">
                  <block type="text" id="errorPrefix">
                    <field name="TEXT">Error: </field>
                  </block>
                </value>
                <value name="ADD1">
                  <block type="lexical_variable_get" id="getErrorResponse">
                    <field name="VAR">responseContent</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;

  zip.addFile(`src/appinventor/ai_${userId}/${appName}/Screen1.bky`, Buffer.from(screen1Bky));

  // Add assets directory with a default icon
  const iconData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
  zip.addFile(`assets/icon.png`, iconData);

  return zip.toBuffer();
}

export function registerRoutes(app: any) {
  app.use('/api', router);
}
