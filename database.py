# database.py
import sqlite3
from datetime import datetime

def get_db_connection():
    conn = sqlite3.connect("DataBase.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            recipient_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            message_status TEXT DEFAULT 'sent',
            resources TEXT,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (recipient_id) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()

init_db()

def add_user(username, email, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, password))
        conn.commit()
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()
    return True

def verify_user(email, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    conn.close()
    return users

def add_message(sender_id, recipient_id, content, resources=None):
    timestamp = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO messages (sender_id, recipient_id, content, timestamp, resources)
        VALUES (?, ?, ?, ?, ?)
    """, (sender_id, recipient_id, content, timestamp, resources))
    conn.commit()
    conn.close()

def get_messages(sender_id, recipient_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM messages
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
        ORDER BY timestamp ASC
    """, (sender_id, recipient_id, recipient_id, sender_id))
    messages = cursor.fetchall()
    conn.close()
    return messages