const { invoke } = window.__TAURI__.tauri;
const { save, open } = window.__TAURI__.dialog;
const { writeTextFile, readTextFile, createDir } = window.__TAURI__.fs;
const { appDataDir, resourceDir, join } = window.__TAURI__.path;

let tableData = [];
let testDate = new Date();
let wantedHoursPerDay = [0];
let columnNames = ['Date', 'Col 1'];
let columnTypes = ['date', 'time'];

function showAddColumnForm() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    
    const form = document.createElement('div');
    form.className = 'form-container';
    form.innerHTML = `
                <input type="text" id="columnName" placeholder="column name">
                <div class="button-group">
                    <button type="button" class="button-link" onclick="addColumnType('time')">HH:MM Time Based Entry</button>
                    <button type="button" class="button-link" onclick="addColumnType('number')">5 Digit Based Entry</button>
                </div>
            `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);
}

function addColumnType(type) {
    let name = document.getElementById('columnName').value.trim();
    if (!name) {
        name = `Col ${columnNames.length}`;
    }
    addColumn(type, name);
    document.body.removeChild(document.querySelector('.overlay'));
}

function addColumn(type, name) {
    const newIndex = columnNames.length;
    columnNames.push(name);
    columnTypes.push(type);
    wantedHoursPerDay.push(0);
    
    tableData.forEach(row => {
        row[`col${newIndex}`] = null;
    });
    
    updateTable();
    saveToLocalStorage();
}

function deleteColumn(index) {
    if (index === 0) return;
    columnNames.splice(index, 1);
    columnTypes.splice(index, 1);
    wantedHoursPerDay.splice(index - 1, 1);
    
    tableData = tableData.map(row => {
        let newRow = { ...row };
        for (let i = index; i < columnNames.length; i++) {
            newRow[`col${i}`] = row[`col${i+1}`];
        }
        delete newRow[`col${columnNames.length}`];
        return newRow;
    });
    
    updateTable();
    saveToLocalStorage();
}

function addRow() {
    let date = document.getElementById('dateInput').value;
    let values = [];
    for (let i = 1; i < columnNames.length; i++) {
        values.push(document.getElementById(`input${i}`).value);
    }
    
    const stopwatchData = localStorage.getItem('stopwatchTime');
    if (stopwatchData) {
        const { columnIndex, time } = JSON.parse(stopwatchData);
        values[columnIndex - 1] = time;
        localStorage.removeItem('stopwatchTime');
    }
    
    if (date || values.some(value => value)) {
        if (date) {
            date = formatDate(date);
            let newRow = { date };
            values.forEach((value, index) => {
                newRow[`col${index + 1}`] = value ? formatValue(value, columnTypes[index + 1]) : null;
            });
            tableData.push(newRow);
        } else if (tableData.length > 0) {
            const lastEntry = tableData[tableData.length - 1];
            values.forEach((value, index) => {
                if (value) {
                    value = formatValue(value, columnTypes[index + 1]);
                    const colKey = `col${index + 1}`;
                    lastEntry[colKey] = lastEntry[colKey] ? addValues(lastEntry[colKey], value, columnTypes[index + 1]) : value;
                }
            });
        }
        updateTable();
        saveToLocalStorage();
        clearInputs();
    }
}

function deleteLastRow() {
    if (tableData.length > 0) {
        tableData.pop();
        updateTable();
        saveToLocalStorage();
    }
}

