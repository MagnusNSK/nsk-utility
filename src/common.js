// Disable context menu globally
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
}, false); 