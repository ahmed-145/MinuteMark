from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://gradeai:gradeai@localhost:5432/gradeai"
    groq_api_key: str = ""
    google_ai_api_key: str = ""
    secret_key: str = "supersecretkey" # Change in production
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7 # 1 week

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
