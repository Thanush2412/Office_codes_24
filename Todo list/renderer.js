const { ipcRenderer } = require('electron');
const addButton = document.getElementById('addTaskButton');
const clearButton = document.getElementById('clearTasksButton');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const historyButton = document.getElementById('historyButton');
const alarmButton = document.getElementById('alarmButton');
const prioritySelect = document.getElementById('prioritySelect');
const dueDateInput = document.getElementById('dueDateInput');
const categorySelect = document.getElementById('categorySelect');
const searchInput = document.getElementById('searchInput');

// State Variables for tasks and history
let tasks = [];
let taskHistory = [];
let timers = {};
let completeHistory = [];  // New array to store complete history
let loginTimestamp = null;
let logoutTimestamp = null;


// Select elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginTime = document.getElementById('loginTime');
const logoutTime = document.getElementById('logoutTime');

// Initialize the category dropdown with default options
function initializeCategoryDropdown() {
    const defaultCategories = [
        'Meeting',
        'content',
        'Social Media',
        'campaign',
        'Presales',
        'Learning ',
        'Long Video',
        'Posters',
        'PPT',
        'Short Video',
        'Pamphlet',
        'Thumbnail',
        'Brochure',
        'HR Team',
        'Recording',
        'Explore',
        'Website',
        'Review',
        'Standee',
        'Video Shoot',
    ];

    categorySelect.innerHTML = ''; // Clear existing options
    defaultCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Load tasks and history from the file on start
async function loadTasks() {
    const data = await ipcRenderer.invoke('get-tasks');
    tasks = data.tasks || [];
    completeHistory = data.history || [];
    renderTasks();
}

// Save tasks and history to the file
async function saveTasks() {
    await ipcRenderer.invoke('save-tasks', { tasks, history: completeHistory });
}

loginBtn.addEventListener('click', () => {
    loginTimestamp = new Date().toLocaleString();
    loginTime.textContent = `Logged in at: ${loginTimestamp}`;
    loginBtn.disabled = true;
    logoutBtn.disabled = false;
    startTwentyTwentyReminder();
    startCountdownTimer();

});

logoutBtn.addEventListener('click', () => {
    logoutTimestamp = new Date().toLocaleString();
    logoutTime.textContent = `Logged out at: ${logoutTimestamp}`;
    logoutBtn.disabled = true;
    loginBtn.disabled = false;
    stopOneMinuteReminder();
});

// Add Task
addButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    const priority = prioritySelect.value;
    const dueDate = dueDateInput.value;

    if (taskText) {
        const task = createNewTask(taskText, priority, dueDate);
        tasks.push(task);
        addToHistory('CREATED', task);
        saveTasks();
        renderTasks();
        taskInput.value = '';
        dueDateInput.value = '';
    }
});

function createNewTask(taskText, priority, dueDate) {
    return {
        id: new Date().getTime(),
        text: taskText,
        status: 'Work in progress',
        comments: [],
        priority: priority,
        dueDate: dueDate || 'No Due Date',
        category: categorySelect.value,
        reminderTime: null,
        remainingTime: 0
    };
}

// Add to History
function addToHistory(action, task, additionalInfo = null) {
    const historyEntry = {
        timestamp: new Date().toISOString(),
        action: action,
        taskData: { ...task },
        additionalInfo: additionalInfo
    };
    completeHistory.push(historyEntry);
}


// Alarm Button (Set Reminder for Selected Task)
alarmButton.addEventListener('click', () => {
    showReminderModal();
});

function showReminderModal() {
    const taskListElement = createTaskSelection();
    const reminderModal = createReminderModal(taskListElement);
    document.body.appendChild(reminderModal);

    document.getElementById('setReminderTime').addEventListener('click', () => {
        const selectedTaskId = document.getElementById('taskSelection').value;
        const reminderTime = document.getElementById('reminderTime').value;

        if (selectedTaskId && reminderTime) {
            setTaskReminder(selectedTaskId, reminderTime);
            closeReminderModal();
        }
    });
}

function createTaskSelection() {
    const taskListElement = document.createElement('select');
    taskListElement.id = 'taskSelection';
    tasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.text;
        taskListElement.appendChild(option);
    });
    return taskListElement;
}

function createReminderModal(taskListElement) {
    const modalDiv = document.createElement('div');
    modalDiv.classList.add('reminderModal');

    const header = document.createElement('h2');
    header.textContent = 'Select a Task for Reminder';
    modalDiv.appendChild(header);

    modalDiv.appendChild(taskListElement);

    const reminderInput = document.createElement('input');
    reminderInput.type = 'number';
    reminderInput.id = 'reminderTime';
    reminderInput.placeholder = 'Time in minutes';
    modalDiv.appendChild(reminderInput);

    const setReminderButton = document.createElement('button');
    setReminderButton.id = 'setReminderTime';
    setReminderButton.textContent = 'Set Reminder';
    modalDiv.appendChild(setReminderButton);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', closeReminderModal);
    modalDiv.appendChild(closeButton);

    return modalDiv;
}

