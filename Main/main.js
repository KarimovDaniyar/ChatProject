document.addEventListener('DOMContentLoaded', function() {

    const contacts = document.querySelectorAll('.contact');
    // Данные пользователя (для примера)
    const currentUser = {
        name: 'You',
        avatar: 'avatar.png' // Путь к вашей аватарке
    };

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
        
        // Используем аватарку текущего пользователя
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
});



