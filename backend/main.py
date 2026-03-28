"""
ManaSetu (CareerPulse) API — FastAPI on Modal.

Local dev:  cd backend && uvicorn main:api --reload --port 8000
Modal dev:  modal serve main.py
Deploy:     modal deploy main.py

Secrets (Modal dashboard → Secrets → mana-setu-secrets):
  GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import asyncio
import hashlib
import json
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

import modal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Modal image
# ---------------------------------------------------------------------------
mana_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("requirements.txt")
)

app = modal.App("mana-setu", image=mana_image)

# ---------------------------------------------------------------------------
# Supabase helper
# ---------------------------------------------------------------------------
_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key or "your_" in url or "your_" in key:
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        print(f"Supabase init failed: {e}")
        return None


# ---------------------------------------------------------------------------
# In-memory fallback (used when Supabase isn't configured)
# ---------------------------------------------------------------------------
_users_mem: dict[str, dict] = {}
_burnout_mem: dict[str, dict] = {}

# Lock to prevent duplicate concurrent Gemini requests for the same user
_gen_locks: dict[str, asyncio.Lock] = {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class OnboardRequest(BaseModel):
    major: str
    skills: list[str]
    interests: list[str]


class BurnoutCheckinRequest(BaseModel):
    user_id: str
    answers: list[int]  # 5 answers, each 1-5


class CareerMapRequest(BaseModel):
    user_id: str


# ---------------------------------------------------------------------------
# Burnout scoring
# ---------------------------------------------------------------------------
def _compute_burnout(answers: list[int]) -> dict:
    if not answers:
        return {"score": 0, "zone": "healthy"}
    raw = sum(answers) / (len(answers) * 5)
    score = round(raw * 100)
    if score <= 35:
        zone = "healthy"
    elif score <= 65:
        zone = "early_warning"
    else:
        zone = "risk"
    return {"score": score, "zone": zone}


# ---------------------------------------------------------------------------
# Gemini prompt
# ---------------------------------------------------------------------------
GEMINI_CAREER_PROMPT = """You are CareerPulse AI. Given the user profile below, generate a personalized career roadmap as a directed graph.

User Profile:
- Major: {major}
- Skills: {skills}
- Career Interests: {interests}
- Current Burnout Zone: {burnout_zone}

Rules:
1. Generate 6-8 career milestone nodes forming 2-3 branching paths.
2. The first node is always the user's current state (label: "Current: Student").
3. Each node must have: id (string number starting from "1"), position (object with x, y integers - space ~280px apart horizontally, vary y between -60 and 280), and a data object.
4. Node data fields: label (short title, NO emojis), role (job title), timelineMonths (integer), readiness (0.0-1.0 float), stressLevel ("low"|"medium"|"high"), description (1 sentence career advice, NO emojis).
5. If burnout_zone is "risk", include MORE low-stress, short-timeline nodes (e.g. "Update Resume", "Coffee Chat", "1-Day Workshop").
6. If burnout_zone is "healthy", include ambitious longer-term paths too.
7. Edges connect nodes logically. Each edge: id (e.g. "e1-2"), source (string), target (string).
8. Do NOT use any emojis anywhere.

