const { appWindow } = window.__TAURI__.window;

document.addEventListener('DOMContentLoaded', () => {
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

    document.getElementById('closeBtn').addEventListener('click', () => {
        appWindow.close();
    });

    document.querySelector('.titleBar-middle').addEventListener('mousedown', () => {
        appWindow.startDragging();
    });

    appWindow.listen('tauri://resize', async () => {
        const isMaximized = await appWindow.isMaximized();
        document.getElementById('maximizeBtn').textContent = isMaximized ? '[▭]' : '[□]';
    });
});