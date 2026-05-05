import asyncio
import httpx
import json
import pandas as pd
from datasets import load_dataset
import os

API_URL = "http://localhost:8000"

async def run_audit():
    print("📥 Loading ASAP-SAS (AERA version) dataset from HuggingFace...")
    # Load dataset. We use the test split for auditing and specify a config.
    dataset = load_dataset("jiazhengli/AERA", "Simple Instruction", split="test")
    df = pd.DataFrame(dataset)
    
    # Correct columns: 'EssaySet', 'EssayText', 'Score1'
    prompt_id = 1 
    subset = df[df['EssaySet'] == prompt_id].head(10)
    
    print(f"✅ Loaded {len(subset)} real student samples for Prompt {prompt_id}.")
    
    # Prompt 1 Context: Science experiment replication
    question_text = "List additional information that the student would need to provide in order for the experiment to be replicable."
    answer_key = "To replicate the experiment, the student needs to provide: 1. The amount of vinegar used. 2. The mass/size of the marble chip. 3. The size/type of the container. 4. The duration of the experiment."
    max_marks = 3 
    
    results = []
    
    async with httpx.AsyncClient(timeout=60) as client:
        # Create a test exam for this audit
        exam_payload = {
            "title": f"Audit: ASAP Prompt {prompt_id}",
            "subject": "Science",
            "total_marks": max_marks,
            "grading_mode": "answer_key",
            "questions": [
                {
                    "question_text": question_text,
                    "max_marks": max_marks,
                    "answer_key": answer_key,
                    "order_index": 0
                }
            ]
        }
        
        exam_resp = await client.post(f"{API_URL}/exams", json=exam_payload)
        exam = exam_resp.json()
        exam_id = exam["id"]
        qid = exam["questions"][0]["id"]
        
        print(f"🚀 Starting AI Grading of {len(subset)} samples...")
        
        for idx, row in subset.iterrows():
            student_answer = row['EssayText']
            human_score = float(row['Score1'])
            
            # Submit to MinuteMark
            payload = {
                "student_name": f"ASAP_Student_{idx}",
                "answers": [{"question_id": qid, "answer_text": student_answer}]
            }
            
            sub_resp = await client.post(f"{API_URL}/exams/{exam_id}/submit", json=payload)
            ai_data = sub_resp.json()["answers"][0]
            ai_score = float(ai_data["ai_score"])
            ai_feedback = ai_data["ai_feedback"]
            
            delta = abs(ai_score - human_score)
            results.append({
                "Student Answer": student_answer[:100] + "...",
                "Human Score": human_score,
                "AI Score": ai_score,
                "Delta": delta,
                "AI Feedback": ai_feedback
            })
            print(f"   Sample {idx}: Human={human_score}, AI={ai_score} (Delta={delta})")
            
    # Calculate Metrics
    audit_df = pd.DataFrame(results)
    avg_delta = audit_df['Delta'].mean()
    perfect_matches = (audit_df['Delta'] == 0).sum()
    match_pct = (perfect_matches / len(subset)) * 100
    
    print("\n" + "="*50)
    print("📊 ACCURACY AUDIT REPORT")
    print("="*50)
    print(f"Total Samples: {len(subset)}")
    print(f"Average Delta: {avg_delta:.2f} marks")
    print(f"Exact Matches: {perfect_matches} ({match_pct:.1f}%)")
    print("="*50)
    
    # Save to CSV
    audit_df.to_csv("accuracy_audit_report.csv", index=False)
    print("\n✅ Detailed report saved to 'accuracy_audit_report.csv'")

if __name__ == "__main__":
    asyncio.run(run_audit())
