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
            password TEXT NOT NULL,
            email TEXT UNIQUE
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            is_group BOOLEAN DEFAULT FALSE
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_members (
            chat_id INTEGER,
            user_id INTEGER,
            PRIMARY KEY (chat_id, user_id),
            FOREIGN KEY (chat_id) REFERENCES chats(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
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

def create_user(username, password, email):
    conn = get_db()
    hashed_password = pwd_context.hash(password)
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password, email) VALUES (?, ?, ?)", 
                      (username, hashed_password, email))
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "username": username, "email": email}
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

def get_or_create_one_on_one_chat(user_id1, user_id2):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Check if a one-on-one chat exists between these two users
        cursor.execute('''
            SELECT c.id
            FROM chats c
            JOIN chat_members cm1 ON c.id = cm1.chat_id
            JOIN chat_members cm2 ON c.id = cm2.chat_id
            WHERE c.is_group = FALSE
            AND cm1.user_id = ? AND cm2.user_id = ?
            AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
        ''', (user_id1, user_id2))
        
        chat = cursor.fetchone()
        if chat:
            return chat['id']
        
        # Create a new chat
        cursor.execute("INSERT INTO chats (name, is_group) VALUES (?, FALSE)", (f"Chat_{user_id1}_{user_id2}",))
        chat_id = cursor.lastrowid
        
        # Add both users to the chat
        cursor.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)", (chat_id, user_id1))
        cursor.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)", (chat_id, user_id2))
        
        conn.commit()
        return chat_id
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return None
    finally:
        conn.close()

def get_or_create_chat(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM chats WHERE id = ?", (chat_id,))
    chat = cursor.fetchone()
    conn.close()
    if chat:
        return chat['id']
    raise ValueError(f"Chat with ID {chat_id} does not exist")

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

def get_or_create_one_on_one_chat(user_id1, user_id2):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Check if a one-on-one chat exists between these two users
        cursor.execute('''
            SELECT c.id
            FROM chats c
            JOIN chat_members cm1 ON c.id = cm1.chat_id
            JOIN chat_members cm2 ON c.id = cm2.chat_id
            WHERE c.is_group = FALSE
            AND cm1.user_id = ? AND cm2.user_id = ?
            AND (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) = 2
        ''', (user_id1, user_id2))
        
        chat = cursor.fetchone()
        if chat:
            return chat['id']
        
        # Create a new chat
        cursor.execute("INSERT INTO chats (name, is_group) VALUES (?, FALSE)", (f"Chat_{user_id1}_{user_id2}",))
        chat_id = cursor.lastrowid
        
        # Add both users to the chat
        cursor.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)", (chat_id, user_id1))
        cursor.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)", (chat_id, user_id2))
        
        conn.commit()
        return chat_id
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise sqlite3.Error(f"Failed to create or retrieve chat: {e}")
    finally:
        conn.close()
def add_contact(user_id, contact_id):
    if user_id == contact_id:
        return False

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE id = ?", (contact_id,))
        if not cursor.fetchone():
            return False

        cursor.execute(
            "SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id)
        )
        if cursor.fetchone():
            return False

        cursor.execute(
            "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
            (user_id, contact_id)
        )
        cursor.execute(
            "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
            (contact_id, user_id)
        )

        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    finally:
        conn.close()

def get_contacts(user_id):
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
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username
        FROM users
        WHERE username LIKE ? AND id != ?
    ''', (f"%{query}%", current_user_id))
    users = cursor.fetchall()
    conn.close()
    return [dict(user) for user in users]