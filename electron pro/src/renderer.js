const { ipcRenderer } = require('electron');
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// State management
let leaderboardState = {
    isRunning: false,
    isPaused: false,
    data: [],
    currentPage: 1,
    totalPages: 0
};

let comparisonState = {
    isRunning: false,
    isPaused: false,
    data: [],
    processedCount: 0,
    totalCount: 0,
    fileData: null
};

let comparisonTableColumns = null;
let comparisonSavePath = '';

// Tab switching with state preservation
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
        
        // Update UI based on current state
        if (button.dataset.tab === 'leaderboard') {
            updateLeaderboardControls();
        } else {
            updateComparisonControls();
        }
    });
});

// Leaderboard scraping
document.getElementById('start-leaderboard').addEventListener('click', async () => {
    if (leaderboardState.isRunning) return;

    const config = {
        baseUrl: document.getElementById('leaderboard-url').value.trim(),
        startPage: parseInt(document.getElementById('start-page').value),
        endPage: parseInt(document.getElementById('end-page').value),
        sleepTime: parseInt(document.getElementById('sleep-time').value)
    };
    
    // Validate input
    if (!config.baseUrl || isNaN(config.startPage) || isNaN(config.endPage) || isNaN(config.sleepTime)) {
        showNotification('Please fill in all fields with valid values', 'error');
        return;
    }
    
    if (config.startPage > config.endPage) {
        showNotification('Start page must be less than or equal to end page', 'error');
        return;
    }
    
    try {
        // Clear previous data when starting new scrape
        leaderboardState.data = [];
        const tbody = document.querySelector('#leaderboard-table tbody');
        tbody.innerHTML = '';
        updateTableStats('leaderboard');
        
        // Reset session file
        const sessionData = {
            currentPage: 1,
            data: []
        };
        try {
            const result = await ipcRenderer.invoke('save-leaderboard-session', sessionData);
            if (!result.success) {
                console.warn('Warning: Could not save session data:', result.error);
            }
        } catch (error) {
            console.warn('Warning: Could not save session data:', error);
        }
        
        setLoading('leaderboard', true);
        leaderboardState.isRunning = true;
        leaderboardState.isPaused = false;
        updateLeaderboardControls();

        const scrapedData = await ipcRenderer.invoke('start-leaderboard-scraping', config);
        // Clean the data before storing
        leaderboardState.data = scrapedData.map(item => ({
            rank: item.rank,
            hackerName: item.hackerName ? item.hackerName.toString().trim() : '',
            score: item.score
        }));
        updateLeaderboardTable(leaderboardState.data);
        showNotification('Leaderboard scraping completed successfully', 'success');
            
            // Auto-export
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const autoSavePath = `hackerrank_leaderboard_${timestamp}.xlsx`;
            await exportToExcel(leaderboardState.data, autoSavePath, true);
    } catch (error) {
        showNotification('Error scraping leaderboard: ' + error.message, 'error');
    } finally {
        setLoading('leaderboard', false);
        leaderboardState.isRunning = false;
        leaderboardState.isPaused = false;
        updateLeaderboardControls();
    }
});

document.getElementById('pause-leaderboard').addEventListener('click', async () => {
    if (!leaderboardState.isRunning) return;
    
    leaderboardState.isPaused = await ipcRenderer.invoke('pause-leaderboard-scraping');
    const pauseButton = document.getElementById('pause-leaderboard');
    pauseButton.textContent = leaderboardState.isPaused ? 'Resume' : 'Pause';
    setLoading('leaderboard', false);
    showNotification(
        leaderboardState.isPaused ? 'Scraping paused' : 'Scraping resumed',
        'info'
    );
});

document.getElementById('stop-leaderboard').addEventListener('click', async () => {
    if (!leaderboardState.isRunning) return;
    
    await ipcRenderer.invoke('stop-leaderboard-scraping');
    leaderboardState.isRunning = false;
    leaderboardState.isPaused = false;
    updateLeaderboardControls();
    setLoading('leaderboard', false);
    showNotification('Scraping stopped', 'warning');
});

