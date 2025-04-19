import sqlite3

DATABASE = 'chat.db'

def migrate_database():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Check if migration is needed
        cursor.execute("PRAGMA table_info(chats)")
        columns = [col['name'] for col in cursor.fetchall()]
        if 'is_group' in columns:
            print("Database already migrated. No changes needed.")
            return

        # Create a new chats table with the is_group column
        cursor.execute('''
            CREATE TABLE chats_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                is_group BOOLEAN DEFAULT FALSE
            )
        ''')

        # Copy data from old chats table to new chats table
        cursor.execute('''
            INSERT INTO chats_new (id, name)
            SELECT id, name FROM chats
        ''')

        # Drop the old chats table
        cursor.execute('DROP TABLE chats')

        # Rename chats_new to chats
        cursor.execute('ALTER TABLE chats_new RENAME TO chats')

        # Create the chat_members table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_members (
                chat_id INTEGER,
                user_id INTEGER,
                PRIMARY KEY (chat_id, user_id),
                FOREIGN KEY (chat_id) REFERENCES chats(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        conn.commit()
        print("Database migration completed successfully.")
    except sqlite3.Error as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()