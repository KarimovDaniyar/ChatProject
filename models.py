from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table
from sqlalchemy.orm import relationship
import datetime
from database import Base

# Association table for many-to-many relationship between User and Group
user_group = Table(
    "user_group",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.recipient_id", back_populates="recipient")
    contacts = relationship("Contact", back_populates="user")
    groups = relationship("Group", secondary=user_group, back_populates="members")

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    contact_id = Column(Integer, ForeignKey("users.id"))
    
    user = relationship("User", foreign_keys=[user_id], back_populates="contacts")
    contact_user = relationship("User", foreign_keys=[contact_id])

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    members = relationship("User", secondary=user_group, back_populates="groups")
    messages = relationship("Message", back_populates="group")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    content = Column(String)
    media_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_read = Column(Boolean, default=False)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_messages")
    group = relationship("Group", back_populates="messages")