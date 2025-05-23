from datetime import datetime
import sqlite3
from typing import List, Optional
from passlib.context import CryptContext

DATABASE = 'chat.db'

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Create tables if they don't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_activity (
            user_id INTEGER PRIMARY KEY,
            last_active TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            active_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE,
            avatar TEXT DEFAULT '/static/images/avatar.png'
        )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        is_group BOOLEAN DEFAULT FALSE,
        creator_id INTEGER,
        avatar TEXT DEFAULT '/static/images/group.png',
        FOREIGN KEY (creator_id) REFERENCES users(id)
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
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status INTEGER DEFAULT 0,
            is_changed INTEGER DEFAULT 0,
            FOREIGN KEY (chat_id) REFERENCES chats(id),
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Check if migration is needed
    cursor.execute("PRAGMA table_info(messages)")
    columns = [col[1] for col in cursor.fetchall()]
    
        # Seed default users: admin и q с паролем "1"
    default_users = [("Daniyar", "1", "w@gmail.com"), ("Alymbek", "1", "q@gmail.com"), ("Almaz", "1", "a@gmail.com")]
    for username, raw_pwd, email in default_users:
        hashed = pwd_context.hash(raw_pwd)
        cursor.execute(
            "INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)",
            (username, hashed, email)
        )

    conn.commit()
    conn.close()

def migrate_messages_table():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        # Add receiver_id column if it doesn't exist
        cursor.execute('''
            ALTER TABLE messages ADD COLUMN receiver_id INTEGER
        ''')
        # Populate receiver_id for existing messages
        cursor.execute('''
            UPDATE messages
            SET receiver_id = (
                SELECT user_id
                FROM chat_members
                WHERE chat_id = messages.chat_id AND user_id != messages.user_id
            )
            WHERE EXISTS (
                SELECT 1
                FROM chat_members
                WHERE chat_id = messages.chat_id AND user_id != messages.user_id
            )
        ''')
        # Rename user_id to sender_id
        cursor.execute('''
            ALTER TABLE messages RENAME COLUMN user_id TO sender_id
        ''')
        conn.commit()
    except sqlite3.Error as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def create_user(username, password, email, avatar='/static/images/avatar.png'):
    conn = get_db()
    hashed_password = pwd_context.hash(password)
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password, email, avatar) VALUES (?, ?, ?, ?)", 
                      (username, hashed_password, email, avatar))
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "username": username, "email": email, "avatar": avatar}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def get_user(field_name, value):
    """
    Get a user by any field (username or email).
    
    Args:
        field_name: The field to search by ('username' or 'email')
        value: The value to search for
    
    Returns:
        A dictionary with user data if found, None otherwise
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE {field_name} = ?", (value,))
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
    conn.close()
    if chat:
        return chat['id']
    raise ValueError(f"Chat with ID {chat_id} does not exist")

def create_message(chat_id, sender_id, content):
    conn = get_db()
    cursor = conn.cursor()
    
    # Determine receiver_id for one-on-one chats
    cursor.execute('''
        SELECT user_id
        FROM chat_members
        WHERE chat_id = ? AND user_id != ?
    ''', (chat_id, sender_id))
    receiver = cursor.fetchone()
    receiver_id = receiver['user_id'] if receiver else None  # Null for group chats
    
    cursor.execute('''
        INSERT INTO messages (chat_id, sender_id, receiver_id, content, status)
        VALUES (?, ?, ?, ?, 0)
    ''', (chat_id, sender_id, receiver_id, content))
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()
    return message_id

def get_messages(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, m.status, m.is_changed,  u.username as sender_username, u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.timestamp ASC
    ''', (chat_id,))
    messages = cursor.fetchall()
    conn.close()
    return [dict(msg) for msg in messages]

# Новый метод для обновления статуса сообщения

def mark_message_as_read(message_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE messages SET status = 1 WHERE id = ?', (message_id,))
    conn.commit()
    conn.close()

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
        
def create_group_chat(creator_id: int, group_name: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO chats (name, is_group, creator_id) VALUES (?, TRUE, ?)",
            (group_name, creator_id)
        )
        group_id = cursor.lastrowid
        # Добавляем создателя в группу как участника
        cursor.execute(
            "INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)",
            (group_id, creator_id)
        )
        conn.commit()
        return group_id
    except sqlite3.Error as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def add_group_members(group_id: int, user_ids: List[int]):
    conn = get_db()
    cursor = conn.cursor()
    try:
        for user_id in user_ids:
            cursor.execute(
                "INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)",
                (group_id, user_id)
            )
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_contacts(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username,u.avatar
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

def update_user_activity(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO user_activity (user_id, last_active)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET last_active=excluded.last_active
    """, (user_id, now))
    conn.commit()
    conn.close()