function updateLeaderboardControls() {
    const startBtn = document.getElementById('start-leaderboard');
    const pauseBtn = document.getElementById('pause-leaderboard');
    const stopBtn = document.getElementById('stop-leaderboard');
    const exportBtn = document.getElementById('export-leaderboard');
    
    startBtn.disabled = leaderboardState.isRunning;
    pauseBtn.disabled = !leaderboardState.isRunning;
    stopBtn.disabled = !leaderboardState.isRunning;
    exportBtn.disabled = !leaderboardState.data.length;
    
    if (leaderboardState.isPaused) {
        pauseBtn.textContent = 'Resume';
    } else {
        pauseBtn.textContent = 'Pause';
    }
}

function updateLeaderboardTable(data, append = false) {
    const tbody = document.querySelector('#leaderboard-table tbody');
    if (!append) {
        tbody.innerHTML = '';
    }
    
    const fragment = document.createDocumentFragment();
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.rank}</td>
            <td>${row.hackerName}</td>
            <td>${row.score}</td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
    updateTableStats('leaderboard');
    
    // Scroll to bottom if appending
    if (append) {
        const tableContainer = document.querySelector('#leaderboard-tab .table-scroll');
        tableContainer.scrollTop = tableContainer.scrollHeight;
    }
}

function updateTableStats(type) {
    const container = document.querySelector(`#${type}-tab`);
    const recordCount = container.querySelector('.record-count');
    const tbody = container.querySelector('tbody');
    recordCount.textContent = tbody.children.length;
}

