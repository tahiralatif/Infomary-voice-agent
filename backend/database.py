import asyncpg
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
db_pool = None

async def init_db_pool():
    global db_pool
    if not DATABASE_URL:
        print("WARNING: DATABASE_URL not set!")
        return
    try:
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
            statement_cache_size=0
        )
        print("✅ Supabase connected!")
        await create_tables()
    except Exception as e:
        print(f"❌ DB connection failed: {e}")
        db_pool = None

async def close_db_pool():
    global db_pool
    if db_pool:
        await db_pool.close()

@asynccontextmanager
async def get_db_connection():
    if not db_pool:
        raise Exception("DB pool not initialized!")
    async with db_pool.acquire() as conn:
        yield conn

async def create_tables():
    async with get_db_connection() as conn:
        # Sessions table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS infomary_sessions (
                id SERIAL PRIMARY KEY,
                session_id TEXT UNIQUE NOT NULL,
                user_id TEXT,
                title TEXT DEFAULT 'New Conversation',
                description TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # Add title column if it doesn't exist (migration for existing tables)
        await conn.execute("""
            ALTER TABLE infomary_sessions 
            ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'New Conversation'
        """)
        
        # Add description column if it doesn't exist
        await conn.execute("""
            ALTER TABLE infomary_sessions 
            ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''
        """)
        
        # Messages table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS infomary_messages (
                id SERIAL PRIMARY KEY,
                message_id TEXT UNIQUE NOT NULL,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (session_id) 
                    REFERENCES infomary_sessions(session_id) 
                    ON DELETE CASCADE
            )
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session 
            ON infomary_messages(session_id, created_at ASC)
        """)
        
        print("✅ Tables created/verified!")

# Helper functions
async def save_message(session_id: str, role: str, content: str):
    import uuid
    async with get_db_connection() as conn:
        # Session upsert
        await conn.execute("""
            INSERT INTO infomary_sessions (session_id) 
            VALUES ($1) ON CONFLICT DO NOTHING
        """, session_id)
        
        # Message insert
        await conn.execute("""
            INSERT INTO infomary_messages (message_id, session_id, role, content)
            VALUES ($1, $2, $3, $4)
        """, str(uuid.uuid4()), session_id, role, content)

async def fetch_history(session_id: str):
    async with get_db_connection() as conn:
        rows = await conn.fetch("""
            SELECT role, content FROM infomary_messages
            WHERE session_id = $1
            ORDER BY created_at ASC
        """, session_id)
        return [{"role": r["role"], "content": r["content"]} for r in rows]

async def get_user_sessions(user_id: str):
    async with get_db_connection() as conn:
        rows = await conn.fetch("""
            SELECT session_id, title, description, created_at FROM infomary_sessions
            WHERE user_id = $1
            ORDER BY created_at DESC
        """, user_id)
        return [{"session_id": r["session_id"], "title": r["title"], "description": r["description"], "created_at": str(r["created_at"])} for r in rows]

async def update_session_title(session_id: str, title: str, description: str = ""):
    async with get_db_connection() as conn:
        await conn.execute("""
            UPDATE infomary_sessions 
            SET title = $1, description = $2
            WHERE session_id = $3
        """, title, description, session_id)

async def get_all_sessions():
    async with get_db_connection() as conn:
        rows = await conn.fetch("""
            SELECT session_id, title, description, created_at FROM infomary_sessions
            ORDER BY created_at DESC
        """)
        return [{"session_id": r["session_id"], "title": r["title"], "description": r["description"], "created_at": str(r["created_at"])} for r in rows]

async def delete_session(session_id: str):
    async with get_db_connection() as conn:
        await conn.execute("""
            DELETE FROM infomary_sessions
            WHERE session_id = $1
        """, session_id)