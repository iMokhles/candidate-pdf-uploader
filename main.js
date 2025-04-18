const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");
const Store = require("electron-store");

// Store for app configurations
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Uncomment to open DevTools (for development)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Select credentials file
ipcMain.handle("select-credentials", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const credentialsPath = result.filePaths[0];
    store.set("credentialsPath", credentialsPath);
    return credentialsPath;
  }
  return null;
});

// Select PDF file
ipcMain.handle("select-pdf", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Get config
ipcMain.handle("get-config", () => {
  return {
    credentialsPath: store.get("credentialsPath"),
    spreadsheetId: store.get("spreadsheetId"),
    sheetName: store.get("sheetName", "Sheet1"),
    driveFolderId: store.get("driveFolderId"),
  };
});

// Save config
ipcMain.handle("save-config", (event, config) => {
  store.set("spreadsheetId", config.spreadsheetId);
  store.set("sheetName", config.sheetName);
  store.set("driveFolderId", config.driveFolderId);
  return true;
});

// Upload PDF and add data to sheet
ipcMain.handle("upload-and-track", async (event, candidateData) => {
  try {
    const credentialsPath = store.get("credentialsPath");
    if (!credentialsPath) {
      throw new Error("Google credentials not configured");
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const client = await auth.getClient();
    const drive = google.drive({ version: "v3", auth: client });
    const sheets = google.sheets({ version: "v4", auth: client });

    // 1. Upload PDF to Google Drive
    const fileMetadata = {
      name: path.basename(candidateData.pdfPath),
      parents: store.get("driveFolderId") ? [store.get("driveFolderId")] : [],
    };

    const media = {
      mimeType: "application/pdf",
      body: fs.createReadStream(candidateData.pdfPath),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id,webViewLink",
    });

    // Make file viewable by anyone with the link
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // 2. Prepare data for Google Sheet
    const pdfLink = file.data.webViewLink;

    // Create values array with the required columns and any custom columns
    const values = [candidateData.name, pdfLink, candidateData.feedback || ""];

    // Add any custom column data
    if (candidateData.customColumns) {
      Object.values(candidateData.customColumns).forEach((value) => {
        values.push(value);
      });
    }

    // 3. Update Google Sheet
    const spreadsheetId = store.get("spreadsheetId");
    const sheetName = store.get("sheetName", "Sheet1");
    const range = `${sheetName}!A:Z`;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [values],
      },
    });

    return {
      success: true,
      link: pdfLink,
    };
  } catch (error) {
    console.error("Error in upload-and-track:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});
