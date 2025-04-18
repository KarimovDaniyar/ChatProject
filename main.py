# main.py
from fastapi import FastAPI, Form, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from database import add_user, verify_user, get_messages, add_message, get_all_users, get_user_by_id, get_db_connection
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="your-secret-key")  # Replace with a secure key in production
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Dependency to get the current user
def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Login page
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# Handle login
@app.post("/login")
async def login(request: Request, email: str = Form(...), password: str = Form(...)):
    user = verify_user(email, password)
    if user:
        request.session["user_id"] = user["id"]  # Store user ID in session
        return RedirectResponse(url="/chat", status_code=303)
    else:
        raise HTTPException(status_code=401, detail="Invalid email or password")

# Register page
@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

# Handle registration
@app.post("/register")
async def register(request: Request, username: str = Form(...), email: str = Form(...), password: str = Form(...)):
    if add_user(username, email, password):
        user = verify_user(email, password)  # Log them in immediately
        request.session["user_id"] = user["id"]
        return RedirectResponse(url="/chat", status_code=303)
    else:
        raise HTTPException(status_code=400, detail="Email already exists")

# Chat page
@app.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request, current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse("main.html", {"request": request})

# Logout
@app.get("/logout")
async def logout(request: Request):
    request.session.pop("user_id", None)
    return RedirectResponse(url="/login", status_code=303)

# API to get all users (for contacts list)
@app.get("/api/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    users = get_all_users()
    return [{"id": user["id"], "username": user["username"], "email": user["email"]} for user in users if user["id"] != current_user["id"]]

# API to get messages with a specific user
@app.get("/api/messages/{recipient_id}")
async def get_chat_messages(recipient_id: int, current_user: dict = Depends(get_current_user)):
    messages = get_messages(current_user["id"], recipient_id)
    return [{"id": m["id"], "sender_id": m["sender_id"], "recipient_id": m["recipient_id"], "content": m["content"], "timestamp": m["timestamp"], "resources": m["resources"]} for m in messages]

# API to send a message
class Message(BaseModel):
    recipient_id: int
    content: str
    resources: str | None = None

@app.post("/api/send_message")
async def send_message(message: Message, current_user: dict = Depends(get_current_user)):
    add_message(current_user["id"], message.recipient_id, message.content, message.resources)
    return {"status": "Message sent"}

# Populate DB for testing (comment out after first run)
@app.on_event("startup")
async def populate_db():
    users = [
        ("Den", "karimovdaniyar224@gmail.com", "password1"),
        ("Alym", "alym@example.com", "password2"),
        ("Akbar", "akbar@example.com", "password3"),
    ]
    for username, email, password in users:
        if add_user(username, email, password):
            print(f"Added user: {username}")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", ("karimovdaniyar224@gmail.com",))
    user1_id = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM users WHERE email = ?", ("alym@example.com",))
    user2_id = cursor.fetchone()[0]
    conn.close()

    messages = [
        (user1_id, user2_id, "Hey, how are you?", None),
        (user2_id, user1_id, "I’m good, thanks!", None),
    ]
    for sender_id, recipient_id, content, resources in messages:
        add_message(sender_id, recipient_id, content, resources)
        print(f"Added message from {sender_id} to {recipient_id}")