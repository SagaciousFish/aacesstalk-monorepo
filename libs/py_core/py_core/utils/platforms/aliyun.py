from alibabacloud_credentials.client import Client as CredentialClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_alimt20181012.client import Client as alimt20181012Client


class AliyunClient:
    aliyun_credential: CredentialClient | None = None
    aliyun_config: open_api_models.Config | None = None
    translation_client: alimt20181012Client | None = None

    @staticmethod
    def get_aliyun_credential() -> CredentialClient:
        if AliyunClient.aliyun_credential is None:
            # 工程代码建议使用更安全的无AK方式，凭据配置方式请参见：https://help.aliyun.com/document_detail/378659.html。
            AliyunClient.aliyun_credential = CredentialClient()
        return AliyunClient.aliyun_credential

    @staticmethod
    def get_aliyun_config() -> open_api_models.Config:
        if AliyunClient.aliyun_config is None:
            AliyunClient.aliyun_config = open_api_models.Config(
                credential=AliyunClient.get_aliyun_credential()
            )
            # Endpoint 请参考 https://api.aliyun.com/product/alimt
            AliyunClient.aliyun_config.endpoint = "mt.cn-hangzhou.aliyuncs.com"
        return AliyunClient.aliyun_config

    @staticmethod
    def create_trans_client() -> alimt20181012Client:
        """
        使用凭据初始化账号Client
        @return: Client
        @throws Exception
        """

        if AliyunClient.translation_client is None:
            AliyunClient.translation_client = alimt20181012Client(
                AliyunClient.get_aliyun_config()
            )

        return AliyunClient.translation_client
