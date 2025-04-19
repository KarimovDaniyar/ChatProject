document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log("No token found, redirecting to login");
        window.location.href = "/";
        return;
    }

    let currentChatId = null; // Добавьте эту переменную
    let currentContactUsername = null; // Для хранения выбранного контакта
    const messageContainer = document.querySelector("#message-container");
    const messageInput = document.querySelector("#message-text");
    const sendButton = document.querySelector("#send-button");
    const activeUsersList = document.querySelector("#active-users-list");
    const contactsList = document.querySelector('.contacts-list');

    const currentUser = {
        name: 'You',
        avatar: '/static/images/avatar.png'
    };

    const selectedMedia = [];
    const mediaInput = document.getElementById('media-input');
    const mediaButton = document.getElementById('media-button');
    const mediaPreviewContainer = document.getElementById('media-preview-container');
    const mediaPreviewContent = document.getElementById('media-preview-content');
    const closePreviewBtn = document.getElementById('close-preview');
    const mediaLightbox = document.getElementById('media-lightbox');
    const lightboxContent = document.querySelector('.lightbox-content');
    const closeLightboxBtn = document.getElementById('close-lightbox');
    const downloadMediaBtn = document.getElementById('download-media');

    const emojiButton = document.querySelector('.emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const closeEmojiPickerBtn = document.getElementById('close-emoji-picker');
    const emojiGrid = document.getElementById('emoji-grid');
    const emojiLoading = document.querySelector('.emoji-loading');
    let emojisLoaded = false;
    const API_KEY = '5ea1113c8ca5c111a97f7be1af7b95886bd84898';
    const API_URL = `https://emoji-api.com/emojis?access_key=${API_KEY}`;

    const addUserButton = document.getElementById('add-user');
    const addUserContainer = document.getElementById('add-user-container');
    const cancelAddContact = document.getElementById('cancel-add-contact');
    const addContactBtn = document.getElementById('add-contact-btn');
    const newContactNameInput = document.getElementById('new-contact-name');
    const addGroupButton = document.getElementById('add-group');
    const addGroupContainer = document.getElementById('add-group-container');
    const cancelAddGroup = document.getElementById('cancel-add-group');
    const addGroupBtn = document.getElementById('add-group-btn');
    const newGroupNameInput = document.getElementById('new-contact-name');
    const editProfileButton = document.getElementById('edit-profile');
    const editProfileContainer = document.getElementById('edit-profile-container');
    const cancelEditProfile = document.getElementById('cancel-edit-profile');
    const saveProfileBtn = document.getElementById('save-profile');
    const editUsernameInput = document.getElementById('edit-username');
    const editEmailInput = document.getElementById('edit-email');
    const editPasswordInput = document.getElementById('edit-password');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');

    // Хранилище для идентификаторов отображённых сообщений
    const displayedMessages = new Set();

    function getCurrentUserId() {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.sub;
        } catch (error) {
            console.error("Error decoding token:", error);
            return null;
        }
    }

    const currentUsername = getCurrentUserId();
    if (currentUsername) {
        document.querySelector('.profile-info h3').textContent = currentUsername;
    }

    async function loadContacts() {
        try {
            console.log("Loading contacts...");
            // Изменяем запрос на получение контактов вместо всех пользователей
            const response = await fetch("/contacts", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Unauthorized, redirecting to login");
                    localStorage.removeItem("token");
                    window.location.href = "/";
                    return;
                }
                throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
            }
            const contacts = await response.json();
            console.log("Loaded contacts:", contacts);
            contactsList.innerHTML = "";
            
            // Если у пользователя нет контактов, показываем сообщение
            if (contacts.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.classList.add('empty-contacts');
                emptyMessage.innerHTML = `
                    <div class="empty-contacts-message">
                        <p>У вас пока нет контактов</p>
                        <p>Нажмите кнопку "Добавить контакт" в меню</p>
                    </div>
                `;
                contactsList.appendChild(emptyMessage);
                return;
            }

            // Отображаем контакты из полученного списка
            contacts.forEach(contact => {
                const contactElement = document.createElement('div');
                contactElement.classList.add('contact');
                contactElement.setAttribute('data-username', contact.username);
                contactElement.setAttribute('data-id', contact.id);
                contactElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="/static/images/avatar.png" alt="${contact.username}">
                    </div>
                    <div class="contact-info">
                        <h3>${contact.username}</h3>
                        <p>Offline</p>
                    </div>
                    <div class="contact-status offline"></div>
                `;
                contactsList.appendChild(contactElement);
            });

            const contactElements = document.querySelectorAll('.contact');
            contactElements.forEach(contact => {
                contact.addEventListener('click', function() {
                    contactElements.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    const contactName = this.querySelector('.contact-info h3').textContent;
                    const contactImg = this.querySelector('.contact-avatar img').src;
                    const isOnline = this.querySelector('.contact-status.online') !== null;
                    const contactId = this.getAttribute('data-id');
                    
                    // Сохраняем текущий выбранный контакт
                    currentContactUsername = contactName;
                    
                    // Устанавливаем chatId на основе имени пользователя
                    // Используем простой хеш, чтобы получить уникальный ID
                    currentChatId = hashString(currentUsername + '_' + contactName);
                    
                    // Обновляем заголовок чата
                    document.querySelector('.current-contact .contact-info h3').textContent = contactName;
                    document.querySelector('.current-contact .contact-info p').textContent = isOnline ? 'Online' : 'Offline';
                    document.querySelector('.current-contact .contact-avatar img').src = contactImg;
                    
                    // Переподключаемся к WebSocket с новым chatId
                    reconnectWebSocket();
                    
                    // Загружаем сообщения для данного чата
                    loadMessages();
                });
            });

            if (contacts.length > 0) {
                contacts[0].click();
            }
        } catch (error) {
            console.error("Error loading contacts:", error);
        }
    }

    // Функция для хеширования строки и получения числового ID
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash); // Возвращаем положительное число
    }

    // Функция для переподключения WebSocket с новым chatId
    function reconnectWebSocket() {
        if (ws) {
            ws.close();
        }
        
        ws = new WebSocket(`ws://${window.location.host}/ws/${currentChatId}?token=${token}`);
        
        ws.onopen = () => {
            console.log("WebSocket connection established for chat:", currentChatId);
        };
        
        ws.onmessage = (event) => {
            console.log("Received WebSocket message:", event.data);
            const message = JSON.parse(event.data);
            
            // Остальной код обработки сообщений...
            const isOutgoing = message.username === getCurrentUserId();
            const messageId = message.id || `${message.username}-${message.content}-${Date.now()}`;
            displayMessage(
                messageId,
                message.content,
                message.username,
                isOutgoing ? currentUser.avatar : '/static/images/avatar.png',
                isOutgoing,
                message.timestamp || new Date().toISOString(),
                message.type || "message"
            );
            const contactElement = document.querySelector(`.contact[data-username="${message.username}"]`);
            if (contactElement) {
                const statusElement = contactElement.querySelector('.contact-status');
                statusElement.classList.remove('offline');
                statusElement.classList.add('online');
                contactElement.querySelector('.contact-info p').textContent = 'Online';
            }
        };
        
        ws.onclose = (event) => {
            console.log("WebSocket connection closed:", event);
        };
        
        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    async function loadMessages() {
        try {
            // Проверяем, выбран ли контакт
            if (!currentChatId) {
                console.log("No chat selected");
                return;
            }
            
            console.log("Loading messages for chat_id:", currentChatId);
            const response = await fetch(`/messages/${currentChatId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Unauthorized, redirecting to login");
                    localStorage.removeItem("token");
                    window.location.href = "/";
                    return;
                }
                throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
            }
            const messages = await response.json();
            console.log("Loaded messages:", messages);
            messageContainer.innerHTML = "";
            displayedMessages.clear();
            messages.forEach(msg => {
                const isOutgoing = msg.username === getCurrentUserId();
                displayMessage(msg.id, msg.content, msg.username, isOutgoing ? currentUser.avatar : '/static/images/avatar.png', isOutgoing, msg.timestamp, "message");
            });
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    }

    let ws = null;
    sendButton.addEventListener("click", async () => {
        const content = messageInput.value.trim();
        
        // Проверяем, выбран ли контакт
        if (!currentChatId || !currentContactUsername) {
            console.log("No contact selected");
            return;
        }
        
        if (content || selectedMedia.length > 0) {
            await sendMessage(content, selectedMedia);
            messageInput.value = "";
            mediaPreviewContainer.classList.add('hidden');
            mediaPreviewContent.innerHTML = '';
            selectedMedia.length = 0;
        }
    });

    messageInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const content = messageInput.value.trim();
            if (content || selectedMedia.length > 0) {
                await sendMessage(content, selectedMedia);
                messageInput.value = '';
                mediaPreviewContainer.classList.add('hidden');
                mediaPreviewContent.innerHTML = '';
                selectedMedia.length = 0;
            }
        }
    });

    // Изменяем функцию отправки сообщения для поддержки загрузки медиа
    async function sendMessage(message, mediaFiles = []) {
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
                    headers: {
                        "Authorization": `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload media files');
                }
                
                // Получаем информацию о загруженных файлах
                const uploadResult = await uploadResponse.json();
                uploadedMedia.push(...uploadResult.files);
            }
            
            // Формируем текст сообщения с метками для медиа
            let content = message || '';
            
            // Добавляем метки медиа к сообщению
            if (uploadedMedia.length > 0) {
                content += uploadedMedia.map(file => ` [Media: ${file}]`).join('');
            }
            
            // Отправляем сообщение через WebSocket
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    content: content,
                    type: "message"
                }));
            } else {
                console.error("WebSocket is not open, cannot send message");
                showNotification("Ошибка соединения. Пожалуйста, обновите страницу.");
            }
        } catch (error) {
            console.error("Send message error:", error);
            showNotification("Не удалось отправить сообщение. Пожалуйста, попробуйте еще раз.");
        }
    }

    function displayMessage(messageId, message, senderName, senderAvatar, isOutgoing, timestamp, type) {
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
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <img src="${senderAvatar}" alt="${senderName}">
                </div>
                <div class="message-bubble">
                    <div class="message-sender">${senderName}</div>
                    ${mediaHTML}
                    ${textHTML}
                    <span class="message-time">${formatTimestamp(timestamp)}</span>
                </div>
            `;
        }
        messageContainer.appendChild(messageElement);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    function formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                console.error("Invalid timestamp:", timestamp);
                return "Invalid time";
            }
            return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (error) {
            console.error("Error formatting timestamp:", timestamp, error);
            return "Invalid time";
        }
    }

    addUserButton.addEventListener('click', function() {
        addUserContainer.classList.remove('hidden');
        newContactNameInput.focus();
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    cancelAddContact.addEventListener('click', function() {
        addUserContainer.classList.add('hidden');
        newContactNameInput.value = '';
    });

    // Обновление функционала добавления контакта
    addContactBtn.addEventListener('click', async function() {
        const contactName = newContactNameInput.value.trim();
        if (contactName) {
            try {
                // 1. Search for the user by exact username
                const searchResponse = await fetch(`/users/search?query=${encodeURIComponent(contactName)}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (!searchResponse.ok) {
                    throw new Error(`Search failed: ${searchResponse.statusText}`);
                }

                const searchResults = await searchResponse.json();

                if (searchResults.length === 1) {
                    // 2. If exactly one user is found, get their ID
                    const contactId = searchResults[0].id;

                    // 3. Call the endpoint to add the contact by ID
                    const addResponse = await fetch('/contacts/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ contact_ids: [contactId] })
                    });

                    if (!addResponse.ok) {
                         const errorData = await addResponse.json();
                         throw new Error(errorData.detail || `Failed to add contact: ${addResponse.statusText}`);
                    }

                    // 4. Handle success
                    showNotification(`Контакт "${contactName}" успешно добавлен.`);
                    await loadContacts(); // Reload the contact list
                    addUserContainer.classList.add('hidden');
                    newContactNameInput.value = '';

                } else if (searchResults.length === 0) {
                    showNotification(`Пользователь с именем "${contactName}" не найден.`);
                } else {
                    // Should not happen with the modified search, but handle just in case
                    showNotification(`Найдено несколько пользователей с именем "${contactName}". Уточните имя.`);
                }

            } catch (error) {
                console.error("Error adding contact:", error);
                showNotification(`Ошибка при добавлении контакта: ${error.message}`);
            } finally {
                 // Ensure the input is cleared even if there was an error after finding the user
                 // but before successfully adding. Keep modal open on error for correction.
                 if (!addUserContainer.classList.contains('hidden') && searchResults && searchResults.length !== 1) {
                     // Keep modal open if user not found or multiple found
                 } else if (!addUserContainer.classList.contains('hidden') && !addResponse.ok) {
                     // Keep modal open if add failed
                 }
                 else {
                    // Clear input and hide modal on success or initial search failure
                    newContactNameInput.value = '';
                    addUserContainer.classList.add('hidden');
                 }
            }
        } else {
            showNotification("Введите имя пользователя для добавления.");
        }
    });

    addUserContainer.addEventListener('click', function(e) {
        if (e.target === addUserContainer) {
            addUserContainer.classList.add('hidden');
            newContactNameInput.value = '';
        }
    });

    addGroupButton.addEventListener('click', function() {
        addGroupContainer.classList.remove('hidden');
        newGroupNameInput.focus();
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    cancelAddGroup.addEventListener('click', function() {
        addGroupContainer.classList.add('hidden');
        newGroupNameInput.value = '';
    });

    addGroupBtn.addEventListener('click', function() {
        const groupName = newGroupNameInput.value.trim();
        if (groupName) {
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = '';
        }
    });

    addGroupContainer.addEventListener('click', function(e) {
        if (e.target === addGroupContainer) {
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = '';
        }
    });

    editProfileButton.addEventListener('click', function() {
        const username = document.querySelector('.profile-info h3').textContent;
        const email = document.querySelector('.profile-info p').textContent;
        editUsernameInput.value = username;
        editEmailInput.value = email;
        editPasswordInput.value = '';
        editProfileContainer.classList.remove('hidden');
        editUsernameInput.focus();
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    cancelEditProfile.addEventListener('click', function() {
        editProfileContainer.classList.add('hidden');
    });

    saveProfileBtn.addEventListener('click', function() {
        const username = editUsernameInput.value.trim();
        const email = editEmailInput.value.trim();
        const password = editPasswordInput.value.trim();
        if (username && email) {
            document.querySelector('.profile-info h3').textContent = username;
            document.querySelector('.profile-info p').textContent = email;
            editProfileContainer.classList.add('hidden');
        }
    });

    editProfileContainer.addEventListener('click', function(e) {
        if (e.target === editProfileContainer) {
            editProfileContainer.classList.add('hidden');
        }
    });

    userMenuBtn.addEventListener('click', function() {
        userMenu.classList.toggle('hidden');
        userMenu.classList.toggle('active');
        document.addEventListener('click', handleOutsideClickUserMenu);
    });

    function handleOutsideClickUserMenu(event) {
        if (!userMenu.contains(event.target) && !userMenuBtn.contains(event.target)) {
            userMenu.classList.remove('active');
            setTimeout(() => {
                userMenu.classList.add('hidden');
            }, 300);
            document.removeEventListener('click', handleOutsideClickUserMenu);
        }
    }

    const clearHistoryBtn = userMenu.querySelector('.clear-btn');
    const deleteChatBtn = userMenu.querySelector('.delete-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const cancelConfirmationBtn = document.getElementById('cancel-confirmation');
    const confirmationDeletionBtn = document.getElementById('confirmation-deletion');

    clearHistoryBtn.addEventListener('click', function() {
        messageContainer.innerHTML = '';
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
    });

    deleteChatBtn.addEventListener('click', function() {
        confirmationModal.classList.remove('hidden');
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
    });

    cancelConfirmationBtn.addEventListener('click', function() {
        confirmationModal.classList.add('hidden');
    });

    confirmationDeletionBtn.addEventListener('click', function() {
        messageContainer.innerHTML = '';
        confirmationModal.classList.add('hidden');
    });

    confirmationModal.addEventListener('click', function(e) {
        if (e.target === confirmationModal) {
            confirmationModal.classList.add('hidden');
        }
    });

    const searchInput = document.querySelector('.search-contact');
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const contacts = document.querySelectorAll('.contact');
        contacts.forEach(contact => {
            const contactName = contact.querySelector('.contact-info h3').textContent.toLowerCase();
            if (contactName.includes(searchTerm)) {
                contact.style.display = 'flex';
            } else {
                contact.style.display = 'none';
            }
        });
    });

    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    menuBtn.addEventListener('click', function() {
        menu.classList.remove('hidden');
        setTimeout(() => {
            menu.classList.add('active');
        }, 10);
    });

    document.addEventListener('click', function(event) {
        if (!menu.contains(event.target) && !menuBtn.contains(event.target) && menu.classList.contains('active')) {
            menu.classList.remove('active');
            setTimeout(() => {
                menu.classList.add('hidden');
            }, 300);
        }
    });

    document.getElementById('logout').addEventListener('click', function() {
        localStorage.removeItem("token");
        window.location.href = '/logout';
    });

    mediaButton.addEventListener('click', function() {
        if (!emojiPickerContainer.classList.contains('hidden')) {
            emojiPickerContainer.classList.add('hidden');
        }
        mediaInput.click();
    });

    mediaInput.addEventListener('change', function() {
        if (this.files.length > 0) {          
            handleMediaFiles(this.files);
        }
    });

    function handleMediaFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                selectedMedia.push(file);
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';               
                    if (file.type.startsWith('image/')) {
                        previewItem.innerHTML = `
                            <img src="${e.target.result}" alt="Preview">
                            <button class="remove-preview" data-index="${selectedMedia.length - 1}">
                                <ion-icon name="close"></ion-icon>
                            </button>
                        `;
                    } else if (file.type.startsWith('video/')) {
                        previewItem.innerHTML = `
                            <video src="${e.target.result}" muted></video>
                            <button class="remove-preview" data-index="${selectedMedia.length - 1}">
                                <ion-icon name="close"></ion-icon>
                            </button>
                            <div class="media-type-icon">
                                <ion-icon name="videocam"></ion-icon>
                            </div>
                        `;
                    }
                    mediaPreviewContent.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            }
        }
        if (selectedMedia.length > 0) {
            mediaPreviewContainer.classList.remove('hidden');
        }
    }

    mediaPreviewContent.addEventListener('click', function(e) {
        if (e.target.closest('.remove-preview')) {
            const button = e.target.closest('.remove-preview');
            const index = parseInt(button.getAttribute('data-index'));
                selectedMedia.splice(index, 1);
            button.closest('.preview-item').remove();
            document.querySelectorAll('.remove-preview').forEach((btn, idx) => {
                btn.setAttribute('data-index', idx);
            });
            if (selectedMedia.length === 0) {
                mediaPreviewContainer.classList.add('hidden');
            }
        }
    });

    closePreviewBtn.addEventListener('click', function() {
        mediaPreviewContainer.classList.add('hidden');
        mediaPreviewContent.innerHTML = '';
        selectedMedia.length = 0;
    });

    document.addEventListener('click', function(e) {
        const mediaImg = e.target.closest('.message-media img, .message-media video');
        if (mediaImg) {
            const mediaUrl = mediaImg.src || mediaImg.currentSrc;
            const isVideo = mediaImg.tagName.toLowerCase() === 'video';
            if (isVideo) {
                lightboxContent.innerHTML = `<video src="${mediaUrl}" controls autoplay></video>`;
                downloadMediaBtn.setAttribute('data-src', mediaUrl);
                downloadMediaBtn.setAttribute('data-filename', 'video_' + new Date().getTime() + '.mp4');
            } else {
                lightboxContent.innerHTML = `<img src="${mediaUrl}" alt="Full size image">`;
            downloadMediaBtn.setAttribute('data-src', mediaUrl);
            downloadMediaBtn.setAttribute('data-filename', 'image_' + new Date().getTime() + '.jpg');
        }
            mediaLightbox.classList.remove('hidden');
        }
    });

    closeLightboxBtn.addEventListener('click', function() {
        mediaLightbox.classList.add('hidden');
        lightboxContent.innerHTML = '';
    });

    downloadMediaBtn.addEventListener('click', function() {
        const mediaUrl = this.getAttribute('data-src');
        const filename = this.getAttribute('data-filename');
        if (mediaUrl) {
            const a = document.createElement('a');
            a.href = mediaUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    mediaLightbox.addEventListener('click', function(e) {
        if (e.target === mediaLightbox) {
            mediaLightbox.classList.add('hidden');
            lightboxContent.innerHTML = '';
        }
    });

    emojiButton.addEventListener('click', function() {
        if (!mediaPreviewContainer.classList.contains('hidden')) {
            mediaPreviewContainer.classList.add('hidden');
        }
        emojiPickerContainer.classList.remove('hidden');
        if (!emojisLoaded) {
            fetchEmojis();
        }
    });

    closeEmojiPickerBtn.addEventListener('click', function() {
        emojiPickerContainer.classList.add('hidden');
    });

    document.addEventListener('click', function(event) {
        if (!emojiPickerContainer.contains(event.target) && 
            !emojiButton.contains(event.target) && 
            !emojiPickerContainer.classList.contains('hidden')) {
            emojiPickerContainer.classList.add('hidden');
        }
    });

    function fetchEmojis() {
        emojiLoading.style.display = 'flex';
        emojiGrid.innerHTML = '';
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                emojiLoading.style.display = 'none';
                displayEmojis(data);
                emojisLoaded = true;
            })
            .catch(error => {
                console.error('Error fetching emojis:', error);
                emojiLoading.innerHTML = `
                    <p>Не удалось загрузить эмодзи</p>
                    <button id="retry-emoji-load" class="action-btn">
                        <ion-icon name="refresh-outline"></ion-icon> Повторить
                    </button>
                `;
                document.getElementById('retry-emoji-load').addEventListener('click', fetchEmojis);
            });
    }

    function displayEmojis(emojis) {
        const limitedEmojis = emojis.slice(0, 100);
        limitedEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji.character;
            emojiItem.title = emoji.unicodeName;
            emojiItem.addEventListener('click', function() {
                insertEmoji(emoji.character);
            });
            emojiGrid.appendChild(emojiItem);
        });
    }

    function insertEmoji(emoji) {
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.selectionStart = cursorPos + emoji.length;
        messageInput.selectionEnd = cursorPos + emoji.length;
        messageInput.focus();
    }

    // Добавим функцию для отображения уведомлений
    function showNotification(message) {
        // Простая реализация уведомления - можно улучшить с CSS-анимацией
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

    loadContacts();
});