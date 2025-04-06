document.addEventListener('DOMContentLoaded', function() {
    // Get all contacts
    const contacts = document.querySelectorAll('.contact');
    
    // Add click event to each contact
    contacts.forEach(contact => {
        contact.addEventListener('click', function() {
            // Remove active class from all contacts
            contacts.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked contact
            this.classList.add('active');
            
            // Update chat header with selected contact info
            const contactName = this.querySelector('.contact-info h3').textContent;
            const contactImg = this.querySelector('.contact-avatar img').src;
            const isOnline = this.querySelector('.contact-status.online') !== null;
            
            document.querySelector('.current-contact .contact-info h3').textContent = contactName;
            document.querySelector('.current-contact .contact-info p').textContent = isOnline ? 'Online' : 'Offline';
            document.querySelector('.current-contact .contact-avatar img').src = contactImg;
            
            // In a real app, you would load chat history here
            loadChatHistory(contactName);
        });
    });
    
    // Function to load chat history (mock implementation)
    function loadChatHistory(contactName) {
        const messages = document.querySelector('.messages');
        messages.innerHTML = `<p style="text-align: center; color: #999;">This is the beginning of your conversation with ${contactName}</p>`;
    }
    
    // Handle message sending
    const messageForm = document.querySelector('.message-input');
    const messageInput = document.querySelector('.chat-input');
    
    messageForm.addEventListener('click', function(e) {
        if (e.target.classList.contains('send-button') || e.target.closest('.send-button')) {
            e.preventDefault();
            const message = messageInput.value.trim();
            
            if (message) {
                sendMessage(message);
                messageInput.value = '';
            }
        }
    });
    
    // Function to send message (mock implementation)
    function sendMessage(message) {
        const messages = document.querySelector('.messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'outgoing');
        messageElement.innerHTML = `
            <div class="message-bubble">
                <p>${message}</p>
                <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }
    
    // Search functionality
    const searchInput = document.querySelector('.search-contact');
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        contacts.forEach(contact => {
            const contactName = contact.querySelector('.contact-info h3').textContent.toLowerCase();
            
            if (contactName.includes(searchTerm)) {
                contact.style.display = 'flex';
            } else {
                contact.style.display = 'none';
            }
        });
    });
});