document.getElementById('export-leaderboard').addEventListener('click', async () => {
    const tbody = document.querySelector('#leaderboard-table tbody');
    if (!tbody.children.length) {
        showNotification('No data to export', 'warning');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leaderboard');
    
    worksheet.columns = [
        { header: 'Rank', key: 'rank', width: 10 },
        { header: 'Hacker Name', key: 'hackerName', width: 30 },
        { header: 'Score', key: 'score', width: 15 }
    ];

    // Ensure data is properly formatted before adding to worksheet
    const formattedData = leaderboardState.data.map(row => ({
        rank: row.rank,
        hackerName: row.hackerName ? row.hackerName.toString().trim() : '',
        score: row.score
    }));
    
    // Apply text format to Hacker Name column
    worksheet.getColumn('hackerName').eachCell((cell) => {
        if (cell.value) {
            cell.value = cell.value.toString().trim();
        }
    });

    worksheet.addRows(formattedData);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `hackerrank_leaderboard_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
});

// User Comparison
async function handleFileData(fileContent, fileName) {
    try {
        const data = [];
        if (fileName.endsWith('.csv')) {
            // Parse CSV
            for await (const row of fs.createReadStream(fileContent)
                .pipe(csv())) {
                data.push(row);
            }
        } else {
            // Parse Excel
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(fileContent);
            const worksheet = workbook.getWorksheet(1);
            const headers = worksheet.getRow(1).values.slice(1); // Remove empty first cell

            worksheet.eachRow((row, rowNum) => {
                if (rowNum > 1) { // Skip header row
                    const rowData = {};
                    row.values.slice(1).forEach((value, index) => {
                        rowData[headers[index]] = value;
                    });
                    data.push(rowData);
                }
            });
        }
        return data;
    } catch (error) {
        throw new Error(`Error parsing file: ${error.message}`);
    }
}

document.getElementById('comparison-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Display the file name
        document.getElementById('file-name-display').textContent = `Selected file: ${file.name}`;
        showNotification('Loading file...', 'info');
        let data = [];
        if (file.name.endsWith('.csv')) {
            // Parse CSV using FileReader
            const text = await file.text();
            const lines = text.split(/\r?\n/);
            const headers = lines[0].split(',');
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim() || '');
                data.push(row);
            }
        } else {
            // Parse Excel using ExcelJS
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.getWorksheet(1);
            const headers = worksheet.getRow(1).values.slice(1);
            worksheet.eachRow((row, rowNum) => {
                if (rowNum > 1) {
                    const rowData = {};
                    row.values.slice(1).forEach((value, idx) => {
                        rowData[headers[idx]] = value;
                    });
                    data.push(rowData);
                }
            });
        }
        comparisonState.fileData = data;
        // Update column dropdown
        const columnSelect = document.getElementById('username-column');
        columnSelect.innerHTML = '';
        Object.keys(data[0]).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            columnSelect.appendChild(option);
        });
        columnSelect.disabled = false;
        document.getElementById('start-comparison').disabled = false;
        showNotification(`Loaded ${data.length} records`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
        comparisonState.fileData = null;
        document.getElementById('username-column').disabled = true;
        document.getElementById('start-comparison').disabled = true;
    }
});

document.getElementById('comparison-save-browse').addEventListener('click', async () => {
    const filePath = await ipcRenderer.invoke('show-save-dialog');
    if (filePath) {
        comparisonSavePath = filePath;
        document.getElementById('comparison-save-path-label').textContent = filePath;
    }
});

document.getElementById('start-comparison').addEventListener('click', async () => {
    if (comparisonState.isRunning) return;

    const columnName = document.getElementById('username-column').value;
    const baseUrl = document.getElementById('comparison-url').value.trim().replace(/\/+$/, '');
    const fixedUsername = document.getElementById('fixed-username').value.trim();
    let sleepTime = parseInt(document.getElementById('comparison-sleep-time').value, 10);
    if (isNaN(sleepTime) || sleepTime < 1) sleepTime = 3;
    let savePath = comparisonSavePath;

    if (!columnName || !baseUrl) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }

    const usernames = comparisonState.fileData.map(row => row[columnName]).filter(Boolean);

    const config = {
        baseUrl,
        fixedUsername,
        usernames,
        sleepTime,
        savePath
    };
    console.log('Comparison config:', config);

    try {
        setLoading('comparison', true);
        comparisonState.isRunning = true;
        document.getElementById('start-comparison').disabled = true;
        document.getElementById('pause-comparison').disabled = false;
        document.getElementById('stop-comparison').disabled = false;

        // Clear table before starting
        updateComparisonTable([]);

        // Start scraping and update table in real time
        const results = await ipcRenderer.invoke('start-user-comparison', config);
        updateComparisonTable(results);
        showNotification('Comparison completed successfully', 'success');
    } catch (error) {
        showNotification('Error in comparison scraping: ' + error.message, 'error');
    } finally {
        setLoading('comparison', false);
        comparisonState.isRunning = false;
        document.getElementById('start-comparison').disabled = false;
        document.getElementById('pause-comparison').disabled = true;
        document.getElementById('stop-comparison').disabled = true;
    }
});

function updateComparisonTable(data) {
    const table = document.getElementById('comparison-table');
    table.classList.add('comparison-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    // Always determine the full set of columns from all results
    let allColumns = [];
    data.forEach(row => {
        if (row.data && Array.isArray(row.data.columns) && row.data.columns.length) {
            row.data.columns.forEach(col => {
                if (!allColumns.includes(col)) allColumns.push(col);
            });
        } else if (row.error === null) {
            // For results from main process that don't have the data.columns structure
            Object.keys(row).forEach(key => {
                if (key !== 'username' && key !== 'error' && !allColumns.includes(key)) {
                    allColumns.push(key);
                }
            });
        }
    });

    // Check if any row has an error
    const hasError = data.some(row => row.error);

    // Set up headers dynamically
    thead.innerHTML = '<th>Username</th>';
    allColumns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        thead.appendChild(th);
    });
    if (hasError) {
        const th = document.createElement('th');
        th.textContent = 'Error';
        thead.appendChild(th);
    }

    // Add data rows
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.username}</td>`;
        
        if (row.error) {
            // Handle error case
            for (let i = 0; i < allColumns.length; i++) {
                tr.innerHTML += '<td></td>';
            }
            tr.innerHTML += `<td>${row.error}</td>`;
        } else if (row.data && Array.isArray(row.data.values)) {
            // Handle data with columns/values structure
            allColumns.forEach((col, i) => {
                tr.innerHTML += `<td>${row.data.values[i] || ''}</td>`;
            });
            if (hasError) {
                tr.innerHTML += '<td></td>';
            }
        } else {
            // Handle flat object structure from main process
            allColumns.forEach(col => {
                tr.innerHTML += `<td>${row[col] || ''}</td>`;
            });
            if (hasError) {
                tr.innerHTML += '<td></td>';
            }
        }
        tbody.appendChild(tr);
    });
    
    // Update record count
    const recordCount = document.querySelector('#comparison-tab .record-count');
    recordCount.textContent = data.length;
    
    // Log the data for debugging
    console.log('Comparison data:', data);
}