function updateTable() {
    console.log("Updating table");
    let markdown = "";
    let currentMonth = '';
    let monthlyTotal = Array(columnNames.length - 1).fill(0);
    let cumulativeTotal = Array(columnNames.length - 1).fill(0);
    let daysLogged = 0;
    let lastDate = '';
    let monthlyWanted = Array(columnNames.length - 1).fill(0);
    let firstDate = null;

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

    markdown += "Column Names and Anticipated Value:\n";
    for (let i = 1; i < columnNames.length; i++) {
        markdown += `<input type='text' id='colName${i}' value='${columnNames[i]}' class='column-input' tabindex='${2*i-1}'>: `;
        markdown += `<input type='text' id='wantedInput${i}' value='${wantedHoursPerDay[i-1]}' class='wanted-input' tabindex='${2*i}'> `;
        markdown += `<span onclick="deleteColumn(${i})" class="delete-column">[-]</span> `;
    }
    markdown += `<span onclick="showAddColumnForm()" class="add-column">[+]</span>\n\n`;

    tableData.forEach((row, index) => {
        let [month, day] = row.date.split('/');
        
        if (!firstDate) {
            firstDate = new Date(new Date().getFullYear(), parseInt(month) - 1, parseInt(day));
        }
        
        if (month !== currentMonth) {
            if (currentMonth !== '') {
                let totalTime = monthlyTotal.map((total, index) => formatTotal(total, columnTypes[index + 1]));
                let monthName = monthNames[parseInt(currentMonth) - 1];
                let daysInMonth = new Date(new Date().getFullYear(), parseInt(currentMonth), 0).getDate();
                
                markdown += "|" + "=".repeat(20 * columnNames.length) + "|\n";
                markdown += `End of ${monthName}\n`;
                markdown += `Days Logged: ${daysLogged.toString().padStart(2, '0')}/${daysInMonth.toString().padStart(2, '0')}`;
                
                for (let i = 0; i < columnNames.length - 1; i++) {
                    try {
                        let diff = calculateDiff(totalTime[i], wantedHoursPerDay[i], daysLogged, columnTypes[i + 1]);
                        let diffPercentage = calculateDiffPercentage(diff, wantedHoursPerDay[i], daysLogged);
                        let sign = diff >= 0 ? '+' : '-';
                        markdown += `  ${totalTime[i]}  <span class="percentage" style="font-size: 0.8em;">${sign}${Math.abs(diffPercentage).toFixed(2)}%</span>`;
                    } catch (error) {
                        console.error(`Error calculating diff for column ${i + 1}:`, error);
                        markdown += `  ${totalTime[i]}  <span class="percentage" style="font-size: 0.8em;">N/A</span>`;
                    }
                    if (i < columnNames.length - 2) markdown += "  ";
                }
                markdown += "\n" + "|" + "=".repeat(20 * columnNames.length);
                markdown += "|\n";
            }
            currentMonth = month;
            daysLogged = 0;
            monthlyTotal = Array(columnNames.length - 1).fill(0);
            monthlyWanted = Array(columnNames.length - 1).fill(0);
        }
        
        let values = columnNames.slice(1).map(name => row[`col${columnNames.indexOf(name)}`]);
        let allColumnsHaveValue = values.every(value => value !== null && value !== undefined);
        
        if (allColumnsHaveValue) {
            daysLogged++;
        }
        
        markdown += `|${row.date.padEnd(13)}|`;
        values.forEach((value, index) => {
            if (value !== null && value !== undefined) {
                try {
                    let formattedValue = formatValue(value, columnTypes[index + 1]);
                    let wantedValue = calculateWantedValue(wantedHoursPerDay[index], columnTypes[index + 1]);
                    let diff = calculateDiff(value, wantedHoursPerDay[index], 1, columnTypes[index + 1]);
                    let percentageDisplay = calculatePercentageDisplay(diff, wantedValue);
                    
                    markdown += `<span class="data-cell">${formattedValue.padEnd(7)}<span class="percentage" style="font-size: 0.8em;">${percentageDisplay}</span></span>|`;
                    
                    monthlyTotal[index] += parseValue(value, columnTypes[index + 1]);
                    cumulativeTotal[index] += parseValue(value, columnTypes[index + 1]);
                    monthlyWanted[index] += wantedValue;
                } catch (error) {
                    console.error(`Error processing value for column ${index + 1}:`, error);
                    markdown += `<span class="data-cell null-cell">ERROR</span>|`;
                }
            } else {
                markdown += `<span class="data-cell null-cell">NULL</span>|`;
            }
        });
        markdown += "\n";

        lastDate = row.date;
    });

    markdown += "|" + "=".repeat(20 * columnNames.length) + "|\n";
    markdown += `<span class="column-header">${columnNames[0]}</span>`;
    for (let i = 1; i < columnNames.length; i++) {
        markdown += `<span class="column-header">${columnNames[i]}</span>`;
    }
    markdown += "\n";

    markdown += `<span class="column-input-container"><input type='text' id='dateInput' placeholder='mm/dd' style='width:100%;' autocomplete='off' data-form-type='other'></span>`;
    for (let i = 1; i < columnNames.length; i++) {
        markdown += `<span class="column-input-container"><input type='text' id='input${i}' placeholder='${columnTypes[i] === 'time' ? 'hh:mm' : '00000'}' style='width:100%;' autocomplete='off' data-form-type='other'></span>`;
    }
    markdown += "\n\n";

    markdown += `<span class="column-header">Streak</span>`;
    for (let i = 1; i < columnNames.length; i++) {
        markdown += `<span class="column-header">Cumulative</span>`;
    }
    markdown += "\n";

    const streak = calculateStreak();
    let cumulativeStrings = cumulativeTotal.map((total, index) => formatTotal(total, columnTypes[index + 1]));
    let projectedTimes = calculateProjectedTimes(firstDate, wantedHoursPerDay);

    markdown += `<span class="column-header">${streak}</span>`;
    for (let i = 0; i < columnNames.length - 1; i++) {
        markdown += `<span class="column-header">${cumulativeStrings[i]} <span class="percentage" style="font-size: 0.8em;"> ${projectedTimes[i]}</span></span>`;
    }
    markdown += "\n";
    markdown += "- ".repeat(10 * columnNames.length) + "\n\n";

    document.getElementById('markdownOutput').innerHTML = markdown;

    document.getElementById('dateInput').addEventListener('keypress', handleDateInputKeyPress);
    for (let i = 1; i < columnNames.length; i++) {
        document.getElementById(`colName${i}`).addEventListener('change', (event) => handleColumnNameChange(event, i));
        document.getElementById(`wantedInput${i}`).addEventListener('change', (event) => handleWantedChange(event, i-1));
        document.getElementById(`input${i}`).addEventListener('keypress', (event) => handleInputKeyPress(event, i));
    }

    updateCurrentDateTime();

    console.log("Table updated");
}

