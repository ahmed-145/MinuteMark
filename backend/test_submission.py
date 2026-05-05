import httpx
import asyncio
import json

async def main():
    payload = {
        "student_name": "Test Student",
        "answers": [{"question_id": "84df2444-154a-4e89-9a74-d4b8e88e2c3c", "answer_text": "Plant cells have cell walls."}]
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post("http://localhost:8000/exams/c9e8f78d-682c-49b7-9d46-f37533e02ba4/submit", json=payload)
        print(f"STATUS: {resp.status_code}")
        print(f"BODY: {resp.text}")

if __name__ == '__main__':
    asyncio.run(main())
