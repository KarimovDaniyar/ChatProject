import os
import random
import uuid
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query, File, UploadFile, Form, Path
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.websockets import WebSocketState
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Optional
import sqlite3
import shutil
# Обновляем импорты из database
from database import (
    get_db, get_or_create_one_on_one_chat, init_db, create_user, get_user_by_username, verify_password,
    create_message, get_messages, get_or_create_chat, get_all_users,
    add_contact, get_contacts, search_users
)
from security import create_access_token, decode_access_token
from datetime import datetime
from main import send_email

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Корневая директория проекта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Монтируем статические файлы
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Инициализация базы данных
init_db()

# Хранилище для WebSocket-соединений и активных пользователей
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[Dict]] = {}
        self.active_users: Dict[int, List[Dict]] = {}

    async def connect(self, websocket: WebSocket, chat_id: int, user: dict):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
            self.active_users[chat_id] = []
        if not any(u["id"] == user["id"] for u in self.active_users[chat_id]):
            self.active_users[chat_id].append({"id": user["id"], "username": user["username"]})
        self.active_connections[chat_id].append({"websocket": websocket, "user": user})
        await self.broadcast_users(chat_id)

    def disconnect(self, websocket: WebSocket, chat_id: int, user: dict):
        if chat_id in self.active_connections:
            for conn in self.active_connections[chat_id][:]:  # Copy to avoid modifying during iteration
                if conn["websocket"] == websocket:
                    self.active_connections[chat_id].remove(conn)
                    break
            self.active_users[chat_id] = [u for u in self.active_users[chat_id] if u["id"] != user["id"]]
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]
                del self.active_users[chat_id]
            else:
                self.broadcast_users(chat_id)

    async def broadcast(self, message: dict, chat_id: int):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id][:]:  # Copy to avoid modifying during iteration
                try:
                    # Check if WebSocket is still open
                    if connection["websocket"].client_state == WebSocketState.CONNECTED:
                        await connection["websocket"].send_json(message)
                    else:
                        # Remove closed connection
                        self.active_connections[chat_id].remove(connection)
                except Exception as e:
                    print(f"Error broadcasting to {connection['user']['username']}: {e}")
                    self.active_connections[chat_id].remove(connection)

    async def broadcast_users(self, chat_id: int):
        if chat_id in self.active_connections:
            user_list = self.active_users[chat_id]
            await self.broadcast({"type": "user_list", "users": user_list}, chat_id)

manager = ConnectionManager()

# Модели для входа и регистрации
class UserCreate(BaseModel):
    username: str
    password: str
    email: EmailStr

class UserLogin(BaseModel):
    username: str
    password: str

# Модель для сообщения
class MessageCreate(BaseModel):
    chat_id: int
    content: str

# Модель для добавления контактов
class ContactsAdd(BaseModel):
    contact_ids: List[int]

# Модель для запроса верификации email
class EmailVerification(BaseModel):
    code: str
    email: EmailStr
    temp_token: str

# Модель для повторной отправки кода
class ResendCode(BaseModel):
    email: EmailStr
    temp_token: str

# Словарь для хранения временных кодов верификации
verification_codes = {}
temp_users = {}

