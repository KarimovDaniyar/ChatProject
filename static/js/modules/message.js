import { getAuthHeaders, removeToken, getCurrentUserId } from './auth.js';
import { formatTimestamp } from './utils.js';
import { showNotification } from './ui.js';
import { sendWebSocketMessage, getChatWebSocket } from './websocket.js';

// Module-level state
let messageContainer;
let currentChatId;
let currentUser;
let currentContactAvatar;
let unreadToMark = [];
let displayedMessages = new Set();

// Initialize the module with required dependencies
export function initMessageModule(config) {
    messageContainer = config.messageContainer;
    currentUser = config.currentUser;
    displayedMessages = config.displayedMessages || new Set();
    unreadToMark = [];
}

// Update state when chat changes
export function updateMessageState(config) {
    currentChatId = config.currentChatId;
    currentContactAvatar = config.currentContactAvatar;
}

export async function loadMessages() {
    try {
        if (!currentChatId) {
            console.log("No chat selected");
            return;
        }
        console.log("Loading messages for chat_id:", currentChatId);
        const response = await fetch(`/messages/${currentChatId}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.log("Unauthorized, redirecting to login");
                removeToken();
                window.location.href = "/";
                return;
            }
            throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
        }
        const messages = await response.json();
        console.log("Loaded messages:", messages);
        messageContainer.innerHTML = "";
        displayedMessages.clear();

        const currentUserId = getCurrentUserId();
        unreadToMark = [];
        messages.forEach(msg => {
            const isOutgoing = msg.sender_id === currentUserId;
            displayMessage(
                msg.id,
                msg.content,
                msg.sender_username,
                msg.sender_avatar || (isOutgoing ? currentUser.avatar : currentContactAvatar),
                isOutgoing,
                msg.timestamp,
                "message",
                msg.status
            );
            // Если входящее и не прочитано — добавить в список для отметки
            if (!isOutgoing && msg.status === 0) {
                unreadToMark.push(msg.id);
            }
        });
        // Отправить событие read для всех непрочитанных
        const ws = getChatWebSocket();
        if (ws && ws.readyState === WebSocket.OPEN && unreadToMark.length > 0) {
            unreadToMark.forEach(mid => {
                sendWebSocketMessage("read", { message_id: mid });
            });
            unreadToMark = [];
        }
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

export async function sendMessage(message, mediaFiles = []) {
    try {
        // Сначала загружаем все медиа на сервер (если они есть)
        const uploadedMedia = [];
        
        if (mediaFiles.length > 0) {
            const formData = new FormData();
            
            // Добавляем все файлы в FormData
            for (let i = 0; i < mediaFiles.length; i++) {
                formData.append('files', mediaFiles[i]);
            }
            
            // Загружаем файлы на сервер
            const uploadResponse = await fetch(`/upload-media/${currentChatId}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload media files');
            }
            
            // Получаем информацию о загруженных файлах
            const uploadResult = await uploadResponse.json();
            uploadedMedia.push(...uploadResult.files);
        }
        
        // Отправляем через WebSocket
        const ws = getChatWebSocket();
        if (ws && ws.readyState === WebSocket.OPEN) {
            if (uploadedMedia.length > 0) {
                // Display each media and text message as sent
                if (uploadedMedia.length === 1) {
                    const mediaTag = ` [Media: ${uploadedMedia[0]}]`;
                    const contentWithMedia = (message || '') + mediaTag;
                    sendWebSocketMessage("message", { content: contentWithMedia });
                } else {
                    uploadedMedia.forEach((file, index) => {
                        const mediaTag = ` [Media: ${file}]`;
                        const contentForThis = index === uploadedMedia.length - 1 ? (message || '') + mediaTag : mediaTag;
                        sendWebSocketMessage("message", { content: contentForThis });
                    });
                }
            } else if (message) {
                sendWebSocketMessage("message", { content: message });
            }
        } else {
            console.error("WebSocket is not open, cannot send message");
            showNotification("Ошибка соединения. Пожалуйста, обновите страницу.");
        }
    } catch (error) {
        console.error("Send message error:", error);
        showNotification("Не удалось отправить сообщение. Пожалуйста, попробуйте еще раз.");
    }
}

export function displayMessage(messageId, message, senderName, senderAvatar, isOutgoing, timestamp, type, status) {
    if (messageId && displayedMessages.has(messageId)) {
        console.log("Message already displayed, skipping:", messageId);
        return;
    }
    if (messageId) {
        displayedMessages.add(messageId);
    }

    console.log("Displaying message:", message, "from:", senderName, "isOutgoing:", isOutgoing, "type:", type);
    const messageElement = document.createElement('div');
    if (type === "system") {
        messageElement.classList.add('message', 'system');
        messageElement.innerHTML = `
            <div class="message-bubble">
                <p>${message}</p>
                <span class="message-time">${formatTimestamp(timestamp)}</span>
            </div>
        `;
    } else {
        messageElement.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');
        let mediaHTML = '';
        const mediaRegex = /\[Media: (.*?)\]/g;
        let textContent = message;
        const mediaMatches = message.match(mediaRegex);
        if (mediaMatches) {
            mediaMatches.forEach(match => {
                const fileName = match.match(/\[Media: (.*?)\]/)[1];
                const isImage = fileName.match(/\.(jpg|jpeg|png|gif)$/i);
                const isVideo = fileName.match(/\.(mp4|webm|ogg)$/i);
                if (isImage) {
                    mediaHTML += `<img src="/static/media/${fileName}" alt="Media" class="message-media">`;
                } else if (isVideo) {
                    mediaHTML += `<video src="/static/media/${fileName}" controls class="message-media"></video>`;
                }
                textContent = textContent.replace(match, '');
            });
        }
        const textHTML = textContent.trim() ? `<p>${textContent}</p>` : '';
        let statusIcon = '';
        if (isOutgoing) {
            if (status === 1) {
                statusIcon = `<span class="message-status" title="Read"><ion-icon name="checkmark-done" style="color: #25d366; font-size: 18px; vertical-align: middle;"></ion-icon></span>`;
            } else {
                statusIcon = `<span class="message-status" title="Delivered"><ion-icon name="checkmark-outline" style="color: #b0b0b0; font-size: 18px; vertical-align: middle;"></ion-icon></span>`;
            }
        }
        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${senderAvatar}" alt="${senderName}">
            </div>
            <div class="message-bubble">
                <div class="message-sender">${senderName}</div>
                ${mediaHTML}
                ${textHTML}
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                    <span class="message-time">${formatTimestamp(timestamp)}</span>
                    ${statusIcon}
                </div>
            </div>
        `;
        if (messageId) messageElement.setAttribute('data-message-id', messageId);
    }
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Add a message editing function
export async function editMessage(messageId, newContent) {
    try {
        const response = await fetch(`/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ new_message: newContent })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update message');
        }
        
        return true;
    } catch (error) {
        console.error('Error updating message:', error);
        showNotification('Failed to update message');
        return false;
    }
}

// Add a message deletion function
export function deleteMessage(messageId) {
    return sendWebSocketMessage('message_deleted', { message_id: parseInt(messageId) });
}