function closeReminderModal() {
    document.querySelector('.reminderModal').remove();
}

function setTaskReminder(taskId, timeInMinutes) {
    const task = tasks.find(task => task.id == taskId);
    if (task) {
        task.reminderTime = timeInMinutes * 60000;
        task.remainingTime = task.reminderTime;

        resetTimer(taskId);
        startTimerForTask(task);
        
        updateTimerCircle(taskId);
        addToHistory('REMINDER_SET', task, { reminderTime: timeInMinutes });
        
        saveTasks();
        renderTasks();
    }
}

function resetTimer(taskId) {
    if (timers[taskId]) {
        clearInterval(timers[taskId]);
        delete timers[taskId];
    }
}

function startTimerForTask(task) {
    resetTimer(task.id);

    timers[task.id] = setInterval(() => {
        if (task.remainingTime > 0) {
            task.remainingTime -= 1000;
            updateTimerCircle(task.id);
            
            if (task.remainingTime <= 0) {
                resetTimer(task.id);
                task.remainingTime = 0;
                ipcRenderer.send('send-notification', task);
                addToHistory('REMINDER_COMPLETED', task);
            }
        }
    }, 1000);
}

function updateTimerCircle(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        const taskElement = document.getElementById(`task-${task.id}`);
        if (taskElement) {
            const circle = taskElement.querySelector('.circle');
            const remainingTimeText = taskElement.querySelector('.remainingTimeText');

            if (task.reminderTime > 0) {
                const remainingMinutes = Math.floor(task.remainingTime / 60000);
                const remainingSeconds = Math.floor((task.remainingTime % 60000) / 1000);
                remainingTimeText.textContent = `${remainingMinutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;

                const progress = 100 - ((task.remainingTime / task.reminderTime) * 100);
                circle.style.setProperty('--progress', `${progress}%`);
                
                if (remainingMinutes === 0 && remainingSeconds <= 10) {
                    circle.setAttribute('data-low-time', 'true');
                } else {
                    circle.removeAttribute('data-low-time');
                }
                
                circle.style.display = 'block';
                remainingTimeText.style.display = 'block';
            } else {
                circle.style.display = 'none';
                remainingTimeText.style.display = 'none';
            }
        }
    }
}

// Delete Task
function deleteTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        addToHistory('DELETED', task);
        tasks = tasks.filter(t => t.id !== taskId);
        resetTimer(taskId);
        saveTasks();
        renderTasks();
    }
}

// Edit Task
function editTask(taskId, newText) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        const oldTask = { ...task };
        task.text = newText;
        addToHistory('EDITED', task, { oldText: oldTask.text });
        saveTasks();
        renderTasks();
    }
}

// Update Task Status
function updateTaskStatus(taskId, status) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        const oldStatus = task.status;
        task.status = status;
        addToHistory('STATUS_CHANGED', task, { oldStatus, newStatus: status });
        saveTasks();
        renderTasks();
    }
}

// Add Comment to Task
function addCommentToTask(taskId, commentText) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.comments.push(commentText);
        addToHistory('COMMENT_ADDED', task, { comment: commentText });
        saveTasks();
        renderTasks();
    }
}

// Clear All Tasks
clearButton.addEventListener('click', () => {
    const clearedTasks = [...tasks];
    tasks.forEach(task => resetTimer(task.id));
    tasks = [];
    addToHistory('CLEARED_ALL', null, { clearedTasks });
    saveTasks();
    renderTasks();
});

// Enhanced History Modal
function showHistoryModal() {
    const historyModal = document.createElement('div');
    historyModal.className = 'historyModal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'historyModalContent';
    
    const header = document.createElement('h2');
    header.textContent = 'Task History';
    
    const historyList = document.createElement('div');
    historyList.className = 'historyList';
    
    completeHistory.slice().reverse().forEach(entry => {
        const historyItem = createHistoryItem(entry);
        historyList.appendChild(historyItem);
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.onclick = closeHistoryModal;
    
    modalContent.appendChild(header);
    modalContent.appendChild(historyList);
    modalContent.appendChild(closeButton);
    historyModal.appendChild(modalContent);
    
    document.body.appendChild(historyModal);
}

function createHistoryItem(entry) {
    const item = document.createElement('div');
    item.className = 'historyItem';
    
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const taskData = entry.taskData;
    
    let actionText = '';
    let restoreButton = null;
    
    switch (entry.action) {
        case 'CREATED':
            actionText = `Created task: "${taskData.text}"`;
            break;
        case 'DELETED':
            actionText = `Deleted task: "${taskData.text}"`;
            restoreButton = createRestoreButton(taskData);
            break;
        case 'EDITED':
            actionText = `Edited task from "${entry.additionalInfo.oldText}" to "${taskData.text}"`;
            break;
        case 'STATUS_CHANGED':
            actionText = `Changed status from "${entry.additionalInfo.oldStatus}" to "${entry.additionalInfo.newStatus}"`;
            break;
        case 'COMMENT_ADDED':
            actionText = `Added comment to "${taskData.text}": "${entry.additionalInfo.comment}"`;
            break;
        case 'CLEARED_ALL':
            actionText = 'Cleared all tasks';
            restoreButton = createRestoreAllButton(entry.additionalInfo.clearedTasks);
            break;
        case 'REMINDER_SET':
            actionText = `Set ${entry.additionalInfo.reminderTime} minute reminder for "${taskData.text}"`;
            break;
        case 'REMINDER_COMPLETED':
            actionText = `Reminder completed for "${taskData.text}"`;
            break;
    }
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'historyTimestamp';
    timeSpan.textContent = timestamp;
    
    const actionSpan = document.createElement('span');
    actionSpan.className = 'historyAction';
    actionSpan.textContent = actionText;
    
    item.appendChild(timeSpan);
    item.appendChild(actionSpan);
    if (restoreButton) {
        item.appendChild(restoreButton);
    }
    
    return item;
}

function createRestoreButton(taskData) {
    const button = document.createElement('button');
    button.textContent = 'Restore';
    button.className = 'restoreButton';
    button.onclick = () => restoreTask(taskData);
    return button;
}

function createRestoreAllButton(tasksData) {
    const button = document.createElement('button');
    button.textContent = 'Restore All';
    button.className = 'restoreButton';
    button.onclick = () => restoreAllTasks(tasksData);
    return button;
}

function restoreTask(taskData) {
    const taskExists = tasks.some(task => task.id === taskData.id);
    if (!taskExists) {
        tasks.push({ ...taskData });
        addToHistory('RESTORED', taskData);
        saveTasks();
        renderTasks();
        closeHistoryModal();
        showHistoryModal();
    }
}

function restoreAllTasks(tasksData) {
    tasksData.forEach(taskData => {
        const taskExists = tasks.some(task => task.id === taskData.id);
        if (!taskExists) {
            tasks.push({ ...taskData });
        }
    });
    addToHistory('RESTORED_ALL', null, { restoredTasks: tasksData });
    saveTasks();
    renderTasks();
    closeHistoryModal();
    showHistoryModal();
}

function closeHistoryModal() {
    document.querySelector('.historyModal').remove();
}

// Render Tasks
function renderTasks() {
    taskList.innerHTML = '';
    const filteredTasks = filterTasks();

    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
        
        if (task.reminderTime > 0) {
            updateTimerCircle(task.id);
        }
    });
}

function createTaskElement(task) {
    const li = document.createElement('li');
    li.id = `task-${task.id}`;
    li.className = 'task-item';

    // Create editable task name
    const taskName = document.createElement('div');
    taskName.className = 'taskName';
    taskName.contentEditable = true;
    taskName.textContent = task.text;
    taskName.addEventListener('blur', () => {
        const newText = taskName.textContent.trim();
        if (newText !== task.text) {
            editTask(task.id, newText);
        }
    });

    // Create editable status dropdown
    const taskStatus = document.createElement('select');
    taskStatus.className = 'taskStatus';
    ['Work in progress', 'Completed', 'Postpone'].forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        option.selected = status === task.status;
        taskStatus.appendChild(option);
    });
    taskStatus.addEventListener('change', () => {
        updateTaskStatus(task.id, taskStatus.value);
    });

    // Create editable priority dropdown
    const prioritySelect = document.createElement('select');
    prioritySelect.className = 'priorityLabel';
    ['High', 'Medium', 'Low'].forEach(priority => {
        const option = document.createElement('option');
        option.value = priority;
        option.textContent = `Priority: ${priority}`;
        option.selected = priority === task.priority;
        prioritySelect.appendChild(option);
    });
    prioritySelect.addEventListener('change', () => {
        task.priority = prioritySelect.value;
        saveTasks();
    });

    // Create editable category dropdown
    const categorySelect = document.createElement('select');
    categorySelect.className = 'categoryLabel';
    const defaultCategories = [
        'Meeting', 'Content', 'Social Media', 'Campaign', 'Presales',
        'Learning', 'Long Video', 'Posters', 'PPT', 'Short Video',
        'Pamphlet', 'Thumbnail', 'Brochure', 'HR Team', 'Recording',
        'Explore', 'Website', 'Review', 'Standee', 'Video Shoot'
    ];
    defaultCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = `Category: ${category}`;
        option.selected = category === task.category;
        categorySelect.appendChild(option);
    });
    categorySelect.addEventListener('change', () => {
        task.category = categorySelect.value;
        saveTasks();
    });

    // Create editable due date
    const dueDateInput = document.createElement('input');
    dueDateInput.type = 'date';
    dueDateInput.className = 'dueDateLabel';
    dueDateInput.value = task.dueDate !== 'No Due Date' ? task.dueDate : '';
    dueDateInput.addEventListener('change', () => {
        task.dueDate = dueDateInput.value || 'No Due Date';
        saveTasks();
    });

    // Create other elements
    const statusContainer = createStatusButtons(task);
    const commentSection = createCommentSection(task);
    const timerCircle = createTimerCircle(task);
    const startEndTimeContainer = createStartEndTimeButtons(task);

    // Append all elements
    li.appendChild(taskName);
    li.appendChild(taskStatus);
    li.appendChild(prioritySelect);
    li.appendChild(dueDateInput);
    li.appendChild(categorySelect);
    li.appendChild(statusContainer);
    li.appendChild(commentSection);
    li.appendChild(timerCircle);
    li.appendChild(startEndTimeContainer);

    return li;
}

const style = document.createElement('style');
style.textContent = `
    .task-item .taskName[contenteditable="true"]:hover {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 5px;
        border-radius: 3px;
        cursor: text;
    }

    .task-item select {
        padding: 5px;
        margin: 5px;
        border-radius: 4px;
        border: 1px solid #333;
        background: #000;
        color: #fff;
        cursor: pointer;
    }

    .task-item select:hover {
        border-color: #007bff;
        background: #111;
    }

    .task-item select option {
        background: #000;
        color: #fff;
        padding: 8px;
    }

    .task-item select option:hover {
        background: #111;
    }

    .task-item input[type="date"] {
        padding: 5px;
        margin: 5px;
        border-radius: 4px;
        border: 1px solid #333;
        background: #000;
        color: #fff;
    }

    .task-item input[type="date"]:hover {
        border-color: #007bff;
    }

    .task-item input[type="date"]::-webkit-calendar-picker-indicator {
        filter: invert(1);
        cursor: pointer;
    }
`;
document.head.appendChild(style);

function createStartEndTimeButtons(task) {
    const container = document.createElement('div');
    container.className = 'startEndTimeContainer';

    // Start Time Button
    const startButton = document.createElement('button');
    startButton.className = 'startTimeButton';
    startButton.textContent = task.startTime ? `Start Time: ${task.startTime}` : 'Set Start Time';
    startButton.addEventListener('click', () => setStartTime(task));

    // End Time Button
    const endButton = document.createElement('button');
    endButton.className = 'endTimeButton';
    endButton.textContent = task.endTime ? `End Time: ${task.endTime}` : 'Set End Time';
    endButton.addEventListener('click', () => setEndTime(task));

    container.appendChild(startButton);
    container.appendChild(endButton);

    return container;
}

function setStartTime(task) {
    const startTime = new Date().toLocaleString();  // Get the current time
    task.startTime = startTime;  // Store it in the task object
    addToHistory('START_TIME_SET', task, { startTime });  // Log in history
    saveTasks();  // Save the tasks
    renderTasks();  // Re-render tasks to show updated start time
}

function setEndTime(task) {
    const endTime = new Date().toLocaleString();  // Get the current time
    task.endTime = endTime;  // Store it in the task object
    addToHistory('END_TIME_SET', task, { endTime });  // Log in history
    saveTasks();  // Save the tasks
    renderTasks();  // Re-render tasks to show updated end time
}


function createTaskName(task) {
    const taskName = document.createElement('div');
    taskName.className = 'taskName';
    taskName.textContent = task.text;
    return taskName;
}

function createTaskStatus(task) {
    const taskStatus = document.createElement('div');
    taskStatus.className = 'taskStatus';
    taskStatus.textContent = task.status;
    return taskStatus;
}

function createPriorityLabel(task) {
    const priorityLabel = document.createElement('div');
    priorityLabel.className = 'priorityLabel';
    priorityLabel.textContent = `Priority: ${task.priority}`;
    return priorityLabel;
}

function createDueDateLabel(task) {
    const dueDateLabel = document.createElement('div');
    dueDateLabel.className = 'dueDateLabel';
    dueDateLabel.textContent = `Due: ${task.dueDate}`;
    return dueDateLabel;
}

function createCategoryLabel(task) {
    const categoryLabel = document.createElement('div');
    categoryLabel.className = 'categoryLabel';
    categoryLabel.textContent = `Category: ${task.category}`;
    return categoryLabel;
}

function createStatusButtons(task) {
    const statusContainer = document.createElement('div');
    const doneButton = document.createElement('button');
    doneButton.className = 'statusButton';
    doneButton.textContent = 'Done';
    doneButton.addEventListener('click', () => updateTaskStatus(task.id, 'Done'));

    const inProgressButton = document.createElement('button');
    inProgressButton.className = 'statusButton';
    inProgressButton.textContent = 'In Progress';
    inProgressButton.addEventListener('click', () => updateTaskStatus(task.id, 'In Progress'));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'deleteButton';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    statusContainer.appendChild(doneButton);
    statusContainer.appendChild(inProgressButton);
    statusContainer.appendChild(deleteButton);

    return statusContainer;
}

function createCommentSection(task) {
    const commentSection = document.createElement('div');
    commentSection.className = 'commentSection';

    task.comments.forEach(comment => {
        const commentText = document.createElement('p');
        commentText.textContent = comment;
        commentText.style.color = '#bbb';
        commentSection.appendChild(commentText);
    });

    const commentInput = document.createElement('textarea');
    commentInput.placeholder = 'Add a comment...';
    commentSection.appendChild(commentInput);

    const commentButton = document.createElement('button');
    commentButton.textContent = 'Add Comment';
    commentButton.addEventListener('click', () => {
        const commentText = commentInput.value.trim();
        if (commentText) {
            addCommentToTask(task.id, commentText);
            commentInput.value = '';
        }
    });

    commentSection.appendChild(commentButton);
    return commentSection;
}

function createTimerCircle(task) {
    const timerCircle = document.createElement('div');
    timerCircle.className = 'timerCircle';
    
    const circle = document.createElement('div');
    circle.className = 'circle';
    
    const remainingTimeText = document.createElement('div');
    remainingTimeText.className = 'remainingTimeText';

    timerCircle.appendChild(circle);
    timerCircle.appendChild(remainingTimeText);

    if (task.reminderTime > 0) {
        const remainingMinutes = Math.floor(task.remainingTime / 60000);
        const remainingSeconds = Math.floor((task.remainingTime % 60000) / 1000);
        remainingTimeText.textContent = `${remainingMinutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;

        const progress = 100 - ((task.remainingTime / task.reminderTime) * 100);
        circle.style.setProperty('--progress', `${progress}%`);
        
        circle.style.display = 'block';
        remainingTimeText.style.display = 'block';
    } else {
        circle.style.display = 'none';
        remainingTimeText.style.display = 'none';
    }

    return timerCircle;
}

function filterTasks() {
    const searchTerm = searchInput.value.toLowerCase();
    return tasks.filter(task => {
        return task.text.toLowerCase().includes(searchTerm) ||
               task.status.toLowerCase().includes(searchTerm) ||
               task.priority.toLowerCase().includes(searchTerm) ||
               task.category.toLowerCase().includes(searchTerm);
    });
}

// Listen for search input changes
searchInput.addEventListener('input', renderTasks);

// Initialize categories and load tasks when the application starts
initializeCategoryDropdown();
loadTasks();

// Listen for task updates from main process
ipcRenderer.on('update-tasks', (_, updatedTasks) => {
    tasks = updatedTasks.tasks || updatedTasks;
    completeHistory = updatedTasks.history || completeHistory;
    renderTasks();
});

// Event listener for History button
historyButton.addEventListener('click', showHistoryModal);


// reminder counnter
let breakReminderTimer = null;
let countdownDisplay = document.getElementById('countdownDisplay');
let countdown;

// Function to start the reminder after login
function startOneMinuteReminder() {
    breakReminderTimer = setInterval(() => {
        // Use IPC to send notification request to main process
        ipcRenderer.send('send-notification', {
            text: 'Take a break! What is the status of your current work?'
        });
    }, 30000);
}

// Function to start the countdown timer
function startCountdownTimer() {
    let timeLeft = 30000; // 30 seconds
    if (countdown) clearInterval(countdown);

    countdown = setInterval(() => {
        let seconds = Math.floor(timeLeft / 1000);
        countdownDisplay.textContent = `Next break in: ${seconds} seconds`;
        timeLeft -= 1000;

        if (timeLeft <= 0) {
            clearInterval(countdown);
            // Use IPC to send notification request to main process
            ipcRenderer.send('send-notification', {
                text: 'Take a break! What is the status of your current work?'
            });
            
            // Restart the countdown
            startCountdownTimer();
        }
    }, 1000);
}

// Event listener for the login button
loginBtn.addEventListener('click', () => {
    loginTimestamp = new Date().toLocaleString();
    loginTime.textContent = `Logged in at: ${loginTimestamp}`;
    loginBtn.disabled = true;
    logoutBtn.disabled = false;

    // Notify main process of login
    ipcRenderer.send('user-logged-in', loginTimestamp);
    
    // Start timers
    startOneMinuteReminder();
    startCountdownTimer();
});

// Function to stop timers on logout
function stopOneMinuteReminder() {
    if (breakReminderTimer) {
        clearInterval(breakReminderTimer);
        breakReminderTimer = null;
    }

    if (countdown) {
        clearInterval(countdown);
        countdown = null;
    }
}

// Add event listener for when window is shown
ipcRenderer.on('window-shown', () => {
    showUpdateDialog();
});

// Function to show the update dialog
function showUpdateDialog() {
    const modal = document.createElement('div');
    modal.className = 'updateModal';
    modal.innerHTML = `
        <div class="updateModalContent">
            <h2>Update Task Status</h2>
            <select id="taskUpdateSelection" class="task-select">
                <option value="">Select a task...</option>
                ${tasks.map(task => `
                    <option value="${task.id}">${task.text}</option>
                `).join('')}
            </select>
            <textarea id="statusUpdateInput" placeholder="Enter your status update..."></textarea>
            <div class="button-container">
                <button id="submitUpdate">Submit Update</button>
                <button id="closeUpdateModal">Cancel</button>
            </div>
        </div>
    `;

    // Add event listeners for the modal
    modal.querySelector('#submitUpdate').addEventListener('click', () => {
        const taskId = modal.querySelector('#taskUpdateSelection').value;
        const updateText = modal.querySelector('#statusUpdateInput').value.trim();
        
        if (taskId && updateText) {
            addCommentToTask(taskId, updateText);
            modal.remove();
        }
    });

    modal.querySelector('#closeUpdateModal').addEventListener('click', () => {
        modal.remove();
    });

    // Remove existing modal if any
    const existingModal = document.querySelector('.updateModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.appendChild(modal);
}
// Assuming tasks.json contains an array of task objects

// Fetch the tasks data from tasks.json
// Add this function to handle CSV export
function exportTasksToCSV() {
    try {
        // CSV Headers
        const headers = [
            'Date',
            'Log In Time',
            'Log Out Time',
            'Start Time',
            'End Time',
            'Task for the day',
            'Category',
            'Status',
            'Priority',
            'Deadline'
        ];

        // Helper function to extract only time from datetime string
        function extractTimeOnly(dateTimeStr) {
            if (!dateTimeStr || dateTimeStr === 'N/A') return 'N/A';
            const timePart = dateTimeStr.split(', ')[1];
            return timePart || 'N/A';
        }

        // Get login/logout times from the UI elements
        const loginTimeText = document.getElementById('loginTime')?.textContent || '';
        const logoutTimeText = document.getElementById('logoutTime')?.textContent || '';
        const loginTime = loginTimeText.includes('at: ') ? 
            extractTimeOnly(loginTimeText.split('at: ')[1]) : 'N/A';
        const logoutTime = logoutTimeText.includes('at: ') ? 
            extractTimeOnly(logoutTimeText.split('at: ')[1]) : 'N/A';

        // Helper function to escape CSV values
        function escapeCSV(str) {
            if (str === null || str === undefined) return '';
            return `"${String(str).replace(/"/g, '""')}"`;
        }

        // Create rows from tasks
        const rows = tasks.map(task => {
            // Get the current date
            const currentDate = new Date().toLocaleDateString();
            
            // Get task-specific times and extract only time portion
            const taskStartTime = task.startTime ? extractTimeOnly(task.startTime) : 'N/A';
            const taskEndTime = task.endTime ? extractTimeOnly(task.endTime) : 'N/A';

            // Get values from the task card
            const taskText = task.text || '';
            const category = task.category || '';
            const status = task.status || '';
            const priority = task.priority || 'Medium';
            const dueDate = task.dueDate || 'No Due Date';

            return [
                currentDate,              // Date
                loginTime,               // Log In Time (time only)
                logoutTime,              // Log Out Time (time only)
                taskStartTime,           // Start Time (time only)
                taskEndTime,             // End Time (time only)
                taskText,                // Task for the day
                category,                // Category
                status,                  // Status
                priority,                // Priority
                dueDate                  // Deadline
            ].map(escapeCSV);
        });

        // Combine headers and rows
        const csvContent = [
            headers.map(escapeCSV).join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `tasks_export_${timestamp}.csv`;

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show success message
        alert('Tasks exported successfully!');
    } catch (error) {
        console.error('Error exporting tasks:', error);
        alert('Error exporting tasks. Please try again.');
    }
}

// Add button if it doesn't exist
function addExportButton() {
    let exportButton = document.getElementById('exportButton');
    if (!exportButton) {
        exportButton = document.createElement('button');
        exportButton.id = 'exportButton';
        exportButton.textContent = 'Export to CSV';
        exportButton.className = 'export-button';
        
        // Find a suitable place to add the button (adjust as needed)
        const taskListContainer = document.getElementById('taskList').parentElement;
        taskListContainer.insertBefore(exportButton, document.getElementById('taskList'));
    }
    
    // Add or update click handler
    exportButton.onclick = exportTasksToCSV;
}

// Add styles for the export button
const exportButtonStyles = document.createElement('style');
exportButtonStyles.textContent = `
    .export-button {
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin: 10px 0;
        font-size: 14px;
    }

    .export-button:hover {
        background: #0056b3;
    }
`;
document.head.appendChild(exportButtonStyles);

// Initialize the export button when the document is ready
document.addEventListener('DOMContentLoaded', addExportButton);

// Add these functions to your existing code

// Group tasks by date
// Function to format date to YYYY-MM-DD
// Function to format date to YYYY-MM-DD
// Global state variables
let currentWeekStart = getStartOfWeek(new Date());

let selectedDate = null;

// Date formatting utility functions
function formatDate(date) {
    if (!(date instanceof Date)) {
        return 'No Due Date';
    }
    // Create a new date at midnight UTC to avoid timezone issues
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return normalizedDate.toISOString().split('T')[0];
}

function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return new Date();
    }

    const [date, time] = dateString.split(', ');
    if (!date || !time) {
        return new Date();
    }

    const [day, month, year] = date.split('/');
    return new Date(`${year}-${month}-${day}T${time}`);
}

function getStartOfWeek(date) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
}

// Task grouping function
function groupTasksByDate(tasks) {
    const grouped = {};
    tasks.forEach(task => {
        if (!task.dueDate || task.dueDate === 'No Due Date') {
            if (!grouped['No Due Date']) {
                grouped['No Due Date'] = [];
            }
            grouped['No Due Date'].push(task);
            return;
        }

        const taskDate = new Date(task.dueDate);
        const normalizedDate = new Date(Date.UTC(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate()));
        const dateString = formatDate(normalizedDate);
        
        if (!grouped[dateString]) {
            grouped[dateString] = [];
        }
        grouped[dateString].push(task);
    });
    return grouped;
}

// Calendar creation functions
function createWeeklyCalendar() {
    const calendarContainer = document.createElement('div');
    calendarContainer.id = 'weeklyCalendar';
    calendarContainer.className = 'weekly-calendar';

    // Navigation controls
    const navigation = document.createElement('div');
    navigation.className = 'calendar-navigation';

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous Week';
    prevButton.className = 'nav-button';
    prevButton.addEventListener('click', () => {
        const newWeek = new Date(currentWeekStart);
        newWeek.setDate(currentWeekStart.getDate() - 7);
        currentWeekStart = newWeek;
        renderWeeklyCalendar(currentWeekStart, tasks, selectedDate);
    });

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next Week';
    nextButton.className = 'nav-button';
    nextButton.addEventListener('click', () => {
        const newWeek = new Date(currentWeekStart);
        newWeek.setDate(currentWeekStart.getDate() + 7);
        currentWeekStart = newWeek;
        renderWeeklyCalendar(currentWeekStart, tasks, selectedDate);
    });

    const weekDisplay = document.createElement('div');
    weekDisplay.id = 'weekDisplay';
    weekDisplay.className = 'week-display';

    navigation.appendChild(prevButton);
    navigation.appendChild(weekDisplay);
    navigation.appendChild(nextButton);

    // Dates container
    const datesContainer = document.createElement('div');
    datesContainer.id = 'datesContainer';
    datesContainer.className = 'dates-container';

    calendarContainer.appendChild(navigation);
    calendarContainer.appendChild(datesContainer);

    // Insert calendar
    const taskListContainer = document.getElementById('taskList') ? 
        document.getElementById('taskList').parentElement : document.body;
    taskListContainer.insertBefore(calendarContainer, document.getElementById('taskList'));

    return {
        prevButton,
        nextButton,
        datesContainer,
        weekDisplay
    };
}


function createDateCell(date, tasks, selectedDate, onDateSelect) {
    const cell = document.createElement('div');
    cell.className = 'date-cell';

    // Normalize the date to midnight UTC
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dateString = formatDate(normalizedDate);
    
    if (selectedDate === dateString) {
        cell.classList.add('selected');
    }

    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = date.getDate();
    const taskCount = tasks[dateString] ? tasks[dateString].length : 0;

    cell.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-number">${dayNumber}</div>
        <div class="task-count">${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}</div>
    `;

    cell.addEventListener('click', () => onDateSelect(dateString));
    return cell;
}


function createNoDueDateCell(tasks, selectedDate, onDateSelect) {
    const cell = document.createElement('div');
    cell.className = 'date-cell no-due-date';

    if (selectedDate === 'No Due Date') {
        cell.classList.add('selected');
    }

    const taskCount = tasks['No Due Date'] ? tasks['No Due Date'].length : 0;

    cell.innerHTML = `
        <div class="day-name">No Due</div>
        <div class="day-number">Date</div>
        <div class="task-count">${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}</div>
    `;

    cell.addEventListener('click', () => onDateSelect('No Due Date'));
    return cell;
}

// Main rendering functions
function renderWeeklyCalendar(currentWeek, tasks, selectedDate) {
    let calendar = document.getElementById('weeklyCalendar');
    if (!calendar) {
        const calendarElements = createWeeklyCalendar();
        calendar = document.getElementById('weeklyCalendar');
    }
    
    const datesContainer = document.getElementById('datesContainer');
    const weekDisplay = document.getElementById('weekDisplay');
    
    // Update current week state
    currentWeekStart = getStartOfWeek(currentWeek);
    
    const groupedTasks = groupTasksByDate(tasks);
    datesContainer.innerHTML = '';

    // Update week display
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    weekDisplay.textContent = `Week of ${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

    // Add No Due Date cell
    const noDueDateCell = createNoDueDateCell(groupedTasks, selectedDate, (dateString) => {
        selectedDate = dateString;
        showTasksForDate(dateString, groupedTasks[dateString] || []);
        renderWeeklyCalendar(currentWeekStart, tasks, dateString);
    });
    datesContainer.appendChild(noDueDateCell);

    // Generate date cells
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        const cell = createDateCell(date, groupedTasks, selectedDate, (dateString) => {
            selectedDate = dateString;
            showTasksForDate(dateString, groupedTasks[dateString] || []);
            renderWeeklyCalendar(currentWeekStart, tasks, dateString);
        });
        datesContainer.appendChild(cell);
    }
}

function showTasksForDate(date, dateTasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    const dateHeader = document.createElement('h2');
    dateHeader.className = 'date-header';
    dateHeader.textContent = date === 'No Due Date' ? 
        'Tasks with No Due Date' : 
        `Tasks Due on ${new Date(date).toLocaleDateString()}`;
    taskList.appendChild(dateHeader);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = 'Show All Tasks';
    backButton.addEventListener('click', () => {
        selectedDate = null;
        const dateCells = document.querySelectorAll('.date-cell');
        dateCells.forEach(cell => cell.classList.remove('selected'));
        originalRenderTasks();
        renderWeeklyCalendar(currentWeekStart, tasks, null);
    });
    taskList.appendChild(backButton);

    if (dateTasks.length === 0) {
        const noTasks = document.createElement('div');
        noTasks.className = 'no-tasks';
        noTasks.textContent = 'No tasks for this date';
        taskList.appendChild(noTasks);
        return;
    }

    dateTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    renderWeeklyCalendar(currentWeekStart, tasks, selectedDate);
});

