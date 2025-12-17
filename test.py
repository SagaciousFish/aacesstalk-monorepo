# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///

import requests

headers = {
    "Authorization": "Bearer sk-739b0cac75e64a1bb680284322899a76",
    "Content-Type": "application/json",
}

data = {
    "input": "Explain how LLMs generate human-like text.",
    "model": "deepseek-chat",
}

response = requests.post(
    "https://api.deepseek.com/v1/embeddings", headers=headers, json=data
)

print(response)
print(response.json()["embedding"])
