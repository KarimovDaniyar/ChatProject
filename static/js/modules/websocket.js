// websocket.js - WebSocket connection manager for chat and notifications
import { getToken, getAuthHeaders, getCurrentUserId } from './auth.js';
import { showNotification } from './ui.js';
import { displayMessage } from './message.js';
import { fetchAndUpdateContactPreview } from './utils.js';

// Module-level state
let chatWebSocket = null;
let notificationWebSocket = null;
let currentChatId = null;
let messageContainer = null;
let contactsList = null;
let currentUser = null;
let currentContactAvatar = null;
let messageCallbacks = {};

/**
 * Initialize WebSocket module with required dependencies
 * @param {Object} config - Configuration object
 */
export function initWebSocketModule(config) {
    messageContainer = config.messageContainer;
    contactsList = config.contactsList;
    currentUser = config.currentUser;
    
    // Set default message callbacks
    messageCallbacks = {
        onMessageRead: config.onMessageRead || function() {},
        onMessageDeleted: config.onMessageDeleted || function() {},
        onMessageRefactor: config.onMessageRefactor || function() {},
        onUserListUpdate: config.onUserListUpdate || function() {},
        onPresenceChange: config.onPresenceChange || function() {}
    };
    
    // Initialize notification WebSocket
    connectNotificationWebSocket();
}

/**
 * Update current chat state and reconnect chat WebSocket
 * @param {Object} config - Configuration with chatId and avatarUrl
 */
export function updateChatState(config) {
    currentChatId = config.chatId;
    currentContactAvatar = config.contactAvatar;
    
    // Reconnect WebSocket with new chat ID
    connectChatWebSocket();
    
    return chatWebSocket;
}

/**
 * Get the current chat WebSocket instance
 * @returns {WebSocket} The current chat WebSocket
 */
export function getChatWebSocket() {
    return chatWebSocket;
}

/**
 * Connect to chat WebSocket for the current chat ID
 */
export function connectChatWebSocket() {
    if (!currentChatId) {
        console.log("No chat ID available, skipping WebSocket connection");
        return;
    }
    
    // Close existing connection if any
    if (chatWebSocket) {
        chatWebSocket.onclose = null; // Prevent reconnection attempts on intended close
        chatWebSocket.close();
    }
    
    // Create new WebSocket connection
    chatWebSocket = new WebSocket(`ws://${window.location.host}/ws/${currentChatId}?token=${getToken()}`);
    
    chatWebSocket.onopen = () => {
        console.log("WebSocket connection established for chat:", currentChatId);
    };
    
    chatWebSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleChatWebSocketMessage(data);
    };
    
    chatWebSocket.onclose = (event) => {
        console.log("WebSocket connection closed:", event);
        // No automatic reconnection to prevent reconnection loops
    };
    
    chatWebSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}

/**
 * Handle messages from the chat WebSocket
 * @param {Object} data - Message data from the WebSocket
 */
function handleChatWebSocketMessage(data) {
    switch (data.type) {
        case 'message':
            handleNewMessage(data);
            break;
        case 'message_read':
            messageCallbacks.onMessageRead(data.message_id);
            break;
        case 'user_list':
            messageCallbacks.onUserListUpdate(data.users);
            break;
        case 'presence':
            messageCallbacks.onPresenceChange(data.user_id, data.status);
            break;
        case 'message_deleted':
            messageCallbacks.onMessageDeleted(data.message_id);
            break;
        case 'message_refactor':
            messageCallbacks.onMessageRefactor(data.message_id, data.new_content);
            break;
        default:
            console.log("Unknown message type:", data.type);
    }
}

/**
 * Handle new message events
 * @param {Object} data - Message data
 */
function handleNewMessage(data) {
    console.log("Message event data:", data);
    const currentUserId = getCurrentUserId();
    const isOutgoing = data.sender_id === currentUserId;
    
    // Display the message in the chat
    displayMessage(
        data.id,
        data.content,
        data.sender_username,
        isOutgoing ? currentUser.avatar : currentContactAvatar,
        isOutgoing,
        data.timestamp,
        'message',
        data.status
    );
    
    // Mark incoming messages as read
    if (!isOutgoing && chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN && data.id) {
        chatWebSocket.send(JSON.stringify({ type: "read", message_id: data.id }));
    }
    
    // Update contact list order and preview
    updateContactListOrder(isOutgoing, data);
}

