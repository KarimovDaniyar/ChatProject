import sqlite3
from passlib.context import CryptContext

DATABASE = 'chat.db'

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    # Add new contacts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            user_id INTEGER,
            contact_id INTEGER,
            PRIMARY KEY (user_id, contact_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (contact_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def create_user(username, password):
    conn = get_db()
    hashed_password = pwd_context.hash(password)
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "username": username}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_or_create_chat(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM chats WHERE id = ?", (chat_id,))
    chat = cursor.fetchone()
    if not chat:
        pass
    conn.close()
    return chat_id

def create_message(chat_id, user_id, content):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO messages (chat_id, user_id, content) VALUES (?, ?, ?)",
                   (chat_id, user_id, content))
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()
    return message_id

def get_messages(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT m.id, m.content, m.timestamp, u.username
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.timestamp ASC
    ''', (chat_id,))
    messages = cursor.fetchall()
    conn.close()
    return [dict(msg) for msg in messages]

def get_all_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users")
    users = cursor.fetchall()
    conn.close()
    return [dict(user) for user in users]

# Add the missing functions
def add_contact(user_id, contact_id):
    """Add a contact for the user. Returns True if successful."""
    if user_id == contact_id:
        return False  # Can't add yourself as a contact
    
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check if contact exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (contact_id,))
        if not cursor.fetchone():
            return False  # Contact doesn't exist
            
        # Check if already a contact
        cursor.execute(
            "SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?", 
            (user_id, contact_id)
        )
        if cursor.fetchone():
            return False  # Already a contact
            
        # Add the contact
        cursor.execute(
            "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
            (user_id, contact_id)
        )
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    finally:
        conn.close()

def get_contacts(user_id):
    """Get all contacts for a user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username
        FROM users u
        JOIN contacts c ON u.id = c.contact_id
        WHERE c.user_id = ?
    ''', (user_id,))
    contacts = cursor.fetchall()
    conn.close()
    return [dict(contact) for contact in contacts]

def search_users(query, current_user_id):
    """Search for users by username, excluding the current user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username FROM users WHERE username LIKE ? AND id != ?",
        (f"%{query}%", current_user_id)
    )
    users = cursor.fetchall()
    conn.close()
    return [dict(user) for user in users]
