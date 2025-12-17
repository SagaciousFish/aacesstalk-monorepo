from .models import DyadLoginCode
from os import path, makedirs
from py_core.system.model import ParentType, ChildGender
from py_database.database import (
    AsyncSession,
    make_async_session_maker,
    create_database_engine,
)
from sqlmodel import select
from py_database.model import DyadORM, FreeTopicDetailORM
from py_core.config import AACessTalkConfig

if not path.exists(AACessTalkConfig.database_dir_path):
    makedirs(AACessTalkConfig.database_dir_path)

engine = create_database_engine(
    AACessTalkConfig.database_file_path,
    # verbose=True
)

db_sessionmaker = make_async_session_maker(engine)


async def with_db_session() -> AsyncSession:
    async with db_sessionmaker() as session:
        yield session


async def create_test_dyad() -> bool:
    async with db_sessionmaker() as db:
        async with db.begin():
            statement = select(DyadORM).where(DyadORM.alias == "test")
            result = await db.exec(statement)
            test_dyad = result.one_or_none()
            if test_dyad is None:
                test_dyad = DyadORM(
                    alias="wang",
                    child_name="王汪汪",
                    parent_type=ParentType.Father,
                    child_gender=ChildGender.Boy,
                )
                dyad_login = DyadLoginCode(code="12345", dyad_id=test_dyad.id)
                db.add(test_dyad)
                db.add(dyad_login)
                print("已创建测试二联体, 登录码为: 12345")
                return True
            else:
                return False


async def create_test_freetopics() -> bool:
    async with db_sessionmaker() as db:
        async with db.begin():
            result = await db.exec(select(DyadORM).where(DyadORM.alias == "test"))
            test_dyad = result.one_or_none()
            if test_dyad is not None:
                statement = select(FreeTopicDetailORM).where(
                    FreeTopicDetailORM.dyad_id == test_dyad.id
                )
                result = await db.exec(statement)

                if result.first() is None:
                    topic_1 = FreeTopicDetailORM(
                        dyad_id=test_dyad.id,
                        subtopic="动画",
                        subtopic_description="关于孩子喜欢的动画片《喜羊羊与灰太狼》中的角色。",
                        topic_image_filename="xi_yang_yang.png",
                    )
                    topic_2 = FreeTopicDetailORM(
                        dyad_id=test_dyad.id,
                        subtopic="恐龙",
                        subtopic_description="关于孩子喜欢的恐龙。",
                        topic_image_filename="dinasour.png",
                    )
                    topic_3 = FreeTopicDetailORM(
                        dyad_id=test_dyad.id,
                        subtopic="乐高",
                        subtopic_description="关于孩子喜欢的乐高玩具系列。",
                        topic_image_filename="lego.png",
                    )
                    db.add(topic_1)
                    db.add(topic_2)
                    db.add(topic_3)
                    print("Added free topics for dyad.")
                    return True
                else:
                    return False