// ui.js - UI utilities and notifications

// Display a notification
export function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }, 100);
}

// Enable messaging interface with optional elements
export function enableMessaging(elements = {}) {
    const { 
        messageInput = document.querySelector("#message-text"),
        sendButton = document.querySelector("#send-button"),
        mediaButton = document.getElementById('media-button'),
        emojiButton = document.querySelector('.emoji-button'),
        userMenuBtn = document.getElementById('user-menu-btn'),
        noChatPlaceholder = document.querySelector('#no-chat-selected'),
        headerAvatar = document.querySelector('.current-contact .contact-avatar img')
    } = elements;
    
    messageInput.disabled = false;
    sendButton.disabled = false;
    mediaButton.disabled = false;
    emojiButton.disabled = false;
    userMenuBtn.disabled = false;
    
    noChatPlaceholder.style.display = 'none';
    
    if (headerAvatar) {
        headerAvatar.style.visibility = 'visible';
    }
    
    // Remove disabled visual styling
    messageInput.classList.remove('disabled');
    sendButton.classList.remove('disabled');
    mediaButton.classList.remove('disabled');
    emojiButton.classList.remove('disabled');
    userMenuBtn.classList.remove('disabled');
}

// Disable messaging interface with optional elements
export function disableMessaging(elements = {}) {
    const { 
        messageInput = document.querySelector("#message-text"),
        sendButton = document.querySelector("#send-button"),
        mediaButton = document.getElementById('media-button'),
        emojiButton = document.querySelector('.emoji-button'),
        userMenuBtn = document.getElementById('user-menu-btn'),
        noChatPlaceholder = document.querySelector('#no-chat-selected'),
        headerAvatar = document.querySelector('.current-contact .contact-avatar img')
    } = elements;
    
    messageInput.disabled = true;
    sendButton.disabled = true;
    mediaButton.disabled = true;
    emojiButton.disabled = true;
    userMenuBtn.disabled = true;
    
    noChatPlaceholder.style.display = 'flex';
    
    if (headerAvatar) {
        headerAvatar.style.visibility = 'hidden';
    }
    
    // Add disabled visual styling
    messageInput.classList.add('disabled');
    sendButton.classList.add('disabled');
    mediaButton.classList.add('disabled');
    emojiButton.classList.add('disabled');
    userMenuBtn.classList.add('disabled');
}