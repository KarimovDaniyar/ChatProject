document.addEventListener('DOMContentLoaded', function() {

    const contacts = document.querySelectorAll('.contact');
    const contactsList = document.querySelector('.contacts-list');
    // Update user data with correct path to avatar image
    const currentUser = {
        name: 'You',
        avatar: '/static/images/avatar.png' // Updated path to avatar
    };

    // Media handling variables
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

    // Emoji picker variables
    const emojiButton = document.querySelector('.emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const closeEmojiPickerBtn = document.getElementById('close-emoji-picker');
    const emojiGrid = document.getElementById('emoji-grid');
    const emojiLoading = document.querySelector('.emoji-loading');
    const messageText = document.getElementById('message-text');
    let emojisLoaded = false;
    const API_KEY = '5ea1113c8ca5c111a97f7be1af7b95886bd84898';
    const API_URL = `https://emoji-api.com/emojis?access_key=${API_KEY}`;

    // Add User Modal functionality
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
    
    // Edit Profile Modal functionality
    const editProfileButton = document.getElementById('edit-profile');
    const editProfileContainer = document.getElementById('edit-profile-container');
    const cancelEditProfile = document.getElementById('cancel-edit-profile');
    const saveProfileBtn = document.getElementById('save-profile');
    const editUsernameInput = document.getElementById('edit-username');
    const editEmailInput = document.getElementById('edit-email');
    const editPasswordInput = document.getElementById('edit-password');
    
    // User Menu functionality
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');

    // Show modal when "Add User" button is clicked
    addUserButton.addEventListener('click', function() {
        addUserContainer.classList.remove('hidden');
        newContactNameInput.focus();
        // Also close the menu when opening the modal
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    // Hide modal when "Cancel" button is clicked
    cancelAddContact.addEventListener('click', function() {
        addUserContainer.classList.add('hidden');
        newContactNameInput.value = ''; // Clear input field
    });

    // Add new contact when "Add" button is clicked (placeholder functionality)
    addContactBtn.addEventListener('click', function() {
        const contactName = newContactNameInput.value.trim();
        if (contactName) {
            // In a real app, you would save the new contact to your database
            // For now, we'll just hide the modal
            addUserContainer.classList.add('hidden');
            newContactNameInput.value = ''; // Clear input field
            
            // You could add code here to dynamically create a new contact in the UI
            // This would be a good place to add that functionality in the future
        }
    });

    // Close modal when clicking outside
    addUserContainer.addEventListener('click', function(e) {
        if (e.target === addUserContainer) {
            addUserContainer.classList.add('hidden');
            newContactNameInput.value = ''; // Clear input field
        }
    });

    // Show modal when "Add Group" button is clicked
    addGroupButton.addEventListener('click', function() {
        addGroupContainer.classList.remove('hidden');
        newGroupNameInput.focus();
        // Also close the menu when opening the modal
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });

    // Hide modal when "Cancel" button is clicked for group
    cancelAddGroup.addEventListener('click', function() {
        addGroupContainer.classList.add('hidden');
        newGroupNameInput.value = ''; // Clear input field
    });

    // Add new group when "Add" button is clicked
    addGroupBtn.addEventListener('click', function() {
        const groupName = newGroupNameInput.value.trim();
        if (groupName) {
            // Create new group element
            createNewGroup(groupName);
            
            // Hide the modal and clear input field
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = '';
        }
    });

    // Function to create and add a new group to the contacts list
    function createNewGroup(groupName) {
        // Create the group element
        const groupElement = document.createElement('div');
        groupElement.className = 'contact';
        groupElement.dataset.type = 'group'; // Mark this as a group for differentiation
        
        // Group HTML structure
        groupElement.innerHTML = `
            <div class="contact-avatar">
                <img src="/static/images/avatar.png" alt="${groupName}">
            </div>
            <div class="contact-info">
                <h3>${groupName}</h3>
                <p>Group chat</p>
            </div>
            <div class="contact-status"></div>
        `;
        
        // Add click event listener to the new group
        groupElement.addEventListener('click', function() {
            // Remove active class from all contacts
            contacts.forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
            
            // Add active class to this group
            this.classList.add('active');
            
            // Update chat header with group info
            const groupName = this.querySelector('.contact-info h3').textContent;
            const groupImg = this.querySelector('.contact-avatar img').src;
            
            document.querySelector('.current-contact .contact-info h3').textContent = groupName;
            document.querySelector('.current-contact .contact-info p').textContent = 'Group';
            document.querySelector('.current-contact .contact-avatar img').src = groupImg;
            
            // Clear chat messages since this is a new group
            const messages = document.querySelector('.messages');
            messages.innerHTML = '';
        });
        
        // Add the new group to the contacts list at the top
        const contactsList = document.querySelector('.contacts-list');
        if (contactsList.firstChild) {
            contactsList.insertBefore(groupElement, contactsList.firstChild);
        } else {
            contactsList.appendChild(groupElement);
        }
        
        // Automatically select the new group
        groupElement.click();
    }

    // Close modal when clicking outside for group
    addGroupContainer.addEventListener('click', function(e) {
        if (e.target === addGroupContainer) {
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = ''; // Clear input field
        }
    });

    // Show modal when "Edit Profile" button is clicked
    editProfileButton.addEventListener('click', function() {
        // Get current profile data
        const username = document.querySelector('.profile-info h3').textContent;
        const email = document.querySelector('.profile-info p').textContent;
        
        // Pre-fill the form fields with current data
        editUsernameInput.value = username;
        editEmailInput.value = email;
        editPasswordInput.value = ''; // Password is blank for security
        
        // Show the modal
        editProfileContainer.classList.remove('hidden');
        editUsernameInput.focus();
        
        // Close the menu
        menu.classList.remove('active');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    });
    
    // Hide modal when "Back" button is clicked for profile
    cancelEditProfile.addEventListener('click', function() {
        editProfileContainer.classList.add('hidden');
        // No need to clear fields as they'll be repopulated on open
    });
    
    // Save profile changes when "Checkmark" button is clicked
    saveProfileBtn.addEventListener('click', function() {
        const username = editUsernameInput.value.trim();
        const email = editEmailInput.value.trim();
        const password = editPasswordInput.value.trim();
        
        if (username && email) {
            // In a real app, you would update the user profile in your database
            // For now, we'll just update the UI and hide the modal
            document.querySelector('.profile-info h3').textContent = username;
            document.querySelector('.profile-info p').textContent = email;
            
            // If password was provided, you would handle that here
            if (password) {
                // console.log('Password would be updated in a real app');
            }
            
            // Hide the modal
            editProfileContainer.classList.add('hidden');
        }
    });
    
    // Close modal when clicking outside for profile edit
    editProfileContainer.addEventListener('click', function(e) {
        if (e.target === editProfileContainer) {
            editProfileContainer.classList.add('hidden');
        }
    });

    // Show/hide user menu when button is clicked
    userMenuBtn.addEventListener('click', function() {
        // Get current active contact
        const activeContact = document.querySelector('.contact.active');
        
        // Check if it's a group chat
        if (activeContact && activeContact.dataset.type === 'group') {
            // It's a group - show group profile menu
            showGroupProfileMenu();
        } else {
            // It's a regular contact - show normal user menu
            userMenu.classList.toggle('hidden');
            userMenu.classList.toggle('active');
            
            // Close the menu when clicking outside
            document.addEventListener('click', handleOutsideClickUserMenu);
        }
    });
    
    // Group profile menu functionality
    const groupProfileMenu = document.getElementById('group-profile-menu');
    const leaveGroupBtn = document.getElementById('leave-group');
    const addMembersBtn = document.getElementById('add-members');
    const editGroupNameBtn = document.getElementById('edit-group-name');
    const saveGroupNameBtn = document.getElementById('save-group-name');
    const groupNameDisplay = document.getElementById('group-name-display');
    const editGroupNameContainer = document.getElementById('edit-group-name-container');
    const groupNameInput = document.getElementById('group-name-input');
    
    // Function to show group profile
    function showGroupProfileMenu() {
        // Get current group info
        const activeGroup = document.querySelector('.contact.active');
        const groupName = activeGroup.querySelector('.contact-info h3').textContent;
        const groupImg = activeGroup.querySelector('.contact-avatar img').src;
        
        // Update group profile modal with current info
        groupNameDisplay.textContent = groupName;
        groupProfileMenu.querySelector('.group-profile-avatar img').src = groupImg;
        
        // Show the modal
        groupProfileMenu.classList.remove('hidden');
    }
    
    // Handle leaving group
    leaveGroupBtn.addEventListener('click', function() {
        // Get the current group info
        const activeGroup = document.querySelector('.contact.active');
        const groupName = activeGroup.querySelector('.contact-info h3').textContent;
        
        // Get current user info from the profile
        const currentUsername = document.querySelector('.profile-info h3').textContent;
        
        // Close the group profile menu
        groupProfileMenu.classList.add('hidden');
        
        // Add a system message showing that the user left the group
        const messages = document.querySelector('.messages');
        const leaveMessageElement = document.createElement('div');
        leaveMessageElement.classList.add('system-message');
        leaveMessageElement.innerHTML = `
            <div class="system-message-content">
                <p>${currentUsername} покинул(а) группу</p>
                <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
        messages.appendChild(leaveMessageElement);
        messages.scrollTop = messages.scrollHeight;
        
        // Mark the group as left in the contact list (visual indicator)
        activeGroup.classList.add('left-group');
        activeGroup.dataset.left = 'true';
        
        // Disable the message input for this group only
        disableMessageInput();
    });
    
    // Function to disable message input for the current chat
    function disableMessageInput() {
        const messageInput = document.getElementById('message-text');
        const sendButton = document.querySelector('.send-button');
        const mediaButton = document.getElementById('media-button');
        const emojiButton = document.querySelector('.emoji-button');
        
        messageInput.disabled = true;
        messageInput.placeholder = 'Вы больше не являетесь участником группы';
        sendButton.disabled = true;
        mediaButton.disabled = true;
        emojiButton.disabled = true;
        
        // Apply visual styles for disabled state
        messageInput.classList.add('disabled');
        sendButton.classList.add('disabled');
        mediaButton.classList.add('disabled');
        emojiButton.classList.add('disabled');
    }
    
    // Function to enable message input
    function enableMessageInput() {
        const messageInput = document.getElementById('message-text');
        const sendButton = document.querySelector('.send-button');
        const mediaButton = document.getElementById('media-button');
        const emojiButton = document.querySelector('.emoji-button');
        
        messageInput.disabled = false;
        messageInput.placeholder = 'Enter message...';
        sendButton.disabled = false;
        mediaButton.disabled = false;
        emojiButton.disabled = false;
        
        messageInput.classList.remove('disabled');
        sendButton.classList.remove('disabled');
        mediaButton.classList.remove('disabled');
        emojiButton.classList.remove('disabled');
    }
    
    // Handle adding members (placeholder)
    addMembersBtn.addEventListener('click', function() {
        // This would show a dialog to add members in a real app
        // For now, we'll just log a message
        console.log('Adding members to group');
    });
    
    // Handle edit group name button
    editGroupNameBtn.addEventListener('click', function() {
        // Hide the display and show edit input
        const currentName = groupNameDisplay.textContent;
        groupNameInput.value = currentName;
        editGroupNameContainer.classList.remove('hidden');
    });
    
    // Handle save group name button
    saveGroupNameBtn.addEventListener('click', function() {
        const newName = groupNameInput.value.trim();
        
        if (newName) {
            // Update displayed name
            groupNameDisplay.textContent = newName;
            
            // Update group in contacts list
            const activeGroup = document.querySelector('.contact.active');
            activeGroup.querySelector('.contact-info h3').textContent = newName;
            
            // Update chat header
            document.querySelector('.current-contact .contact-info h3').textContent = newName;
            
            // Hide edit container
            editGroupNameContainer.classList.add('hidden');
        }
    });
    
    // Close group profile when clicking outside
    groupProfileMenu.addEventListener('click', function(e) {
        if (e.target === groupProfileMenu) {
            groupProfileMenu.classList.add('hidden');
        }
    });
    
    // Handle clicks outside of the user menu
    function handleOutsideClickUserMenu(event) {
        if (!userMenu.contains(event.target) && !userMenuBtn.contains(event.target)) {
            userMenu.classList.remove('active');
            setTimeout(() => {
                userMenu.classList.add('hidden');
            }, 300);
            document.removeEventListener('click', handleOutsideClickUserMenu);
        }
    }
    
    // Add functionality to user menu buttons
    const clearHistoryBtn = userMenu.querySelector('.clear-btn');
    const deleteChatBtn = userMenu.querySelector('.delete-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const cancelConfirmationBtn = document.getElementById('cancel-confirmation');
    const confirmationDeletionBtn = document.getElementById('confirmation-deletion');
    
    clearHistoryBtn.addEventListener('click', function() {
        const messages = document.querySelector('.messages');
        messages.innerHTML = '';
        // Hide the menu after action
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
    });
    
    // Set up deletion confirmation logic
    deleteChatBtn.addEventListener('click', function() {
        // Show the confirmation modal
        confirmationModal.classList.remove('hidden');
        // Hide the user menu
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
    });
    
    // Handle confirmation modal Cancel button
    cancelConfirmationBtn.addEventListener('click', function() {
        confirmationModal.classList.add('hidden');
    });
    
    // Handle confirmation modal Delete button
    confirmationDeletionBtn.addEventListener('click', function() {
        const messages = document.querySelector('.messages');
        messages.innerHTML = '';
        confirmationModal.classList.add('hidden');
    });
    
    // Close confirmation modal when clicking outside
    confirmationModal.addEventListener('click', function(e) {
        if (e.target === confirmationModal) {
            confirmationModal.classList.add('hidden');
        }
    });

    contacts.forEach(contact => {
        contact.addEventListener('click', function() {
            contacts.forEach(c => c.classList.remove('active'));

            this.classList.add('active'); 
            
            //🔹 this — это элемент, на который кликнули, т.е. конкретный .contact, по которому ты щёлкнул.
            //🔹 classList.add('active') — добавляет CSS-класс active к этому элементу.

            const contactName = this.querySelector('.contact-info h3').textContent;
            const contactImg = this.querySelector('.contact-avatar img').src;
            const isOnline = this.querySelector('.contact-status.online') !== null;

            document.querySelector('.current-contact .contact-info h3').textContent = contactName;
            document.querySelector('.current-contact .contact-info p').textContent = isOnline ? 'Online': 'Offline';
            document.querySelector('.current-contact .contact-avatar img').src = contactImg;

            // Check if this is a group chat and if the user has left it
            if (this.dataset.type === 'group' && this.dataset.left === 'true') {
                // This is a group the user has left, disable message input
                disableMessageInput();
            } else {
                // This is a regular contact or an active group, enable message input
                enableMessageInput();
            }

            loadChatHistory(contactName);
        })
    });

    function loadChatHistory(contactName) {
        const messages = document.querySelector('.messages');
        // Очищаем предыдущую историю чата
        messages.innerHTML = '';

        // Здесь в реальном приложении вы бы загрузили историю сообщений из базы данных
        // Для примера добавим несколько демонстрационных сообщений
        setTimeout(() => {
            // Получаем изображение текущего контакта для аватарки
            const contactImg = document.querySelector('.current-contact .contact-avatar img').src;
            
            // Демонстрационные входящие сообщения
            receiveMessage("Привет! Как дела?", contactImg, contactName);
            
            setTimeout(() => {
                receiveMessage("Что нового?", contactImg, contactName);
            }, 1000);
        }, 500);
    }

    const messageForm = document.querySelector('.message-input');
    const messageInput = document.querySelector('.chat-input');

    messageForm.addEventListener('click', function(e) {
        if (e.target.classList.contains('send-button') || e.target.closest('.send-button')) {
            e.preventDefault();
            const message = messageInput.value.trim();

            if (message || selectedMedia.length > 0) {
                sendMessage(message, selectedMedia);
                messageInput.value = '';
                // Clear media previews
                mediaPreviewContainer.classList.add('hidden');
                mediaPreviewContent.innerHTML = '';
                selectedMedia.length = 0; // Clear the array
            }
        }
    });
    
    // Добавляем обработчик для отправки сообщения по нажатию Enter
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const message = messageInput.value.trim();
            
            if (message || selectedMedia.length > 0) {
                sendMessage(message, selectedMedia);
                messageInput.value = '';
                // Clear media previews
                mediaPreviewContainer.classList.add('hidden');
                mediaPreviewContent.innerHTML = '';
                selectedMedia.length = 0; // Clear the array
            }
        }
    });

    function sendMessage(message, mediaFiles = []) {
        const messages = document.querySelector('.messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'outgoing');
        
        // Prepare message content with media if available
        let mediaHTML = '';
        
        if (mediaFiles.length > 0) {
            mediaFiles.forEach(file => {
                const mediaUrl = URL.createObjectURL(file);
                if (file.type.startsWith('image/')) {
                    mediaHTML += `
                        <div class="message-media">
                            <img src="${mediaUrl}" alt="Image">
                        </div>
                    `;
                } else if (file.type.startsWith('video/')) {
                    mediaHTML += `
                        <div class="message-media">
                            <video src="${mediaUrl}" controls></video>
                        </div>
                    `;
                }
            });
        }
        
        let textHTML = message ? `<p>${message}</p>` : '';
        
        // Using updated path to avatar
        messageElement.innerHTML = `
            <div class="message-bubble">
                ${mediaHTML}
                ${textHTML}
                <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="message-avatar">
                <img src="${currentUser.avatar}" alt="${currentUser.name}">
            </div>
        `;
        
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
        
        // Имитация ответа для демонстрации
        simulateReply();
    }
    
    function receiveMessage(message, senderAvatar, senderName, mediaType = null) {
        const messages = document.querySelector('.messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'incoming');
        
        // Add media content if specified
        let mediaHTML = '';
        
        if (mediaType === 'image') {
            mediaHTML = `
                <div class="message-media">
                    <img src="/static/images/avatar.png" alt="Received image">
                </div>
            `;
        } else if (mediaType === 'video') {
            mediaHTML = `
                <div class="message-media">
                    <video src="https://sample-videos.com/video123/mp4/240/big_buck_bunny_240p_1mb.mp4" controls></video>
                </div>
            `;
        }
        
        // Include text if there's a message
        const textHTML = message ? `<p>${message}</p>` : '';
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${senderAvatar}" alt="${senderName}">
            </div>
            <div class="message-bubble">
                ${mediaHTML}
                ${textHTML}
                <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
        
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }
    
    // Функция имитации ответа собеседника для демонстрации
    function simulateReply() {
        // Случайная задержка имитирует "печатание" собеседника
        const delay = Math.random() * 2000 + 1000;
        
        setTimeout(() => {
            // Получаем информацию о текущем собеседнике
            const contactName = document.querySelector('.current-contact .contact-info h3').textContent;
            const contactImg = document.querySelector('.current-contact .contact-avatar img').src;
            
            // Random chance to send media response
            const randomMedia = Math.floor(Math.random() * 10); // 0-9
            
            // Text replies
            const replies = [
                "Хорошо, спасибо!",
                "Интересно...",
                "Я согласен",
                "Давай обсудим это позже",
                "Отлично!",
                "Не уверен, что понимаю",
                "Хммм, нужно подумать"
            ];
            
            // Choose what type of message to send
            if (randomMedia < 2) {
                // Send image only
                receiveMessage('', contactImg, contactName, 'image');
            } else if (randomMedia < 3) {
                // Send video only
                receiveMessage('', contactImg, contactName, 'video');
            } else if (randomMedia < 5) {
                // Send text + image
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                receiveMessage(randomReply, contactImg, contactName, 'image');
            } else {
                // Send text only
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                receiveMessage(randomReply, contactImg, contactName);
            }
        }, delay);
    }

    const searchInput = document.querySelector('.search-contact');
    searchInput.addEventListener('input', function(){
        const searchTerm = this.value.toLowerCase();

        contacts.forEach(contact => {
            const contactName = contact.querySelector('.contact-info h3').textContent.toLocaleLowerCase();
            if(contactName.includes(searchTerm)){
                contact.style.display = 'flex';
            } else {
                contact.style.display = 'none'
            }
        });
    });

    // Updated menu functionality
    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    
    // Add click event for opening menu
    menuBtn.addEventListener('click', function() {
        menu.classList.remove('hidden');
        setTimeout(() => {
            menu.classList.add('active');
        }, 10);
    });
    
    // Add click event for closing menu when clicking outside
    document.addEventListener('click', function(event) {
        // Check if click is outside the menu and the menu button
        if (!menu.contains(event.target) && !menuBtn.contains(event.target) && menu.classList.contains('active')) {
            menu.classList.remove('active');
            setTimeout(() => {
                menu.classList.add('hidden');
            }, 300); // Add delay equal to transition time
        }
    });
    
    // Add close button functionality for the menu
    document.getElementById('logout').addEventListener('click', function() {
        // Redirect to logout URL
        window.location.href = '/logout';
    });

    // Media handling functionality
    mediaButton.addEventListener('click', function() {
        // Close emoji picker if it's open
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
                // Add to selected media array
                selectedMedia.push(file);
                
                // Create preview
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
        
        // Show preview container
        if (selectedMedia.length > 0) {
            mediaPreviewContainer.classList.remove('hidden');
        }
    }
    
    // Remove media preview item
    mediaPreviewContent.addEventListener('click', function(e) {
        if (e.target.closest('.remove-preview')) {
            const button = e.target.closest('.remove-preview');
            const index = parseInt(button.getAttribute('data-index'));
            
            // Remove from array and DOM
            selectedMedia.splice(index, 1);
            button.closest('.preview-item').remove();
            
            // Reindex remaining buttons
            document.querySelectorAll('.remove-preview').forEach((btn, idx) => {
                btn.setAttribute('data-index', idx);
            });
            
            // Hide container if no more media
            if (selectedMedia.length === 0) {
                mediaPreviewContainer.classList.add('hidden');
            }
        }
    });
    
    // Close preview container
    closePreviewBtn.addEventListener('click', function() {
        mediaPreviewContainer.classList.add('hidden');
        mediaPreviewContent.innerHTML = '';
        selectedMedia.length = 0; // Clear the array
    });
    
    // Media lightbox functionality
    document.addEventListener('click', function(e) {
        const mediaImg = e.target.closest('.message-media img, .message-media video');
        if (mediaImg) {
            const mediaUrl = mediaImg.src || mediaImg.currentSrc;
            const isVideo = mediaImg.tagName.toLowerCase() === 'video';
            
            // Set content in lightbox
            if (isVideo) {
                lightboxContent.innerHTML = `<video src="${mediaUrl}" controls autoplay></video>`;
                downloadMediaBtn.setAttribute('data-src', mediaUrl);
                downloadMediaBtn.setAttribute('data-filename', 'video_' + new Date().getTime() + '.mp4');
            } else {
                lightboxContent.innerHTML = `<img src="${mediaUrl}" alt="Full size image">`;
                downloadMediaBtn.setAttribute('data-src', mediaUrl);
                downloadMediaBtn.setAttribute('data-filename', 'image_' + new Date().getTime() + '.jpg');
            }
            
            // Show lightbox
            mediaLightbox.classList.remove('hidden');
        }
    });
    
    // Close lightbox
    closeLightboxBtn.addEventListener('click', function() {
        mediaLightbox.classList.add('hidden');
        lightboxContent.innerHTML = '';
    });
    
    // Download media
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
    
    // Click outside lightbox to close
    mediaLightbox.addEventListener('click', function(e) {
        if (e.target === mediaLightbox) {
            mediaLightbox.classList.add('hidden');
            lightboxContent.innerHTML = '';
        }
    });

    // Emoji picker functionality
    emojiButton.addEventListener('click', function() {
        // Close media preview if it's open
        if (!mediaPreviewContainer.classList.contains('hidden')) {
            mediaPreviewContainer.classList.add('hidden');
        }
        
        // Show the emoji picker
        emojiPickerContainer.classList.remove('hidden');
        
        // Load emojis if they haven't been loaded yet
        if (!emojisLoaded) {
            fetchEmojis();
        }
    });
    
    // Close emoji picker when clicking the close button
    closeEmojiPickerBtn.addEventListener('click', function() {
        emojiPickerContainer.classList.add('hidden');
    });
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', function(event) {
        if (!emojiPickerContainer.contains(event.target) && 
            !emojiButton.contains(event.target) && 
            !emojiPickerContainer.classList.contains('hidden')) {
            emojiPickerContainer.classList.add('hidden');
        }
    });
    
    // Function to fetch emojis from API
    function fetchEmojis() {
        // Show loading indicator
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
                // Hide loading indicator
                emojiLoading.style.display = 'none';
                
                // Process and display emojis
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
    
    // Function to display emojis in the grid
    function displayEmojis(emojis) {
        // Limit to a reasonable number of emojis to avoid performance issues
        const limitedEmojis = emojis.slice(0, 100);
        
        limitedEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji.character;
            emojiItem.title = emoji.unicodeName;
            
            // Add click event to insert emoji into message input
            emojiItem.addEventListener('click', function() {
                insertEmoji(emoji.character);
            });
            
            emojiGrid.appendChild(emojiItem);
        });
    }
    
    // Function to insert emoji at cursor position in message input
    function insertEmoji(emoji) {
        const cursorPos = messageText.selectionStart;
        const textBefore = messageText.value.substring(0, cursorPos);
        const textAfter = messageText.value.substring(cursorPos);
        
        messageText.value = textBefore + emoji + textAfter;
        
        // Set cursor position after the inserted emoji
        messageText.selectionStart = cursorPos + emoji.length;
        messageText.selectionEnd = cursorPos + emoji.length;
        
        // Focus back on input
        messageText.focus();
    }

    // Handle adding members
    addMembersBtn.addEventListener('click', function() {
        // Close the group profile menu
        groupProfileMenu.classList.add('hidden');
        
        // Show the add members popup
        showAddMembersPopup();
    });
    
    // Add Members Popup functionality
    const addMembersPopup = document.getElementById('add-members-popup');
    const closeAddMembersBtn = document.getElementById('close-add-members');
    const cancelAddMembersBtn = document.getElementById('cancel-add-members');
    const confirmAddMembersBtn = document.getElementById('confirm-add-members');
    const searchMembersInput = document.getElementById('search-members');
    const contactsSelectionList = document.getElementById('contacts-selection-list');
    
    // Function to show add members popup
    function showAddMembersPopup() {
        // Get all contacts to populate the list
        populateContactsSelectionList();
        
        // Show the popup
        addMembersPopup.classList.remove('hidden');
        
        // Focus on search input
        searchMembersInput.focus();
    }
    
    // Function to populate the contacts selection list
    function populateContactsSelectionList() {
        // Clear existing list
        contactsSelectionList.innerHTML = '';
        
        // Get all contacts from the contacts list
        const allContacts = document.querySelectorAll('.contact:not([data-type="group"])');
        
        // Get current active group
        const activeGroup = document.querySelector('.contact.active[data-type="group"]');
        
        // Get list of existing members' names from the group
        const groupMembersList = document.getElementById('group-members-list');
        const existingMembers = Array.from(groupMembersList.querySelectorAll('.group-member')).map(
            member => member.querySelector('.member-info h4').textContent
        );
        
        // For each contact, create a selection item if they're not already in the group
        allContacts.forEach(contact => {
            const contactName = contact.querySelector('.contact-info h3').textContent;
            
            // Skip if this contact is already in the group
            if (existingMembers.includes(contactName)) {
                return;
            }
            
            const contactImg = contact.querySelector('.contact-avatar img').src;
            const isOnline = contact.querySelector('.contact-status.online') !== null;
            
            const selectionItem = document.createElement('div');
            selectionItem.className = 'contact-selection-item';
            selectionItem.innerHTML = `
                <input type="checkbox" class="contact-checkbox" data-name="${contactName}">
                <div class="contact-selection-avatar">
                    <img src="${contactImg}" alt="${contactName}">
                </div>
                <div class="contact-selection-info">
                    <h4>${contactName}</h4>
                    <p>${isOnline ? 'Online' : 'Offline'}</p>
                </div>
            `;
            
            contactsSelectionList.appendChild(selectionItem);
        });
        
        // Show message if no contacts are available to add
        if (contactsSelectionList.children.length === 0) {
            const noContactsMessage = document.createElement('div');
            noContactsMessage.className = 'no-contacts-message';
            noContactsMessage.innerHTML = 'Все контакты уже добавлены в группу';
            contactsSelectionList.appendChild(noContactsMessage);
        }
    }
    
    // Function to handle search in contacts list
    searchMembersInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        // Filter contacts based on search term
        const contactItems = contactsSelectionList.querySelectorAll('.contact-selection-item');
        
        contactItems.forEach(item => {
            const contactName = item.querySelector('.contact-selection-info h4').textContent.toLowerCase();
            
            if (contactName.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
    
    // Close add members popup
    closeAddMembersBtn.addEventListener('click', function() {
        addMembersPopup.classList.add('hidden');
    });
    
    // Cancel adding members
    cancelAddMembersBtn.addEventListener('click', function() {
        addMembersPopup.classList.add('hidden');
    });
    
    // Confirm adding selected members
    confirmAddMembersBtn.addEventListener('click', function() {
        // Get all selected contacts
        const selectedCheckboxes = contactsSelectionList.querySelectorAll('.contact-checkbox:checked');
        const selectedNames = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.name);
        
        // If at least one contact is selected
        if (selectedNames.length > 0) {
            // Get current group
            const activeGroup = document.querySelector('.contact.active[data-type="group"]');
            const groupName = activeGroup.querySelector('.contact-info h3').textContent;
            
            // Get members list
            const groupMembersList = document.getElementById('group-members-list');
            
            // Add selected contacts to group members
            let contactsAdded = false;
            
            selectedNames.forEach(name => {
                // Check if member already exists in the group
                const existingMember = groupMembersList.querySelector(`.group-member[data-name="${name}"]`);
                if (!existingMember) {
                    contactsAdded = true;
                    
                    // Find contact in contacts list to get image
                    let contactImg = '/static/images/avatar.png';
                    document.querySelectorAll('.contact').forEach(contact => {
                        const contactName = contact.querySelector('.contact-info h3').textContent;
                        if (contactName === name) {
                            contactImg = contact.querySelector('.contact-avatar img').src;
                        }
                    });
                    
                    // Create new member element
                    const memberElement = document.createElement('div');
                    memberElement.className = 'group-member';
                    memberElement.dataset.name = name;
                    memberElement.innerHTML = `
                        <div class="member-avatar">
                            <img src="${contactImg}" alt="${name}">
                        </div>
                        <div class="member-info">
                            <h4>${name}</h4>
                            <p>Участник</p>
                        </div>
                    `;
                    
                    // Add to members list
                    groupMembersList.appendChild(memberElement);
                    
                    // Add system message in chat
                    addSystemMessage(`${name} добавлен(а) в группу`);
                }
            });
            
            // If group was previously left, reactivate it when adding new members
            if (activeGroup.classList.contains('left-group') && contactsAdded) {
                // Remove left-group styling
                activeGroup.classList.remove('left-group');
                delete activeGroup.dataset.left;
                
                // Re-enable message input
                const messageInput = document.getElementById('message-text');
                const sendButton = document.querySelector('.send-button');
                const mediaButton = document.getElementById('media-button');
                
                messageInput.disabled = false;
                messageInput.placeholder = "Enter message...";
                sendButton.disabled = false;
                mediaButton.disabled = false;
                
                messageInput.classList.remove('disabled');
                sendButton.classList.remove('disabled');
                mediaButton.classList.remove('disabled');
                
                // Add system message that you rejoined the group
                const currentUsername = document.querySelector('.profile-info h3').textContent;
                addSystemMessage(`${currentUsername} вернулся(ась) в группу`);
            }
            
            // Close popup
            addMembersPopup.classList.add('hidden');
        }
    });
    
    // Function to add system message to chat
    function addSystemMessage(message) {
        const messages = document.querySelector('.messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('system-message');
        messageElement.innerHTML = `
            <div class="system-message-content">
                <p>${message}</p>
                <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }
});



