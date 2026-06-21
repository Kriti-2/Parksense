from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import user as user_model  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Automatically add missing columns if they do not exist
    try:
        inspector = inspect(engine)
        if inspector.has_table("users"):
            columns = [col["name"] for col in inspector.get_columns("users")]
            if "otp_code" not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_code VARCHAR(6) NULL"))
            if "otp_expires_at" not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_expires_at DATETIME NULL"))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to auto-update users schema: {e}")

