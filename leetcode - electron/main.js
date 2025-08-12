const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer');
class QuestionChecker {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isProcessing = false;
    }

    async init(isHeadless) {
        if (this.browser) {
            await this.browser.close();
        }

        console.log(`Launching browser for question checking - Headless mode: ${isHeadless}`);
        this.browser = await puppeteer.launch({
            headless: isHeadless ? "new" : false,
            executablePath: settings.chromePath,
            defaultViewport: { width: 1024, height: 768 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-position=9999,9999',  // Position off-screen
                '--window-size=1024,768',
                '--start-minimized',
                '--disable-notifications',
                '--mute-audio'
            ]
        });

        this.page = await this.browser.newPage();
        this.isProcessing = true;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        this.isProcessing = false;
    }

    async checkQuestions(url, questions) {
        try {
            await this.page.goto(url, { waitUntil: 'networkidle0' });
            const result = await this.page.evaluate((selector) => {
                const elements = document.querySelectorAll(selector);
                return Array.from(elements).map(el => el.innerText.trim()).filter(Boolean);
            }, '.text-label-1.dark\\:text-dark-label-1.line-clamp-1.font-medium');

            return questions.map(question => ({
                question,
                solved: result.includes(question)
            }));
        } catch (error) {
            console.error('Error checking questions:', error);
            throw error;
        }
    }
}

const questionChecker = new QuestionChecker();