def delete_user(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

def get_online_users_list(start: str, end: str) -> List[dict]:
    """
    Возвращает список пользователей, которые были активны между start и end.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.avatar, ua.last_active
        FROM user_activity ua
        JOIN users u ON ua.user_id = u.id
        WHERE ua.last_active BETWEEN ? AND ?
        ORDER BY ua.last_active DESC
    """, (start, end))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def count_online_users(start: str, end: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(DISTINCT user_id) as online_count
        FROM user_activity
        WHERE last_active BETWEEN ? AND ?
    """, (start, end))
    row = cursor.fetchone()
    conn.close()
    return row["online_count"] if row else 0

def count_all_chats()-> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM chats WHERE is_group = 0")
    row = cursor.fetchone()
    conn.close()
    return row[0]

def get_groups_for_admin()->list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM chats WHERE is_group = TRUE")
    groups = cursor.fetchall()
    conn.close()
    return [dict(group) for group in groups]

def get_user_stats(user_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, username, avatar FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return None

    cursor.execute("SELECT COUNT(*) FROM contacts WHERE user_id = ?", (user_id,))
    contacts_count = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*)
        FROM chats c
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = ? AND c.is_group = TRUE
    """, (user_id,))
    groups_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM messages WHERE sender_id = ?", (user_id,))
    messages_count = cursor.fetchone()[0]

    conn.close()

    return {
        "id": user["id"],
        "username": user["username"],
        "avatar": user["avatar"] or "/static/images/avatar.png",
        "contacts_count": contacts_count,
        "groups_count": groups_count,
        "messages_count": messages_count
    }

def get_unread_counts_for_user(user_id: int) -> dict:
    """
    Returns a dictionary mapping contact_id (or chat_id) to count of unread messages for that user.
    For one-on-one chats, count unread messages where receiver_id = user_id and status = 0.
    For groups, count unread messages in group chats where user is a member.
    """
    conn = get_db()
    cursor = conn.cursor()
    # For one-on-one chats, count unread messages per contact
    cursor.execute('''
        SELECT m.chat_id, COUNT(*) as unread_count
        FROM messages m
        JOIN chat_members cm ON m.chat_id = cm.chat_id
        WHERE cm.user_id = ?
          AND m.receiver_id = ?
          AND m.status = 0
        GROUP BY m.chat_id
    ''', (user_id, user_id))
    rows = cursor.fetchall()
    conn.close()
    return {row['chat_id']: row['unread_count'] for row in rows}

def get_unread_counts_by_groups(user_id: int, conn):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT chat_id, COUNT(*) AS unread_count
        FROM messages
        WHERE receiver_id = ?
        AND status = 0
        AND chat_id IN (
            SELECT id FROM chats WHERE is_group = TRUE
        )
        GROUP BY chat_id

    ''', (user_id,))
    rows = cursor.fetchall()
    return {row["chat_id"]: row["unread_count"] for row in rows}
def log_user_activity(user_id: int):
    
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO user_activity_log (user_id, active_at)
        VALUES (?, ?)
    """, (user_id, now))
    conn.commit()
    conn.close()
    
def get_user_active_dates(user_id: int, start: str, end: str) -> list[str]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT DATE(active_at) as active_date
        FROM user_activity_log
        WHERE user_id = ? AND active_at BETWEEN ? AND ?
        ORDER BY active_date DESC
    """, (user_id, start, end))
    rows = cursor.fetchall()
    conn.close()
    return [row['active_date'] for row in rows]

def get_users_active_between(start: str, end: str) -> List[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.avatar, 
       MAX(strftime('%Y-%m-%dT%H:%M:%fZ', ua.active_at)) AS last_active
FROM user_activity_log ua
JOIN users u ON ua.user_id = u.id
WHERE ua.active_at BETWEEN ? AND ?
GROUP BY u.id, u.username, u.avatar
ORDER BY last_active DESC


    """, (start, end))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
