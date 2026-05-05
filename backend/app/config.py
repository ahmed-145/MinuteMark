from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://gradeai:gradeai@localhost:5432/gradeai"
    groq_api_key: str = ""
    google_ai_api_key: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
