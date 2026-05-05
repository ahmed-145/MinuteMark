# MinuteMark ⚡️

> **Grades in 60 seconds, not 3 weeks.**

**MinuteMark** is an AI-powered exam grading platform designed for modern educators. It provides instant, consistent, and high-quality feedback to students while giving instructors deep analytical insights into class performance.

---

## 🚀 Key Features

- **⚡️ Instant Grading:** Move from submission to results in under 60 seconds.
- **📝 Teacher-Quality Feedback:** Generates 3-6 sentences of constructive feedback per question.
- **🌍 Bilingual Support:** Native support for English (via Groq/Llama) and Arabic (via Gemini 2.0 Flash).
- **📊 Advanced Analytics:** Class-wide success rates, score distribution, and individual question performance tracking.
- **🔍 Plagiarism Detection:** Background semantic similarity checks to ensure academic integrity.
- **📸 OCR Ready:** Supports image (JPG/PNG) and PDF uploads for handwritten or digital exams.
- **✏️ Instructor Override:** Complete control for teachers to review and adjust AI-generated scores.

---

## 🛠️ Tech Stack

- **Backend:** FastAPI, SQLAlchemy (PostgreSQL), Pydantic, Tesseract OCR.
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, TypeScript.
- **AI Models:** Groq (Llama 3.3 70B), Google Gemini 2.0 Flash.
- **Deployment:** Docker & Docker Compose.

---

## 🚦 Quick Start

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

| Key | Description |
|---|---|
| `GROQ_API_KEY` | Get it at [console.groq.com](https://console.groq.com) |
| `GOOGLE_AI_API_KEY` | Get it at [aistudio.google.com](https://aistudio.google.com) |

### 2. Run with Docker
```bash
docker compose up --build
```
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:8000`
- **API Docs:** `http://localhost:8000/docs`

---

## 📂 Project Structure

- `/backend`: FastAPI application, grading logic, and OCR services.
- `/frontend`: Next.js web interface and instructor dashboard.
- `/scripts`: Utility scripts for stress testing and validation.

---

## 📜 License
MIT License. Created by [Your Name/Organization].
