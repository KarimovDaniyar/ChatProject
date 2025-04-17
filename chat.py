# routers/chat.py
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Form, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import Optional
import os
from datetime import timedelta
from pathlib import Path

from database import SessionLocal

from .. import models, schemas, database
from ..security import authenticate_user, create_access_token, get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="templates")

# Authentication routes
@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=60 * 24)  # 1 day
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@router.post("/login")
async def login(
    response: Response,
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(database.get_db)
):
    user = authenticate_user(db, email, password)
    if not user:
        return templates.TemplateResponse(
            "login.html", 
            {"request": request, "error": "Invalid email or password"}
        )
    
    access_token_expires = timedelta(minutes=60 * 24)  # 1 day
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Set cookie with token
    response = RedirectResponse(url="/chat", status_code=status.HTTP_302_FOUND)
    response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True)
    
    return response

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@router.post("/register")
async def register(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(database.get_db)
):
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if db_user:
        return templates.TemplateResponse(
            "register.html", 
            {"request": request, "error": "Email already registered"}
        )
    
    # Create new user
    from security import get_password_hash
    hashed_password = get_password_hash(password)
    new_user = models.User(
        username=username,
        email=email,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Redirect to login page
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

@router.get("/chat", response_class=HTMLResponse)
async def chat_page(request: Request, current_user: models.User = Depends(get_current_user)):
    return templates.TemplateResponse("main.html", {"request": request, "user": current_user})

@router.get("/logout")
async def logout(response: Response):
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    return response

# WebSocket endpoint for chat
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    await websocket.accept()
    
    if token is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        # Validate token and get user
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        # Get database session
        db = SessionLocal()
        user = db.query(models.User).filter(models.User.email == email).first()
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        # Add the connection to active connections
        await manager.connect(websocket, user.id)
        
        try:
            while True:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Save message to database
                new_message = models.Message(
                    content=message_data["content"],
                    media_url=message_data.get("media_url"),
                    sender_id=user.id,
                    receiver_id=message_data["receiver_id"]
                )
                db.add(new_message)
                db.commit()
                db.refresh(new_message)
                
                # Send message to receiver
                await Manager.send_personal_message(
                    {
                        "sender_id": user.id,
                        "sender_name": user.username,
                        "content": message_data["content"],
                        "media_url": message_data.get("media_url"),
                        "created_at": new_message.created_at.isoformat()
                    },
                    message_data["receiver_id"]
                )
        except WebSocketDisconnect:
            manager.disconnect(user.id)
        finally:
            db.close()
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
