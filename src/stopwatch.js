document.addEventListener('DOMContentLoaded', () => {
    const state = {
        startTime: 0,
        elapsedTime: 0,
        timerInterval: null,
        isRunning: false
    };

    const elements = {
        display: {
            hours: document.getElementById('hours'),
            minutes: document.getElementById('minutes'),
            seconds: document.getElementById('seconds')
        },
        buttons: {
            start: document.getElementById('startTimer'),
            pause: document.getElementById('pauseTimer'),
            reset: document.getElementById('resetTimer'),
            addToTracker: document.getElementById('addToTracker'),
            debug: document.getElementById('debugTime')
        }
    };

    const fsUtils = {
        async readTrackerData() {
            const { resourceDir, join } = window.__TAURI__.path;
            const { readTextFile } = window.__TAURI__.fs;
            
            const resDir = await resourceDir();
            const filePath = await join(resDir, 'data', 'tracker-data.json');
            
            try {
                const content = await readTextFile(filePath);
                return JSON.parse(content);
            } catch (error) {
                return { columnNames: ['Date'], columnTypes: ['date'] };
            }
        },

        async saveTrackerData(data, filePath) {
            const { writeTextFile } = window.__TAURI__.fs;
            await writeTextFile(filePath, JSON.stringify(data, null, 2));
        },

        async saveStopwatchState() {
            const { resourceDir, join } = window.__TAURI__.path;
            const { writeTextFile, createDir } = window.__TAURI__.fs;
            
            const resDir = await resourceDir();
            const dataDir = await join(resDir, 'data');
            await createDir(dataDir, { recursive: true });
            
            const filePath = await join(dataDir, 'stopwatch-data.json');
            await writeTextFile(filePath, JSON.stringify({
                elapsedTime: state.elapsedTime,
                isRunning: state.isRunning
            }));
        }
    };

    const timer = {
        updateDisplay() {
            const totalSeconds = Math.floor(state.elapsedTime / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            elements.display.hours.textContent = hours.toString().padStart(2, '0');
            elements.display.minutes.textContent = minutes.toString().padStart(2, '0');
            elements.display.seconds.textContent = seconds.toString().padStart(2, '0');
        },

        start() {
            if (!state.isRunning) {
                state.isRunning = true;
                state.startTime = Date.now() - state.elapsedTime;
                state.timerInterval = setInterval(() => {
                    state.elapsedTime = Date.now() - state.startTime;
                    timer.updateDisplay();
                }, 1000);

                timer.updateButtons(true);
                fsUtils.saveStopwatchState();
            }
        },

        pause() {
            if (state.isRunning) {
                state.isRunning = false;
                clearInterval(state.timerInterval);
                timer.updateButtons(false);
                fsUtils.saveStopwatchState();
            }
        },

        reset() {
            state.isRunning = false;
            clearInterval(state.timerInterval);
            state.elapsedTime = 0;
            timer.updateDisplay();
            timer.updateButtons(false, true);
            fsUtils.saveStopwatchState();
        },

        updateButtons(isRunning, isReset = false) {
            elements.buttons.start.disabled = isRunning;
            elements.buttons.pause.disabled = !isRunning;
            elements.buttons.addToTracker.disabled = isRunning || isReset;
        },

        debug() {
            const minTime = 30 * 60 * 1000;
            const maxTime = 4 * 60 * 60 * 1000;
            state.elapsedTime = Math.floor(Math.random() * (maxTime - minTime) + minTime);
            
            state.isRunning = false;
            clearInterval(state.timerInterval);
            timer.updateDisplay();
            timer.updateButtons(false);
            fsUtils.saveStopwatchState();
        }
    };

    async function addToTracker() {
        try {
            const { resourceDir, join } = window.__TAURI__.path;
            const { createDir, writeTextFile } = window.__TAURI__.fs;
            
            const resDir = await resourceDir();
            const dataDir = await join(resDir, 'data');
            await createDir(dataDir, { recursive: true });
            
            const data = await fsUtils.readTrackerData();
            const timeColumns = data.columnTypes
                ?.map((type, index) => type === 'time' && index > 0 ? { name: data.columnNames[index], index } : null)
                .filter(Boolean) ?? [];

            if (!timeColumns.length) {
                createPopup({
                    message: 'No time-based columns found in tracker.\nPlease add a time hh:mm column in the tracker first.',
                    type: 'alert'
                });
                return;
            }

            showColumnSelectionPopup(timeColumns, resDir);
        } catch (error) {
            console.error('Error loading tracker data:', error);
            createPopup({
                message: 'Error accessing tracker data.',
                type: 'alert'
            });
        }
    }

    function showColumnSelectionPopup(timeColumns, resDir) {
        const columnButtons = timeColumns.map(column => ({
            text: column.name,
            onClick: () => handleColumnSelection(column, resDir)
        }));

        createPopup({
            message: 'Select column to add to:',
            type: 'custom',
            buttons: columnButtons,
            onCancel: () => {} // Allow clicking outside to close
        });
    }

    async function handleColumnSelection(column, resDir) {
        const hours = parseInt(elements.display.hours.textContent);
        const minutes = parseInt(elements.display.minutes.textContent);
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        try {
            const { join } = window.__TAURI__.path;
            const filePath = await join(resDir, 'data', 'tracker-data.json');
            const trackerData = await fsUtils.readTrackerData();
            
            if (trackerData.tableData?.length) {
                const lastRow = trackerData.tableData[trackerData.tableData.length - 1];
                const colKey = `col${column.index}`;
                
                if (lastRow[colKey]) {
                    const [existingHours, existingMinutes] = lastRow[colKey].split(':').map(Number);
                    const totalMinutes = (existingHours * 60 + existingMinutes) + (hours * 60 + minutes);
                    lastRow[colKey] = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
                } else {
                    lastRow[colKey] = timeString;
                }
                
                await fsUtils.saveTrackerData(trackerData, filePath);
                timer.reset();
                createPopup({
                    message: `Time (${timeString}) has been added to the latest row.`,
                    type: 'alert'
                });
            } else {
                createPopup({
                    message: 'No existing rows found in tracker. Please add a row first.',
                    type: 'alert'
                });
            }
        } catch (error) {
            console.error('Error updating tracker:', error);
            createPopup({
                message: 'Error updating tracker data.',
                type: 'alert'
            });
        }
    }

    elements.buttons.start.addEventListener('click', timer.start);
    elements.buttons.pause.addEventListener('click', timer.pause);
    elements.buttons.reset.addEventListener('click', timer.reset);
    elements.buttons.addToTracker.addEventListener('click', addToTracker);
    elements.buttons.debug.addEventListener('click', timer.debug);

    async function init() {
        try {
            const { resourceDir, join } = window.__TAURI__.path;
            const { readTextFile } = window.__TAURI__.fs;
            
            const resDir = await resourceDir();
            const filePath = await join(resDir, 'data', 'stopwatch-data.json');
            const content = await readTextFile(filePath);
            const data = JSON.parse(content);
            
            state.elapsedTime = data.elapsedTime || 0;
            if (data.isRunning) {
                timer.start();
            } else {
                timer.updateDisplay();
                if (state.elapsedTime > 0) {
                    elements.buttons.addToTracker.disabled = false;
                }
            }
        } catch (error) {
            console.warn('No saved stopwatch data found:', error);
        }
    }

    init();
}); 