const { app, Notification } = require('electron');
const psList = require('ps-list');  // Package to get list of running processes
const path = require('path');

// List of apps to track (change this to any app you want to monitor)
const appsToTrack = ['chrome.exe', 'notepad.exe', 'vlc.exe']; // Example apps

// Function to check if any app in the list is running
async function checkRunningProcesses() {
  try {
    const processes = await psList(); // Get the list of running processes

    // Check if any process matches the apps in the appsToTrack list
    processes.forEach((process) => {
      if (appsToTrack.includes(process.name.toLowerCase())) {
        showNotification(`${process.name} is running!`);
      }
    });
  } catch (error) {
    console.error('Error checking processes:', error);
  }
}

// Function to show notifications in the system
function showNotification(message) {
  new Notification({
    title: 'App Tracker',
    body: message,
  }).show();
}

// Function to initialize the application
function createWindow() {
  // Start tracking processes immediately when the app is ready
  setInterval(checkRunningProcesses, 5000); // Check every 5 seconds
}

// Electron app lifecycle events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
