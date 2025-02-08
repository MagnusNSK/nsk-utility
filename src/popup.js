function createPopup(options) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    
    const popup = document.createElement('div');
    popup.className = 'popup';
    
    const content = document.createElement('div');
    content.className = 'popup-content';
    content.innerHTML = options.message;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'popup-buttons';
    
    if (options.type === 'confirm') {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'button-link';
        confirmBtn.textContent = options.confirmText || 'OK';
        confirmBtn.onclick = () => {
            document.body.removeChild(overlay);
            if (options.onConfirm) options.onConfirm();
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'button-link';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            if (options.onCancel) options.onCancel();
        };
        
        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);
    } else if (options.type === 'custom' && Array.isArray(options.buttons)) {
        options.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = 'button-link';
            btn.textContent = button.text;
            btn.onclick = () => {
                document.body.removeChild(overlay);
                if (button.onClick) button.onClick();
            };
            buttonContainer.appendChild(btn);
        });
    } else {
        const okBtn = document.createElement('button');
        okBtn.className = 'button-link';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            document.body.removeChild(overlay);
            if (options.onClose) options.onClose();
        };
        
        buttonContainer.appendChild(okBtn);
    }
    
    popup.appendChild(content);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    
    // Add click handler to overlay
    overlay.addEventListener('click', (e) => {
        // If the click is directly on the overlay (not on popup or its children)
        if (e.target === overlay) {
            document.body.removeChild(overlay);
            if (options.onCancel) options.onCancel();
        }
    });

    // Add click handler to popup for preventing click propagation
    popup.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.body.appendChild(overlay);
} 