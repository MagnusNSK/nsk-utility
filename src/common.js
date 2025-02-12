document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
}, false);


let onTabSwitchCallbacks = [];

function registerTabSwitchCallback(callback) {
    onTabSwitchCallbacks.push(callback);
}

const DATA_DIR = 'data 1.0.0';

async function saveSettings(settings) {
    const { resourceDir, join } = window.__TAURI__.path;
    const { createDir, writeTextFile } = window.__TAURI__.fs;
    
    try {
        const resDir = await resourceDir();
        const appDir = await join(resDir, DATA_DIR);
        await createDir(appDir, { recursive: true });
        
        const filePath = await join(appDir, 'settings.json');
        await writeTextFile(filePath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

async function loadSettings() {
    const { resourceDir, join } = window.__TAURI__.path;
    const { readTextFile } = window.__TAURI__.fs;
    
    try {
        const resDir = await resourceDir();
        const filePath = await join(resDir, DATA_DIR, 'settings.json');
        const content = await readTextFile(filePath);
        return JSON.parse(content);
    } catch (error) {
        console.warn('No settings found:', error);
        return {
            lastTab: 'index.html',
            fontSize: 14,
            noteSettings: {}
        };
    }
}

async function saveLastTab(href) {
    const settings = await loadSettings();
    settings.lastTab = href;
    await saveSettings(settings);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const settings = await loadSettings();
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        if (settings.lastTab && settings.lastTab !== currentPath) {
            window.location.href = settings.lastTab;
        }
    } catch (error) {
        console.warn('Error loading settings:', error);
    }
});

window.DATA_DIR = DATA_DIR;
window.saveSettings = saveSettings;
window.loadSettings = loadSettings;

async function loadTitleBar() {
    try {
        const response = await fetch('titlebar.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Set active tab
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-button').forEach(button => {
            if (button.dataset.href === currentPath) {
                button.classList.add('active');
            }
        });

        document.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!button.classList.contains('active')) {
                    const href = button.dataset.href;
                    if (!href) return;

                    let canProceed = true;
                    for (const callback of onTabSwitchCallbacks) {
                        try {
                            const result = await callback();
                            if (!result) {
                                canProceed = false;
                                break;
                            }
                        } catch (error) {
                            console.error('Tab switch callback error:', error);
                            canProceed = false;
                            break;
                        }
                    }

                    if (canProceed) {
                        await saveLastTab(href);
                        window.location.href = href;
                    }
                }
            });
        });

        const { appWindow } = window.__TAURI__.window;
        
        document.getElementById('minimizeBtn').addEventListener('click', () => {
            appWindow.minimize();
        });

        document.getElementById('maximizeBtn').addEventListener('click', async () => {
            const isMaximized = await appWindow.isMaximized();
            if (isMaximized) {
                appWindow.unmaximize();
            } else {
                appWindow.maximize();
            }
        });

        document.getElementById('closeBtn').addEventListener('click', async () => {
            if (await handleClose()) {
                appWindow.close();
            }
        });

        document.querySelector('.titleBar-middle').addEventListener('mousedown', () => {
            appWindow.startDragging();
        });

        appWindow.listen('tauri://resize', async () => {
            const isMaximized = await appWindow.isMaximized();
            document.getElementById('maximizeBtn').textContent = isMaximized ? '[▭]' : '[□]';
        });

    } catch (error) {
        console.error('Error loading title bar:', error);
    }
}

let closeCallbacks = [];

function registerCloseCallback(callback) {
    closeCallbacks.push(callback);
}

async function handleClose() {
    let canClose = true;
    for (const callback of closeCallbacks) {
        try {
            const result = await callback();
            if (!result) {
                canClose = false;
                break;
            }
        } catch (error) {
            console.error('Close callback error:', error);
            canClose = false;
            break;
        }
    }

    if (canClose) {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        try {
            const settings = await loadSettings();
            settings.lastTab = currentPath;
            await saveSettings(settings);
        } catch (error) {
            console.error('Error saving last tab:', error);
        }
    }
    return canClose;
}

window.registerCloseCallback = registerCloseCallback;

document.addEventListener('DOMContentLoaded', loadTitleBar); 