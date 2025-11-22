import requests

r = requests.post("http://localhost:8001/generate-image",
    json={"prompt": "Japandi living room, soft light"})
print(r.json())
