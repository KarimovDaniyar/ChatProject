from flask import Flask, request, jsonify, render_template, session, redirect, url_for
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'super secret key'

# Подключение к БД
def get_db():
    conn = sqlite3.connect('db.sqlite3')
    conn.row_factory = sqlite3.Row
    return conn

# ====== ПУТИ ======

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/main')
def main():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template('main.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

# ====== API: Регистрация ======

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    email = data.get('email')
    username = data.get('username')
    password = data.get('password')

    if not email or not username or not password:
        return jsonify({'success': False, 'message': 'Missing fields'}), 400

    conn = get_db()
    try:
        conn.execute('INSERT INTO users (email, username, password) VALUES (?, ?, ?)',
                     (email, username, generate_password_hash(password)))
        conn.commit()
        return jsonify({'success': True})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'User already exists'}), 409

# ====== API: Логин ======

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

# ====== Запуск ======
if __name__ == '__main__':
    app.run(debug=True)
