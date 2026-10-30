import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
except ImportError:  # python-dotenv is optional at runtime
    pass


@dataclass(frozen=True)
class Settings:
    llm_api_key: str
    llm_model: str
    llm_timeout: float
    llm_provider: str
    llm_base_url: str
    allowed_origins: list[str]
    paypal_client_id: str
    paypal_client_secret: str
    paypal_env: str
    paypal_webhook_id: str

    @property
    def llm_configured(self) -> bool:
        if not self.llm_api_key.strip():
            return False
        # OpenAI-compatible providers (Groq, Gemini, OpenRouter...) also need a base URL.
        return self.llm_provider == "anthropic" or bool(self.llm_base_url)

    @property
    def paypal_configured(self) -> bool:
        # Sandbox only: any other PAYPAL_ENV is treated as not configured so real money can never move.
        return self.paypal_env == "sandbox" and bool(self.paypal_client_id.strip() and self.paypal_client_secret.strip())


def get_settings() -> Settings:
    """Read on every call so tests and restarts pick up env changes. Secrets never leave the backend."""
    return Settings(
        llm_api_key=os.getenv("LLM_API_KEY", ""),
        llm_model=os.getenv("LLM_MODEL") or "claude-sonnet-5-5",
        llm_timeout=float(os.getenv("LLM_TIMEOUT_SECONDS") or "30"),
        llm_provider="openai" if (os.getenv("LLM_PROVIDER") or "anthropic").strip().lower() in ("openai", "openai-compatible") else "anthropic",
        llm_base_url=(os.getenv("LLM_BASE_URL") or "").strip(),
        allowed_origins=[o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or "http://localhost:5173").split(",") if o.strip()],
        paypal_client_id=os.getenv("PAYPAL_CLIENT_ID", ""),
        paypal_client_secret=os.getenv("PAYPAL_CLIENT_SECRET", ""),
        paypal_env=(os.getenv("PAYPAL_ENV") or "sandbox").strip().lower(),
        paypal_webhook_id=os.getenv("PAYPAL_WEBHOOK_ID", "").strip(),
    )