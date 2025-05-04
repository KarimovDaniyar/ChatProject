import { showNotification, enableMessaging, disableMessaging } from './modules/ui.js';
import { formatTimestamp, fetchAndUpdateContactPreview } from './modules/utils.js';
import { ensureAuthenticated, getToken, removeToken, getAuthHeaders, getCurrentUserId } from './modules/auth.js';
import { loadMessages, sendMessage, displayMessage, initMessageModule, updateMessageState, editMessage, deleteMessage } from './modules/message.js';
import { initWebSocketModule, updateChatState, connectChatWebSocket, getChatWebSocket, sendWebSocketMessage, closeAllConnections } from './modules/websocket.js';

document.addEventListener('DOMContentLoaded', function() {
    const token = ensureAuthenticated();
    if (!token) return;

    const displayedMessages = new Set();

    let addUserContext = 'contacts';

    let currentChatId = null; // Добавьте эту переменную
    let currentContactAvatar = null; // Для хранения аватара текущего контакта
    let currentContactUsername = null; // Для хранения имени текущего контакта или группы
    const messageContainer = document.querySelector("#message-container");
    const messageInput = document.querySelector("#message-text");
    const sendButton = document.querySelector("#send-button");
    const contactsList = document.querySelector('.contacts-list');
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
    const newGroupNameInput = document.getElementById('new-group-name');
    const editProfileButton = document.getElementById('edit-profile');
    const editProfileContainer = document.getElementById('edit-profile-container');
    const cancelEditProfile = document.getElementById('cancel-edit-profile');
    const saveProfileBtn = document.getElementById('save-profile');
    const editUsernameInput = document.getElementById('edit-username');
    const editEmailInput = document.getElementById('edit-email');
    const editPasswordInput = document.getElementById('edit-password');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');
    const groupUserMenu = document.getElementById('group-user-menu');

    const usersList = document.getElementById('users-list');
    const addGroupMemberBtn = document.getElementById('add-group-member-btn');
    const leaveGroupBtn = document.getElementById('leave-group-btn');

    const editAvatarImg = document.getElementById('edit-avatar-img');
    const editAvatarInput = document.getElementById('edit-avatar-input'); 
    let selectedAvatarFile = null;  

    const editGroupProfileContainer = document.getElementById('edit-group-profile-container');
    const editGroupProfileBtn = document.getElementById('edit-group-profile-btn') || changeGroupNameBtn; // если заменяем существующую кнопку
    const cancelEditGroupProfileBtn = document.getElementById('cancel-edit-group-profile');
    const saveGroupProfileBtn = document.getElementById('save-group-profile');

    const editGroupAvatarImg = document.getElementById('edit-group-avatar-img');
    const editGroupAvatarInput = document.getElementById('edit-group-avatar-input');
    const editGroupNameInput = document.getElementById('edit-group-name');

    let selectedGroupAvatarFile = null;
    let currentGroupCreatorId = null;

    let editingMessageId = null;
    const originalSendButtonHTML = sendButton.innerHTML;

    const currentUser = {
        name: 'You',
        avatar: '/static/images/avatar.png'
    };
    

    // Disable message input and buttons on initial load
    disableMessaging();
    
    async function loadGroupMembers(groupId) {
        try {
            const groupResponse = await fetch(`/user/groups`, {
                headers: getAuthHeaders()
            });
            if (!groupResponse.ok) throw new Error("Failed to load groups");
            const groups = await groupResponse.json();
            const group = groups.find(g => g.id === groupId);
            currentGroupCreatorId = group ? group.creator_id : null;
    
            const response = await fetch(`/groups/${groupId}/members`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`Failed to load group members: ${response.statusText}`);
            }
            const members = await response.json();
    
            usersList.innerHTML = '';
    
            if (members.length === 0) {
                usersList.innerHTML = '<div style="padding: 10px; color: #ccc;">No members in this group</div>';
                return;
            }
    
            const currentUserId = getCurrentUserId();
    
            members.forEach(member => {
                const memberElement = document.createElement('div');
                memberElement.classList.add('contactInGroupInfo');
                memberElement.setAttribute('data-id', member.id);
    
                const canRemove = currentUserId === currentGroupCreatorId && member.id !== currentUserId;
    
                memberElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="${member.avatar || '/static/images/avatar.png'}" alt="${member.username}">
                    </div>
                    <div class="contact-info">
                        <h3>${member.username}</h3>
                    </div>
                    <div class="contact-status offline"></div>
                    ${canRemove ? `<button class="remove-member-btn" title="Remove user" aria-label="Remove user">
                        <ion-icon name="trash-outline" class="remove-icon"></ion-icon>
                    </button>` : ''}
                `;
                usersList.appendChild(memberElement);
            });
    
            document.querySelectorAll('.remove-member-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const memberDiv = e.target.closest('.contactInGroupInfo');
                    const memberId = memberDiv.getAttribute('data-id');
                    const memberName = memberDiv.querySelector('.contact-info h3').textContent;
                    confirmRemoveMember(memberId, memberName);
                });
            });
        } catch (error) {
            console.error(error);
            usersList.innerHTML = '<div style="padding: 10px; color: red;">Failed to load members</div>';
        }
    }
    
    
    function confirmRemoveMember(userId, username) {
        const modal = document.getElementById('confirm-remove-member-modal');
        const usernameElem = document.getElementById('remove-member-username');
        const cancelBtn = document.getElementById('cancel-remove-member-btn');
        const confirmBtn = document.getElementById('confirm-remove-member-btn');
    
        usernameElem.textContent = username;
        modal.classList.remove('hidden');
    
        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    
        confirmBtn.onclick = async () => {
            try {
                const res = await fetch(`/groups/${currentChatId}/members/${userId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Ошибка при удалении участника');
                }
                showNotification(`Пользователь "${username}" успешно удалён из группы`);
                await loadGroupMembers(currentChatId);

            } catch (e) {
                showNotification(`Ошибка: ${e.message}`);
            } finally {
                modal.classList.add('hidden');
            }
        };
    }
    
    

    async function loadUserProfile() {
        try {
            const response = await fetch("/user/profile", {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const userData = await response.json();
                document.querySelector('.profile-info h3').textContent = userData.username;
                document.querySelector('.profile-info p').textContent = userData.email || '';
                
                const profileAvatarImg = document.querySelector('.profile-avatar img');
                if (profileAvatarImg && userData.avatar) {
                    profileAvatarImg.src = userData.avatar;
                }
    
                if (editUsernameInput) editUsernameInput.value = userData.username;
                if (editEmailInput) editEmailInput.value = userData.email || '';
                if (editAvatarImg && userData.avatar) {
                    editAvatarImg.src = userData.avatar;
                }
    
                currentUser.avatar = userData.avatar || '/static/images/avatar.png';
            } else {
                console.error("Failed to load user profile:", response.status);
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
        }
    }
    editAvatarImg.addEventListener('click', () => {
        editAvatarInput.click();
    });
    
    editAvatarInput.addEventListener('change', () => {
        const file = editAvatarInput.files[0];
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif'];
        const maxSize = 5 * 1024 * 1024;
        const ext = file.name.split('.').pop().toLowerCase();
        if (file && file.type.startsWith('image/') && allowedExtensions.includes(ext)) {
            if (file.size > maxSize) {
                showNotification('Файл слишком большой. Максимальный размер — 5 МБ.');
                editAvatarInput.value = '';
                return;
            }
            selectedAvatarFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                editAvatarImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Пожалуйста, выберите изображение в формате PNG, JPG, JPEG или GIF.');
            editAvatarInput.value = '';
        }
    },
);

    function updateContactPreview(contactElement) {
        const lastMsgBubble = messageContainer.querySelector('.message:last-child .message-bubble');
        if (!lastMsgBubble) return;
        let preview = '';
        if (lastMsgBubble.querySelector('img.message-media')) {
            preview = '📷 Photo';
        } else if (lastMsgBubble.querySelector('video.message-media')) {
            preview = '🎥 Video';
        } else {
            const textElem = lastMsgBubble.querySelector('p');
            preview = textElem ? textElem.textContent : '';
        }
        if (preview.length > 30) preview = preview.slice(0, 30) + '…';
        const previewElem = contactElement.querySelector('.contact-info p');
        if (previewElem) previewElem.textContent = preview;
    }

    async function loadContacts() {
        try {
            console.log("Loading contacts...");
            const response = await fetch("/contacts", {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Unauthorized, redirecting to login");
                    removeToken();
                    window.location.href = "/";
                    return;
                }
                throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
            }
            const contacts = await response.json();
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
                await loadGroups();
                return;
            }
    
            const previewPromises = [];
            contacts.forEach(contact => {
                const contactElement = document.createElement('div');
                contactElement.classList.add('contact');
                contactElement.setAttribute('data-username', contact.username);
                contactElement.setAttribute('data-id', contact.id);
                contactElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="${contact.avatar || '/static/images/avatar.png'}" alt="${contact.username}">
                    </div>
                    <div class="contact-info">
                        <h3>${contact.username}</h3>
                        <p></p>
                    </div>
                    <div class="contact-status offline"></div>
                `;
                contactsList.appendChild(contactElement);
                previewPromises.push(fetchAndUpdateContactPreview(contactElement, contact.id));
            });
            await Promise.all(previewPromises);
    
            const contactElements = document.querySelectorAll('.contact');
            contactElements.forEach(contact => {
                contact.addEventListener('click', async function() {
                    contactElements.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    const contactName = this.querySelector('.contact-info h3').textContent;
                    const contactImg = this.querySelector('.contact-avatar img').src;
                    const isOnline = this.querySelector('.contact-status.online') !== null;
                    const contactId = this.getAttribute('data-id');
                    
                    currentContactAvatar = contactImg;
                    
                    try {
                        const response = await fetch(`/chat/one-on-one/${contactId}`, {
                            headers: getAuthHeaders()
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`Failed to get chat: ${errorData.detail || response.statusText}`);
                        }
                        const data = await response.json();
                        currentChatId = data.chat_id;
                        
                        document.querySelector('.current-contact .contact-info h3').textContent = contactName;
                        document.querySelector('.current-contact .contact-avatar img').src = contactImg;
                        
                        updateChatState({
                            chatId: currentChatId,
                            contactAvatar: currentContactAvatar
                        });
                        
                        updateMessageState({
                            currentChatId: currentChatId,
                            currentContactAvatar: currentContactAvatar
                        });

                        loadMessages();
                        enableMessaging();
                    } catch (error) {
                        console.error("Error fetching chat ID:", error);
                        showNotification(`Не удалось открыть чат: ${error.message}`);
                        currentChatId = null;
                        disableMessaging();
                    }
                });
            });
    
            console.log("Contacts loaded successfully");
        } catch (error) {
            console.error("Error loading contacts:", error);
        }
        await loadGroups();
    }
    
    initWebSocketModule({
        messageContainer: messageContainer,
        contactsList: contactsList,
        currentUser: currentUser,
        
        onMessageRead: (messageId) => {
            const msgElem = messageContainer.querySelector(`[data-message-id="${messageId}"]`);
            if (msgElem) {
                const statusSpan = msgElem.querySelector('.message-status');
                if (statusSpan) {
                    statusSpan.innerHTML = '<ion-icon name="checkmark-done" style="color: #25d366; font-size: 18px; vertical-align: middle;"></ion-icon>';
                    statusSpan.title = 'Read';
                }
            }
        },
        onMessageDeleted: (messageId) => {
            const deletedElem = messageContainer.querySelector(`[data-message-id="${messageId}"]`);
            if (deletedElem) deletedElem.remove();
        },
        onMessageRefactor: (messageId, newContent) => {
            const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageEl) {
                const bubble = messageEl.querySelector('.message-bubble');
                const p = bubble.querySelector('p');
                if (p) {
                    p.textContent = newContent;
                }
            }
        },
        onUserListUpdate: (users) => {
            users.forEach(u => {
                const el = document.querySelector(`.contact[data-id="${u.id}"]`);
                if (el) {
                    el.querySelector('.contact-status').classList.replace('offline','online');
                }
            });
        },
        onPresenceChange: (userId, status) => {
            const el = document.querySelector(`.contact[data-id="${userId}"] .contact-status`);
            if (el) {
                el.classList.replace(status === 'online' ? 'offline' : 'online', status);
            }
        }
    });
    
    initMessageModule({
        messageContainer: messageContainer,
        currentUser: currentUser,
        displayedMessages: displayedMessages
    });

    window.addEventListener('contacts_update', () => {
        loadContacts();
    });
    
    sendButton.addEventListener("click", async () => {
        const content = messageInput.value.trim();
        
        if (editingMessageId) {
            if (content) {
                const success = await editMessage(editingMessageId, content);
                if (!success) {
                    showNotification('Failed to update message');
                }
            }
            
            cancelEditing();
            return;
        }
        
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
            const activeContact = document.querySelector('.contact.active');
            if (activeContact) {
                contactsList.prepend(activeContact);
                updateContactPreview(activeContact);
            }
        }
    });

    messageInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            if (editingMessageId) {
                const content = messageInput.value.trim();
                if (content) {
                    try {
                        const response = await fetch(`/messages/${editingMessageId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                ...getAuthHeaders()
                            },
                            body: JSON.stringify({ new_message: content })
                        });
                        
                        if (!response.ok) {
                            throw new Error('Failed to update message');
                        }
                    } catch (error) {
                        console.error('Error updating message:', error);
                        showNotification('Failed to update message');
                    }
                }
                
                cancelEditing();
                return;
            }
            
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

    addUserButton.addEventListener('click', () => {
        addUserContext = 'contacts';
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

    addContactBtn.addEventListener('click', async () => {
    const usernameToAdd = newContactNameInput.value.trim();
    if (!usernameToAdd) {
        showNotification("Введите имя пользователя для добавления.");
        return;
    }

    if (addUserContext === 'contacts') {
        try {
            const searchResponse = await fetch(`/users/search?query=${encodeURIComponent(usernameToAdd)}`, {
                headers: getAuthHeaders()
            });
            if (!searchResponse.ok) throw new Error(`Ошибка поиска пользователя: ${searchResponse.statusText}`);
            const searchResults = await searchResponse.json();
    
            if (searchResults.length === 0) {
                showNotification(`Пользователь "${usernameToAdd}" не найден.`);
                return;
            } else if (searchResults.length > 1) {
                showNotification(`Найдено несколько пользователей с именем "${usernameToAdd}". Уточните имя.`);
                return;
            }
    
            const userToAdd = searchResults[0];
    
            const profileResponse = await fetch('/user/profile', {
                headers: getAuthHeaders()
            });
            if (!profileResponse.ok) throw new Error('Не удалось получить профиль пользователя');
            const currentUser = await profileResponse.json();
    
            console.log("Текущий пользователь ID:", currentUser.id);
            console.log("Добавляем контакт ID:", userToAdd.id);
    
            if (!userToAdd.id) {
                showNotification("ID пользователя не найден.");
                return;
            }
    
            if (userToAdd.id === currentUser.id) {
                showNotification("Вы не можете добавить себя в контакты.");
                return;
            }
    
            const addResponse = await fetch('/contacts/add', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ contact_ids: [userToAdd.id] })
            });
    
            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(errorData.detail || 'Ошибка при добавлении контакта');
            }
    
            showNotification(`Пользователь "${userToAdd.username}" успешно добавлен в контакты.`);
            await loadContacts();
    
            addUserContainer.classList.add('hidden');
            newContactNameInput.value = '';
    
        } catch (error) {
            console.error(error);
            showNotification(`Ошибка: ${error.message}`);
        }

    } else if (addUserContext === 'group-members') {
        if (!currentChatId) {
            showNotification("Группа не выбрана.");
            return;
        }
        try {
            const searchResponse = await fetch(`/users/search?query=${encodeURIComponent(usernameToAdd)}`, {
                headers: getAuthHeaders()
            });
            
            if (!searchResponse.ok) {
                let errorText;
                try {
                    const errorData = await searchResponse.json();
                    errorText = errorData.detail || JSON.stringify(errorData);
                } catch {
                    errorText = await searchResponse.text();
                }
                throw new Error(`Ошибка поиска пользователя: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`);
            }
            const searchResults = await searchResponse.json();

            if (searchResults.length === 0) {
                showNotification(`Пользователь "${usernameToAdd}" не найден.`);
                return;
            } else if (searchResults.length > 1) {
                showNotification(`Найдено несколько пользователей с именем "${usernameToAdd}". Уточните имя.`);
                return;
            }

            const userToAdd = searchResults[0];

            const addResponse = await fetch(`/groups/${currentChatId}/add-members`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ user_ids: [userToAdd.id] })
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(errorData.detail || 'Ошибка при добавлении участника');
            }

            showNotification(`Пользователь "${userToAdd.username}" успешно добавлен в группу.`);
            await loadGroupMembers(currentChatId);

            addUserContainer.classList.add('hidden');
            newContactNameInput.value = '';

        } catch (error) {
            console.error(error);
            showNotification(`Ошибка: ${error.message}`);
        }
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

    addGroupBtn.addEventListener('click', async function() {
        const groupName = newGroupNameInput.value.trim();
        if (!groupName) {
            showNotification("Введите название группы.");
            return;
        }
    
        try {
            const response = await fetch("/groups/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ name: groupName })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Ошибка создания группы");
            }
    
            await loadGroups();
    
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = '';
            showNotification(`Группа "${groupName}" успешно создана.`);
    
        } catch (error) {
            showNotification(`Ошибка: ${error.message}`);
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

    saveProfileBtn.addEventListener('click', async function() {
        const username = editUsernameInput.value.trim();
        const email = editEmailInput.value.trim();
        const password = editPasswordInput.value.trim();
    
        if (!username || !email) return showNotification("Заполните все поля");
    
        try {
            let avatarUrl = null;
            if (selectedAvatarFile) {
                const formData = new FormData();
                formData.append('file', selectedAvatarFile);
    
                const uploadResponse = await fetch('/user/upload-avatar', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: formData
                });
    
                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json();
                    console.error('Upload error:', uploadResponse.status, errorData);
                    throw new Error(`Ошибка загрузки аватара: ${errorData.detail || uploadResponse.statusText}`);
                }
    
                const uploadData = await uploadResponse.json();
                avatarUrl = uploadData.avatar_url;
            }
    
            const bodyData = { username, email };
            if (password) bodyData.password = password;
            if (avatarUrl) bodyData.avatar = avatarUrl;
    
            const res = await fetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(bodyData)
            });
    
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || res.statusText);
    
            document.querySelector('.profile-info h3').textContent = data.username;
            document.querySelector('.profile-info p').textContent = data.email;
            if (data.avatar) {
                const profileAvatarImg = document.querySelector('.profile-avatar img');
                if (profileAvatarImg) profileAvatarImg.src = data.avatar;
                if (editAvatarImg) editAvatarImg.src = data.avatar;
                currentUser.avatar = data.avatar;
            }
    
            editProfileContainer.classList.add('hidden');
    
            localStorage.setItem('token', data.token);
            token = data.token;
            showNotification('Профиль обновлён, токен обновлён');
            await loadUserProfile();
            await loadContacts();
            loadMessages();

    
            selectedAvatarFile = null;
            editAvatarInput.value = '';
        } catch (e) {
            showNotification('Ошибка обновления профиля: ' + e.message);
        }
    });
    

    editProfileContainer.addEventListener('click', function(e) {
        if (e.target === editProfileContainer) {
            editProfileContainer.classList.add('hidden');
        }
    });

    userMenuBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        if (!currentChatId) return;
    
        const activeContact = document.querySelector('.contact.active');
        const isGroupChat = activeContact && activeContact.classList.contains('group');
    
        userMenu.classList.add('hidden');
        userMenu.classList.remove('active');
        groupUserMenu.classList.add('hidden');
        groupUserMenu.classList.remove('active');
    
        if (isGroupChat) {
            const groupNameElement = document.getElementById('group-name');
            if (groupNameElement) {
                groupNameElement.textContent = currentContactUsername || '';
            }
    
            groupUserMenu.classList.remove('hidden');
            setTimeout(() => {
                groupUserMenu.classList.add('active');
            }, 10);
    
            loadGroupMembers(currentChatId);
        } else {
            userMenu.classList.remove('hidden');
            setTimeout(() => {
                userMenu.classList.add('active');
            }, 10);
        }
    
        document.addEventListener('click', handleOutsideClickMenu);
    });
    
    


    addGroupMemberBtn.addEventListener('click', () => {
        addUserContext = 'group-members';
        addUserContainer.classList.remove('hidden');
        newContactNameInput.focus();
    
        groupUserMenu.classList.remove('active');
        setTimeout(() => {
            groupUserMenu.classList.add('hidden');
        }, 300);
    });
    
    
    leaveGroupBtn.addEventListener('click', async () => {
        if (!currentChatId) return;
    
        try {
            const response = await fetch(`/groups/${currentChatId}/leave`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка выхода из группы');
            }
            showNotification('Вы вышли из группы');
    
            await loadContacts();
            loadMessages();
    
            currentChatId = null;
            currentContactUsername = null;
            messageContainer.innerHTML = '';
            disableMessaging();
    
            groupUserMenu.classList.remove('active');
            setTimeout(() => {
                groupUserMenu.classList.add('hidden');
            }, 300);
        } catch (error) {
            showNotification(`Ошибка: ${error.message}`);
        }
    });

    function handleOutsideClickMenu(event) {
        const target = event.target;
        if (
            !userMenu.contains(target) &&
            !groupUserMenu.contains(target) &&
            !userMenuBtn.contains(target)
        ) {
            userMenu.classList.remove('active');
            groupUserMenu.classList.remove('active');
            setTimeout(() => {
                userMenu.classList.add('hidden');
                groupUserMenu.classList.add('hidden');
            }, 300);
            document.removeEventListener('click', handleOutsideClickMenu);
        }
    }
    
    

    const clearHistoryBtn = userMenu.querySelector('.clear-btn');
    const deleteChatBtn = userMenu.querySelector('.delete-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const cancelConfirmationBtn = document.getElementById('cancel-confirmation');
    const confirmationDeletionBtn = document.getElementById('confirmation-deletion');

    clearHistoryBtn.addEventListener('click', async function() {
        if (!currentChatId) return;
        const response = await fetch(`/messages/${currentChatId}/clear`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            const err = await response.json();
            showNotification(`Ошибка очистки истории: ${err.detail || 'Unknown error'}`);
            return;
        }
        if (!userMenu.classList.contains('hidden')) {
            userMenu.classList.remove('active');
            setTimeout(() => {
                userMenu.classList.add('hidden');
            }, 300);
        }
        messageContainer.innerHTML = '';
        showNotification('История чата очищена');
        await loadMessages();
        
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

    confirmationDeletionBtn.addEventListener('click', async function() {
        if (!currentChatId) return;
    
        try {
            const activeContact = document.querySelector('.contact.active');
            const isGroupChat = activeContact && activeContact.classList.contains('group');
    
            let url, method;
            if (isGroupChat) {
                url = `/chats/${currentChatId}`;
                method = 'DELETE';
            } else {
                url = `/chats/${currentChatId}/leave`;
                method = 'DELETE';
            }
    
            const response = await fetch(url, {
                method,
                headers: getAuthHeaders()
            });
    
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to delete chat');
            }
    
            messageContainer.innerHTML = '';
    
            document.querySelector('.current-contact .contact-info h3').textContent = '';
            document.querySelector('.current-contact .contact-info p').textContent = '';
            const headerAvatar = document.querySelector('.current-contact .contact-avatar img');
            if (headerAvatar) {
                headerAvatar.src = '/static/images/avatar.png';
                headerAvatar.style.visibility = 'hidden';
            }
    
            currentChatId = null;
            currentContactUsername = null;
            currentContactAvatar = null;
    
            const ws = getChatWebSocket();
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
    
            if (activeContact) {
                activeContact.classList.remove('active');
            }
    
            showNotification('Чат удалён');
            disableMessaging();
            await loadContacts();
    
        } catch (error) {
            showNotification(`Ошибка удаления чата: ${error.message}`);
        }
    
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
        const token = getToken();
        removeToken();
        closeAllConnections();
        window.location.replace(`/logout?token=${token}`);
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

    editGroupProfileBtn.addEventListener('click', () => {
        editGroupNameInput.value = currentContactUsername || '';
        editGroupAvatarImg.src = document.querySelector('.current-contact .contact-avatar img').src || '/static/images/group.png';
        selectedGroupAvatarFile = null;
    
        editGroupProfileContainer.classList.remove('hidden');
        setTimeout(() => {
            editGroupProfileContainer.classList.add('active');
        }, 10);
    });
    
    cancelEditGroupProfileBtn.addEventListener('click', () => {
        editGroupProfileContainer.classList.remove('active');
        setTimeout(() => {
            editGroupProfileContainer.classList.add('hidden');
        }, 300);
    });
    
    editGroupAvatarImg.addEventListener('click', () => {
        editGroupAvatarInput.click();
    });
    
    editGroupAvatarInput.addEventListener('change', () => {
        const file = editGroupAvatarInput.files[0];
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif'];
        const maxSize = 5 * 1024 * 1024;
        const ext = file.name.split('.').pop().toLowerCase();
        if (file && file.type.startsWith('image/') && allowedExtensions.includes(ext)) {
            if (file.size > maxSize) {
                showNotification('Файл слишком большой. Максимальный размер — 5 МБ.');
                editGroupAvatarInput.value = '';
                return;
            }
            selectedGroupAvatarFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                editGroupAvatarImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Пожалуйста, выберите изображение в формате PNG, JPG, JPEG или GIF.');
            editGroupAvatarInput.value = '';
        }
    });

    saveGroupProfileBtn.addEventListener('click', async () => {
        const newName = editGroupNameInput.value.trim();
        if (!newName) {
            showNotification('Название группы не может быть пустым');
            return;
        }
    
        const formData = new FormData();
        formData.append('name', newName);
        if (selectedGroupAvatarFile) {
            formData.append('avatar_file', selectedGroupAvatarFile);
        }
    
        try {
            const response = await fetch(`/groups/${currentChatId}/profile`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Ошибка обновления группы');
            }
            const data = await response.json();
    
            document.querySelector('.current-contact .contact-info h3').textContent = data.name;
            document.querySelector('.current-contact .contact-avatar img').src = data.avatar || '/static/images/group.png';

            const groupContactElement = document.querySelector(`.contact.group[data-group-id="${currentChatId}"]`);
            if (groupContactElement) {
                groupContactElement.querySelector('.contact-info h3').textContent = data.name;
                groupContactElement.querySelector('.contact-avatar img').src = data.avatar || '/static/images/group.png';
            }

            const groupAvatarImg = document.querySelector('#group-user-menu .profile-avatar img');
            if (groupAvatarImg) {
                groupAvatarImg.src = data.avatar || '/static/images/group.png';
            }
    
            showNotification('Профиль группы обновлен');
    
            editGroupProfileContainer.classList.remove('active');
            setTimeout(() => {
                editGroupProfileContainer.classList.add('hidden');
            }, 300);
    
            selectedGroupAvatarFile = null;
        } catch (e) {
            showNotification('Ошибка: ' + e.message);
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
        const mediaEl = e.target.closest('img.message-media, video.message-media');
        if (mediaEl) {
            const mediaUrl = mediaEl.src || mediaEl.currentSrc;
            const isVideo = mediaEl.tagName.toLowerCase() === 'video';
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
            emojiPickerContainer.classList.add('hidden');
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

    async function loadGroups() {
        try {
            const response = await fetch("/user/groups", {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error("Не удалось загрузить группы");
            const groups = await response.json();
    
            groups.forEach(group => {
                if (contactsList.querySelector(`.contact.group[data-group-id="${group.id}"]`)) {
                    return;
                }
            
                const groupElement = document.createElement('div');
                groupElement.classList.add('contact', 'group');
                groupElement.setAttribute('data-group-id', group.id);
                groupElement.innerHTML = `
                    <div class="contact-avatar">
                        <img src="${group.avatar || '/static/images/group.png'}" alt="${group.name}">
                    </div>
                    <div class="contact-info">
                        <h3>${group.name}</h3>
                        <p>Group</p>
                    </div>
                `;
                contactsList.appendChild(groupElement);
            
                groupElement.addEventListener('click', async function() {
                    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
            
                    currentChatId = group.id;
                    currentContactUsername = group.name;
            
                    document.querySelector('.current-contact .contact-info h3').textContent = group.name;
                    document.querySelector('.current-contact .contact-info p').textContent = 'Group';
                    const headerAvatar = document.querySelector('.current-contact .contact-avatar img');
                    if (headerAvatar) {
                        headerAvatar.src = group.avatar || '/static/images/group.png';
                        headerAvatar.style.visibility = 'visible';
                    }
            
                    const groupNameElement = document.getElementById('group-name');
                    if (groupNameElement) {
                        groupNameElement.textContent = group.name;
                    }
                    const groupAvatarImg = document.querySelector('#group-user-menu .profile-avatar img');
                    if (groupAvatarImg) {
                        groupAvatarImg.src = group.avatar || '/static/images/group.png';
                    }
            
                    updateChatState({
                        chatId: currentChatId,
                        contactAvatar: group.avatar || '/static/images/group.png'
                    });
                    
                    updateMessageState({
                        currentChatId: currentChatId,
                        currentContactAvatar: group.avatar || '/static/images/group.png'
                    });

                    loadMessages();
                    enableMessaging();
                    loadGroupMembers(currentChatId);
                });
            });
            
        } catch (error) {
            console.error("Ошибка загрузки групп:", error);
            showNotification("Не удалось загрузить группы");
        }
    }
    
    
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

    loadUserProfile();
    loadContacts().then(initPresence);

    async function initPresence() {
        try {
            const res = await fetch('/users/online', { headers: getAuthHeaders() });
            if (!res.ok) return;
            const onlineIds = await res.json();
            document.querySelectorAll('.contact').forEach(c => {
                const id = parseInt(c.getAttribute('data-id'), 10);
                const statusEl = c.querySelector('.contact-status');
                if (!statusEl) return;
                if (onlineIds.includes(id)) statusEl.classList.replace('offline','online');
                else statusEl.classList.replace('online','offline');
            });
        } catch (e) { console.error(e); }
    }

    messageContainer.addEventListener('contextmenu', function(e) {
        const messageEl = e.target.closest('.message');
        if (!messageEl) return;
        
        e.preventDefault();
        const menu = document.getElementById('message-menu');
        menu.style.top = e.pageY + 'px';
        menu.style.left = e.pageX + 'px';
        menu.classList.remove('hidden');
        menu.currentMessageEl = messageEl;
        
        // Get all menu buttons
        const editBtn = document.getElementById('edit-message-btn');
        const deleteBtn = document.getElementById('delete-message-btn');
        const translateBtn = document.getElementById('translate-message-btn');
        const revertBtn = document.getElementById('revert-message-btn');

        // Reset to hide all buttons before showing relevant ones
        editBtn.classList.add('hidden');
        deleteBtn.classList.add('hidden');
        translateBtn.classList.add('hidden');
        revertBtn.classList.add('hidden');

        // Check if message has been translated
        const hasTranslation = messageEl.hasAttribute('data-original-text');
        
        // If it's your message (outgoing)
        if (messageEl.classList.contains('outgoing')) {
            // Show edit and delete options
            editBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
        }
        
        // Show translate or revert for all messages
        if (hasTranslation) {
            revertBtn.classList.remove('hidden');
        } else {
            translateBtn.classList.remove('hidden');
        }
    });

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('message-menu');
        if (!menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    document.getElementById('edit-message-btn').addEventListener('click', function() {
        const menu = document.getElementById('message-menu');
        const messageEl = menu.currentMessageEl;
        if (!messageEl) return;
        
        const bubble = messageEl.querySelector('.message-bubble');
        const p = bubble.querySelector('p');
        const originalText = p ? p.textContent : '';
        const msgId = messageEl.getAttribute('data-message-id');
        
        messageInput.value = originalText;
        messageInput.focus();
        
        editingMessageId = msgId;
        
        sendButton.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
        sendButton.classList.add('editing');
        
        if (!document.getElementById('cancel-edit-input-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-edit-input-btn';
            cancelBtn.className = 'cancel-edit-btn';
            cancelBtn.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
            cancelBtn.title = 'Cancel editing';
            cancelBtn.addEventListener('click', cancelEditing);
            
            sendButton.parentNode.insertBefore(cancelBtn, sendButton);
        }
        
        menu.classList.add('hidden');
    });

    function cancelEditing() {
        sendButton.innerHTML = originalSendButtonHTML;
        sendButton.classList.remove('editing');
        
        messageInput.value = '';
        
        editingMessageId = null;;
        
        const cancelBtn = document.getElementById('cancel-edit-input-btn');
        if (cancelBtn) cancelBtn.remove();
        
        const indicator = document.getElementById('editing-indicator');
        if (indicator) indicator.remove();
    }

    document.getElementById('delete-message-btn').addEventListener('click', function() {
        const menu = document.getElementById('message-menu');
        const messageEl = menu.currentMessageEl;
        const msgId = messageEl.getAttribute('data-message-id');
        deleteMessage(msgId);
        menu.classList.add('hidden');
    });
    document.getElementById('translate-message-btn').addEventListener('click', async function() {
        const menu = document.getElementById('message-menu');
        const messageEl = menu.currentMessageEl;
        if (!messageEl) return;
        const bubble = messageEl.querySelector('.message-bubble');
        const p = bubble.querySelector('p');
        const originalText = p ? p.textContent : '';
        try {
            showNotification('Translating...');
            const isCyrillic = /[\u0400-\u04FF]/.test(originalText);
            const langpair = isCyrillic ? 'ru|en' : 'en|ru';
            const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalText)}&langpair=${langpair}`);
            if (!resp.ok) throw new Error('Translation API error');
            const data = await resp.json();
            const translated = data.responseData.translatedText;
            if (p) {
// Save original text in a data attribute
                messageEl.dataset.originalText = originalText;
                p.textContent = translated;
            }
        } catch (e) {
            console.error('Translation failed:', e);
            showNotification('Translation failed');
        }
        menu.classList.add('hidden');
 });

    document.getElementById('revert-message-btn').addEventListener('click', function() {
        const menu = document.getElementById('message-menu');
        const messageEl = menu.currentMessageEl;
        if (!messageEl) return;
        const bubble = messageEl.querySelector('.message-bubble');
        const p = bubble.querySelector('p');
        const originalText = messageEl.dataset.originalText || '';
        if (p && originalText) {
            p.textContent = originalText;
            // Remove saved original text
            delete messageEl.dataset.originalText;
            // Toggle buttons
            document.getElementById('revert-message-btn').classList.add('hidden');
            document.getElementById('translate-message-btn').classList.remove('hidden');
        }
        menu.classList.add('hidden');
    });
});