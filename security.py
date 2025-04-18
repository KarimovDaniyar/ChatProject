from passlib.context import CryptContext

# Создаем контекст для хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """
    Хеширует пароль с использованием bcrypt.
    
    Args:
        password: Пароль в виде строки
    Returns:
        Хешированный пароль
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет, соответствует ли введенный пароль хешированному.
    
    Args:
        plain_password: Введенный пароль
        hashed_password: Хешированный пароль из базы данных
    Returns:
        True, если пароль верный, иначе False
    """
    return pwd_context.verify(plain_password, hashed_password)