function calculateProjectedTimes(firstDate, wantedHoursPerDay) {
    if (!firstDate) return Array(wantedHoursPerDay.length).fill('00:00');

    const endOfYear = new Date(new Date().getFullYear(), 11, 31);
    const totalDays = Math.ceil((endOfYear - firstDate) / (1000 * 60 * 60 * 24)) + 1;

    return wantedHoursPerDay.map((wanted, index) => {
        if (columnTypes[index + 1] === 'time') {
            const totalMinutes = wanted * 60 * totalDays;
            const projectedHours = Math.floor(totalMinutes / 60);
            const projectedMinutes = Math.round(totalMinutes % 60);
            return `${projectedHours.toString().padStart(2, '0')}:${projectedMinutes.toString().padStart(2, '0')}`;
        } else {
            return (wanted * totalDays).toFixed(0).padStart(5, '0');
        }
    });
}

function handleWantedChange(event, index) {
    let newValue = parseFloat(event.target.value);
    if (!isNaN(newValue) && newValue >= 0) {
        wantedHoursPerDay[index] = newValue;
        saveToLocalStorage();
        updateTable();
    } else {
        alert("Please enter a valid non-negative number.");
        event.target.value = wantedHoursPerDay[index];
    }
}

function handleDateInputKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addRow();
    }
}

function handleInputKeyPress(event, columnIndex) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addRow();
    }
}

function handleColumnNameChange(event, columnIndex) {
    let newName = event.target.value.trim();
    if (newName) {
        columnNames[columnIndex] = newName;
        saveToLocalStorage();
        updateTable();
    }
}

function calculateStreak() {
    if (tableData.length === 0) return 0;
    let streak = 0;
    let lastDate = parseDate(tableData[tableData.length - 1].date);
    for (let i = tableData.length - 1; i >= 0; i--) {
        const currentDate = parseDate(tableData[i].date);
        const allColumnsHaveValue = Object.keys(tableData[i])
            .filter(key => key !== 'date')
            .every(key => tableData[i][key] !== null && tableData[i][key] !== undefined);
        
        if (allColumnsHaveValue && (i === tableData.length - 1 || isConsecutiveDay(lastDate, currentDate))) {
            streak++;
            lastDate = currentDate;
        } else {
            break;
        }
    }
    return streak;
}

