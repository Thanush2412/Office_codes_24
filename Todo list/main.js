const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const jsonfile = require('jsonfile');

const filePath = path.join(__dirname, 'tasks.json');

let mainWindow;

app.setName('Todo - 2 4');  // Set the app name explicitly

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title:"Todo - 2 4",
        icon:"todo-icon-512x512-voha1qns.png",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Function to show and focus the window
function showWindow() {
    if (!mainWindow) {
        createWindow();
    } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        
        // Bring to front on macOS
        if (process.platform === 'darwin') {
            app.dock.show();
            app.focus({ steal: true });
        }
    }
}

// Load tasks from file
ipcMain.handle('get-tasks', () => {
    try {
        if (fs.existsSync(filePath)) {
            return jsonfile.readFileSync(filePath);
        }
    } catch (err) {
        console.log('Error reading tasks file:', err);
    }
    return [];
});

// Save tasks to file
ipcMain.handle('save-tasks', (event, tasks) => {
    try { 
        jsonfile.writeFileSync(filePath, tasks, { spaces: 2 });
    } catch (err) {
        console.log('Error saving tasks file:', err);
    }
});

// Enhanced notification handler
ipcMain.on('send-notification', (event, task) => {
    const notification = new Notification({
        title: 'Todo - 2 4 - Task Reminder', // Explicitly set the title here
        body: `Time for the task: ${task.text}`,
        silent: false,
        icon: path.join(__dirname, 'todo-icon-512x512-voha1qns.png'),
        actions: [{ type: 'button', text: 'Open App' }],
        closeButtonText: 'Close'
    });

    notification.on('click', () => {
        showWindow();
    });

    notification.on('action', () => {
        showWindow();
    });

    notification.on('close', () => {
        // Handle close button click
    });

    notification.show();
});



// Handle user login/logout events
ipcMain.on('user-logged-in', (event, loginTime) => {
    console.log('User logged in at:', loginTime);
});

ipcMain.on('user-logged-out', (event, logoutTime) => {
    console.log('User logged out at:', logoutTime);
});

// App initialization
app.whenReady().then(() => {
    createWindow();

    // Handle macOS activation
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Window closing behavior
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // On Windows and Linux, minimize to tray instead of quitting
        if (mainWindow) {
            mainWindow.hide();
        }
    } else {
        // On macOS, hide the dock icon
        app.dock.hide();
    }
});

// Prevent actual quitting when all windows are closed
app.on('before-quit', (event) => {
    if (mainWindow) {
        event.preventDefault();
        mainWindow.hide();
    }
});

// Optional: Add a tray icon for better background operation
const { Tray, Menu } = require('electron');
let tray = null;

app.whenReady().then(() => {
    tray = new Tray(path.join(__dirname, 'todo-icon-512x512-voha1qns.png'));
    tray.setToolTip('todo24 - Task Manager'); // Make sure to have an icon.png
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Open', 
            click: () => showWindow() 
        },
        { 
            label: 'Quit', 
            click: () => {
                app.isQuitting = true;
                app.quit();
            } 
        }
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Todo - 24');
    
    tray.on('click', () => {
        showWindow();
    });
});