/**
 * Update contact list order and preview after new message
 * @param {boolean} isOutgoing - Whether message is outgoing
 * @param {Object} data - Message data
 */
function updateContactListOrder(isOutgoing, data) {
    const contactId = isOutgoing ? data.receiver_id : data.sender_id;
    const contactEl = contactsList.querySelector(`.contact[data-id="${contactId}"]`);
    
    if (contactEl) {
        // Move the contact to the top of the list
        contactsList.prepend(contactEl);
        // Fetch and update preview to include this new message
        fetchAndUpdateContactPreview(contactEl, contactId);
    }
}

/**
 * Connect to notification WebSocket
 */
export function connectNotificationWebSocket() {
    notificationWebSocket = new WebSocket(`ws://${window.location.host}/ws/notifications?token=${getToken()}`);
    
    notificationWebSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleNotificationMessage(data);
    };
    
    notificationWebSocket.onerror = (error) => {
        console.error('Notifications WebSocket error', error);
    };
    
    notificationWebSocket.onclose = () => {
        console.log('Notifications WebSocket closed');
    };
}

/**
 * Handle notification messages
 * @param {Object} data - Notification data
 */
function handleNotificationMessage(data) {
    switch (data.type) {
        case 'contacts_update':
            // Trigger contacts reload
            window.dispatchEvent(new CustomEvent('contacts_update'));
            break;
        case 'new_message':
            handleNewMessageNotification(data);
            break;
        case 'presence':
            updateContactPresence(data.user_id, data.status);
            break;
        default:
            console.log("Unknown notification type:", data.type);
    }
}

/**
 * Handle new message notifications (when not in the chat)
 * @param {Object} data - Notification data
 */
function handleNewMessageNotification(data) {
    const contactId = data.sender_id;
    const contactElement = contactsList.querySelector(`.contact[data-id="${contactId}"]`);
    
    if (contactElement) {
        // Move chat to top of the list
        contactsList.prepend(contactElement);
        
        // Update preview with notification content
        updateContactPreviewFromNotification(contactElement, data.content);
    }
}

/**
 * Update contact preview from notification
 * @param {Element} contactElement - Contact DOM element
 * @param {string} content - Message content
 */
function updateContactPreviewFromNotification(contactElement, content) {
    const previewElem = contactElement.querySelector('.contact-info p');
    if (!previewElem) return;
    
    let preview = '';
    // Check if it's a media message
    if (/\[Media: (.*?)\]/.test(content)) {
        if (/\.(jpg|jpeg|png|gif)$/i.test(content)) {
            preview = '📷 Photo';
        } else if (/\.(mp4|webm|ogg)$/i.test(content)) {
            preview = '🎥 Video';
        } else {
            preview = 'Attachment';
        }
    } else {
        preview = content;
    }
    
    // Truncate if too long
    if (preview.length > 30) preview = preview.slice(0, 30) + '…';
    
    previewElem.textContent = preview;
}

/**
 * Update online/offline status for a contact
 * @param {number} userId - User ID
 * @param {string} status - 'online' or 'offline'
 */
function updateContactPresence(userId, status) {
    const el = contactsList.querySelector(`.contact[data-id="${userId}"] .contact-status`);
    if (el) {
        el.classList.replace(status === 'online' ? 'offline' : 'online', status);
    }
}

/**
 * Send a message through the WebSocket
 * @param {string} type - Message type
 * @param {Object} data - Message data
 */
export function sendWebSocketMessage(type, data = {}) {
    if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
        showNotification('Connection error. Please refresh the page.');
        return false;
    }
    
    chatWebSocket.send(JSON.stringify({ type, ...data }));
    return true;
}

/**
 * Close all WebSocket connections
 */
export function closeAllConnections() {
    if (chatWebSocket) {
        chatWebSocket.onclose = null; // Prevent reconnection attempts
        chatWebSocket.close();
        chatWebSocket = null;
    }
    
    if (notificationWebSocket) {
        notificationWebSocket.onclose = null;
        notificationWebSocket.close();
        notificationWebSocket = null;
    }
}