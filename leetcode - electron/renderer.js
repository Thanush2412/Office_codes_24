const { ipcRenderer } = require('electron');
// UI Elements
const elements = {
    selectFileBtn: document.getElementById('selectFileBtn'),
    selectedFile: document.getElementById('selectedFile'),
    columnSelect: document.getElementById('columnSelect'),
    saveDir: document.getElementById('saveDir'),
    filename: document.getElementById('filename'),
    saveMethod: document.getElementById('saveMethod'),
    browseDirBtn: document.getElementById('browseDirBtn'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    profileLogSection: document.getElementById('profileLogSection'),
    autoSaveStatus: document.getElementById('autoSaveStatus'),
    // Question checker tab elements
    profileUrl: document.getElementById('profileUrl'),
    profileName: document.getElementById('profileName'),
    importQuestionsBtn: document.getElementById('importQuestionsBtn'),
    questionsFileName: document.getElementById('questionsFileName'),
    questionsColumn: document.getElementById('questionsColumn'),
    pointsPerMatch: document.getElementById('pointsPerMatch'),
    questionResults: document.getElementById('questionResults'),
    totalScore: document.getElementById('totalScore'),
    checkQuestionsBtn: document.getElementById('checkQuestionsBtn'),
    questionLogSection: document.getElementById('questionLogSection'),
    // Settings tab elements
    profileHeadlessMode: document.getElementById('profileHeadlessMode'),
    questionsHeadlessMode: document.getElementById('questionsHeadlessMode'),
    // UI Customization elements
    themeSelect: document.getElementById('themeSelect'),
    accentColorPicker: document.getElementById('accentColorPicker'),
    fontSizeSelect: document.getElementById('fontSizeSelect'),
    sidebarPositionSelect: document.getElementById('sidebarPositionSelect'),
    layoutStyleSelect: document.getElementById('layoutStyleSelect'),
    buttonStyleSelect: document.getElementById('buttonStyleSelect'),
    resultContainerStyleSelect: document.getElementById('resultContainerStyleSelect')
};
let fileData = null;
let questionsData = null;
let isPaused = false;
let isStopped = false;
let allQuestionResults = []; // New global array to store all question results
// Load settings when the app starts
async function loadSettings() {
    try {
        console.log('Loading settings...');
        const settings = await ipcRenderer.invoke('get-settings');
        console.log('Loaded settings:', settings);
        
        // Update UI with loaded settings
        if (elements.profileHeadlessMode) {
            elements.profileHeadlessMode.checked = settings.profileHeadlessMode;
            console.log('Set profileHeadlessMode to', settings.profileHeadlessMode);
        }
        
        if (elements.questionsHeadlessMode) {
            elements.questionsHeadlessMode.checked = settings.questionsHeadlessMode;
            console.log('Set questionsHeadlessMode to', settings.questionsHeadlessMode);
        }
        
        if (elements.saveDir) {
            elements.saveDir.value = settings.saveDir;
            console.log('Set saveDir to', settings.saveDir);
        }
        
        if (elements.filename) {
            elements.filename.value = settings.filename;
            console.log('Set filename to', settings.filename);
        }
        
        if (elements.pointsPerMatch) {
            elements.pointsPerMatch.value = settings.pointsPerMatch;
            console.log('Set pointsPerMatch to', settings.pointsPerMatch);
        }
        
        if (elements.saveMethod) {
            elements.saveMethod.value = settings.saveMethod || 'xlsx';
            console.log('Set saveMethod to', settings.saveMethod || 'xlsx');
        }
        
        // Apply UI customization settings
        applyTheme(settings.theme || 'dark');
        applyAccentColor(settings.accentColor || '#6366f1');
        applyFontSize(settings.fontSize || 'medium');
        applySidebarPosition(settings.sidebarPosition || 'left');
        applyLayoutStyle(settings.layoutStyle || 'default');
        applyButtonStyle(settings.buttonStyle || 'default');
        applyResultContainerStyle(settings.resultContainerStyle || 'default');
        
        // Update customization UI controls
        if (elements.themeSelect) {
            elements.themeSelect.value = settings.theme || 'dark';
        }
        if (elements.accentColorPicker) {
            elements.accentColorPicker.value = settings.accentColor || '#6366f1';
        }
        if (elements.fontSizeSelect) {
            elements.fontSizeSelect.value = settings.fontSize || 'medium';
        }
        if (elements.sidebarPositionSelect) {
            elements.sidebarPositionSelect.value = settings.sidebarPosition || 'left';
        }
        if (elements.layoutStyleSelect) {
            elements.layoutStyleSelect.value = settings.layoutStyle || 'default';
        }
        if (elements.buttonStyleSelect) {
            elements.buttonStyleSelect.value = settings.buttonStyle || 'default';
        }
        if (elements.resultContainerStyleSelect) {
            elements.resultContainerStyleSelect.value = settings.resultContainerStyle || 'default';
        }
        
        // Update chrome path if needed
        if (settings.chromePath) {
            console.log('Using Chrome at:', settings.chromePath);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}
// Save a specific setting
async function saveSetting(key, value) {
    try {
        console.log(`Saving setting ${key} =`, value);
        const newSettings = { [key]: value };
        await ipcRenderer.invoke('update-settings', newSettings);
    } catch (error) {
        console.error('Error saving setting:', error);
    }
}
// Apply theme to the UI
function applyTheme(theme) {
    const body = document.body;
    body.classList.remove('dark-theme', 'light-theme');
    body.classList.add(`${theme}-theme`);
}

// Apply accent color to the UI
function applyAccentColor(color) {
    const root = document.documentElement;
    root.style.setProperty('--accent', color);
    
    // Generate a slightly lighter version for hover state
    const hoverColor = adjustColor(color, 20);
    root.style.setProperty('--accent-hover', hoverColor);
}

// Apply font size to the UI
function applyFontSize(size) {
    const body = document.body;
    body.classList.remove('font-small', 'font-medium', 'font-large');
    body.classList.add(`font-${size}`);
}

// Apply sidebar position to the UI
function applySidebarPosition(position) {
    const sidebar = document.querySelector('.sidebar');
    const mainArea = document.querySelector('.main-area');
    const appLayout = document.querySelector('.app-layout');
    
    // Remove all position classes
    sidebar.classList.remove('sidebar-left', 'sidebar-right', 'sidebar-top', 'sidebar-bottom');
    mainArea.classList.remove('main-area-left', 'main-area-right', 'main-area-top', 'main-area-bottom');
    appLayout.classList.remove('layout-horizontal', 'layout-vertical');
    
    if (position === 'right') {
        sidebar.classList.add('sidebar-right');
        mainArea.classList.add('main-area-right');
    } else if (position === 'top') {
        sidebar.classList.add('sidebar-top');
        mainArea.classList.add('main-area-top');
        appLayout.classList.add('layout-horizontal');
    } else if (position === 'bottom') {
        sidebar.classList.add('sidebar-bottom');
        mainArea.classList.add('main-area-bottom');
        appLayout.classList.add('layout-horizontal');
    } else {
        // Default to left
        sidebar.classList.add('sidebar-left');
        mainArea.classList.add('main-area-left');
    }
}

// Apply layout style to the UI
function applyLayoutStyle(style) {
    const appLayout = document.querySelector('.app-layout');
    const contentArea = document.querySelector('.content-area');
    const logPanel = document.querySelector('.log-panel');
    
    // Remove all layout style classes
    appLayout.classList.remove('layout-compact', 'layout-spacious', 'layout-minimal');
    contentArea.classList.remove('content-compact', 'content-spacious', 'content-minimal');
    logPanel.classList.remove('log-panel-compact', 'log-panel-spacious', 'log-panel-minimal');
    
    if (style === 'compact') {
        appLayout.classList.add('layout-compact');
        contentArea.classList.add('content-compact');
        logPanel.classList.add('log-panel-compact');
    } else if (style === 'spacious') {
        appLayout.classList.add('layout-spacious');
        contentArea.classList.add('content-spacious');
        logPanel.classList.add('log-panel-spacious');
    } else if (style === 'minimal') {
        appLayout.classList.add('layout-minimal');
        contentArea.classList.add('content-minimal');
        logPanel.classList.add('log-panel-minimal');
    }
    // Default style doesn't need additional classes
}

// Apply button style to the UI
function applyButtonStyle(style) {
    const buttons = document.querySelectorAll('button');
    
    // Remove all button style classes
    buttons.forEach(button => {
        button.classList.remove('btn-default', 'btn-rounded', 'btn-outlined', 'btn-flat');
    });
    
    if (style === 'rounded') {
        buttons.forEach(button => {
            button.classList.add('btn-rounded');
        });
    } else if (style === 'outlined') {
        buttons.forEach(button => {
            button.classList.add('btn-outlined');
        });
    } else if (style === 'flat') {
        buttons.forEach(button => {
            button.classList.add('btn-flat');
        });
    }
    // Default style doesn't need additional classes
}

// Apply result container style to the UI
function applyResultContainerStyle(style) {
    const questionResults = document.getElementById('questionResults');
    const resultsSummary = document.getElementById('resultsSummary');
    const totalScore = document.getElementById('totalScore');
    
    // Remove all result container style classes
    if (questionResults) {
        questionResults.classList.remove('results-default', 'results-card', 'results-list', 'results-grid');
    }
    if (resultsSummary) {
        resultsSummary.classList.remove('summary-default', 'summary-card', 'summary-compact');
    }
    if (totalScore) {
        totalScore.classList.remove('score-default', 'score-card', 'score-compact');
    }
    
    if (style === 'card') {
        if (questionResults) questionResults.classList.add('results-card');
        if (resultsSummary) resultsSummary.classList.add('summary-card');
        if (totalScore) totalScore.classList.add('score-card');
    } else if (style === 'list') {
        if (questionResults) questionResults.classList.add('results-list');
        if (resultsSummary) resultsSummary.classList.add('summary-compact');
        if (totalScore) totalScore.classList.add('score-compact');
    } else if (style === 'grid') {
        if (questionResults) questionResults.classList.add('results-grid');
        if (resultsSummary) resultsSummary.classList.add('summary-compact');
        if (totalScore) totalScore.classList.add('score-compact');
    }
    // Default style doesn't need additional classes
}

// Helper function to adjust color brightness
function adjustColor(color, amount) {
    let usePound = false;
    if (color[0] === "#") {
        color = color.slice(1);
        usePound = true;
    }
    
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    
    let g = ((num >> 8) & 0x00FF) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    
    let b = (num & 0x0000FF) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
}
// Helper to update all column dropdowns in the Questions tab
function updateQuestionsTabColumnDropdowns(columns) {
    const options = columns.map(col => `<option value="${col}">${col}</option>`).join('');
    if (elements.profileUrl) {
        elements.profileUrl.innerHTML = options;
        elements.profileUrl.disabled = false;
    }
    if (elements.profileName) {
        elements.profileName.innerHTML = options;
        elements.profileName.disabled = false;
    }
    if (elements.questionsColumn) {
        elements.questionsColumn.innerHTML = options;
        elements.questionsColumn.disabled = false;
    }
}
// File Selection
if (elements.selectFileBtn) {
    elements.selectFileBtn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-file');
        if (result.success) {
            fileData = result.data;
            if (elements.selectedFile) {
                elements.selectedFile.textContent = `Selected: ${result.filePath.split('\\').pop()}`;
            }
            // Update column dropdown for profile tab
            const columns = Object.keys(fileData[0]);
            if (elements.columnSelect) {
                elements.columnSelect.innerHTML = columns
                    .map(col => `<option value="${col}">${col}</option>`)
                    .join('');
                elements.columnSelect.disabled = false;
            }
            if (elements.startBtn) {
                elements.startBtn.disabled = false;
            }
            // Update all Questions tab dropdowns with these columns
            updateQuestionsTabColumnDropdowns(columns);
        } else if (result.error) {
            logMessage(`Error loading file: ${result.error}`);
        }
    });
}
// Directory Selection
if (elements.browseDirBtn) {
    elements.browseDirBtn.addEventListener('click', async () => {
        const dir = await ipcRenderer.invoke('select-save-directory');
        if (dir) {
            if (elements.saveDir) {
                elements.saveDir.value = dir;
            }
            saveSetting('saveDir', dir); // Save the new directory
        }
    });
}
// Clear input logic for saveDir and filename
const saveDirInput = document.getElementById('saveDir');
const clearSaveDirBtn = document.getElementById('clearSaveDirBtn');
if (clearSaveDirBtn && saveDirInput) {
  clearSaveDirBtn.addEventListener('click', () => {
    saveDirInput.value = '';
    saveDirInput.focus();
    saveSetting('saveDir', ''); // Save the cleared directory
  });
}
const filenameInput = document.getElementById('filename');
const clearFilenameBtn = document.getElementById('clearFilenameBtn');
if (clearFilenameBtn && filenameInput) {
  clearFilenameBtn.addEventListener('click', () => {
    filenameInput.value = '';
    filenameInput.focus();
    saveSetting('filename', ''); // Save the cleared filename
  });
}
// Settings change listeners
if (elements.profileHeadlessMode) {
    elements.profileHeadlessMode.addEventListener('change', (e) => {
        console.log('Profile headless mode changed to:', e.target.checked);
        saveSetting('profileHeadlessMode', e.target.checked);
    });
}

if (elements.questionsHeadlessMode) {
    elements.questionsHeadlessMode.addEventListener('change', (e) => {
        console.log('Questions headless mode changed to:', e.target.checked);
        saveSetting('questionsHeadlessMode', e.target.checked);
    });
}

if (elements.saveDir) {
    elements.saveDir.addEventListener('change', (e) => {
        console.log('Save directory changed to:', e.target.value);
        saveSetting('saveDir', e.target.value);
    });
}

if (elements.filename) {
    elements.filename.addEventListener('change', (e) => {
        console.log('Filename changed to:', e.target.value);
        saveSetting('filename', e.target.value);
    });
}

if (elements.pointsPerMatch) {
    elements.pointsPerMatch.addEventListener('change', (e) => {
        console.log('Points per match changed to:', e.target.value);
        saveSetting('pointsPerMatch', parseInt(e.target.value, 10));
    });
}

if (elements.saveMethod) {
    elements.saveMethod.addEventListener('change', (e) => {
        console.log('Save method changed to:', e.target.value);
        saveSetting('saveMethod', e.target.value);
    });
}

// UI Customization change listeners
if (elements.themeSelect) {
    elements.themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        console.log('Theme changed to:', theme);
        applyTheme(theme);
        saveSetting('theme', theme);
    });
}