// Helper: Show/hide loading spinner
function setLoading(tab, isLoading) {
    const spinner = document.querySelector(`#${tab}-tab .loading-spinner`);
    if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
}

// Modular: Update progress bar and status
function updateProgress(tab, percent, statusText, extraHtml = '') {
    const container = document.querySelector(`#${tab}-tab`);
    const progressFill = container.querySelector('.progress-fill');
    const progressPercentage = container.querySelector('.progress-percentage');
    const statusElement = container.querySelector('.status-text');
    progressFill.style.width = `${percent}%`;
    progressPercentage.textContent = `${Math.round(percent)}%`;
    statusElement.innerHTML = (statusText || '') + (extraHtml || '');
}

// Leaderboard progress (real-time)
ipcRenderer.on('leaderboard-progress', (event, data) => {
    leaderboardState.currentPage = data.currentPage;
    leaderboardState.totalPages = data.totalPages;
    const percent = (data.currentPage / data.totalPages) * 100;
    let status = `Processing page ${data.currentPage} of ${data.totalPages}`;
    if (data.estimatedTime) status += `<br>Estimated time remaining: ${data.estimatedTime}`;
    // If newData is present, append it and show live count
    if (data.newData && Array.isArray(data.newData)) {
        updateLeaderboardTable(data.newData, true);
    }
    const liveCount = document.querySelector('#leaderboard-table tbody').children.length;
    const extraHtml = `<div class='live-count'>Scraped Results: <b>${liveCount}</b></div>`;
    updateProgress('leaderboard', percent, status, extraHtml);
    setLoading('leaderboard', true);
});

// Comparison progress (real-time)
ipcRenderer.on('comparison-progress', (event, data) => {
    comparisonState.processedCount = data.processed;
    const percent = (data.processed / data.total) * 100;
    let status = `Processing user ${data.processed} of ${data.total}: ${data.currentUsername}`;
    if (data.estimatedTime) status += `<br>Estimated time remaining: ${data.estimatedTime}`;
    updateProgress('comparison', percent, status);
    setLoading('comparison', true);
    
    if (data.newData && Array.isArray(data.newData)) {
        // Process the new data to ensure it's in the right format
        const processedData = data.newData.map(item => {
            // If the item already has the expected structure, return it as is
            if (item.data && item.data.columns && item.data.values) {
                return item;
            }
            
            // Otherwise, convert the flat structure to the expected format
            const username = item.username;
            const error = item.error;
            
            // If there's an error, keep the simple structure
            if (error) {
                return { username, error };
            }
            
            // For successful results, ensure they're properly formatted
            return item;
        });
        
        comparisonState.data = comparisonState.data.concat(processedData);
        updateComparisonTable(comparisonState.data);
        
        // Log for debugging
        console.log('Received new comparison data:', processedData);
    }
});

// Stop loading spinner on completion
function stopLoading(tab) {
    setLoading(tab, false);
    updateProgress(tab, 100, 'Completed!');
}