function parseDate(dateString) {
    const [month, day] = dateString.split('/').map(Number);
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, month - 1, day);
}

function isConsecutiveDay(date1, date2) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((date1 - date2) / oneDayMs);
    return diffDays === 1 || (date2.getMonth() === 11 && date2.getDate() === 31 && date1.getMonth() === 0 && date1.getDate() === 1);
}

function updateCurrentDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    const localDate = now.toLocaleString('ja-JP', options);
    document.getElementById('currentDate').textContent = localDate;

    updateTime();
    setInterval(updateTime, 1000);
}

function updateTime() {
    const now = new Date();
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const timeString = now.toLocaleTimeString('ja-JP', timeOptions);
    document.getElementById('currentTime').textContent = timeString;
}

async function saveToFile() {
    try {
        const dataToSave = {
            tableData: tableData,
            wantedHoursPerDay: wantedHoursPerDay,
            columnNames: columnNames,
            columnTypes: columnTypes
        };
        const content = JSON.stringify(dataToSave);
        
        const filePath = await save({
            filters: [{
                name: 'JSON',
                extensions: ['json']
            }],
            defaultPath: `nsk_chart${new Date().toISOString().split('T')[0]}.json`
        });
        
        if (filePath) {
            await writeTextFile(filePath, content);
            createPopup({
                message: 'File saved successfully!',
                type: 'alert'
            });
        }
    } catch (error) {
        createPopup({
            message: 'Error saving file: ' + error.message,
            type: 'alert'
        });
    }
}

async function loadFromFile() {
    try {
        createPopup({
            message: 'Loading a file will overwrite all current data. Do you want to continue?',
            type: 'confirm',
            confirmText: 'Load',
            cancelText: 'Cancel',
            onConfirm: async () => {
                const selected = await open({
                    filters: [{
                        name: 'JSON',
                        extensions: ['json']
                    }]
                });
                
                if (selected) {
                    const content = await readTextFile(selected);
                    const loadedData = JSON.parse(content);
                    
                    if (loadedData.tableData && Array.isArray(loadedData.wantedHoursPerDay) && 
                        Array.isArray(loadedData.columnNames) && Array.isArray(loadedData.columnTypes)) {
                        tableData = loadedData.tableData;
                        wantedHoursPerDay = loadedData.wantedHoursPerDay;
                        columnNames = loadedData.columnNames;
                        columnTypes = loadedData.columnTypes;
                        updateTable();
                        saveToLocalStorage();
                        
                        createPopup({
                            message: 'File loaded successfully!',
                            type: 'alert'
                        });
                    } else {
                        createPopup({
                            message: 'The selected file contains invalid data.',
                            type: 'alert'
                        });
                    }
                }
            }
        });
    } catch (error) {
        createPopup({
            message: 'Error loading file: ' + error.message,
            type: 'alert'
        });
    }
}