# Получение текущего пользователя из токена (для заголовков)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("sub")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Получение текущего пользователя из параметра token (для маршрута /chat)
async def get_current_user_from_query(token: Optional[str] = Query(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Token missing")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("sub")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Проверка токена для WebSocket
async def get_current_user_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        raise WebSocketDisconnect("Missing token")
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Invalid token")
        raise WebSocketDisconnect("Invalid token")
    username = payload.get("sub")
    user = get_user_by_username(username)
    if not user:
        await websocket.close(code=1008, reason="User not found")
        raise WebSocketDisconnect("User not found")
    return user

# Маршруты
@app.get("/", response_class=HTMLResponse)
async def serve_login():
    file_path = os.path.join(BASE_DIR, "templates", "login.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.get("/chat", response_class=HTMLResponse)
async def serve_chat(token: Optional[str] = Query(None)):
    try:
        current_user = await get_current_user_from_query(token)
        file_path = os.path.join(BASE_DIR, "templates", "main.html")
        with open(file_path, encoding="utf-8") as f:
            return f.read()
    except HTTPException as e:
        if e.status_code == 401:
            return RedirectResponse(url="/")
        raise e

@app.get("/register", response_class=HTMLResponse)
async def serve_register():
    file_path = os.path.join(BASE_DIR, "templates", "register.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.post("/register")
async def register(user: UserCreate):
    # Проверяем, существует ли пользователь с таким именем
    existing_user = get_user_by_username(user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    temp_token = str(uuid.uuid4())
    verification_code = str(random.randint(100000, 999999))
    
    temp_users[temp_token] = {
        "username": user.username,
        "password": user.password,
        "email": user.email
    }
    verification_codes[temp_token] = verification_code
    
    # Отправляем код на email пользователя
    send_email_result = await send_email("", user.email, verification_code)
    
    # Возвращаем временный токен
    return {"temp_token": temp_token}

@app.get("/verification", response_class=HTMLResponse)
async def serve_verification():
    file_path = os.path.join(BASE_DIR, "templates", "verification.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.post("/verify-email")
async def verify_email(verification: EmailVerification):
    # Проверяем токен и код
    if verification.temp_token not in verification_codes:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    stored_code = verification_codes[verification.temp_token]
    if stored_code != verification.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Получаем данные пользователя из временного хранилища
    user_data = temp_users.get(verification.temp_token)
    if not user_data:
        raise HTTPException(status_code=400, detail="User data not found")
    
    # Создаем пользователя в базе данных
    new_user = create_user(user_data["username"], user_data["password"], user_data["email"])
    if not new_user:
        raise HTTPException(status_code=400, detail="Failed to create user")
    
    # Очищаем временные данные
    del verification_codes[verification.temp_token]
    del temp_users[verification.temp_token]
    
    # Создаем токен доступа
    access_token = create_access_token(data={"sub": user_data["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/resend-code")
async def resend_verification_code(resend: ResendCode):
    # Проверяем токен
    if resend.temp_token not in temp_users:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Генерируем новый код
    new_code = str(random.randint(100000, 999999))
    verification_codes[resend.temp_token] = new_code
    
    # Отправляем новый код
    send_email_result = await send_email("", resend.email, new_code)
    
    return {"message": "Verification code resent"}

@app.post("/login")
async def login(user: UserLogin):
    db_user = get_user_by_username(user.username)
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/logout")
async def logout():
    return RedirectResponse(url="/")

@app.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = get_all_users()
    return users

# Новый эндпоинт для получения контактов текущего пользователя
@app.get("/contacts")
async def read_contacts(user: dict = Depends(get_current_user)):
    contacts = get_contacts(user["id"])
    return contacts

# Новый эндпоинт для добавления контактов
@app.post("/contacts/add")
async def add_contacts_route(contacts_to_add: ContactsAdd, user: dict = Depends(get_current_user)):
    current_user_id = user["id"]
    added_count = 0
    for contact_id in contacts_to_add.contact_ids:
        if contact_id != current_user_id: # Нельзя добавить себя
            if add_contact(current_user_id, contact_id):
                added_count += 1
    if added_count > 0:
         # Return the updated list of contacts
         updated_contacts = get_contacts(current_user_id)
         return {"status": f"{added_count} contacts added successfully.", "contacts": updated_contacts}
    else:
         # Handle cases where no contacts were added (e.g., all IDs were self or already contacts)
         # Check if the list was empty or contained only self
         if not contacts_to_add.contact_ids or all(cid == current_user_id for cid in contacts_to_add.contact_ids):
              raise HTTPException(status_code=400, detail="No valid contact IDs provided.")
         else:
              # Assume they might already be contacts or another issue occurred
              raise HTTPException(status_code=400, detail="Could not add contacts. They might already exist or IDs are invalid.")

# Новый эндпоинт для поиска пользователей
@app.get("/users/search")
async def search_users_route(query: str = Query(..., min_length=1), user: dict = Depends(get_current_user)):
    if not query:
        return []
    found_users = search_users(query, user["id"])
    return found_users

@app.get("/messages/{chat_id}")
async def list_messages(chat_id: int, user: dict = Depends(get_current_user)):
    chat_id = get_or_create_chat(chat_id)
    messages = get_messages(chat_id)
    return messages

@app.post("/upload-media/{chat_id}")
async def upload_media(chat_id: int, files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    uploaded_files = []
    
    # Создаем папку для медиафайлов, если она не существует
    media_dir = os.path.join(BASE_DIR, "static", "media")
    if not os.path.exists(media_dir):
        os.makedirs(media_dir)
    
    for file in files:
        # Генерируем уникальное имя файла
        file_ext = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Сохраняем файл
        file_path = os.path.join(media_dir, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        uploaded_files.append(unique_filename)
    
    return {"files": uploaded_files}

# New endpoint to get or create a one-on-one chat
from fastapi import HTTPException

@app.get("/chat/one-on-one/{contact_id}")
async def get_one_on_one_chat(contact_id: int, user: dict = Depends(get_current_user)):
    # Verify contact_id exists
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (contact_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    conn.close()

    chat_id = get_or_create_one_on_one_chat(user["id"], contact_id)
    if chat_id is None:
        raise HTTPException(status_code=500, detail="Failed to create or retrieve chat due to database error")
    return {"chat_id": chat_id}

# Modified WebSocket endpoint
@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, user: dict = Depends(get_current_user_ws)):
    # Verify user is a member of the chat
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (chat_id, user["id"]))
    if not cursor.fetchone():
        await websocket.close(code=1008, reason="User not in chat")
        conn.close()
        return  # Exit immediately after closing
    conn.close()
    
    try:
        chat_id = get_or_create_chat(chat_id)
    except ValueError:
        await websocket.close(code=1008, reason="Invalid chat ID")
        return

    await manager.connect(websocket, chat_id, user)
    await manager.broadcast({
        "user_id": user["id"],
        "username": user["username"],
        "content": f"{user['username']} joined the chat",
        "type": "system"
    }, chat_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            content = data.get("content")
            if content:
                message_id = create_message(chat_id, user["id"], content)
                # Fetch the newly created message to get receiver_id
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, u.username
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = ?
                ''', (message_id,))
                message = cursor.fetchone()
                conn.close()
                
                message_to_broadcast = {
                    "id": message_id,
                    "sender_id": message["sender_id"],
                    "receiver_id": message["receiver_id"],
                    "username": message["username"],
                    "content": content,
                    "type": "message",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                await manager.broadcast(message_to_broadcast, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user)
        # Only broadcast if there are still active connections
        if chat_id in manager.active_connections:
            await manager.broadcast({
                "user_id": user["id"],
                "username": user["username"],
                "content": f"{user['username']} left the chat",
                "type": "system"
            }, chat_id)
    except Exception as e:
        print(f"Error in WebSocket for user {user.get('username', 'unknown')}: {e}")
        manager.disconnect(websocket, chat_id, user)
        # Only broadcast if there are still active connections
        if chat_id in manager.active_connections:
            await manager.broadcast({
                "user_id": user["id"],
                "username": user["username"],
                "content": f"{user['username']} left the chat due to error",
                "type": "system"
            }, chat_id)
    finally:
        # Ensure connection is closed
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=1000, reason="Normal closure")
        # Можно добавить broadcast об ошибке, если нужно

@app.get("/user/profile")
async def get_user_profile(user: dict = Depends(get_current_user)):
    # The user object already comes from the database via get_current_user
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"] or ""  # Provide empty string if email is None
    }