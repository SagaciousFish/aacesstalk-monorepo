from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker

class SQLStorageBase:
    __sql_session_maker: async_sessionmaker[AsyncSession]

    @classmethod
    def set_session_maker(cls, func: async_sessionmaker[AsyncSession]):
        cls.__sql_session_maker = func

    @classmethod
    def get_sessionmaker(cls) -> AsyncSession:
        return cls.__sql_session_maker()