import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Dict
import sqlite3
from database import init_db, create_user, get_user_by_username, verify_password, create_message, get_messages
from security import create_access_token, decode_access_token

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Корневая директория проекта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Монтируем статические файлы
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Инициализация базы данных
init_db()

# Хранилище для WebSocket-соединений
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, chat_id: int):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)

    def disconnect(self, websocket: WebSocket, chat_id: int):
        self.active_connections[chat_id].remove(websocket)
        if not self.active_connections[chat_id]:
            del self.active_connections[chat_id]

    async def broadcast(self, message: dict, chat_id: int):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# Модели для входа и регистрации
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

# Получение текущего пользователя из токена
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("sub")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Маршруты
@app.get("/", response_class=HTMLResponse)
async def serve_login():
    file_path = os.path.join(BASE_DIR, "static", "templates", "login.html")
    with open(file_path) as f:
        return f.read()

@app.get("/chat", response_class=HTMLResponse)
async def serve_chat():
    file_path = os.path.join(BASE_DIR, "static", "templates", "main.html")
    with open(file_path) as f:
        return f.read()

@app.get("/register", response_class=HTMLResponse)
async def serve_register():
    file_path = os.path.join(BASE_DIR, "static", "templates", "register.html")
    with open(file_path) as f:
        return f.read()

@app.post("/register")
async def register(user: UserCreate):
    new_user = create_user(user.username, user.password)
    if not new_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": "User created successfully"}

@app.post("/login")
async def login(user: UserLogin):
    db_user = get_user_by_username(user.username)
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/messages")
async def send_message(chat_id: int, content: str, user: dict = Depends(get_current_user)):
    create_message(chat_id, user["id"], content)
    await manager.broadcast({"user_id": user["id"], "username": user["username"], "content": content}, chat_id)
    return {"status": "Message sent"}

@app.get("/messages/{chat_id}")
async def list_messages(chat_id: int, user: dict = Depends(get_current_user)):
    messages = get_messages(chat_id)
    return messages

# WebSocket
@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int):
    await manager.connect(websocket, chat_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id)