if (elements.accentColorPicker) {
    elements.accentColorPicker.addEventListener('change', (e) => {
        const color = e.target.value;
        console.log('Accent color changed to:', color);
        applyAccentColor(color);
        saveSetting('accentColor', color);
    });
}

if (elements.fontSizeSelect) {
    elements.fontSizeSelect.addEventListener('change', (e) => {
        const size = e.target.value;
        console.log('Font size changed to:', size);
        applyFontSize(size);
        saveSetting('fontSize', size);
    });
}

if (elements.sidebarPositionSelect) {
    elements.sidebarPositionSelect.addEventListener('change', (e) => {
        const position = e.target.value;
        console.log('Sidebar position changed to:', position);
        applySidebarPosition(position);
        saveSetting('sidebarPosition', position);
    });
}

if (elements.layoutStyleSelect) {
    elements.layoutStyleSelect.addEventListener('change', (e) => {
        const style = e.target.value;
        console.log('Layout style changed to:', style);
        applyLayoutStyle(style);
        saveSetting('layoutStyle', style);
    });
}

if (elements.buttonStyleSelect) {
    elements.buttonStyleSelect.addEventListener('change', (e) => {
        const style = e.target.value;
        console.log('Button style changed to:', style);
        applyButtonStyle(style);
        saveSetting('buttonStyle', style);
    });
}

