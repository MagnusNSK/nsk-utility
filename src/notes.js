window.showAllTabs = null;

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const lineCount = document.getElementById('line-count');
    const tabsContainer = document.getElementById('tabs');
    const fileBtn = document.getElementById('fileBtn');
    const unsavedChanges = document.createElement('span');
    unsavedChanges.className = 'unsaved-changes';
    document.getElementById('file-operations').appendChild(unsavedChanges);

    let tabs = [{ 
        id: 1, 
        content: '', 
        cursorPosition: 0, 
        filename: 'untitled',
        filepath: null,
        isModified: false,
        lastUsed: Date.now()
    }];
    let activeTab = 1;
    let filePopup = null;

    async function saveToLocalStorage() {
        try {
            const { resourceDir, join } = window.__TAURI__.path;
            const { createDir, writeTextFile } = window.__TAURI__.fs;
            
            const resDir = await resourceDir();
            const appDir = await join(resDir, 'data');
            await createDir(appDir, { recursive: true });
            
            const dataToSave = {
                tabs: tabs.map(tab => ({
                    ...tab,
                    lastModified: new Date().toISOString()
                })),
                activeTab: activeTab
            };
            
            const filePath = await join(appDir, 'notes-data.json');
            await writeTextFile(filePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    async function loadFromLocalStorage() {
        try {
            const { resourceDir, join } = window.__TAURI__.path;
            const { readTextFile } = window.__TAURI__.fs;
            
            const resDir = await resourceDir();
            const filePath = await join(resDir, 'data', 'notes-data.json');
            const content = await readTextFile(filePath);
            
            const loadedData = JSON.parse(content);
            if (loadedData.tabs && Array.isArray(loadedData.tabs)) {
                tabs = loadedData.tabs;
                activeTab = loadedData.activeTab || 1;
                
                const currentTab = tabs.find(tab => tab.id === activeTab);
                if (currentTab) {
                    editor.value = currentTab.content;
                    editor.selectionStart = editor.selectionEnd = currentTab.cursorPosition;
                }
                
                updateTabs();
                updateLineCount();
            }
        } catch (error) {
            console.warn('No saved data found:', error);
        }
    }

    function updateLineCount() {
        const lines = editor.value.split('\n');
        lineCount.textContent = `Lines: ${lines.length}`;

        if (editor.value.trim() === '') {
            editor.classList.add('empty');
        } else {
            editor.classList.remove('empty');
        }

        const currentTab = tabs.find(tab => tab.id === activeTab);
        if (currentTab) {
            const newContent = editor.value;
            if (currentTab.content !== newContent) {
                currentTab.content = newContent;
                currentTab.isModified = true;
                updateTabs();
                saveToLocalStorage();
            }
            currentTab.cursorPosition = editor.selectionStart;
        }
    }

    function reorderTabs() {
        tabs = tabs.map((tab, index) => ({
            ...tab,
            id: index + 1
        }));
        activeTab = tabs.find(tab => tab.content === editor.value).id;
        updateTabs();
    }

    function updateTabs() {
        const maxVisibleTabs = 5;
        const tabsToShow = tabs.slice(-maxVisibleTabs);
        
        let tabsHtml = '';
        
        if (tabs.length > maxVisibleTabs) {
            tabsHtml += `<span class="view-all-tabs" data-action="view-all">[view all tabs]</span> `;
        }
        
        tabsHtml += tabsToShow.map(tab => 
            `<span class="tab${tab.id === activeTab ? ' active' : ''}" 
                   data-id="${tab.id}">[${tab.filename}${tab.isModified ? '*' : ''}]</span>`
        ).join(' ');
        
        tabsContainer.innerHTML = tabsHtml;

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(parseInt(tab.dataset.id)));
        });

        document.querySelector('.view-all-tabs')?.addEventListener('click', showAllTabs);
    }

    function showFilePopup() {
        if (filePopup) {
            filePopup.remove();
            filePopup = null;
            return;
        }

        createPopup({
            message: `
                <div class="popup-buttons">
                    <div class="popup-button-container">
                        <button class="button-link" id="newTab">New Tab</button>
                        <span class="shortcut">Ctrl+T</span>
                    </div>
                    <div class="popup-button-container">
                        <button class="button-link" id="closeTab">Close Tab</button>
                        <span class="shortcut">Ctrl+W</span>
                    </div>
                    <div class="popup-button-container">
                        <button class="button-link" id="saveFile">Save File</button>
                        <span class="shortcut">Ctrl+S</span>
                    </div>
                    <div class="popup-button-container">
                        <button class="button-link" id="loadFile">Load File</button>
                        <span class="shortcut">Ctrl+O</span>
                    </div>
                </div>
            `,
            type: 'custom',
            buttons: [
                {
                    text: 'New Tab',
                    onClick: () => addNewTab()
                },
                {
                    text: 'Close Tab',
                    onClick: () => closeTab(activeTab)
                },
                {
                    text: 'Save File',
                    onClick: saveFile
                },
                {
                    text: 'Load File',
                    onClick: loadFile
                }
            ],
            onCancel: () => {}
        });
    }

    window.showAllTabs = function() {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        
        const popup = document.createElement('div');
        popup.className = 'popup';
        
        const content = document.createElement('div');
        content.className = 'popup-content';

        const sortedTabs = [...tabs].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
        
        content.innerHTML = `
            <div class="popup-buttons view-all-tabs-grid">
                ${sortedTabs.map(tab => `
                    <div class="popup-button-container">
                        <button class="button-link" data-id="${tab.id}">
                            ${tab.filename}${tab.isModified ? '*' : ''}
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        popup.appendChild(content);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        popup.querySelectorAll('.button-link').forEach(button => {
            button.addEventListener('click', () => {
                switchTab(parseInt(button.dataset.id));
                overlay.remove();
            });
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    function switchTab(id) {
        const currentTab = tabs.find(tab => tab.id === activeTab);
        if (currentTab) {
            currentTab.content = editor.value;
            currentTab.cursorPosition = editor.selectionStart;
        }

        activeTab = id;
        const newTab = tabs.find(tab => tab.id === id);
        if (newTab) {
            newTab.lastUsed = Date.now();
            editor.value = newTab.content;
            editor.selectionStart = editor.selectionEnd = newTab.cursorPosition;
            updateLineCount();
            updateTabs();
            saveToLocalStorage();
        }
    }

    function addNewTab() {
        const newId = tabs.length + 1;
        tabs.push({ 
            id: newId, 
            content: '', 
            cursorPosition: 0, 
            filename: 'untitled', 
            filepath: null, 
            isModified: false,
            lastUsed: Date.now()
        });
        switchTab(newId);
        saveToLocalStorage();
    }

    function closeTab(id) {
        if (tabs.length === 1) return;
        
        const index = tabs.findIndex(tab => tab.id === id);
        if (index !== -1) {
            tabs.splice(index, 1);
            if (id === activeTab) {
                const newTab = tabs[index - 1] || tabs[0];
                switchTab(newTab.id);
            }
            reorderTabs();
            saveToLocalStorage();
        }
    }

    async function saveFile() {
        const { save } = window.__TAURI__.dialog;
        const { writeTextFile } = window.__TAURI__.fs;
        const currentTab = tabs.find(tab => tab.id === activeTab);

        try {
            let filePath = currentTab.filepath;
            
            if (!filePath) {
                filePath = await save({
                    defaultPath: `untitled${currentTab.filename !== 'untitled' ? '.' + currentTab.filename.split('.').pop() : ''}`
                });
            }

            if (filePath) {
                await writeTextFile(filePath, editor.value);
                currentTab.filepath = filePath;
                currentTab.filename = filePath.split('\\').pop().split('/').pop();
                currentTab.isModified = false;
                updateTabs();
                saveToLocalStorage();
            }
        } catch (error) {
            console.error('Error saving file:', error);
        }
    }

    async function loadFile() {
        const { open } = window.__TAURI__.dialog;
        const { readTextFile } = window.__TAURI__.fs;

        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'All Files',
                    extensions: ['*']
                }]
            });

            if (selected) {
                const content = await readTextFile(selected);
                const filename = selected.split('\\').pop().split('/').pop();
                
                const newId = tabs.length + 1;
                tabs.push({ 
                    id: newId, 
                    content: content, 
                    cursorPosition: 0,
                    filename: filename,
                    filepath: selected,
                    isModified: false
                });
                switchTab(newId);
            }
        } catch (error) {
            console.error('Error loading file:', error);
        }
    }

    editor.addEventListener('input', updateLineCount);

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    saveFile();
                    break;
                case 'o':
                    e.preventDefault();
                    loadFile();
                    break;
                case 't':
                    e.preventDefault();
                    addNewTab();
                    break;
                case 'w':
                    e.preventDefault();
                    closeTab(activeTab);
                    break;
            }
        }
    });

    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
            updateLineCount();
        }
    });

    fileBtn.addEventListener('click', showFilePopup);

    updateLineCount();
    updateTabs();

    loadFromLocalStorage();
}); 