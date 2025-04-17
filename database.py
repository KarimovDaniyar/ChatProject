import sqlite3
from passlib.context import CryptContext

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