if (elements.resultContainerStyleSelect) {
    elements.resultContainerStyleSelect.addEventListener('change', (e) => {
        const style = e.target.value;
        console.log('Result container style changed to:', style);
        applyResultContainerStyle(style);
        saveSetting('resultContainerStyle', style);
    });
}
// Scraping Controls
if (elements.startBtn) {
    elements.startBtn.addEventListener('click', startScraping);
}

if (elements.pauseBtn) {
    elements.pauseBtn.addEventListener('click', togglePause);
}

if (elements.stopBtn) {
    elements.stopBtn.addEventListener('click', stopScraping);
}

async function startScraping() {
    if (!fileData || !elements.columnSelect.value) {
        logMessage('Please select a file and column first');
        return;
    }
    const urls = fileData.map(row => row[elements.columnSelect.value]).filter(Boolean);
    if (urls.length === 0) {
        logMessage('No URLs found in selected column');
        return;
    }
    // Update UI state
    if (elements.startBtn) elements.startBtn.disabled = true;
    if (elements.pauseBtn) elements.pauseBtn.disabled = false;
    if (elements.stopBtn) elements.stopBtn.disabled = false; // Fix: Enable stop button
    if (elements.selectFileBtn) elements.selectFileBtn.disabled = true;
    if (elements.columnSelect) elements.columnSelect.disabled = true;
    
    // Get headless mode setting
    const headlessModeElement = document.getElementById('profileHeadlessMode');
    const isHeadless = headlessModeElement ? headlessModeElement.checked : true; // Default to true if element not found
    try {
        // Prepare questions data if available
        let selectedQuestions = null;
        if (questionsData && elements.questionsColumn.value) {
            selectedQuestions = questionsData
                .map(row => row[elements.questionsColumn.value])
                .filter(Boolean);
        }
        const config = {
            urls,
            saveDir: elements.saveDir.value,
            filename: elements.filename.value,
            isHeadless,
            questionsData: selectedQuestions,
            pointsPerQuestion: parseInt(elements.pointsPerMatch.value, 10)
        };
        logMessage(`Starting scraping of ${urls.length} URLs...`);
        if (selectedQuestions) {
            logMessage(`Will check ${selectedQuestions.length} questions for each profile`);
        }
        await ipcRenderer.invoke('start-scraping', config);
    } catch (error) {
        console.error('Scraping initiation error:', error);
        logMessage(`Error starting scraping: ${error.message}`);
        resetUIState();
    }
}
function togglePause() {
    ipcRenderer.send('toggle-pause');
}
function stopScraping() {
    if (confirm('Are you sure you want to stop scraping? Progress will be saved.')) {
        ipcRenderer.send('stop-scraping');
    }
}
// Progress Updates
ipcRenderer.on('progress-update', (event, { processed, total, result }) => {
    updateProgress(processed, total);
    logMessage(`Processed ${result.URL}: Easy: ${result.Easy}, Medium: ${result.Medium}, Hard: ${result.Hard}`);
});
function updateProgress(processed, total) {
    const percentage = (processed / total * 100).toFixed(1);
    if (elements.progressFill) elements.progressFill.style.width = `${percentage}%`;
    if (elements.progressText) elements.progressText.textContent = `${processed}/${total} URLs processed (${percentage}%)`;
}
// Status Updates
ipcRenderer.on('pause-status-changed', (event, isPaused) => {
    if (elements.pauseBtn) elements.pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    logMessage(isPaused ? 'Scraping paused' : 'Scraping resumed');
});
ipcRenderer.on('scraping-stopped', () => {
    logMessage('Scraping stopped');
    resetUIState();
});
ipcRenderer.on('scraping-error', (event, { url, error }) => {
    logMessage(`Error processing ${url}: ${error}`);
});
ipcRenderer.on('scraping-finished', () => {
    logMessage('Scraping finished successfully!');
    resetUIState();
});
// Helper Functions
function logMessage(message, type = 'profile') {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    // Find the correct log section based on type
    const logSection = document.getElementById(`${type}LogSection`);
    if (logSection) {
        // Find the log entries container
        const logEntries = logSection.querySelector('.log-entries');
        if (logEntries) {
            logEntries.appendChild(entry);
            // Scroll to the bottom
            logEntries.scrollTop = logEntries.scrollHeight;
        }
    }
    
    // Also show toast for important messages
    if (type === 'profile' || type === 'questions') {
        showToast(message, 'info');
    }
}
// Toast/notification system
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '1.5rem';
    toastContainer.style.right = '2rem';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '0.7rem';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toast.style.padding = '1rem 1.5rem';
  toast.style.background = 'var(--bg-card)';
  toast.style.color = 'var(--text-main)';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 2px 12px rgba(99,102,241,0.10)';
  toast.style.fontWeight = '600';
  toast.style.fontSize = '1.05rem';
  toast.style.opacity = '0.98';
  toast.style.transition = 'opacity 0.3s';
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
// Question checker functionality
if (elements.importQuestionsBtn) {
    elements.importQuestionsBtn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-questions-file');
        if (result.success) {
            questionsData = result.data;
            if (elements.questionsFileName) {
                elements.questionsFileName.textContent = `Selected: ${result.filePath.split('\\').pop()}`;
            }
            
            // Update only the questions column dropdown
            const columns = Object.keys(questionsData[0]);
            const options = columns.map(col => `<option value="${col}">${col}</option>`).join('');
            if (elements.questionsColumn) {
                elements.questionsColumn.innerHTML = options;
                elements.questionsColumn.disabled = false;
            }
            
            validateQuestionChecker();
        } else if (result.error) {
            logMessage(`Error loading questions file: ${result.error}`, 'questions');
        }
    });
}
// Global variable to track current profile index
let currentProfileIndex = 0;
async function processNextProfile() {
    // Validate all required inputs
    if (!validateQuestionChecker()) {
        return false;
    }
    
    const urlColumn = elements.profileUrl.value;
    const nameColumn = elements.profileName.value;
    const questionColumn = elements.questionsColumn.value;
    const pointsPerMatch = parseInt(elements.pointsPerMatch.value, 10);
    
    // Check if processing is paused or stopped
    if (isPaused) {
        logMessage('Processing is paused. Click Resume to continue.', 'questions');
        return false; // Stop processing while paused
    }
    
    if (isStopped) {
        logMessage('Processing was stopped.', 'questions');
        return false; // Stop processing completely
    }
    
    // Check if we've processed all profiles
    if (currentProfileIndex >= fileData.length) {
        logMessage('All profiles have been processed', 'questions');
        currentProfileIndex = 0; // Reset for next run
        return false;
    }
    
    // Get the current profile data
    const url = fileData[currentProfileIndex][urlColumn];
    const profileName = fileData[currentProfileIndex][nameColumn];
    
    if (!url || !profileName) {
        logMessage(`Profile at index ${currentProfileIndex} does not contain valid data, skipping...`, 'questions');
        currentProfileIndex++;
        return true; // Continue to next profile
    }
    
    logMessage(`Processing profile ${currentProfileIndex + 1}/${fileData.length}: ${profileName} (${url})`, 'questions');
    
    try {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = true;
        logMessage(`Checking questions for profile: ${profileName}`, 'questions');
        const questions = questionsData.map(row => row[questionColumn]).filter(Boolean);
        
        // Get headless mode setting
        const headlessModeElement = document.getElementById('questionsHeadlessMode');
        const isHeadless = headlessModeElement ? headlessModeElement.checked : true; // Default to true if element not found
        
        logMessage(`Running in ${isHeadless ? 'headless' : 'visible'} mode`, 'questions');
        
        const result = await ipcRenderer.invoke('check-questions', {
            url,
            profileName,
            questions,
            pointsPerMatch,
            isHeadless
        });
        // Display results
        displayResults(result, questions, pointsPerMatch);
        
        // Save results
        await saveQuestionResults(result, profileName, url, questions, pointsPerMatch);
        
        // Move to next profile
        currentProfileIndex++;
        
        // Update progress
        updateQuestionsProgress(currentProfileIndex, fileData.length);
        
        return true; // Continue to next profile
    } catch (error) {
        logMessage(`Error: ${error.message}`, 'questions');
        currentProfileIndex++; // Move to next profile even if there's an error
        
        // Update progress even on error
        updateQuestionsProgress(currentProfileIndex, fileData.length);
        
        return true; // Continue to next profile
    } finally {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = false;
    }
}
// Function to update the questions progress bar
function updateQuestionsProgress(processed, total) {
    const percentage = (processed / total * 100).toFixed(1);
    const questionsProgressFill = document.getElementById('questionsProgressFill');
    const questionsProgressText = document.getElementById('questionsProgressText');
    
    if (questionsProgressFill) questionsProgressFill.style.width = `${percentage}%`;
    if (questionsProgressText) questionsProgressText.textContent = `${processed}/${total} profiles processed (${percentage}%)`;
}
// Function to reset the questions UI
function resetQuestionsUI() {
    // Clear results
    if (elements.questionResults) elements.questionResults.innerHTML = '';
    if (elements.totalScore) elements.totalScore.textContent = 'Total Score: 0 / 0';
    
    // Hide progress section
    const questionsProgressSection = document.getElementById('questionsProgressSection');
    if (questionsProgressSection) questionsProgressSection.style.display = 'none';
    
    // Reset button states
    const resetQuestionsBtn = document.getElementById('resetQuestionsBtn');
    const pauseQuestionsBtn = document.getElementById('pauseQuestionsBtn');
    const resumeQuestionsBtn = document.getElementById('resumeQuestionsBtn');
    const stopQuestionsBtn = document.getElementById('stopQuestionsBtn');
    
    if (resetQuestionsBtn) resetQuestionsBtn.style.display = 'none';
    if (pauseQuestionsBtn) pauseQuestionsBtn.style.display = 'none';
    if (resumeQuestionsBtn) resumeQuestionsBtn.style.display = 'none';
    if (stopQuestionsBtn) stopQuestionsBtn.style.display = 'none';
    
    if (elements.checkQuestionsBtn) {
        elements.checkQuestionsBtn.disabled = fileData.length === 0;
        elements.checkQuestionsBtn.textContent = 'Check Questions';
    }
    
    // Reset current profile index and pause state
    currentProfileIndex = 0;
    isPaused = false;
    allQuestionResults = []; // Clear accumulated results
    
    logMessage('Results cleared', 'questions');
}
// Add event listener for the reset questions button
const resetQuestionsBtn = document.getElementById('resetQuestionsBtn');
if (resetQuestionsBtn) {
    resetQuestionsBtn.addEventListener('click', resetQuestionsUI);
}
// Add event listener for the pause questions button
const pauseQuestionsBtn = document.getElementById('pauseQuestionsBtn');
if (pauseQuestionsBtn) {
    pauseQuestionsBtn.addEventListener('click', () => {
        isPaused = true;
        pauseQuestionsBtn.style.display = 'none';
        const resumeQuestionsBtn = document.getElementById('resumeQuestionsBtn');
        if (resumeQuestionsBtn) resumeQuestionsBtn.style.display = 'block';
        logMessage('Processing paused', 'questions');
    });
}
// Add event listener for the stop questions button
const stopQuestionsBtn = document.getElementById('stopQuestionsBtn');
if (stopQuestionsBtn) {
    stopQuestionsBtn.addEventListener('click', () => {
        isStopped = true;
        isPaused = false; // Clear pause state
        
        // Update UI
        const pauseQuestionsBtn = document.getElementById('pauseQuestionsBtn');
        const resumeQuestionsBtn = document.getElementById('resumeQuestionsBtn');
        const resetQuestionsBtn = document.getElementById('resetQuestionsBtn');
        
        if (pauseQuestionsBtn) pauseQuestionsBtn.style.display = 'none';
        if (resumeQuestionsBtn) resumeQuestionsBtn.style.display = 'none';
        if (stopQuestionsBtn) stopQuestionsBtn.style.display = 'none';
        if (resetQuestionsBtn) resetQuestionsBtn.style.display = 'block';
        
        if (elements.checkQuestionsBtn) {
            elements.checkQuestionsBtn.disabled = false;
            elements.checkQuestionsBtn.textContent = 'Check Questions';
        }
        
        logMessage('Processing stopped', 'questions');
    });
}
// Add event listener for the resume questions button
const resumeQuestionsBtn = document.getElementById('resumeQuestionsBtn');
if (resumeQuestionsBtn) {
    resumeQuestionsBtn.addEventListener('click', async () => {
        isPaused = false;
        resumeQuestionsBtn.style.display = 'none';
        const pauseQuestionsBtn = document.getElementById('pauseQuestionsBtn');
        if (pauseQuestionsBtn) pauseQuestionsBtn.style.display = 'block';
        logMessage('Processing resumed', 'questions');
        
        // Continue processing from where we left off
        let continueProcessing = true;
        while (continueProcessing && !isPaused && !isStopped) {
            continueProcessing = await processNextProfile();
            
            // Add a small delay between profiles
            if (continueProcessing && !isPaused && !isStopped) {
                logMessage('Waiting 2 seconds before processing next profile...', 'questions');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // If processing was stopped, update the UI
        if (isStopped) {
            logMessage('Processing stopped', 'questions');
            return; // Exit the event handler early
        }
        
        // If all profiles are processed, update UI
        if (!continueProcessing && !isPaused) {
            // Reset button state
            if (elements.checkQuestionsBtn) {
                elements.checkQuestionsBtn.textContent = 'Check Questions';
                elements.checkQuestionsBtn.disabled = false;
            }
            
            // Update button visibility
            const resetQuestionsBtn = document.getElementById('resetQuestionsBtn');
            const pauseQuestionsBtn = document.getElementById('pauseQuestionsBtn');
            const resumeQuestionsBtn = document.getElementById('resumeQuestionsBtn');
            const stopQuestionsBtn = document.getElementById('stopQuestionsBtn');
            
            if (resetQuestionsBtn) resetQuestionsBtn.style.display = 'block';
            if (pauseQuestionsBtn) pauseQuestionsBtn.style.display = 'none';
            if (resumeQuestionsBtn) resumeQuestionsBtn.style.display = 'none';
            if (stopQuestionsBtn) stopQuestionsBtn.style.display = 'none';
            
            // Update progress to 100%
            updateQuestionsProgress(fileData.length, fileData.length);
            logMessage('All profiles processed!', 'questions');
        }
    });
}
// Add event listener for the check questions button
if (elements.checkQuestionsBtn) {
    elements.checkQuestionsBtn.addEventListener('click', async () => {
        // Reset the current profile index and states when starting a new batch
        currentProfileIndex = 0;
        isPaused = false;
        isStopped = false;
        
        // Update UI
        elements.checkQuestionsBtn.textContent = 'Processing...'; 
        elements.checkQuestionsBtn.disabled = true;
        
        const pauseQuestionsBtn = document.getElementById('pauseQuestionsBtn');
        const resumeQuestionsBtn = document.getElementById('resumeQuestionsBtn');
        const stopQuestionsBtn = document.getElementById('stopQuestionsBtn');
        const questionsProgressSection = document.getElementById('questionsProgressSection');
        
        if (pauseQuestionsBtn) pauseQuestionsBtn.style.display = 'block';
        if (resumeQuestionsBtn) resumeQuestionsBtn.style.display = 'none';
        if (stopQuestionsBtn) stopQuestionsBtn.style.display = 'block';
        if (questionsProgressSection) questionsProgressSection.style.display = 'block';
        
        updateQuestionsProgress(0, fileData.length);
        
        // Process profiles sequentially
        let continueProcessing = true;
        while (continueProcessing && !isPaused) {
            continueProcessing = await processNextProfile();
            
            // Add a small delay between profiles to avoid overwhelming the server
            // and to give the user time to see the results
            if (continueProcessing && !isPaused) {
                logMessage('Waiting 2 seconds before processing next profile...', 'questions');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // If processing was paused, update the UI to reflect that
        if (isPaused) {
            logMessage('Processing paused. Click Resume to continue.', 'questions');
            return; // Exit the event handler early
        }
        
        // Reset button state
        elements.checkQuestionsBtn.textContent = 'Check Questions';
        elements.checkQuestionsBtn.disabled = false;
        
        // Update button visibility
        const resetQuestionsBtn = document.getElementById('resetQuestionsBtn');
        
        if (resetQuestionsBtn) resetQuestionsBtn.style.display = 'block';
        if (pauseQuestionsBtn) pauseQuestionsBtn.style.display = 'none';
        if (resumeQuestionsBtn) resumeQuestionsBtn.style.display = 'none';
        if (stopQuestionsBtn) stopQuestionsBtn.style.display = 'none';
        
        // Update progress to 100% when all profiles are processed
        updateQuestionsProgress(fileData.length, fileData.length);
        logMessage('All profiles processed!', 'questions');
        await saveAllQuestionResultsToFile();
    });
}
function validateQuestionChecker() {
    const urlColumn = elements.profileUrl ? elements.profileUrl.value : '';
    const nameColumn = elements.profileName ? elements.profileName.value : '';
    const questionColumn = elements.questionsColumn ? elements.questionsColumn.value : '';
    const pointsPerMatch = parseInt(elements.pointsPerMatch ? elements.pointsPerMatch.value : '10', 10);
    
    if (!urlColumn || !nameColumn) {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = true;
        return false;
    }
    
    if (!questionColumn) {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = true;
        return false;
    }
    
    if (!questionsData || questionsData.length === 0) {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = true;
        return false;
    }
    
    if (!fileData || fileData.length === 0) {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = true;
        return false;
    }
    if (isNaN(pointsPerMatch) || pointsPerMatch <= 0) {
        if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = true;
        return false;
    }
    if (elements.checkQuestionsBtn) elements.checkQuestionsBtn.disabled = false;
    return true;
}
['input', 'change'].forEach(event => {
    if (elements.profileUrl) elements.profileUrl.addEventListener(event, validateQuestionChecker);
    if (elements.profileName) elements.profileName.addEventListener(event, validateQuestionChecker);
    if (elements.questionsColumn) elements.questionsColumn.addEventListener(event, validateQuestionChecker);
});
function displayResults(result, questions, pointsPerMatch) {
    const { questionMatches } = result;
    const solvedCount = questionMatches.filter(m => m.solved).length;
    const totalCount = questions.length;
    const totalPoints = solvedCount * pointsPerMatch;
    const maxPoints = totalCount * pointsPerMatch;
    
    // Get current profile info for display
    const urlColumn = elements.profileUrl.value;
    const nameColumn = elements.profileName.value;
    const profileName = fileData[currentProfileIndex-1]?.[nameColumn] || 'Unknown';
    const profileUrl = fileData[currentProfileIndex-1]?.[urlColumn] || '';
    
    // Show profile info
    const profileInfo = document.getElementById('profileInfo');
    const profileInfoText = document.getElementById('profileInfoText');
    
    if (profileInfo && profileInfoText) {
        profileInfoText.textContent = `${profileName} (${currentProfileIndex}/${fileData.length})`;
        profileInfo.style.display = 'flex';
    }
    
    // Display results
    if (elements.questionResults) {
        elements.questionResults.innerHTML = questionMatches
            .map(match => `
                <div class="question-result ${match.solved ? 'solved' : 'unsolved'}">
                    <div class="question-text">
                        <span>${match.solved ? '✓' : '✗'}</span>
                        <span>${match.question}</span>
                    </div>
                    <div class="question-status ${match.solved ? 'solved' : 'unsolved'}">
                        <span class="question-points">${match.solved ? pointsPerMatch : 0}</span>
                    </div>
                </div>
            `)
            .join('');
    }
    
    // Update summary
    const solvedCountEl = document.getElementById('solvedCount');
    const totalCountEl = document.getElementById('totalCount');
    const scoreValueEl = document.getElementById('scoreValue');
    const resultsSummaryEl = document.getElementById('resultsSummary');
    
    if (solvedCountEl) solvedCountEl.textContent = solvedCount;
    if (totalCountEl) totalCountEl.textContent = totalCount;
    if (scoreValueEl) scoreValueEl.textContent = totalPoints;
    if (resultsSummaryEl) resultsSummaryEl.style.display = 'flex';
    
    // Update total score
    const scoreTextEl = document.getElementById('scoreText');
    const totalScoreEl = document.getElementById('totalScore');
    
    if (scoreTextEl) scoreTextEl.textContent = `${totalPoints} / ${maxPoints}`;
    if (totalScoreEl) totalScoreEl.style.display = 'block';
}
async function saveQuestionResults(result, profileName, url, questions, pointsPerMatch) {
    const maxPoints = questions.length * pointsPerMatch;
    allQuestionResults.push({
        'Profile Name': profileName,
        'Profile URL': url,
        'Total Score': result.points,
        'Max Points': maxPoints,
        'Questions': result.questionMatches.map(q => ({
            question: q.question,
            solved: q.solved,
            points: q.solved ? pointsPerMatch : 0
        }))
    });
    logMessage(`Results accumulated for ${profileName}`, 'questions');
}
function resetUIState() {
    if (elements.startBtn) elements.startBtn.disabled = false;
    if (elements.pauseBtn) elements.pauseBtn.disabled = true;
    if (elements.stopBtn) elements.stopBtn.disabled = true;
    if (elements.selectFileBtn) elements.selectFileBtn.disabled = false;
    if (elements.columnSelect) elements.columnSelect.disabled = false;
    if (elements.pauseBtn) elements.pauseBtn.textContent = 'Pause';
}
async function saveAllQuestionResultsToFile() {
    if (allQuestionResults.length === 0) {
        logMessage('No question results to save.', 'questions');
        return;
    }
    
    const saveDir = elements.saveDir.value;
    const saveMethod = elements.saveMethod.value;
    const filename = `all_question_results_${Date.now()}.${saveMethod}`;
    
    try {
        await ipcRenderer.invoke('save-all-question-results', {
            data: allQuestionResults,
            saveDir,
            filename,
            saveMethod
        });
        logMessage(`All question results saved to ${filename}`, 'questions');
        allQuestionResults = []; // Clear results after saving
    } catch (error) {
        logMessage(`Error saving all question results: ${error.message}`, 'questions');
    }
}
// Collapsible section logic
function setupCollapsibles() {
  document.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const targetId = btn.getAttribute('data-target');
      const target = document.getElementById(targetId);
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if (target) {
        if (expanded) {
          target.classList.add('collapsed');
        } else {
          target.classList.remove('collapsed');
        }
      }
    });
  });
}
// Load settings when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    setupCollapsibles();
    loadSettings();
    
    // Fix for profile tab button always showing color
    const profileTabBtn = document.getElementById('profileTabBtn');
    if (profileTabBtn) {
        // Remove active class from all tabs first
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        // Add active class only to profile tab
        profileTabBtn.classList.add('active');
    }
});