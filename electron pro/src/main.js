const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { parse } = require('json2csv');
const store = new Store();
const userDataDir = app.getPath('userData');
const leaderboardSessionPath = path.join(userDataDir, 'leaderboard_session.json');
const appSettingsPath = path.join(userDataDir, 'app_settings.json');
const notifier = require('node-notifier');

let mainWindow;
let browser = null; // Initialize as null, launch when needed
let leaderboardSession;

// Load leaderboard session from JSON file if it exists
if (fs.existsSync(leaderboardSessionPath)) {
    try {
        leaderboardSession = JSON.parse(fs.readFileSync(leaderboardSessionPath, 'utf-8'));
    } catch (e) {
        leaderboardSession = { data: [], lastSuccessfulPage: 0 };
    }
} else {
    leaderboardSession = store.get('leaderboardSession', {
        data: [],
        lastSuccessfulPage: 0
    });
}

// Load app settings from JSON file if it exists
let appSettings = {
    darkMode: false,
    fontSize: 16,
    layout: 'centered',
    contrast: 'normal',
    notificationsEnabled: true
};
if (fs.existsSync(appSettingsPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(appSettingsPath, 'utf-8'));
        appSettings = { ...appSettings, ...loaded };
    } catch (e) {
        // ignore, use defaults
    }
} else {
    // If file does not exist, create it with defaults
    fs.writeFileSync(appSettingsPath, JSON.stringify(appSettings, null, 2), 'utf-8');
}

// Helper to save leaderboard session to JSON file and electron-store
function saveLeaderboardSession() {
    fs.writeFileSync(leaderboardSessionPath, JSON.stringify(leaderboardSession, null, 2), 'utf-8');
    store.set('leaderboardSession', leaderboardSession);
}

function saveAppSettings() {
    try {
        console.log('Writing to', appSettingsPath, JSON.stringify(appSettings, null, 2)); // Debug log
        fs.writeFileSync(appSettingsPath, JSON.stringify(appSettings, null, 2), 'utf-8');
        console.log('Write successful! Path:', appSettingsPath);
    } catch (err) {
        console.error('Error writing app_settings.json:', err, 'Path:', appSettingsPath);
    }
}

// Register ALL ipcMain.handle handlers at the top
ipcMain.handle('show-save-dialog', async () => {
    const result = await dialog.showSaveDialog({
        title: 'Select CSV Save Location',
        defaultPath: 'comparison_results.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (!result.canceled && result.filePath) {
        return result.filePath;
    }
    return null;
});

ipcMain.handle('get-app-settings', () => {
    return appSettings;
});
ipcMain.handle('set-app-settings', (event, newSettings) => {
    console.log('Saving app settings:', newSettings); // Debug log
    appSettings = { ...newSettings }; // Replace, not merge
    saveAppSettings();
    return appSettings;
});
ipcMain.handle('save-leaderboard-session', async (event, sessionData) => {
    try {
        leaderboardSession = sessionData;
        await fsPromises.writeFile(leaderboardSessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
        store.set('leaderboardSession', sessionData);
        return { success: true };
    } catch (error) {
        console.error('Error saving leaderboard session:', error);
        return { success: false, error: error.message };
    }
});
ipcMain.handle('open-app-data-folder', async () => {
    try {
        const result = await shell.openPath(app.getPath('userData'));
        if (result) {
            return { success: false, message: result };
        }
        return { success: true };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

function getAppIconPath() {
    // Use the correct icon path for dev and packaged builds
    if (process.env.NODE_ENV === 'development' || process.defaultApp) {
        return path.join(__dirname, '..', 'assets', 'icon.ico');
    } else {
        return path.join(process.resourcesPath, 'assets', 'icon.ico');
    }
}

async function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                devTools: process.env.NODE_ENV === 'development'
            },
            frame: true,
            titleBarStyle: 'hidden',
            titleBarOverlay: {
                color: '#1e1e1e',
                symbolColor: '#ffffff'
            },
            backgroundColor: '#1e1e1e',
            icon: getAppIconPath()
        });

        const indexPath = path.join(__dirname, 'index.html');
        await mainWindow.loadFile(indexPath);
    } catch (error) {
        console.error('Error creating window:', error);
        app.quit();
    }
}

app.whenReady().then(async () => {
    try {
        await createWindow();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    } catch (error) {
        console.error('Error initializing application:', error);
        app.quit();
    }
}).catch(error => {
    console.error('Error in app initialization:', error);
    app.quit();
});

app.on('window-all-closed', async () => {
    if (browser) await browser.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Lazy load browser function using Puppeteer with Chrome
async function getBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: false,
            executablePath: getChromePath(),
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
    }
    return browser;
}

// Chrome path detection
function getChromePath() {
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
            return chromePath;
        }
    }
    return null; // Will use Puppeteer's bundled Chromium if Chrome not found
}

// IPC handlers for leaderboard scraping
let isScrapingLeaderboard = false;
let isPausedLeaderboard = false;

