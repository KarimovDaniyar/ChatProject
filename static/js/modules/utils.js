// utils.js - Common utility functions
import { getAuthHeaders } from './auth.js';

// Format timestamp for display
export function formatTimestamp(timestamp) {
    try {
        let date;
        // If timestamp has timezone info, parse directly
        if (/Z$|[+\-]\d{2}:?\d{2}$/.test(timestamp)) {
            date = new Date(timestamp);
        } else {
            // Treat DB timestamp (UTC) by appending 'Z' for UTC parsing
            date = new Date(timestamp.replace(' ', 'T') + 'Z');
        }
        
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

// Update contact preview with last message
export async function fetchAndUpdateContactPreview(contactElement, contactId) {
    try {
        const chatResponse = await fetch(`/chat/one-on-one/${contactId}`, {
            headers: getAuthHeaders()
        });
        
        if (!chatResponse.ok) return;
        
        const { chat_id } = await chatResponse.json();
        const msgResponse = await fetch(`/messages/${chat_id}`, {
            headers: getAuthHeaders()
        });
        
        if (!msgResponse.ok) return;
        
        const messages = await msgResponse.json();
        if (!messages.length) return;
        
        const lastContent = messages[messages.length - 1].content || '';
        let preview = '';
        
        // Format preview based on content type
        if (/\[Media: (.*?)\]/.test(lastContent)) {
            const file = /\[Media: (.*?)\]/.exec(lastContent)[1];
            if (/\.(jpg|jpeg|png|gif)$/i.test(file)) preview = '📷 Photo';
            else if (/\.(mp4|webm|ogg)$/i.test(file)) preview = '🎥 Video';
            else preview = 'Attachment';
        } else {
            preview = lastContent;
        }
        
        if (preview.length > 30) preview = preview.slice(0, 30) + '…';
        
        const previewElem = contactElement.querySelector('.contact-info p');
        if (previewElem) previewElem.textContent = preview;
    } catch (e) {
        console.error('Preview fetch error', e);
    }
}