Return ONLY valid JSON (no markdown fences, no extra text):
{{"nodes": [...], "edges": [...]}}"""

# ---------------------------------------------------------------------------
# Profile hashing — detects when user data has changed so the map regenerates
# ---------------------------------------------------------------------------
def _compute_profile_hash(major: str, skills: list, interests: list, burnout_zone: str) -> str:
    """Deterministic hash of the inputs that shape the career map."""
    payload = json.dumps(
        {"major": major, "skills": sorted(skills), "interests": sorted(interests), "zone": burnout_zone},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# DB helpers for career_maps table
# ---------------------------------------------------------------------------
def _get_cached_career_map(sb, user_id: str, profile_hash: str) -> Optional[dict]:
    """Return the most recent career map for this user IF the profile hash matches."""
    try:
        res = (
            sb.table("career_maps")
            .select("nodes, edges, source, profile_hash")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and res.data[0]["profile_hash"] == profile_hash:
            row = res.data[0]
            return {"nodes": row["nodes"], "edges": row["edges"], "source": row["source"]}
    except Exception as e:
        print(f"Cache lookup error: {e}")
    return None


def _save_career_map(sb, user_id: str, profile_hash: str, nodes: list, edges: list, source: str):
    """Upsert the career map for a user (keeps one row per user)."""
    try:
        # Delete old maps for this user, then insert new one
        sb.table("career_maps").delete().eq("user_id", user_id).execute()
        sb.table("career_maps").insert({
            "user_id": user_id,
            "profile_hash": profile_hash,
            "nodes": nodes,
            "edges": edges,
            "source": source,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"Career map save error: {e}")


def _invalidate_career_map(sb, user_id: str):
    """Delete cached career map so next request regenerates it."""
    try:
        sb.table("career_maps").delete().eq("user_id", user_id).execute()
    except Exception as e:
        print(f"Career map invalidation error: {e}")


# ---------------------------------------------------------------------------
# FastAPI builder
# ---------------------------------------------------------------------------
def _build_fastapi() -> Any:

    @asynccontextmanager
    async def lifespan(web_app: FastAPI):
        yield

    web_app = FastAPI(
        title="ManaSetu API",
        description="Career map + burnout signals for students and professionals.",
        version="0.1.0",
        lifespan=lifespan,
    )

    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173"
        ).split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health ──────────────────────────────────────────────────────
    @web_app.get("/health")
    async def health():
        sb = _get_supabase()
        return {
            "status": "ok",
            "service": "mana-setu",
            "supabase": "connected" if sb else "not configured",
            "gemini": "configured" if os.environ.get("GEMINI_API_KEY", "") not in ("", "your_gemini_api_key_here") else "not configured",
        }

    # ── Onboarding ──────────────────────────────────────────────────
    @web_app.post("/api/onboard")
    async def onboard(req: OnboardRequest):
        user_id = str(uuid.uuid4())
        profile = {
            "major": req.major,
            "skills": req.skills,
            "interests": req.interests,
        }

        sb = _get_supabase()
        if sb:
            try:
                sb.table("users").insert({
                    "id": user_id,
                    "major": req.major,
                    "skills": req.skills,
                    "interests": req.interests,
                    "burnout_score": 0,
                    "burnout_zone": "healthy",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception as e:
                print(f"Supabase insert error: {e}")
                # Fall back to in-memory
                _users_mem[user_id] = profile
                _burnout_mem[user_id] = {"score": 0, "zone": "healthy"}
        else:
            _users_mem[user_id] = profile
            _burnout_mem[user_id] = {"score": 0, "zone": "healthy"}

        return {"user_id": user_id, "profile": profile}

    # ── Burnout Check-in ────────────────────────────────────────────
    @web_app.post("/api/burnout/checkin")
    async def burnout_checkin(req: BurnoutCheckinRequest):
        result = _compute_burnout(req.answers)

        sb = _get_supabase()
        if sb:
            try:
                # Fetch the OLD burnout zone so we can compare
                old_zone = "healthy"
                try:
                    old_res = sb.table("users").select("burnout_zone").eq("id", req.user_id).single().execute()
                    old_zone = old_res.data.get("burnout_zone", "healthy")
                except Exception:
                    pass

                # Update user record
                sb.table("users").update({
                    "burnout_score": result["score"],
                    "burnout_zone": result["zone"],
                }).eq("id", req.user_id).execute()

                # Log the checkin
                sb.table("burnout_checkins").insert({
                    "user_id": req.user_id,
                    "answers": req.answers,
                    "score": result["score"],
                    "zone": result["zone"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()

                # If burnout zone changed, invalidate the cached career map
                # so the next generate call produces a fresh, zone-aware map
                if result["zone"] != old_zone:
                    _invalidate_career_map(sb, req.user_id)

            except Exception as e:
                print(f"Supabase burnout update error: {e}")
                _burnout_mem[req.user_id] = result
        else:
            _burnout_mem[req.user_id] = result

        return result

    # ── Get burnout ─────────────────────────────────────────────────
    @web_app.get("/api/burnout/{user_id}")
    async def get_burnout(user_id: str):
        sb = _get_supabase()
        if sb:
            try:
                res = sb.table("users").select("burnout_score, burnout_zone").eq("id", user_id).single().execute()
                return {"score": res.data["burnout_score"], "zone": res.data["burnout_zone"]}
            except Exception:
                pass
        return _burnout_mem.get(user_id, {"score": 0, "zone": "healthy"})

    # ── Update profile ──────────────────────────────────────────────
    class UpdateProfileRequest(BaseModel):
        user_id: str
        major: Optional[str] = None
        skills: Optional[list[str]] = None
        interests: Optional[list[str]] = None

    @web_app.patch("/api/profile")
    async def update_profile(req: UpdateProfileRequest):
        """Update user profile fields. Invalidates cached career map so the
        next generate call produces a fresh map reflecting the changes."""
        updates: dict[str, Any] = {}
        if req.major is not None:
            updates["major"] = req.major
        if req.skills is not None:
            updates["skills"] = req.skills
        if req.interests is not None:
            updates["interests"] = req.interests
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")

        sb = _get_supabase()
        if sb:
            try:
                sb.table("users").update(updates).eq("id", req.user_id).execute()
                # Invalidate cached career map — profile changed
                _invalidate_career_map(sb, req.user_id)
            except Exception as e:
                print(f"Profile update error: {e}")
                raise HTTPException(status_code=500, detail="Failed to update profile.")
        else:
            mem = _users_mem.get(req.user_id)
            if mem:
                mem.update(updates)
            else:
                raise HTTPException(status_code=404, detail="User not found.")

        return {"status": "updated", "fields": list(updates.keys())}

    # ── Generate career map ─────────────────────────────────────────
    @web_app.post("/api/career-map/generate")
    async def generate_career_map(req: CareerMapRequest):
        # 1. Fetch user profile from DB
        profile = None
        sb = _get_supabase()
        if sb:
            try:
                res = sb.table("users").select("*").eq("id", req.user_id).single().execute()
                profile = {
                    "major": res.data["major"],
                    "skills": res.data["skills"],
                    "interests": res.data["interests"],
                }
                burnout = {
                    "score": res.data.get("burnout_score", 0),
                    "zone": res.data.get("burnout_zone", "healthy"),
                }
            except Exception as e:
                print(f"Supabase fetch error: {e}")

        if not profile:
            profile = _users_mem.get(req.user_id)
            burnout = _burnout_mem.get(req.user_id, {"score": 0, "zone": "healthy"})

        if not profile:
            raise HTTPException(status_code=404, detail="User not found. Onboard first.")

        zone = burnout["zone"]

        # 2. Compute profile hash to detect changes
        current_hash = _compute_profile_hash(
            profile["major"], profile["skills"], profile["interests"], zone
        )

        # 3. Check for a cached career map in the DB that matches the current hash
        if sb:
            cached = _get_cached_career_map(sb, req.user_id, current_hash)
            if cached:
                return {
                    "nodes": cached["nodes"],
                    "edges": cached["edges"],
                    "burnout": burnout,
                    "source": cached["source"],
                    "cached": True,
                }

        # 4. No valid cache — generate a fresh map via Gemini
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="Gemini API key is not configured. Cannot generate career map.",
            )

        # Per-user lock: if multiple requests arrive for the same user,
        # only the first one calls Gemini; the rest wait and read from cache.
        if req.user_id not in _gen_locks:
            _gen_locks[req.user_id] = asyncio.Lock()

        async with _gen_locks[req.user_id]:
            # Re-check cache (another request may have filled it while we waited)
            if sb:
                cached = _get_cached_career_map(sb, req.user_id, current_hash)
                if cached:
                    return {
                        "nodes": cached["nodes"],
                        "edges": cached["edges"],
                        "burnout": burnout,
                        "source": cached["source"],
                        "cached": True,
                    }

            from google import genai

            client = genai.Client(api_key=api_key)
            prompt = GEMINI_CAREER_PROMPT.format(
                major=profile["major"],
                skills=", ".join(profile["skills"]),
                interests=", ".join(profile["interests"]),
                burnout_zone=zone,
            )

            # Retry loop for rate-limit (429) — max 2 retries, short delays
            max_retries = 2
            last_error = None
            for attempt in range(max_retries):
                try:
                    response = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt,
                    )
                    text = response.text.strip()
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1]
                    if text.endswith("```"):
                        text = text.rsplit("```", 1)[0]
                    if text.startswith("json"):
                        text = text[4:].strip()

                    career_data = json.loads(text)
                    nodes = career_data["nodes"]
                    edges = career_data["edges"]

                    # 5. Persist the freshly generated map to the DB
                    if sb:
                        _save_career_map(sb, req.user_id, current_hash, nodes, edges, "gemini")

                    return {
                        "nodes": nodes,
                        "edges": edges,
                        "burnout": burnout,
                        "source": "gemini",
                        "cached": False,
                    }
                except Exception as e:
                    last_error = e
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        wait_secs = 30 * (attempt + 1)  # 30s, then 60s
                        print(f"Gemini rate-limited (attempt {attempt+1}/{max_retries}), retrying in {wait_secs}s...")
                        await asyncio.sleep(wait_secs)
                        continue
                    # Non-retryable error
                    print(f"Gemini error: {e}")
                    raise HTTPException(
                        status_code=502,
                        detail=f"Career map generation failed: {e}",
                    )

            # All retries exhausted
            print(f"Gemini rate limit exhausted after {max_retries} retries: {last_error}")
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit exceeded. Please wait a minute and try again.",
            )

    # ── Get user profile ────────────────────────────────────────────
    @web_app.get("/api/profile/{user_id}")
    async def get_profile(user_id: str):
        sb = _get_supabase()
        if sb:
            try:
                res = sb.table("users").select("*").eq("id", user_id).single().execute()
                return {
                    "user_id": user_id,
                    "major": res.data["major"],
                    "skills": res.data["skills"],
                    "interests": res.data["interests"],
                    "burnout_score": res.data.get("burnout_score", 0),
                    "burnout_zone": res.data.get("burnout_zone", "healthy"),
                    "created_at": res.data.get("created_at"),
                }
            except Exception:
                pass
        mem = _users_mem.get(user_id)
        if mem:
            b = _burnout_mem.get(user_id, {"score": 0, "zone": "healthy"})
            return {"user_id": user_id, **mem, **b}
        raise HTTPException(status_code=404, detail="User not found.")

    return web_app


# ASGI app for local dev
api = _build_fastapi()


# ---------------------------------------------------------------------------
# Modal web function
# ---------------------------------------------------------------------------
@app.function(
    secrets=[
        modal.Secret.from_name("mana-setu-secrets"),
    ],
    timeout=300,
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def http_api() -> Any:
    return _build_fastapi()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8000)