// Handle question checking
ipcMain.handle('check-questions', async (event, { url, profileName, questions, pointsPerMatch, isHeadless }) => {
    try {
        await questionChecker.init(isHeadless);
        
        const questionMatches = await questionChecker.checkQuestions(url, questions);
        const solvedCount = questionMatches.filter(m => m.solved).length;
        const points = solvedCount * pointsPerMatch;
        const maxPoints = questions.length * pointsPerMatch;
        
        await questionChecker.cleanup();
        
        return {
            questionMatches,
            totalQuestions: questions.length,
            solvedQuestions: solvedCount,
            points,
            maxPoints,
            pointsPerMatch,
            'Profile Name': profileName,
            'Profile URL': url
        };
    } catch (error) {
        console.error('Error in check-questions:', error);
        await questionChecker.cleanup();
        throw error;
    }
});
let mainWindow;
let questionCheckerWindow;
let isScrapingActive = false;
let isPaused = false;
// Settings management
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
console.log('Settings path:', settingsPath); // Log the settings path
let settings = {
  profileHeadlessMode: true,
  questionsHeadlessMode: true,
  saveDir: path.join(app.getPath('documents'), 'leetcode_results'),
  filename: 'leetcode_results.xlsx',
  pointsPerMatch: 10,
  chromePath: getChromePath(),
  saveMethod: 'xlsx', // Default save method
  // UI Customization settings
  theme: 'dark',
  accentColor: '#6366f1',
  fontSize: 'medium',
  sidebarPosition: 'left',
  layoutStyle: 'default',
  buttonStyle: 'default',
  resultContainerStyle: 'default'
};
// Load settings on startup
function loadSettings() {
  try {
    console.log('Loading settings from:', settingsPath);
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const parsedSettings = JSON.parse(data);
      settings = { ...settings, ...parsedSettings };
      console.log('Settings loaded successfully:', settings);
    } else {
      console.log('No settings file found, creating default...');
      saveSettings(); // Create default settings file
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    // Create default settings file if loading fails
    saveSettings();
  }
}
// Save settings to file
function saveSettings() {
  try {
    console.log('Saving settings to:', settingsPath);
    // Ensure directory exists
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}
// Get Chrome path based on OS
function getChromePath() {
  const platform = process.platform;
  const possiblePaths = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ]
  };
  const paths = possiblePaths[platform] || [];
  for (const chromePath of paths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return null; // Let Puppeteer find Chrome if not in common locations
}
// Load settings at startup
loadSettings();
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'icon.ico')
    });
    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // Removed to prevent DevTools from opening
}
// app.whenReady() handler is now at the bottom of the file
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// Handle getting settings
ipcMain.handle('get-settings', () => {
    console.log('Sending settings to renderer:', settings);
    return settings;
});
// Handle updating settings
ipcMain.handle('update-settings', (event, newSettings) => {
    console.log('Updating settings with:', newSettings);
    settings = { ...settings, ...newSettings };
    saveSettings();
    return settings;
});
// Handle file selection
ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }
        ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            let data;
            if (filePath.endsWith('.csv')) {
                data = fs.readFileSync(filePath, 'utf8');
                // Parse CSV
            } else {
                const workbook = XLSX.readFile(filePath);
                data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            return { success: true, filePath, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false };
});
// Handle questions file selection
ipcMain.handle('select-questions-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }
        ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            let data;
            if (filePath.endsWith('.csv')) {
                data = fs.readFileSync(filePath, 'utf8');
                // Parse CSV
            } else {
                const workbook = XLSX.readFile(filePath);
                data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            return { success: true, filePath, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false };
});
// Handle save directory selection
ipcMain.handle('select-save-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});
// Handle question checking is now handled by the QuestionChecker class above
// Handle saving question results
ipcMain.handle('save-question-results', async (event, { data, saveDir, filename }) => {
    const saveDirPath = saveDir || settings.saveDir;
    if (!fs.existsSync(saveDirPath)) {
        fs.mkdirSync(saveDirPath, { recursive: true });
    }
    const filePath = path.join(saveDirPath, filename);
    const workbook = XLSX.utils.book_new();
    
    // Convert question matches to rows
    const rows = data.questionMatches.map(match => ({
        Question: match.question,
        Solved: match.solved ? 'Yes' : 'No',
        Points: match.solved ? data.pointsPerMatch : 0
    }));
    // Add summary row
    rows.push({}, {
        Question: 'Total',
        Solved: `${data.solvedQuestions}/${data.totalQuestions}`,
        Points: `${data.points}/${data.maxPoints}`
    });
    // Add profile information at the top
    const worksheet = XLSX.utils.json_to_sheet([
        { Question: 'Profile Name', Solved: data['Profile Name'] },
        { Question: 'Profile URL', Solved: data['Profile URL'] },
        {},
        ...rows
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Question Results');
    XLSX.writeFile(workbook, filePath);
    return filePath;
});
class ScrapingQueue {
    constructor() {
        this.queue = [];
        this.results = [];
        this.onComplete = null;
        this.onProgress = null;
        this.onError = null;
        this.isActive = false;
        this.isPaused = false;
        this.currentBrowser = null;
        this.totalUrls = 0;
        this.processedCount = 0;
    }

    async add(urls, options) {
        // Store the total count from the beginning
        this.totalUrls = urls.length;
        this.processedCount = 0;
        this.queue.push(...urls.map(url => ({ url, options })));
        if (!this.isActive) {
            this.isActive = true;
            await this.processQueue();
        }
    }

    pause() {
        this.isPaused = true;
        console.log('Scraping paused');
    }

    resume() {
        this.isPaused = false;
        console.log('Scraping resumed');
        this.processQueue();
    }

    async stop() {
        this.isActive = false;
        this.queue = [];
        if (this.currentBrowser) {
            await this.currentBrowser.close();
            this.currentBrowser = null;
        }
        console.log('Scraping stopped');
    }

    async processQueue() {
        if (!this.isActive) return;

        try {
            while (this.queue.length > 0 && this.isActive) {
                if (this.isPaused) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const item = this.queue.shift();
                if (!item) break;

                // Always increment processed count regardless of success/failure
                this.processedCount++;

                try {
                    const result = await this.processUrl(item.url, item.options);
                    
                    // Always add result to results array, even if it's "not available"
                    if (result) {
                        // Save progress after each attempt
                        await this.saveProgress(item.options.saveDir, item.options.filename);
                    }
                    
                    // Update progress with consistent counting
                    this.onProgress?.({
                        processed: this.processedCount,
                        total: this.totalUrls,
                        current: this.processedCount,
                        result: result
                    });
                    
                    // Wait a bit between requests to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                } catch (error) {
                    console.error(`Error processing ${item.url}:`, error);
                    
                    // Create a "not available" result for failed URLs
                    const failedResult = {
                        URL: item.url,
                        Easy: 'Not available',
                        Medium: 'Not available',
                        Hard: 'Not available',
                        Rank: 'Not available',
                        Status: 'Error: ' + error.message
                    };
                    this.results.push(failedResult);
                    
                    this.onError?.({ url: item.url, error: error.message });
                    
                    // Update progress even for errors
                    this.onProgress?.({
                        processed: this.processedCount,
                        total: this.totalUrls,
                        current: this.processedCount,
                        result: failedResult
                    });
                    
                    // Wait longer after an error
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        } finally {
            // Only close the browser when queue is completely finished or stopped
            if (this.queue.length === 0 || !this.isActive) {
                console.log('Queue finished, cleaning up browser...');
                if (this.currentBrowser) {
                    await this.currentBrowser.close().catch(() => {});
                    this.currentBrowser = null;
                }
                this.isActive = false;
                this.onComplete?.(this.results);
            }
        }
    }

    async initBrowser(options) {
        if (!this.currentBrowser) {
            console.log('Initializing browser for queue processing...');
            this.currentBrowser = await puppeteer.launch({ 
                headless: options.isHeadless ? "new" : false,
                executablePath: settings.chromePath,
                defaultViewport: { width: 1024, height: 768 },
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--window-position=9999,9999',  // Position off-screen
                    '--window-size=1024,768',
                    '--start-minimized',
                    '--disable-notifications',
                    '--mute-audio'
                ]
            });
        }
    }

    async processUrl(url, options) {
        try {
            // Always try to process the URL, even if it might be invalid
            console.log(`Processing URL in queue: ${url}`);

            // Ensure browser is initialized
            await this.initBrowser(options);
            
            // Process URL with existing browser instance
            const result = await scrapeLeetCodeProfile(url, this.currentBrowser);
            
            // Always add result to results array, even if some data is not available
            if (result) {
                console.log(`Scraped data:`, result);
                this.results.push(result);
                return result;
            } else {
                // Create a "not available" result for invalid URLs
                const notAvailableResult = {
                    URL: url,
                    Easy: 'Not available',
                    Medium: 'Not available',
                    Hard: 'Not available',
                    Rank: 'Not available',
                    Status: 'Profile not found'
                };
                console.log(`No data found for: ${url}`);
                this.results.push(notAvailableResult);
                return notAvailableResult;
            }
        } catch (error) {
            console.error(`Error processing URL ${url}:`, error);
            // If browser error occurs, try to reinitialize
            if (error.message.includes('browser') || error.message.includes('Target closed')) {
                console.log('Browser disconnected, reinitializing...');
                await this.currentBrowser?.close().catch(() => {});
                this.currentBrowser = null;
                await this.initBrowser(options);
                // Retry once
                try {
                    console.log(`Retrying URL: ${url}`);
                    const result = await scrapeLeetCodeProfile(url, this.currentBrowser);
                    if (result) {
                        this.results.push(result);
                        return result;
                    } else {
                        const notAvailableResult = {
                            URL: url,
                            Easy: 'Not available',
                            Medium: 'Not available',
                            Hard: 'Not available',
                            Rank: 'Not available',
                            Status: 'Profile not found (retry)'
                        };
                        this.results.push(notAvailableResult);
                        return notAvailableResult;
                    }
                } catch (retryError) {
                    console.error(`Retry failed for ${url}:`, retryError);
                    throw retryError; // Let the caller handle this
                }
            }
            throw error; // Let the caller handle this
        }
    }

    async saveProgress(saveDir, filename) {
        try {
            console.log(`Saving progress: ${this.results.length} results`);
            console.log('Results data:', this.results);
            
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(this.results);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
            
            const saveDirPath = saveDir || settings.saveDir;
            if (!fs.existsSync(saveDirPath)) {
                fs.mkdirSync(saveDirPath, { recursive: true });
            }
            
            const filePath = path.join(saveDirPath, filename);
            XLSX.writeFile(workbook, filePath);
            console.log(`Progress saved to: ${filePath}`);
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }
}

// Create global queue instance for profile scraping
const scrapingQueue = new ScrapingQueue(); // Process 1 URL at a time

// Register IPC handlers after app is ready
app.whenReady().then(() => {
    // Create the window first
    createWindow();

    // Then register the IPC handlers
    ipcMain.handle('start-scraping', async (event, { urls, saveDir, filename, isHeadless }) => {
        try {
            console.log('Starting scraping process with:', { urls, saveDir, filename, isHeadless });
            isScrapingActive = true;
            isPaused = false;
            
            // Reset the queue results to start fresh
            scrapingQueue.results = [];
            scrapingQueue.queue = [];
            console.log('Cleared previous results and queue');
            
            // Set up event handlers
            scrapingQueue.onProgress = (data) => {
                console.log('Progress update:', data);
                if (mainWindow) {
                    mainWindow.webContents.send('progress-update', data);
                }
            };
            
            scrapingQueue.onError = (error) => {
                console.log('Scraping error:', error);
                if (mainWindow) {
                    mainWindow.webContents.send('scraping-error', error);
                }
            };
            
            // Start processing
            console.log('Adding URLs to queue:', urls);
            await scrapingQueue.add(urls, { saveDir, filename, isHeadless });
            
            return new Promise((resolve) => {
                scrapingQueue.onComplete = (results) => {
                    isScrapingActive = false;
                    console.log('Scraping completed with results:', results);
                    if (mainWindow) {
                        mainWindow.webContents.send('scraping-finished');
                    }
                    resolve(results);
                };
            });
        } catch (error) {
            console.error('Error in start-scraping:', error);
            throw error;
        }
    });

    // Handle pause/resume
    ipcMain.on('toggle-pause', () => {
        if (isScrapingActive) {
            isPaused = !isPaused;
            if (isPaused) {
                scrapingQueue.pause();
            } else {
                scrapingQueue.resume();
            }
            mainWindow?.webContents.send('pause-status-changed', isPaused);
        }
    });

    // Handle stop
    ipcMain.on('stop-scraping', async () => {
        if (isScrapingActive) {
            isScrapingActive = false;
            await scrapingQueue.stop();
            mainWindow?.webContents.send('scraping-stopped');
        }
    });

    // Re-create window on macOS when dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Handle saving all accumulated question results to a single file
ipcMain.handle('save-all-question-results', async (event, { data, saveDir, filename, saveMethod }) => {
    const saveDirPath = saveDir || settings.saveDir;
    if (!fs.existsSync(saveDirPath)) {
        fs.mkdirSync(saveDirPath, { recursive: true });
    }
    const filePath = path.join(saveDirPath, filename);
    
    if (saveMethod === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        // Collect all unique question names to use as headers
        const allQuestions = new Set();
        data.forEach(profileResult => {
            profileResult.Questions.forEach(q => allQuestions.add(q.question));
        });
        const questionHeaders = Array.from(allQuestions).sort();
        // Prepare data for the worksheet
        const processedData = data.map(profileResult => {
            const row = {
                'Profile Name': profileResult['Profile Name'],
                'Profile URL': profileResult['Profile URL'],
                'Total Score': `${profileResult['Total Score']} / ${profileResult['Max Points']}`
            };
            // Add points for each question
            questionHeaders.forEach(qHeader => {
                const questionMatch = profileResult.Questions.find(q => q.question === qHeader);
                row[qHeader] = questionMatch ? questionMatch.points : 0; // Display points, 0 if not found
            });
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(processedData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'All Question Results');
        XLSX.writeFile(workbook, filePath);
    } else if (saveMethod === 'csv') {
        // Collect all unique question names to use as headers
        const allQuestions = new Set();
        data.forEach(profileResult => {
            profileResult.Questions.forEach(q => allQuestions.add(q.question));
        });
        const questionHeaders = Array.from(allQuestions).sort();
        
        // Create CSV header
        let csvContent = 'Profile Name,Profile URL,Total Score,' + questionHeaders.join(',') + '\n';
        
        // Add data rows
        data.forEach(profileResult => {
            const row = [
                profileResult['Profile Name'],
                profileResult['Profile URL'],
                `${profileResult['Total Score']} / ${profileResult['Max Points']}`
            ];
            
            // Add points for each question
            questionHeaders.forEach(qHeader => {
                const questionMatch = profileResult.Questions.find(q => q.question === qHeader);
                row.push(questionMatch ? questionMatch.points : 0);
            });
            
            csvContent += row.join(',') + '\n';
        });
        
        fs.writeFileSync(filePath, csvContent, 'utf8');
    } else if (saveMethod === 'json') {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return filePath;
});
async function scrapeLeetCodeProfile(url, browser) {
    try {
        console.log(`Processing profile: ${url}`);
        const page = await browser.newPage();
        
        // Set a longer timeout for profile pages
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait a bit for dynamic content to load
        await page.waitForTimeout(3000);
        
        // First get the difficulty counts
        const data = await page.evaluate(() => {
            const difficultyClasses = {
                'text-sd-easy': 'Easy',
                'text-sd-medium': 'Medium',
                'text-sd-hard': 'Hard'
            };
            const results = { URL: window.location.href };
            
            // Always create a result, even if profile data is not found
            for (const [className, difficulty] of Object.entries(difficultyClasses)) {
                const elements = document.getElementsByClassName(className);
                if (elements.length > 0 && elements[0].nextElementSibling) {
                    const count = elements[0].nextElementSibling.textContent;
                    results[difficulty] = count.split('/')[0].trim();
                } else {
                    results[difficulty] = 'Not available';
                }
            }
            return results;
        });

        // Get the rank using XPath
        try {
            const [rankElement] = await page.$x('//*[@id="__next"]/div[1]/div[4]/div/div[1]/div/div[1]/div/div[2]/div[3]/span[2]');
            if (rankElement) {
                const rank = await page.evaluate(el => el.textContent, rankElement);
                data.Rank = rank.trim();
            } else {
                data.Rank = 'Not available';
                console.log('Rank element not found');
            }
        } catch (rankError) {
            console.log('Error getting rank:', rankError.message);
            data.Rank = 'Not available';
        }
        
        await page.close();
        return data;
    } catch (error) {
        console.error('Scraping error:', error);
        throw error;
    }
}
// IPC handlers are now registered in app.whenReady()