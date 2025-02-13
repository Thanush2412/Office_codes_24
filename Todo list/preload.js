// This file can be used to expose any functionality needed in the renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Expose necessary methods to renderer process
contextBridge.exposeInMainWorld('electron', {
    sendNotification: (message) => ipcRenderer.send('send-notification', message),
    
});

