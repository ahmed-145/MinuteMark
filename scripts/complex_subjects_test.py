import httpx
import asyncio
import json

API_URL = "http://localhost:8000"

# 1. Complex Data Definition (Medical & Engineering)
COMPLEX_EXAM = {
    "title": "Professional Certification: Medicine & Engineering",
    "subject": "Specialized Sciences",
    "total_marks": 20,
    "grading_mode": "rubric", # Using rubric for complex logic
    "questions": [
        {
            "question_text": "Explain the physiological mechanism of the 'Renin-Angiotensin-Aldosterone System' (RAAS) in blood pressure regulation.",
            "max_marks": 10,
            "rubric": "Score 10: Correctly identifies renin release from kidneys, conversion of angiotensinogen to Ang I (via renin) and Ang II (via ACE), and the role of aldosterone in sodium/water retention. Score 5: Mentions kidneys and water retention but misses the ACE conversion or vasoconstriction. Score 0: Incorrect organs or unrelated mechanism.",
            "order_index": 0
        },
        {
            "question_text": "Describe the concept of 'Creep' in structural engineering and its implications for concrete bridges.",
            "max_marks": 10,
            "rubric": "Score 10: Identifies creep as time-dependent deformation under constant load. Mentions factors like humidity, age of loading, and implications like deflection or prestress loss. Score 5: Defines it as deformation over time but misses structural implications. Score 0: Confuses it with elastic deformation or fatigue.",
            "order_index": 1
        }
    ]
}

SAMPLES = [
    {
        "student": "Expert Practitioner",
        "answers": [
            "RAAS begins when kidneys detect low BP and release renin. Renin converts angiotensinogen to Angiotensin I. ACE then converts it to Angiotensin II, a powerful vasoconstrictor that also triggers aldosterone release from the adrenals, leading to Na+ and water reabsorption in the distal tubules.",
            "Creep is the long-term, time-dependent strain that occurs in concrete under sustained compressive stress. In bridges, it causes increased downward deflection over years and can lead to a significant loss of prestress in the tendons, affecting structural integrity if not calculated during design."
        ]
    },
    {
        "student": "Nuanced/Incomplete Student",
        "answers": [
            "The kidneys release renin to help raise blood pressure. This eventually leads to aldosterone which makes you hold onto water, increasing blood volume and pressure. It involves some conversion in the lungs too.",
            "Creep is when concrete keeps deforming even if the weight stays the same. It happens slowly over months and years. It's bad for bridges because they might sag more than expected."
        ]
    },
    {
        "student": "Critical Error Student",
        "answers": [
            "Renin is released by the liver to stop bleeding. It turns into adrenaline which makes the heart beat faster to raise blood pressure.",
            "Creep in engineering refers to the speed at which a car moves when the brake is released. In bridges, this is important for traffic flow."
        ]
    }
]

async def run_complex_test():
    async with httpx.AsyncClient(timeout=60) as client:
        print("🏗️ Creating Complex Domain Exam...")
        resp = await client.post(f"{API_URL}/exams", json=COMPLEX_EXAM)
        exam = resp.json()
        exam_id = exam["id"]
        q_ids = [q["id"] for q in exam["questions"]]
        
        print(f"🚀 Submitting specialized answers for {len(SAMPLES)} students...")
        
        for sample in SAMPLES:
            print(f"\n👤 Student: {sample['student']}")
            payload = {
                "student_name": sample["student"],
                "answers": [
                    {"question_id": q_ids[i], "answer_text": sample["answers"][i]}
                    for i in range(len(q_ids))
                ]
            }
            sub_resp = await client.post(f"{API_URL}/exams/{exam_id}/submit", json=payload)
            sub_data = sub_resp.json()
            
            for i, ans in enumerate(sub_data["answers"]):
                print(f"   Q{i+1} Score: {ans['ai_score']}/10")
                print(f"   AI Feedback: {ans['ai_feedback']}")

if __name__ == "__main__":
    asyncio.run(run_complex_test())