async function saveToLocalStorage() {
    try {
        const resDir = await resourceDir();
        const appDir = await join(resDir, window.DATA_DIR);
        await createDir(appDir, { recursive: true });
        
        const dataToSave = {
            tableData,
            columnNames,
            columnTypes,
            wantedHoursPerDay
        };
        
        const filePath = await join(appDir, 'tracker-data.json');
        await writeTextFile(filePath, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('Error saving to storage:', error);
    }
}

async function loadFromLocalStorage() {
    try {
        const resDir = await resourceDir();
        const filePath = await join(resDir, window.DATA_DIR, 'tracker-data.json');
        const content = await readTextFile(filePath);
        
        const loadedData = JSON.parse(content);
        if (loadedData) {
            tableData = loadedData.tableData || [];
            columnNames = loadedData.columnNames || ['Date'];
            columnTypes = loadedData.columnTypes || ['date'];
            wantedHoursPerDay = loadedData.wantedHoursPerDay || [0];
            updateTable();
        }
    } catch (error) {
        console.warn('No saved data found:', error);
    }
}

function addTestData() {
    if (tableData.length > 0) {
        const latestDateStr = tableData[tableData.length - 1].date;
        const [month, day] = latestDateStr.split('/').map(Number);
        testDate = new Date(new Date().getFullYear(), month - 1, day + 1);
    } else {
        testDate = new Date();
    }

    const date = `${(testDate.getMonth() + 1).toString().padStart(2, '0')}/${testDate.getDate().toString().padStart(2, '0')}`;
    let newRow = { date };
    
    for (let i = 1; i < columnNames.length; i++) {
        if (columnTypes[i] === 'time') {
            const randomHours = Math.floor(Math.random() * 3);
            const randomMinutes = Math.floor(Math.random() * 60);
            newRow[`col${i}`] = `${randomHours.toString().padStart(2, '0')}:${randomMinutes.toString().padStart(2, '0')}`;
        } else {
            newRow[`col${i}`] = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        }
    }
    
    tableData.push(newRow);
    updateTable();
    saveToLocalStorage();

    testDate.setDate(testDate.getDate() + 1);
}

function formatValue(value, type) {
    if (type === 'time') {
        return formatTime(value);
    } else if (type === 'number') {
        return value.padStart(5, '0').slice(-5);
    }
    return value;
}

function addValues(value1, value2, type) {
    if (type === 'time') {
        return addTimes(value1, value2);
    } else if (type === 'number') {
        return (parseInt(value1) + parseInt(value2)).toString().padStart(5, '0').slice(-5);
    }
    return value2;
}

function deleteAllData() {
    createPopup({
        message: 'Delete all data? This action cannot be undone.',
        type: 'confirm',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: async () => {
            tableData = [];
            testDate = new Date();
            wantedHoursPerDay = [0];
            columnNames = ['Date', 'Col 1'];
            columnTypes = ['date', 'time'];
            await saveToLocalStorage();
            updateTable();
        }
    });
}

function formatDate(date) {
    const parts = date.split(/[:/\-]/);
    if (parts.length === 2) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        return `${month}/${day}`;
    }
    return date;
}

function formatTime(time) {
    const parts = time.split(/[:/\-]/);
    if (parts.length === 2) {
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    return time;
}

function addTimes(time1, time2) {
    const [hours1, minutes1] = time1.split(':').map(Number);
    const [hours2, minutes2] = time2.split(':').map(Number);
    let totalMinutes = (hours1 + hours2) * 60 + minutes1 + minutes2;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatTotal(total, type) {
    if (type === 'time') {
        const hours = Math.floor(total / 60);
        const minutes = total % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else {
        return total.toString().padStart(5, '0');
    }
}

function calculateDiff(value, wanted, days, type) {
    if (type === 'time') {
        const [hours, minutes] = value.split(':').map(Number);
        const actualMinutes = hours * 60 + minutes;
        const wantedMinutes = wanted * 60 * days;
        return actualMinutes - wantedMinutes;
    } else {
        return parseInt(value) - (wanted * days);
    }
}

function calculateDiffPercentage(diff, wanted, days) {
    const wantedTotal = wanted * days;
    return wantedTotal !== 0 ? (diff / wantedTotal) * 100 : 0;
}

function calculateWantedValue(wanted, type) {
    if (type === 'time') {
        return wanted * 60;
    } else {
        return wanted;
    }
}

function calculatePercentageDisplay(diff, wanted) {
    if (wanted === 0) return '00.00%';
    const percentage = ((diff / wanted) * 100).toFixed(2);
    const sign = diff >= 0 ? '+' : '-';
    return `${sign}${Math.abs(percentage)}%`;
}

function parseValue(value, type) {
    if (type === 'time') {
        const [hours, minutes] = value.split(':').map(Number);
        return hours * 60 + minutes;
    } else {
        return parseInt(value);
    }
}

function clearInputs() {
    document.getElementById('dateInput').value = '';
    for (let i = 1; i < columnNames.length; i++) {
        document.getElementById(`input${i}`).value = '';
    }
    document.getElementById('dateInput').focus();
}

window.addRow = addRow;
window.deleteLastRow = deleteLastRow;
window.deleteAllData = deleteAllData;
window.saveToFile = saveToFile;
window.loadFromFile = loadFromFile;
window.addTestData = addTestData;
window.showAddColumnForm = showAddColumnForm;
window.addColumnType = addColumnType;
window.addColumn = addColumn;
window.deleteColumn = deleteColumn;

loadFromLocalStorage();
updateTable();
