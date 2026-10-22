import requests
import json

try:
    res = requests.post(
        "http://127.0.0.1:8000/api/analyze_sample",
        data={
            "sample_id": "img mani",
            "question": "background color",
            "mode": "task_focused"
        },
        timeout=30
    )
    print("Status:", res.status_code)
    print("Response:", res.text[:500])
except Exception as e:
    print("Error:", e)
