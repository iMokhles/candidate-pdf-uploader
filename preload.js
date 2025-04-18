const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Configuration functions
  selectCredentials: () => ipcRenderer.invoke("select-credentials"),
  selectPdf: () => ipcRenderer.invoke("select-pdf"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),

  // Upload and track function
  uploadAndTrack: (candidateData) =>
    ipcRenderer.invoke("upload-and-track", candidateData),
});
