from typing import Any
from .model import DyadORM
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import text
from sqlmodel import SQLModel

def create_database_engine(db_path: str, verbose: bool = False) -> AsyncEngine:
    return create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=verbose)


def make_async_session_maker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def column_exists_in_db(
    engine: AsyncEngine, model: type[SQLModel], column_name: str
) -> bool:
    async with engine.connect() as connection:
        result = await connection.execute(text(f"PRAGMA table_info({model.__tablename__})"))
        rows = result.fetchall()
        columns = [row[1] for row in rows]
        return column_name in columns


async def add_column_to_table(
    engine: AsyncEngine,
    model: type[SQLModel],
    column_name: str,
    column_params: str,
    default_value: Any | None = None,
):
    sql = f"ALTER TABLE {model.__tablename__}\nADD COLUMN {column_name} {column_params}"
    async with engine.begin() as connection:
        if default_value is not None:
            await connection.execute(
                text(sql + " DEFAULT :default"), {"default": default_value}
            )
        else:
            await connection.execute(text(sql))


async def migrate(engine: AsyncEngine):
    print("Run migration...")

    if (await column_exists_in_db(engine, DyadORM, "locale")) is False:
        # Add locale column
        await add_column_to_table(
            engine, DyadORM, "locale", "VARCHAR(35) NOT NULL", "SimplifiedChinese"
        )

    return

async def create_db_and_tables(engine: AsyncEngine):

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    await migrate(engine)
