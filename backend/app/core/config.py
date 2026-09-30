from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "InsightDoc"
    environment: str = "development"
    database_url: str = (
        "postgresql+psycopg://insightdoc:insightdoc@localhost:5433/insightdoc"
    )
    openrouter_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