ipcMain.handle('start-leaderboard-scraping', async (event, config) => {
    if (isScrapingLeaderboard) return;
    isScrapingLeaderboard = true;
    isPausedLeaderboard = false;

    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    try {
        const results = [...leaderboardSession.data];
        const startRank = results.length + 1;

        for (let currentPage = config.startPage; currentPage <= config.endPage; currentPage++) {
            while (isPausedLeaderboard) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!isScrapingLeaderboard) break;
            }

            if (!isScrapingLeaderboard) break;

            const url = `${config.baseUrl}/${currentPage}`;
            console.log('Navigating to:', url);
            await page.goto(url, { waitUntil: 'networkidle0' });
            await page.evaluate((sleepTime) => new Promise(resolve => setTimeout(resolve, sleepTime * 1000)), config.sleepTime);
            console.log('Evaluating leaderboard page...');
            const pageData = await page.evaluate((startRank) => {
                const rows = Array.from(document.querySelectorAll('.leaderboard-row'));
                return rows.map((row, index) => ({
                    rank: startRank + index,
                    hackerName: row.querySelector('.cursor.leaderboard-hackername.rg_5')?.textContent,
                    score: row.querySelector('.span-flex-3')?.textContent.trim()
                }));
            }, startRank + results.length);
            console.log('Page data:', pageData);

            results.push(...pageData);
            leaderboardSession.data = results;
            leaderboardSession.lastSuccessfulPage = currentPage;
            saveLeaderboardSession();

            event.sender.send('leaderboard-progress', {
                currentPage,
                totalPages: config.endPage - config.startPage + 1,
                processedCount: results.length
            });

            // Show notification for progress
            if (appSettings.notificationsEnabled !== false) {
                notifier.notify({
                    title: 'HackerRank Scraper',
                    message: `Processed page ${currentPage} of ${config.endPage}`,
                    timeout: 2
                });
            }
        }

        return results;
    } catch (error) {
        if (appSettings.notificationsEnabled !== false) {
            notifier.notify({
                title: 'HackerRank Scraper Error',
                message: error.message,
                timeout: 5
            });
        }
        throw error;
    } finally {
        isScrapingLeaderboard = false;
        await page.close();
    }
});

ipcMain.handle('pause-leaderboard-scraping', () => {
    isPausedLeaderboard = !isPausedLeaderboard;
    return isPausedLeaderboard;
});

ipcMain.handle('stop-leaderboard-scraping', () => {
    isScrapingLeaderboard = false;
    isPausedLeaderboard = false;
    return true;
});

// IPC handlers for user comparison
let isScrapingComparison = false;
let isPausedComparison = false;

ipcMain.handle('start-user-comparison', async (event, config) => {
    if (isScrapingComparison) return;
    isScrapingComparison = true;
    isPausedComparison = false;

    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    try {
        const results = [];
        const totalUsers = config.usernames.length;
        let columnNames = null;
        let saveCount = 0;
        // Use user-specified path or default
        let csvPath = config.savePath && config.savePath.length > 0 ? config.savePath : null;
        if (!csvPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            csvPath = path.join(app.getPath('downloads'), `comparison_results_${timestamp}.csv`);
        }
        // Ensure directory exists
        try {
            const dir = path.dirname(csvPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (e) { /* ignore */ }

        for (const username of config.usernames) {
            while (isPausedComparison) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!isScrapingComparison) break;
            }

            if (!isScrapingComparison) break;

            let result;
            try {
                // Build URL without double slashes
                let url = config.baseUrl;
                if (config.fixedUsername) {
                    url += '/' + encodeURIComponent(config.fixedUsername);
                }
                url += '/' + encodeURIComponent(username);
                await page.goto(url, { waitUntil: 'networkidle0' });
                await page.evaluate((sleepTime) => new Promise(resolve => setTimeout(resolve, sleepTime * 1000)), config.sleepTime);

                const userData = await page.evaluate(() => {
                    const columns = Array.from(document.querySelectorAll('.mjL.span-flex-7.text-left'))
                        .map(col => col.textContent.trim());
                    const values = Array.from(document.querySelectorAll('.mlL.span-flex-4'))
                        .map(val => {
                            const text = val.textContent.trim();
                            // Extract number before parentheses if it exists
                            const match = text.match(/^(\d+\.?\d*)/);
                            return match ? match[1] : text;
                        });
                    return { columns, values };
                });

                if (!columnNames && userData.columns.length) {
                    columnNames = ['username', ...userData.columns, 'error'];
                }

                // Create a result object with both flat structure and data property
                // This ensures compatibility with both the CSV export and the table display
                result = {
                    username,
                    data: userData, // Keep the original data structure for the table
                    error: null,
                    // Add flat properties for CSV export
                    ...Object.fromEntries(userData.columns.map((col, i) => [col, userData.values[i] || '']))
                };
            } catch (error) {
                if (!columnNames) columnNames = ['username', 'error'];
                result = {
                    username,
                    error: error.message
                };
            }

            results.push(result);
            saveCount++;

            // Real-time save every 5 results
            if (saveCount % 5 === 0) {
                try {
                    const csv = parse(results, { fields: columnNames, header: !fs.existsSync(csvPath) });
                    fs.writeFileSync(csvPath, csv, { encoding: 'utf8' });
                } catch (e) {
                    // Ignore save errors, but log
                    console.error('CSV save error:', e);
                }
            }

            // Send real-time updates
            event.sender.send('comparison-progress', {
                processed: results.length,
                total: totalUsers,
                currentUsername: username,
                newData: [result],
                startTime: results.length === 1 ? Date.now() : config.startTime
            });
        }

        // Final save
        try {
            const csv = parse(results, { fields: columnNames, header: true });
            fs.writeFileSync(csvPath, csv, { encoding: 'utf8' });
        } catch (e) {
            console.error('Final CSV save error:', e);
        }

        return results;
    } catch (error) {
        if (appSettings.notificationsEnabled !== false) {
            notifier.notify({
                title: 'Comparison Error',
                message: error.message,
                timeout: 5
            });
        }
        throw error;
    } finally {
        isScrapingComparison = false;
        await page.close();
    }
});

ipcMain.handle('pause-comparison-scraping', () => {
    isPausedComparison = !isPausedComparison;
    return isPausedComparison;
});

ipcMain.handle('stop-comparison-scraping', () => {
    isScrapingComparison = false;
    isPausedComparison = false;
    return true;
});
