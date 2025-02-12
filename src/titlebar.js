const { appWindow } = window.__TAURI__.window;

appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    if (await handleClose()) {
        appWindow.close();
    }
});