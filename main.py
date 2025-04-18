import os
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Optional
import sqlite3
# Обновляем импорты из database
from database import (
    init_db, create_user, get_user_by_username, verify_password,
    create_message, get_messages, get_or_create_chat, get_all_users,
    add_contact, get_contacts, search_users # Добавлены новые импорты
)
from security import create_access_token, decode_access_token
from datetime import datetime

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
        if (chat_id not in self.active_connections):
            self.active_connections[chat_id] = []
            self.active_users[chat_id] = []
        if not any(u["id"] == user["id"] for u in self.active_users[chat_id]):
            self.active_users[chat_id].append({"id": user["id"], "username": user["username"]})
        self.active_connections[chat_id].append({"websocket": websocket, "user": user})
        await self.broadcast_users(chat_id)

    def disconnect(self, websocket: WebSocket, chat_id: int, user: dict):
        for conn in self.active_connections[chat_id]:
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
            for connection in self.active_connections[chat_id]:
                await connection["websocket"].send_json(message)

    async def broadcast_users(self, chat_id: int):
        if chat_id in self.active_connections:
            user_list = self.active_users[chat_id]
            await self.broadcast({"type": "user_list", "users": user_list}, chat_id)

manager = ConnectionManager()

# Модели для входа и регистрации
class UserCreate(BaseModel):
    username: str
    password: str

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
    new_user = create_user(user.username, user.password)
    if not new_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

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

@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, user: dict = Depends(get_current_user_ws)):
    chat_id = get_or_create_chat(chat_id)
    await manager.connect(websocket, chat_id, user)
    # Системное сообщение о подключении
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
                # Сохраняем сообщение в БД
                message_id = create_message(chat_id, user["id"], content)
                # Готовим сообщение для рассылки
                message_to_broadcast = {
                    "id": message_id, # Добавляем ID сообщения
                    "user_id": user["id"],
                    "username": user["username"],
                    "content": content,
                    "type": "message",
                    "timestamp": datetime.utcnow().isoformat() + "Z" # Добавляем временную метку
                }
                await manager.broadcast(message_to_broadcast, chat_id)
            else:
                print(f"Received empty message or invalid format from {user['username']}: {data}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user)
        # Системное сообщение об отключении
        await manager.broadcast({
            "user_id": user["id"],
            "username": user["username"],
            "content": f"{user['username']} left the chat",
            "type": "system"
        }, chat_id)
    except Exception as e:
        print(f"Error in WebSocket for user {user.get('username', 'unknown')}: {e}")
        manager.disconnect(websocket, chat_id, user)
        # Можно добавить broadcast об ошибке, если нужно