// Export functionality
async function exportToExcel(data, filename, isAutoSave = false) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data');
        
        if (data[0].data) {
            // Comparison data
            worksheet.columns = [
                { header: 'Username', key: 'username' },
                ...data[0].data.columns.map(col => ({ header: col, key: col }))
            ];
            
            worksheet.addRows(
                data.map(row => ({
                    username: row.username,
                    ...Object.fromEntries(
                        row.data.columns.map((col, i) => [col, row.data.values[i]])
                    )
                }))
            );
        } else {
            // Leaderboard data
            worksheet.columns = [
                { header: 'Rank', key: 'rank' },
                { header: 'Hacker Name', key: 'hackerName' },
                { header: 'Score', key: 'score' }
            ];
            worksheet.addRows(data);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        if (isAutoSave) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            showNotification(`Auto-saved to ${filename}`, 'success');
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            showNotification('Export completed successfully', 'success');
        }
    } catch (error) {
        showNotification('Export failed: ' + error.message, 'error');
    }
}

// Show notifications with UI
function showNotification(message, type = 'info') {
    // Only show notifications if enabled
    if (typeof appSettings !== 'undefined' && appSettings.notificationsEnabled === false) return;
    // Create or get notification container
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    // Add to container
    container.appendChild(notification);
    // Remove after animation
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, 3000);
}

document.getElementById('pause-comparison').addEventListener('click', async () => {
    if (!comparisonState.isRunning) return;
    comparisonState.isPaused = await ipcRenderer.invoke('pause-comparison-scraping');
    const pauseButton = document.getElementById('pause-comparison');
    pauseButton.textContent = comparisonState.isPaused ? 'Resume' : 'Pause';
    setLoading('comparison', false);
    showNotification(
        comparisonState.isPaused ? 'Comparison scraping paused' : 'Comparison scraping resumed',
        'info'
    );
});

document.getElementById('stop-comparison').addEventListener('click', async () => {
    if (!comparisonState.isRunning) return;
    await ipcRenderer.invoke('stop-comparison-scraping');
    comparisonState.isRunning = false;
    comparisonState.isPaused = false;
    setLoading('comparison', false);
    document.getElementById('start-comparison').disabled = false;
    document.getElementById('pause-comparison').disabled = true;
    document.getElementById('stop-comparison').disabled = true;
    showNotification('Comparison scraping stopped', 'warning');
});

// === SIDEBAR & SETTINGS LOGIC ===

// Sidebar open/close
const sidebar = document.getElementById('settings-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
let sidebarOverlay = document.getElementById('sidebar-overlay');
if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.id = 'sidebar-overlay';
    document.body.appendChild(sidebarOverlay);
}

function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
}
function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}
sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Notification toggle sync
const notifMain = document.getElementById('toggle-notifications');
const notifSidebar = document.getElementById('toggle-notifications-sidebar');
if (notifMain && notifSidebar) {
    notifSidebar.checked = notifMain.checked;
    notifSidebar.addEventListener('change', () => {
        notifMain.checked = notifSidebar.checked;
    });
    notifMain.addEventListener('change', () => {
        notifSidebar.checked = notifMain.checked;
    });
}

// Initialize UI state when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Load app settings from main process
    let appSettings = await ipcRenderer.invoke('get-app-settings');

    // Get all settings elements
    const notifMain = document.getElementById('toggle-notifications');
    const notifSidebar = document.getElementById('toggle-notifications-sidebar');
