document.addEventListener('DOMContentLoaded', function() {

    const contacts = document.querySelectorAll('.contact');
    // Update user data with correct path to avatar image
    const currentUser = {
        name: 'You',
        avatar: '/static/images/avatar.png' // Updated path to avatar
    };

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

    // Add new group when "Add" button is clicked (placeholder functionality)
    addGroupBtn.addEventListener('click', function() {
        const groupName = newGroupNameInput.value.trim();
        if (groupName) {
            // In a real app, you would save the new group to your database
            // For now, we'll just hide the modal
            addGroupContainer.classList.add('hidden');
            newGroupNameInput.value = ''; // Clear input field
            
            // You could add code here to dynamically create a new group in the UI
            // This would be a good place to add that functionality in the future
        }
    });

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
        userMenu.classList.toggle('hidden');
        userMenu.classList.toggle('active');
        
        // Close the menu when clicking outside
        document.addEventListener('click', handleOutsideClickUserMenu);
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
    
    clearHistoryBtn.addEventListener('click', function() {
        // Clear chat history functionality
        const messages = document.querySelector('.messages');
        messages.innerHTML = '';
        
        // Hide the menu after action
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
    });
    
    deleteChatBtn.addEventListener('click', function() {
        // Delete chat functionality (for demo just clear history)
        const messages = document.querySelector('.messages');
        messages.innerHTML = '';
        
        // Hide the menu after action
        userMenu.classList.remove('active');
        setTimeout(() => {
            userMenu.classList.add('hidden');
        }, 300);
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

            if(message) {
                sendMessage(message);
                messageInput.value = '';
            }
        }
    });
    
    // Добавляем обработчик для отправки сообщения по нажатию Enter
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const message = messageInput.value.trim();
            
            if(message) {
                sendMessage(message);
                messageInput.value = '';
            }
        }
    });

    function sendMessage(message) {
        const messages = document.querySelector('.messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'outgoing');
        
        // Using updated path to avatar
        messageElement.innerHTML = `
            <div class="message-bubble">
                <p>${message}</p>
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
    
    function receiveMessage(message, senderAvatar, senderName) {
        const messages = document.querySelector('.messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'incoming');
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${senderAvatar}" alt="${senderName}">
            </div>
            <div class="message-bubble">
                <p>${message}</p>
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
            
            // Случайные ответы для демонстрации
            const replies = [
                "Хорошо, спасибо!",
                "Интересно...",
                "Я согласен",
                "Давай обсудим это позже",
                "Отлично!",
                "Не уверен, что понимаю",
                "Хммм, нужно подумать"
            ];
            
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            receiveMessage(randomReply, contactImg, contactName);
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
});



