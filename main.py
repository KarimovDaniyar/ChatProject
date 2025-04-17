import os
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Optional
import sqlite3
from database import init_db, create_user, get_user_by_username, verify_password, create_message, get_messages, get_or_create_chat
from security import create_access_token, decode_access_token

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
    try :
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

@app.post("/messages")
async def send_message(message: MessageCreate, user: dict = Depends(get_current_user)):
    chat_id = get_or_create_chat(message.chat_id)
    create_message(chat_id, user["id"], message.content)
    await manager.broadcast({
        "user_id": user["id"],
        "username": user["username"],
        "content": message.content,
        "type": "message"
    }, chat_id)
    return {"status": "Message sent"}

@app.get("/messages/{chat_id}")
async def list_messages(chat_id: int, user: dict = Depends(get_current_user)):
    chat_id = get_or_create_chat(chat_id)
    messages = get_messages(chat_id)
    return messages

@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, user: dict = Depends(get_current_user_ws)):
    chat_id = get_or_create_chat(chat_id)
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
            data["user_id"] = user["id"]
            data["username"] = user["username"]
            data["type"] = "message"
            await manager.broadcast(data, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user)
        await manager.broadcast({
            "user_id": user["id"],
            "username": user["username"],
            "content": f"{user['username']} left the chat",
            "type": "system"
        }, chat_id)