const darkModeToggle = document.getElementById('toggle-darkmode');
    const fontSizeRange = document.getElementById('font-size-range');
    const layoutSelect = document.getElementById('layout-select');
    const container = document.querySelector('.container');

    // Check for missing elements
    if (!notifMain) console.error('toggle-notifications element not found!');
    if (!notifSidebar) console.error('toggle-notifications-sidebar element not found!');
    if (!darkModeToggle) console.error('toggle-darkmode element not found!');
    if (!fontSizeRange) console.error('font-size-range element not found!');
    if (!layoutSelect) console.error('layout-select element not found!');
    if (!container) console.error('container element not found!');
    
    // Apply settings to UI
    if (darkModeToggle) {
        darkModeToggle.checked = !!appSettings.darkMode;
        document.body.classList.toggle('dark-mode', !!appSettings.darkMode);
    }
    if (fontSizeRange) {
        fontSizeRange.value = appSettings.fontSize || 16;
        document.documentElement.style.fontSize = (appSettings.fontSize || 16) + 'px';
    }
    if (layoutSelect) {
        layoutSelect.value = appSettings.layout || 'centered';
    container.classList.remove('centered', 'top-aligned');
        container.classList.add(appSettings.layout || 'centered');
    }
    if (notifMain) notifMain.checked = appSettings.notificationsEnabled !== false;
    if (notifSidebar) notifSidebar.checked = appSettings.notificationsEnabled !== false;

    // Real-time save and sync for all settings
    if (darkModeToggle) darkModeToggle.addEventListener('change', async function() {
        document.body.classList.toggle('dark-mode', this.checked);
        appSettings.darkMode = this.checked;
        console.log('Saving darkMode:', appSettings.darkMode);
        await ipcRenderer.invoke('set-app-settings', appSettings);
    });
    if (fontSizeRange) fontSizeRange.addEventListener('input', async function() {
        document.documentElement.style.fontSize = this.value + 'px';
        appSettings.fontSize = parseInt(this.value, 10);
        console.log('Saving fontSize:', appSettings.fontSize);
        await ipcRenderer.invoke('set-app-settings', appSettings);
    });
    if (layoutSelect) layoutSelect.addEventListener('change', async function() {
        container.classList.remove('centered', 'top-aligned');
        if (this.value === 'centered') {
        container.classList.add('centered');
        } else if (this.value === 'top') {
        container.classList.add('top-aligned');
    }
        appSettings.layout = this.value;
        console.log('Saving layout:', appSettings.layout);
        await ipcRenderer.invoke('set-app-settings', appSettings);
});
    if (notifMain) notifMain.addEventListener('change', async function() {
        appSettings.notificationsEnabled = this.checked;
        if (notifSidebar) notifSidebar.checked = this.checked;
        console.log('Saving notificationsEnabled (main):', appSettings.notificationsEnabled);
        await ipcRenderer.invoke('set-app-settings', appSettings);
    });
    if (notifSidebar) notifSidebar.addEventListener('change', async function() {
        appSettings.notificationsEnabled = this.checked;
        if (notifMain) notifMain.checked = this.checked;
        console.log('Saving notificationsEnabled (sidebar):', appSettings.notificationsEnabled);
        await ipcRenderer.invoke('set-app-settings', appSettings);
});

    // Reset Settings button
    const resetBtn = document.getElementById('reset-settings');
    const openDataBtn = document.getElementById('open-app-data-folder');

    if (resetBtn) resetBtn.addEventListener('click', async function() {
        appSettings = {
            darkMode: false,
            fontSize: 16,
            layout: 'centered',
            notificationsEnabled: true
        };
        // Apply to UI
        if (darkModeToggle) darkModeToggle.checked = false;
        document.body.classList.remove('dark-mode');
        if (fontSizeRange) fontSizeRange.value = 16;
        document.documentElement.style.fontSize = '16px';
        if (layoutSelect) layoutSelect.value = 'centered';
        container.classList.remove('centered', 'top-aligned');
        container.classList.add('centered');
        if (notifMain) notifMain.checked = true;
        if (notifSidebar) notifSidebar.checked = true;
        await ipcRenderer.invoke('set-app-settings', appSettings);
        showNotification('Settings reset to default.', 'success');
    });

    // Open App Data Folder button
    if (openDataBtn) openDataBtn.addEventListener('click', async function() {
        const result = await ipcRenderer.invoke('open-app-data-folder');
        if (result && result.success) {
            showNotification('App data folder opened.', 'success');
        } else {
            showNotification('Failed to open app data folder: ' + (result && result.message ? result.message : 'Unknown error'), 'error');
        }
    });

    // Initialize tabs
    document.querySelector('.tab-button[data-tab="leaderboard"]').click();
    container.classList.add(appSettings.layout || 'centered');
});
