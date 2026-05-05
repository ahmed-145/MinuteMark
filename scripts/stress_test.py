import httpx
import asyncio
import json
import random

API_URL = "http://localhost:8000"

# 1. Sample Data Definition
EXAM_DATA = {
    "title": "World History & Science 101",
    "subject": "General Studies",
    "total_marks": 30,
    "grading_mode": "answer_key",
    "questions": [
        {
            "question_text": "Explain the primary causes of the French Revolution.",
            "max_marks": 10,
            "answer_key": "Social inequality (the estate system), economic hardship (famine and debt), and Enlightenment ideas questioning the absolute monarchy.",
            "order_index": 0
        },
        {
            "question_text": "ما هي فوائد التمثيل الضوئي للنباتات؟",
            "max_marks": 10,
            "answer_key": "التمثيل الضوئي يسمح للنباتات بتحويل ضوء الشمس إلى طاقة (جلوكوز) وإطلاق الأكسجين كمنتج ثانوي، وهو ضروري لنمو النبات وبقاء الحياة على الأرض.",
            "order_index": 1
        },
        {
            "question_text": "Describe the process of osmosis.",
            "max_marks": 10,
            "answer_key": "The movement of water molecules from an area of high concentration to an area of low concentration across a semi-permeable membrane.",
            "order_index": 2
        }
    ]
}

STUDENTS = [
    {
        "name": "Excellent Student",
        "answers": [
            "The French Revolution was caused by heavy taxes on the Third Estate, bad harvests leading to starvation, and the influence of thinkers like Rousseau and Voltaire who challenged the King's power.",
            "التمثيل الضوئي هو عملية حيوية حيث تمتص النباتات ضوء الشمس لصنع الغذاء (السكر). هذه العملية تنتج الأكسجين الذي نتنفسه وتساعد النبات على النمو بشكل صحي.",
            "Osmosis is the diffusion of water through a semi-permeable membrane. Water moves to where there is less water (higher solute concentration) until balance is reached."
        ]
    },
    {
        "name": "Average Student",
        "answers": [
            "People were hungry and didn't like the King. The poor people paid all the taxes while the rich paid nothing.",
            "النباتات تستخدم الشمس لتعيش وتخرج لنا الأكسجين.",
            "It is how water moves in plants through their skin."
        ]
    },
    {
        "name": "Struggling Student",
        "answers": [
            "It happened in France a long time ago because of wars.",
            "عملية جيدة للنبات.",
            "I don't remember this one."
        ]
    },
    {
        "name": "Cheater A",
        "answers": [
            "The French Revolution was caused by heavy taxes on the Third Estate, bad harvests leading to starvation, and the influence of thinkers like Rousseau and Voltaire.",
            "التمثيل الضوئي هو عملية حيوية حيث تمتص النباتات ضوء الشمس لصنع الغذاء. هذه العملية تنتج الأكسجين وتساعد النبات على النمو.",
            "Osmosis is the movement of water through a membrane from high to low concentration."
        ]
    },
    {
        "name": "Cheater B (Copy of A)",
        "answers": [
            "The French Revolution was caused by heavy taxes on the Third Estate, bad harvests leading to starvation, and the influence of thinkers like Rousseau and Voltaire.",
            "التمثيل الضوئي هو عملية حيوية حيث تمتص النباتات ضوء الشمس لصنع الغذاء. هذه العملية تنتج الأكسجين وتساعد النبات على النمو.",
            "Osmosis is the movement of water through a membrane from high to low concentration."
        ]
    }
]

async def run_stress_test():
    async with httpx.AsyncClient(timeout=60) as client:
        # Create Exam
        print("🚀 Creating test exam...")
        resp = await client.post(f"{API_URL}/exams", json=EXAM_DATA)
        if resp.status_code != 201:
            print(f"❌ Failed to create exam: {resp.text}")
            return
        exam = resp.json()
        exam_id = exam["id"]
        q_ids = [q["id"] for q in exam["questions"]]
        print(f"✅ Exam created with ID: {exam_id}")

        # Submit Answers
        for student in STUDENTS:
            print(f"📝 Submitting for {student['name']}...")
            payload = {
                "student_name": student["name"],
                "answers": [
                    {"question_id": q_ids[i], "answer_text": student["answers"][i]}
                    for i in range(len(q_ids))
                ]
            }
            sub_resp = await client.post(f"{API_URL}/exams/{exam_id}/submit", json=payload)
            if sub_resp.status_code == 201:
                print(f"   ✅ Done. Score: {sub_resp.json()['total_score']}")
            else:
                print(f"   ❌ Failed: {sub_resp.text}")

        # Wait for background plagiarism check
        print("⏳ Waiting for background tasks...")
        await asyncio.sleep(5)

        # Check Analytics
        print("📊 Fetching Analytics...")
        ana_resp = await client.get(f"{API_URL}/exams/{exam_id}/analytics")
        if ana_resp.status_code == 200:
            print("\n--- TEST RESULTS ---")
            data = ana_resp.json()
            print(f"Total Submissions: {data['total_submissions']}")
            print(f"Class Average: {data['average_pct']}%")
            print("Question Success Rates:")
            for q in data["question_breakdown"]:
                print(f" - {q['question_text'][:30]}...: {q['success_rate']}%")
        
        # Check Plagiarism
        print("\n🔍 Checking for Plagiarism Flags...")
        subs_resp = await client.get(f"{API_URL}/exams/{exam_id}/submissions")
        subs = subs_resp.json()
        flagged = [s["student_name"] for s in subs if s.get("has_plagiarism_flag")]
        print(f"Flagged students: {flagged}")

if __name__ == "__main__":
    asyncio.run(run_stress_test())
