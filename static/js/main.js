document.addEventListener('DOMContentLoaded', function() {
    // заменили const на let, чтобы можно было присваивать новый токен:
    let token = localStorage.getItem("token");
    if (!token) {
        console.log("No token found, redirecting to login");
        window.location.href = "/";
        return;
    }

    let currentChatId = null; // Добавьте эту переменную
    let currentContactAvatar = null; // Для хранения аватара текущего контакта
    const messageContainer = document.querySelector("#message-container");
    const messageInput = document.querySelector("#message-text");
    const sendButton = document.querySelector("#send-button");
    const contactsList = document.querySelector('.contacts-list');
    const noChatPlaceholder = document.querySelector('#no-chat-selected');
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
    const chatHeader = document.querySelector('.chat-header');

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

    // Disable message input and buttons on initial load
    disableMessaging();
    
    // Function to disable messaging when no chat is selected
    function disableMessaging() {
        messageInput.disabled = true;
        sendButton.disabled = true;
        document.getElementById('media-button').disabled = true;
        document.querySelector('.emoji-button').disabled = true;
        userMenuBtn.disabled = true; // Disable the user menu button
        
        // Show placeholder
        noChatPlaceholder.style.display = 'flex';

        const headerAvatar = chatHeader.querySelector('.current-contact .contact-avatar img');
        if (headerAvatar) {
            headerAvatar.style.visibility = 'hidden';
        }
        
        // Add visual indication that input is disabled
        messageInput.classList.add('disabled');
        sendButton.classList.add('disabled');
        document.getElementById('media-button').classList.add('disabled');
        document.querySelector('.emoji-button').classList.add('disabled');
        userMenuBtn.classList.add('disabled'); // Add disabled class to user menu button
    }
    
    // Function to enable messaging when a chat is selected
    function enableMessaging() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        document.getElementById('media-button').disabled = false;
        document.querySelector('.emoji-button').disabled = false;
        userMenuBtn.disabled = false; // Enable the user menu button
        
        // Hide placeholder
        noChatPlaceholder.style.display = 'none';
        const headerAvatar = chatHeader.querySelector('.current-contact .contact-avatar img');
        if (headerAvatar) {
            headerAvatar.style.visibility = 'visible';
        }
        
        // Remove visual indication
        messageInput.classList.remove('disabled');
        sendButton.classList.remove('disabled');
        document.getElementById('media-button').classList.remove('disabled');
        document.querySelector('.emoji-button').classList.remove('disabled');
        userMenuBtn.classList.remove('disabled'); // Remove disabled class from user menu button
    }

    const currentUser = {
        name: 'You',
        avatar: '/static/images/avatar.png'
    };

    // Хранилище для идентификаторов отображённых сообщений
    const displayedMessages = new Set();

    // Получаем свой user_id из JWT
    function getCurrentUserId() {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return parseInt(payload.user_id, 10);
        } catch {
            return null;
        }
    }

    async function loadUserProfile() {
        try {
            const response = await fetch("/user/profile", {
                headers: { 
                    "Authorization": `Bearer ${token}` 
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                document.querySelector('.profile-info h3').textContent = userData.username;
                document.querySelector('.profile-info p').textContent = userData.email || '';
                
                // If you have profile editing functionality, also update those fields
                if (editUsernameInput) editUsernameInput.value = userData.username;
                if (editEmailInput) editEmailInput.value = userData.email || '';
            } else {
                console.error("Failed to load user profile:", response.status);
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
        }
    }

    async function loadContacts() {
        try {
            console.log("Loading contacts...");
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
            
            if (contacts.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.classList.add('empty-contacts');
                emptyMessage.innerHTML = `
                    <div class="empty-contacts-message">
                        <p>You don't have any contacts yet</p>
                        <p>Click the "Add Contact" button in the menu</p>
                    </div>
                `;
                contactsList.appendChild(emptyMessage);
                return;
            }
    
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
                contact.addEventListener('click', async function() {
                    contactElements.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    const contactName = this.querySelector('.contact-info h3').textContent;
                    const contactImg = this.querySelector('.contact-avatar img').src;
                    const isOnline = this.querySelector('.contact-status.online') !== null;
                    const contactId = this.getAttribute('data-id');
                    
                    currentContactAvatar = contactImg;  // store contact avatar
                    
                    // Fetch chat_id from backend
                    try {
                        const response = await fetch(`/chat/one-on-one/${contactId}`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`Failed to get chat: ${errorData.detail || response.statusText}`);
                        }
                        const data = await response.json();
                        currentChatId = data.chat_id;
                        
                        // Update chat header
                        document.querySelector('.current-contact .contact-info h3').textContent = contactName;
                        document.querySelector('.current-contact .contact-info p').textContent = isOnline ? 'Online' : 'Offline';
                        document.querySelector('.current-contact .contact-avatar img').src = contactImg;
                        
                        // Reconnect WebSocket
                        reconnectWebSocket();
                        
                        // Load messages
                        loadMessages();
                        
                        // Enable messaging
                        enableMessaging();
                    } catch (error) {
                        console.error("Error fetching chat ID:", error);
                        showNotification(`Не удалось открыть чат: ${error.message}`);
                        currentChatId = null; // Ensure no invalid WebSocket connection
                        disableMessaging();
                    }
                });
            });
    
            if (contacts.length > 0) {
                contacts[0].click();
            }
        } catch (error) {
            console.error("Error loading contacts:", error);
        }
    }
    
    // Update reconnectWebSocket to use currentChatId
    function reconnectWebSocket() {
        if (!currentChatId) {
            console.log("No chat ID available, skipping WebSocket connection");
            return;
        }
        
        if (ws) {
            ws.onclose = null;  // disable onclose handler to avoid loop
            ws.close();
        }
        
        ws = new WebSocket(`ws://${window.location.host}/ws/${currentChatId}?token=${token}`);
        
        ws.onopen = () => {
            console.log("WebSocket connection established for chat:", currentChatId);
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                console.log("Message event data:", data);
                const currentUserId = getCurrentUserId();
                const isOutgoing = data.sender_id === currentUserId;
                displayMessage(
                    data.id,
                    data.content,
                    data.sender_username,
                    isOutgoing ? currentUser.avatar : currentContactAvatar,
                    isOutgoing,
                    data.timestamp,
                    'message'
                );
            } else if (data.type === 'user_list') {
                // Update online status of contacts
                data.users.forEach(u => {
                    const el = document.querySelector(`.contact[data-id="${u.id}"]`);
                    if (el) {
                        el.querySelector('.contact-status').classList.replace('offline','online');
                        el.querySelector('.contact-info p').textContent = 'Online';
                    }
                });
            }
        };
        
        ws.onclose = (event) => {
            console.log("WebSocket connection closed:", event);
            // Automatic reconnection removed to prevent reconnect loop
        };
        
        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    async function loadMessages() {
        try {
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
    
            const currentUserId = getCurrentUserId();
            
            messages.forEach(msg => {
                const isOutgoing = msg.sender_id === currentUserId;
                displayMessage(
                    msg.id,
                    msg.content,
                    msg.sender_username,
                    isOutgoing ? currentUser.avatar : currentContactAvatar,
                    isOutgoing,
                    msg.timestamp,
                    "message"
                );
            });
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    }

    let ws = null;
    sendButton.addEventListener("click", async () => {
        const content = messageInput.value.trim();
        
        // Проверяем, выбран ли контакт
        if (!currentChatId) {
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
            
            // Новая логика отправки через WebSocket
            if (ws.readyState === WebSocket.OPEN) {
                if (uploadedMedia.length > 0) {
                    if (uploadedMedia.length === 1) {
                        const mediaTag = ` [Media: ${uploadedMedia[0]}]`;
                        ws.send(JSON.stringify({ content: (message || '') + mediaTag, type: "message" }));
                    } else {
                        uploadedMedia.forEach((file, index) => {
                            const mediaTag = ` [Media: ${file}]`;
                            const contentForThis = index === uploadedMedia.length - 1 ? (message || '') + mediaTag : mediaTag;
                            ws.send(JSON.stringify({ content: contentForThis, type: "message" }));
                        });
                    }
                } else if (message) {
                    ws.send(JSON.stringify({ content: message, type: "message" }));
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

    // В обработчике сохранения профиля корректно перезаписываем token:
    saveProfileBtn.addEventListener('click', async function() {
        const username = editUsernameInput.value.trim();
        const email    = editEmailInput.value.trim();
        const password = editPasswordInput.value.trim();
        if (!username || !email) return showNotification("Заполните все поля");

        try {
            const res = await fetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || res.statusText);

            // Обновляем UI
            document.querySelector('.profile-info h3').textContent = data.username;
            document.querySelector('.profile-info p').textContent = data.email;
            editProfileContainer.classList.add('hidden');

            // Сохраняем новый токен и перезагружаем контакты
            localStorage.setItem('token', data.token);
            token = data.token;   // теперь работает без ошибки
            showNotification('Профиль обновлён, токен обновлён');
            await loadContacts();
        } catch (e) {
            showNotification('Ошибка обновления профиля: ' + e.message);
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

    loadUserProfile();
    loadContacts();
});