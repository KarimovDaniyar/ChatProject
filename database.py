import sqlite3
from passlib.context import CryptContext
import base64
import os

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER,
        user_id INTEGER,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS media_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        data BLOB NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    conn.commit()
    conn.close()

def create_user(username: str, password: str):
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    try:
        hashed_password = pwd_context.hash(password)
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        return {"id": c.lastrowid, "username": username}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username: str):
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("SELECT id, username, password FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    if user:
        return {"id": user[0], "username": user[1], "password": user[2]}
    return None

def get_all_users():
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("SELECT id, username FROM users")
    users = c.fetchall()
    conn.close()
    return [{"id": user[0], "username": user[1]} for user in users]

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def create_message(chat_id: int, user_id: int, content: str):
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("INSERT INTO messages (chat_id, user_id, content) VALUES (?, ?, ?)", (chat_id, user_id, content))
    conn.commit()
    conn.close()

def get_messages(chat_id: int):
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("""
        SELECT m.id, m.chat_id, m.user_id, m.content, m.timestamp, u.username
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.timestamp
    """, (chat_id,))
    messages = c.fetchall()
    conn.close()
    return [{"id": m[0], "chat_id": m[1], "user_id": m[2], "content": m[3], "timestamp": m[4], "username": m[5]} for m in messages]

def get_or_create_chat(chat_id: int):
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO chats (id) VALUES (?)", (chat_id,))
    conn.commit()
    c.execute("SELECT id FROM chats WHERE id = ?", (chat_id,))
    chat = c.fetchone()
    conn.close()
    return chat[0] if chat else chat_id

def save_media_file(user_id: int, filename: str, content_type: str, file_data: bytes):
    """Save media file directly to database"""
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("INSERT INTO media_files (user_id, filename, content_type, data) VALUES (?, ?, ?, ?)", 
              (user_id, filename, content_type, file_data))
    conn.commit()
    media_id = c.lastrowid
    conn.close()
    return {"id": media_id, "filename": filename}

def get_media_file(filename: str):
    """Retrieve media file from database"""
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("SELECT content_type, data FROM media_files WHERE filename = ?", (filename,))
    result = c.fetchone()
    conn.close()
    
    if result:
        content_type, file_data = result
        return {"content_type": content_type, "data": file_data}
    return None

def get_user_media_files(user_id: int):
    """Get all media files uploaded by a user"""
    conn = sqlite3.connect("chat.db")
    c = conn.cursor()
    c.execute("SELECT id, filename, content_type, timestamp FROM media_files WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
    files = c.fetchall()
    conn.close()
    return [{"id": f[0], "filename": f[1], "content_type": f[2], "timestamp": f[3]} for f in files]