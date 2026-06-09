import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

GAME_DATA_PATH = PROJECT_ROOT / "src" / "game_data.json"
NOIR_IMAGE_DIR = PROJECT_ROOT / "src" / "assets" / "images" / "noir"
NOIR_MAP_DIR = NOIR_IMAGE_DIR / "maps"
NOIR_ITEMS_DIR = NOIR_IMAGE_DIR / "items"
VOICE_DIR = PROJECT_ROOT / "public" / "voice"

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

IMAGE_MODEL = "google/gemini-3-pro-image-preview"
VISION_MODEL = "google/gemini-2.5-flash"
GEMMA_MODEL = "google/gemma-4-31b-it"

NOIR_STYLE_PREFIX = """You are generating background art for a noir detective video game called "Murphy Law — Investigações Privadas".
The style must be: dark, moody, film noir aesthetic, high contrast shadows, warm amber/yellow tones against deep blacks,
rain-slicked surfaces reflecting neon, painterly but semi-realistic, 1940s-1950s atmosphere.
The setting is a fictional country mixing Germany, USA, and failed Soviet state — everything is rundown, state companies are bankrupt, nothing works.
IMPORTANT: The image must be a first-person perspective scene as if standing in the room looking forward.
No people visible. Cinematic composition. Aspect ratio 16:9 landscape.
CRITICAL: Any text/signs in the image MUST use German or Portuguese words — NEVER English. This is a German-influenced setting."""

ITEM_STYLE_PREFIX = """Generate a single item icon for a noir detective video game.
Film noir aesthetic — high contrast, deep shadows, warm amber highlight.
Dark background, cinematic lighting, isolated object, no text, no people.
Square composition, item icon style, dark moody atmosphere."""

S2_DIR = PROJECT_ROOT / "s2.cpp"
S2_MODELS = PROJECT_ROOT / "s2-models"
S2_TRANSFORMER = S2_MODELS / "s2-pro-q4_k_m-transformer-only.gguf"
S2_CODEC = S2_MODELS / "s2-pro-q4_k_m-codec-only.gguf"
S2_OUTPUT_DIR = PROJECT_ROOT / "s2-output"

DEFAULT_RETRIES = 3
DEFAULT_BACKOFF = 10
