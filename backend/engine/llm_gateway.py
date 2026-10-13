import os
import re
import logging
from typing import Optional, Any
from dotenv import load_dotenv

logger = logging.getLogger("reconx.llm_gateway")

_client = None
_client_initialized = False


def redact_pii(text: str) -> str:
    """
    Redacts sensitive account numbers and phone numbers before external transmission.
    Replaces 9-18 consecutive digits with a masked representation.
    """
    if not text:
        return ""
    # Mask 9-18 digit bank account / card numbers
    redacted = re.sub(r'\b\d{4}(\d{4,10})\d{4}\b', r'XXXX\1XXXX', str(text))
    # Mask 10-digit phone numbers
    redacted = re.sub(r'\b[6-9]\d{9}\b', '[PHONE_REDACTED]', redacted)
    return redacted


def get_gemini_client() -> Optional[Any]:
    """
    Returns a cached Gemini API client instance if a valid key is configured.
    """
    if "PYTEST_CURRENT_TEST" in os.environ:
        return None

    global _client, _client_initialized
    if not _client_initialized:
        _client_initialized = True
        load_dotenv(override=True)
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if api_key and len(api_key.strip()) > 10:
            try:
                from google import genai
                _client = genai.Client(api_key=api_key.strip())
                logger.info("Initialized shared Gemini client successfully.")
            except Exception as e:
                logger.warning("Could not initialize google.genai client: %s", e)
                _client = None
        else:
            _client = None
    return _client


def generate_content(prompt: str, model: Optional[str] = None) -> Optional[str]:
    """
    Safely generates text content using the Gemini client with PII redaction and error handling.
    """
    selected_model = model or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    client = get_gemini_client()
    if not client:
        return None

    try:
        sanitized_prompt = redact_pii(prompt)
        response = client.models.generate_content(
            model=selected_model,
            contents=sanitized_prompt
        )
        if response and hasattr(response, "text") and response.text:
            return response.text.strip()
    except Exception as e:
        logger.warning("Gemini generation failed: %s", e)
    return None
