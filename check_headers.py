import requests

r = requests.get("http://127.0.0.1:8000/static/style.css")
print("Status:", r.status_code)
print("Headers:", dict(r.headers))