// Style definitions
const calendarStyles = document.createElement('style');
calendarStyles.textContent = `
    .weekly-calendar {
        margin-bottom: 2rem;
        background: #0000;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .calendar-navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .nav-button {
        padding: 0.5rem 1rem;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .nav-button:hover {
        background: #0056b3;
    }
    
    .week-display {
        font-size: 1.2rem;
        font-weight: bold;
    }
    
    .dates-container {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 0.5rem;
    }
    
    .date-cell {
        background: rgb(0, 0, 0);
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .date-cell:hover {
        background: rgb(28, 77, 126);
        transform: translateY(-2px);
    }
    
    .date-cell.selected {
        background: #007bff;
        color: white;
    }
    
    .date-cell.no-due-date {
        background: rgb(4, 4, 4);
        border: 1px dashed #ccc;
    }
    
    .date-cell.no-due-date:hover {
        background: rgb(0, 0, 0);
    }
    
    .date-cell.no-due-date.selected {
        background: rgb(8, 8, 8);
        color: white;
        border: none;
    }
    
    .day-name {
        font-weight: bold;
        margin-bottom: 0.25rem;
    }
    
    .day-number {
        font-size: 1.5rem;
        margin-bottom: 0.25rem;
    }
    
    .task-count {
        font-size: 0.875rem;
        color: #666;
    }
    
    .date-cell.selected .task-count {
        color: #fff;
    }
    
    .no-tasks {
        text-align: center;
        padding: 2rem;
        color: #666;
        font-style: italic;
    }
    
    .back-button {
        margin: 1rem 0;
        padding: 0.5rem 1rem;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .back-button:hover {
        background: #0056b3;
    }
    
    .date-header {
        color: #007bff;
        margin-bottom: 1rem;
    }
`;
document.head.appendChild(calendarStyles);

// Hook up to existing task rendering system
const originalRenderTasks = window.renderTasks || function() {};
window.renderTasks = function() {
    originalRenderTasks();
};