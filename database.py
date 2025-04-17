import sqlite3
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    conn = sqlite3.connect("DataBase.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES chats(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()

def create_user(username: str, password: str):
    conn = sqlite3.connect("DataBase.db")
    cursor = conn.cursor()
    hashed_password = pwd_context.hash(password)
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        user = cursor.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return {"id": user[0], "username": user[1]}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username: str):
    conn = sqlite3.connect("DataBase.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    if user:
        return {"id": user[0], "username": user[1], "password": user[2]}
    return None

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def create_message(chat_id: int, user_id: int, content: str):
    conn = sqlite3.connect("DataBase.db")
    cursor = conn.cursor()
    timestamp = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO messages (chat_id, user_id, content, timestamp) VALUES (?, ?, ?, ?)",
        (chat_id, user_id, content, timestamp)
    )
    conn.commit()
    conn.close()

def get_messages(chat_id: int):
    conn = sqlite3.connect("DataBase.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC", (chat_id,))
    messages = cursor.fetchall()
    conn.close()
    return [{"id": msg[0], "chat_id": msg[1], "user_id": msg[2], "content": msg[3], "timestamp": msg[4]} for msg in messages]