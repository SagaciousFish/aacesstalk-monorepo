import asyncio
import pytest

from py_core.utils.translate.aliyun_translator import AliyunTranslator
from py_core.utils.platforms.aliyun import AliyunClient
from alibabacloud_alimt20181012 import models as alimt_20181012_models
from py_core.system.model import UserLocale


@pytest.mark.asyncio
async def test_batch_request_includes_api_type(monkeypatch):
    captured = {}

    class StubClient:
        def get_batch_translate_with_options_async(self, req, runtime):
            # capture the request object
            captured["req"] = req

            async def inner():
                # build a fake SDK response object
                body = alimt_20181012_models.GetBatchTranslateResponseBody()
                body.translated_list = [
                    {"index": "0", "translated": "你好", "code": 200}
                ]
                resp = alimt_20181012_models.GetBatchTranslateResponse()
                resp.status_code = 200
                resp.body = body
                return resp

            return inner()

    monkeypatch.setattr(
        AliyunClient, "create_trans_client", staticmethod(lambda: StubClient())
    )

    translator = AliyunTranslator()

    results = await translator.translate_batch(["hello"], UserLocale.English, "zh")

    assert "req" in captured
    assert getattr(captured["req"], "api_type", None) == "translate_standard"
    assert results[0] == "你好"
