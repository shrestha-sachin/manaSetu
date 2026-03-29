"""
ManaSetu API — FastAPI on Modal.

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
from dotenv import load_dotenv  # type: ignore
load_dotenv()

import modal  # type: ignore
from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore

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
_supabase_client = None

def _get_sample_fallback_map(burnout: dict) -> dict:
    return {
        "nodes": [
            {
                "id": "start",
                "type": "custom",
                "position": {"x": 250, "y": 50},
                "data": {"label": "Start Here", "phase": "foundation", "completed": True},
            },
            {
                "id": "step1",
                "type": "custom",
                "position": {"x": 250, "y": 200},
                "data": {"label": "Focus on Basics", "phase": "early", "completed": False},
            },
        ],
        "edges": [
            {
                "id": "e1",
                "source": "start",
                "target": "step1",
                "type": "smoothstep",
                "animated": True,
            }
        ],
        "burnout": burnout,
        "source": "fallback",
        "cached": False,
    }

def _get_supabase():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key or "your_" in url or "your_" in key:
        return None

    try:
        from supabase import create_client  # type: ignore
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
class OnboardingRequest(BaseModel):
    user_id: str
    name: str = ""
    major: str
    skills: list[str]
    interests: list[str]
    academic_level: Optional[str] = None
    sleep_hours: int | None = 7
    work_hours: int | None = 8
    rest_hours: int | None = 4

class BreakSuggestionRequest(BaseModel):
    user_id: str

class AuthRequest(BaseModel):
    email: str
    password: str
    name: str = ""

class PasswordChangeRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str


class BurnoutCheckinRequest(BaseModel):
    user_id: str
    answers: list[int]  # 5 answers, each 1-5
    academic_level: Optional[str] = None


class CareerMapRequest(BaseModel):
    user_id: str
    broaden: bool = False


class MilestoneUpdateRequest(BaseModel):
    user_id: str
    node_id: str
    completed: Optional[bool] = None
    items_completed: Optional[list[str]] = None

class SuggestionsRequest(BaseModel):
    major: str


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
GEMINI_CAREER_PROMPT = """You are ManaSetu AI. Given the user profile below, generate a personalized career roadmap as a directed graph.

User Profile:
- Major: {major}
- Academic Level: {academic_level}
- Skills: {skills}
- Career Interests: {interests}
- Current Burnout Zone: {burnout_zone}
- Daily Routine: {sleep} hours sleep, {work} hours work/study, {rest} hours rest/free time
- Exploration Goal: {exploration_goal}

Rules:
1. Generate 6-8 career milestone nodes forming 2-3 branching paths.
2. The first node is always the user's current state (label: "Current: Student").
3. Each node must have: id (string number starting from "1"), position (object with x, y integers - space ~280px apart horizontally, vary y between -60 and 280), and a data object.
4. Node data fields: label (short title, NO emojis), role (job title), timelineMonths (integer), stressLevel ("low"|"medium"|"high"), description (short actionable advice).
5. CRITICAL: Each node data MUST include "resources" (list of objects: {{"label": "Title", "url": "verified-resource-url"}}) and "checklist" (list of 3-5 specific actionable items to achieve this milestone).
6. RESOURCES: Provide 2-3 REAL links (e.g., Coursera, MDN, LinkedIn Learning, or niche field-specific sites). DO NOT use fake URLs. Use placeholders like "https://www.google.com/search?q=Learn+..." only if a specific direct link is unavailable.
7. PROGRESS: Do NOT provide mock percentage data. The frontend will calculate progress from the checklist.
8. If burnout_zone is "risk", include MORE low-stress, short-timeline nodes focusing on recovery before growth.
9. Edges connect nodes logically. Each edge: id (e.g. "e1-2"), source (string), target (string).
10. If Exploration Goal is "BROAD", suggest at least 2 paths that are completely unconventional or "sideways" from their major.
11. Do NOT use any emojis anywhere.

Return ONLY valid JSON:
{{"nodes": [...], "edges": [...]}}"""

GEMINI_SUGGESTIONS_PROMPT = """You are ManaSetu AI. Given the user's major/field below, generate relevant skills and career interests they might have.

Major: {major}

Rules:
1. Generate 12-15 skills that are most relevant to this major. Include a mix of technical and soft skills.
2. Generate 10-12 career interest areas or job directions relevant to this major.
3. Skills should be concise (1-3 words each).
4. Career interests should be concise (1-3 words each).
5. Be creative and comprehensive — cover the full breadth of the field.
6. Do NOT include any emojis.

Return ONLY valid JSON (no markdown fences, no extra text):
{{"skills": ["Skill 1", "Skill 2", ...], "interests": ["Interest 1", "Interest 2", ...]}}"""

# ---------------------------------------------------------------------------
# Profile hashing — detects when user data has changed so the map regenerates
# ---------------------------------------------------------------------------
def _compute_profile_hash(major: str, skills: list, interests: list, burnout_zone: str, 
                          academic_level: str | None = None,
                          sleep: int | None = None, work: int | None = None, rest: int | None = None, 
                          broaden: bool = False) -> str:
    """Deterministic hash of the inputs that shape the career map."""
    payload = json.dumps(
        {"major": major, "skills": sorted(skills), "interests": sorted(interests), "zone": burnout_zone, 
         "level": academic_level, "sleep": sleep, "work": work, "rest": rest, "broaden": broaden},
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

    # ── Authentication ──────────────────────────────────────────────
    @web_app.post("/api/auth/signup")
    async def auth_signup(req: AuthRequest):
        sb = _get_supabase()
        if sb:
            try:
                # Use admin API to auto-confirm email, avoiding login blocks
                res = sb.auth.admin.create_user({
                    "email": req.email, 
                    "password": req.password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": req.name}
                })
                if not res or not res.user:
                    raise Exception("Failed to create user.")
                return {"user_id": res.user.id}
            except Exception as e:
                # If admin creation fails (or user exists), try regular sign_up as a fallback
                try:
                    alt_res = sb.auth.sign_up({"email": req.email, "password": req.password})
                    if alt_res and alt_res.user:
                        return {"user_id": alt_res.user.id}
                except:
                    pass
                raise HTTPException(status_code=400, detail=str(e).replace("Exception: ", ""))
        else:
            import hashlib
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, req.email))
            hashed_pw = hashlib.sha256(req.password.encode()).hexdigest()
            # In offline mode, store password hash in memory
            _users_mem[user_id] = _users_mem.get(user_id, {})
            _users_mem[user_id]["email"] = req.email
            _users_mem[user_id]["hashed_pw"] = hashed_pw
            _users_mem[user_id]["name"] = req.name
            return {"user_id": user_id}

    @web_app.post("/api/auth/login")
    async def auth_login(req: AuthRequest):
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if url and key and "your_" not in url:
            try:
                # Instantiate a localized client just for auth so we don't downgrade 
                # the backend's global service_role JWT to a user session
                from supabase import create_client
                temp_sb = create_client(url, key)
                res = temp_sb.auth.sign_in_with_password({"email": req.email, "password": req.password})
                if not res or not res.user:
                    raise Exception("Invalid credentials.")
                return {"user_id": res.user.id}
            except Exception as e:
                print(f"Login failed: {e}")
                raise HTTPException(status_code=401, detail=str(e).replace("Exception: ", ""))
        else:
            import hashlib
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, req.email))
            mem = _users_mem.get(user_id)
            if mem and mem.get("hashed_pw") == hashlib.sha256(req.password.encode()).hexdigest():
                return {"user_id": user_id}
            raise HTTPException(status_code=401, detail="Invalid email or password.")

    @web_app.post("/api/auth/password")
    async def auth_password(req: PasswordChangeRequest):
        sb = _get_supabase()
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if sb and url and key and "your_" not in url:
            try:
                # 1. Get user email
                user_res = sb.auth.admin.get_user_by_id(req.user_id)
                if not user_res or not user_res.user:
                    raise Exception("User not found.")
                email = user_res.user.email
                
                # 2. Verify current password
                from supabase import create_client
                temp_sb = create_client(url, key)
                temp_sb.auth.sign_in_with_password({"email": email, "password": req.current_password})
                
                # 3. Update password
                sb.auth.admin.update_user_by_id(req.user_id, {"password": req.new_password})
                return {"status": "success"}
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e).replace("Exception: ", ""))
        else:
            import hashlib
            mem = _users_mem.get(req.user_id)
            if mem and mem.get("hashed_pw") == hashlib.sha256(req.current_password.encode()).hexdigest():
                mem["hashed_pw"] = hashlib.sha256(req.new_password.encode()).hexdigest()
                return {"status": "success"}
            raise HTTPException(status_code=400, detail="Invalid current password.")

    # ── Suggestions (AI-powered skills & interests for any major) ───
    @web_app.post("/api/suggestions")
    async def get_suggestions(req: SuggestionsRequest):
        """Use xAI to generate relevant skills and career interests for any major."""
        major = req.major.strip()
        if not major:
            raise HTTPException(status_code=400, detail="Major is required.")

        xai_key = os.environ.get("XAI_API_KEY", "")
        if not xai_key:
            return {
                "skills": ["Research", "Critical Thinking", "Communication", "Problem Solving",
                           "Data Analysis", "Project Management", "Writing", "Teamwork",
                           "Presentation", "Time Management", "Leadership", "Creativity"],
                "interests": ["Industry Research", "Consulting", "Education", "Entrepreneurship",
                              "Management", "Technical Specialist", "Policy Making", "Freelancing",
                              "Graduate Studies", "Non-Profit Work"],
                "source": "fallback",
            }

        try:
            prompt = GEMINI_SUGGESTIONS_PROMPT.format(major=major)
            from openai import OpenAI
            xai_client = OpenAI(api_key=xai_key, base_url="https://api.x.ai/v1")
            response = xai_client.chat.completions.create(
                model="grok-4.20-0309-non-reasoning",
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.choices[0].message.content.strip()
            source = "xai"

            if text.startswith("```"):
                text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            if text.startswith("json"):
                text = text[4:].strip()

            data = json.loads(text)
            return {
                "skills": data.get("skills", []),
                "interests": data.get("interests", []),
                "source": source,
            }
        except Exception as e:
            print(f"Suggestions generation error: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to generate suggestions: {e}")

    # ── Onboarding ──────────────────────────────────────────────────
    @web_app.post("/api/onboard")
    async def onboard(req: OnboardingRequest):
        user_id = req.user_id if req.user_id else str(uuid.uuid4())
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        profile = {
            "name": req.name,
            "major": req.major,
            "academic_level": req.academic_level,
            "skills": req.skills,
            "interests": req.interests,
            "sleep_hours": req.sleep_hours,
            "work_hours": req.work_hours,
            "rest_hours": req.rest_hours,
        }

        sb = _get_supabase()
        if sb:
            try:
                # Try to upsert into users table
                payload = {
                    "id": user_id,
                    "name": req.name,
                    "major": req.major,
                    "academic_level": req.academic_level,
                    "skills": req.skills,
                    "interests": req.interests,
                    "sleep_hours": req.sleep_hours,
                    "work_hours": req.work_hours,
                    "rest_hours": req.rest_hours,
                    "burnout_score": 0,
                    "burnout_zone": "healthy",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                sb.table("users").upsert(payload).execute()
            except Exception as e:
                print(f"Supabase onboard error: {e}")
                _users_mem[user_id] = profile
                _burnout_mem[user_id] = {"score": 0, "zone": "healthy"}
        else:
            _users_mem[user_id] = profile
            _burnout_mem[user_id] = {"score": 0, "zone": "healthy"}

        return {"user_id": user_id, "profile": profile}

    # ── Burnout Check-in ────────────────────────────────────────────
    @web_app.post("/api/burnout/checkin")
    async def burnout_checkin(req: BurnoutCheckinRequest):
        user_id = req.user_id
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        result = _compute_burnout(req.answers)

        sb = _get_supabase()
        if sb:
            try:
                # Fetch the OLD burnout zone so we can compare
                old_zone = "healthy"
                try:
                    old_res = sb.table("users").select("burnout_zone").eq("id", user_id).single().execute()
                    old_zone = old_res.data.get("burnout_zone", "healthy")
                except Exception:
                    pass

                # Update user record
                sb.table("users").update({
                    "burnout_score": result["score"],
                    "burnout_zone": result["zone"],
                    "academic_level": req.academic_level
                }).eq("id", user_id).execute()

                # Log the checkin
                sb.table("burnout_checkins").insert({
                    "user_id": user_id,
                    "answers": req.answers,
                    "score": result["score"],
                    "zone": result["zone"],
                    "academic_level": req.academic_level,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()

                # If burnout zone changed, invalidate the cached career map
                # so the next generate call produces a fresh, zone-aware map
                if result["zone"] != old_zone:
                    _invalidate_career_map(sb, user_id)

            except Exception as e:
                print(f"Supabase burnout update error: {e}")
                _burnout_mem[user_id] = result
        else:
            _burnout_mem[user_id] = result

        return result

    # ── Get burnout ─────────────────────────────────────────────────
    @web_app.get("/api/burnout/{user_id}")
    async def get_burnout(user_id: str):
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))
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
        name: Optional[str] = None
        major: Optional[str] = None
        academic_level: Optional[str] = None
        skills: Optional[list[str]] = None
        interests: Optional[list[str]] = None
        sleep_hours: Optional[int] = None
        work_hours: Optional[int] = None
        rest_hours: Optional[int] = None

    @web_app.patch("/api/profile")
    async def update_profile(req: UpdateProfileRequest):
        """Update user profile fields. Invalidates cached career map so the
        next generate call produces a fresh map reflecting the changes."""
        user_id = req.user_id
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        updates: dict[str, Any] = {}
        if req.name is not None:
            updates["name"] = req.name
        if req.major is not None:
            updates["major"] = req.major
        if req.academic_level is not None:
            updates["academic_level"] = req.academic_level
        if req.skills is not None:
            updates["skills"] = req.skills
        if req.interests is not None:
            updates["interests"] = req.interests
        if req.sleep_hours is not None:
            updates["sleep_hours"] = req.sleep_hours
        if req.work_hours is not None:
            updates["work_hours"] = req.work_hours
        if req.rest_hours is not None:
            updates["rest_hours"] = req.rest_hours
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")

        sb = _get_supabase()
        if sb:
            try:
                sb.table("users").update(updates).eq("id", user_id).execute()
                # Invalidate cached career map — profile changed
                _invalidate_career_map(sb, user_id)
            except Exception as e:
                print(f"Profile update error: {e}")
                raise HTTPException(status_code=500, detail="Failed to update profile.")
        else:
            mem = _users_mem.get(user_id)
            if mem:
                mem.update(updates)
            else:
                raise HTTPException(status_code=404, detail="User not found.")

        return {"status": "updated", "fields": list(updates.keys())}

    # ── Generate career map ─────────────────────────────────────────
    @web_app.post("/api/career-map/generate")
    async def generate_career_map(req: CareerMapRequest):
        user_id = req.user_id
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        # 1. Fetch user profile from DB
        profile = None
        sb = _get_supabase()
        if sb:
            try:
                res = sb.table("users").select("*").eq("id", user_id).single().execute()
                res_data = res.data
                url = os.environ.get("SUPABASE_URL")
                key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                if url and key and "your_" not in url:
                    try:
                        admin_res = sb.auth.admin.get_user_by_id(user_id)
                        if admin_res and admin_res.user:
                            res_data["email"] = admin_res.user.email
                    except:
                        pass
                profile = {
                    "major": res_data["major"],
                    "skills": res_data["skills"],
                    "interests": res_data["interests"],
                    "academic_level": res_data.get("academic_level", "Year 1"),
                    "name": res_data.get("name", ""),
                    "sleep_hours": res_data.get("sleep_hours", 7),
                    "work_hours": res_data.get("work_hours", 8),
                    "rest_hours": res_data.get("rest_hours", 4),
                    "email": res_data.get("email", ""),
                }
                burnout = {
                    "score": res_data.get("burnout_score", 0),
                    "zone": res_data.get("burnout_zone", "healthy"),
                }
            except Exception as e:
                print(f"Supabase fetch error: {e}")

        if not profile:
            profile = _users_mem.get(user_id)
            burnout = _burnout_mem.get(user_id, {"score": 0, "zone": "healthy"})

        if not profile:
            raise HTTPException(status_code=404, detail="User not found. Onboard first.")

        zone = burnout["zone"]

        # 2. Compute profile hash to detect changes
        current_hash = _compute_profile_hash(
            profile["major"], profile["skills"], profile["interests"], zone,
            academic_level=profile.get("academic_level"),
            sleep=profile.get("sleep_hours"), work=profile.get("work_hours"), rest=profile.get("rest_hours"),
            broaden=req.broaden
        )

        # 3. Check for a cached career map in the DB that matches the current hash
        if sb:
            cached = _get_cached_career_map(sb, user_id, current_hash)
            if cached:
                return {
                    "nodes": cached["nodes"],
                    "edges": cached["edges"],
                    "burnout": burnout,
                    "source": cached["source"],
                    "cached": True,
                }

        # 4. No valid cache — generate a fresh map via xAI
        xai_key = os.environ.get("XAI_API_KEY", "")
        if not xai_key:
            print("xAI API key is not configured. Falling back to sample map.")
            return _get_sample_fallback_map(burnout)

        # Per-user lock: if multiple requests arrive for the same user,
        # only the first one calls xAI; the rest wait and read from cache.
        if user_id not in _gen_locks:
            _gen_locks[user_id] = asyncio.Lock()

        async with _gen_locks[user_id]:
            # Re-check cache (another request may have filled it while we waited)
            if sb:
                cached = _get_cached_career_map(sb, user_id, current_hash)
                if cached:
                    return {
                        "nodes": cached["nodes"],
                        "edges": cached["edges"],
                        "burnout": burnout,
                        "source": cached["source"],
                        "cached": True,
                    }

            prompt = GEMINI_CAREER_PROMPT.format(
                major=profile["major"],
                academic_level=profile.get("academic_level") or "Student",
                skills=", ".join(profile["skills"]),
                interests=", ".join(profile["interests"]),
                burnout_zone=zone,
                sleep=profile.get("sleep_hours") or 7,
                work=profile.get("work_hours") or 8,
                rest=profile.get("rest_hours") or 4,
                exploration_goal="BROAD (unconventional, cross-disciplinary paths)" if req.broaden else "Focused on their specific major and direct career paths"
            )

            try:
                from openai import OpenAI
                xai_client = OpenAI(api_key=xai_key, base_url="https://api.x.ai/v1")
                response = xai_client.chat.completions.create(
                    model="grok-4.20-0309-non-reasoning",
                    messages=[{"role": "user", "content": prompt}],
                )
                text = response.choices[0].message.content.strip()

                if text.startswith("```"):
                    text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text.rsplit("```", 1)[0]
                if text.startswith("json"):
                    text = text[4:].strip()

                career_data = json.loads(text)
                nodes = career_data["nodes"]
                edges = career_data["edges"]

                # 5. Enrich nodes with user-specific progress if available
                if sb:
                    try:
                        m_res = sb.table("milestones").select("*").eq("user_id", user_id).execute()
                        m_map = {m["node_id"]: m for m in m_res.data}
                        for node in nodes:
                            if node["id"] in m_map:
                                node["data"]["completed"] = m_map[node["id"]]["completed"]
                                node["data"]["items_completed"] = m_map[node["id"]].get("items_completed", [])
                            else:
                                node["data"]["completed"] = False
                                node["data"]["items_completed"] = []
                    except:
                        pass

                # 6. Persist the freshly generated map to the DB
                if sb:
                    _save_career_map(sb, user_id, current_hash, nodes, edges, "xai")

                return {
                    "nodes": nodes,
                    "edges": edges,
                    "burnout": burnout,
                    "source": "xai",
                    "cached": False,
                }
            except Exception as e:
                print(f"xAI fallback error: {e}")
                return _get_sample_fallback_map(burnout)

    # ── AI Break Suggestion ─────────────────────────────────────────
    @web_app.post("/api/break-suggestion")
    async def get_break_suggestion(req: BreakSuggestionRequest):
        user_id = req.user_id
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        # Check burnout zone to tailor the advice
        zone = "healthy"
        sb = _get_supabase()
        if sb:
            try:
                res = sb.table("users").select("burnout_zone").eq("id", user_id).single().execute()
                zone = res.data["burnout_zone"]
            except:
                pass

        if zone == "risk":
            return {
                "suggestion": "Your burnout levels are currently extreme. Please consider speaking with a professional for support.",
                "is_critical": True,
                "resources": [
                    {"label": "988 Suicide & Crisis Lifeline", "url": "https://988lifeline.org/"},
                    {"label": "Crisis Text Line", "url": "https://www.crisistextline.org/"},
                    {"label": "BetterHelp", "url": "https://www.betterhelp.com/"},
                    {"label": "Zen Wisdom: Reach Out", "url": "https://www.psychologytoday.com/us/therapists"}
                ]
            }

        xai_key = os.environ.get("XAI_API_KEY", "")
        if xai_key:
            try:
                # Tailor the advice based on "healthy" vs "early_warning"
                prompt = (
                    f"You are ManaSetu AI. The user is in the '{zone}' burnout zone. "
                    "Suggest one ultra-creative, 5-minute restorative 'micro-break' or mental exercise. "
                    "No generic stuff like 'drink water'. Suggest something unique, sensory, or psychologically grounding. "
                    "Keep it to 2 short sentences. No emojis."
                )
                from openai import OpenAI
                xai_client = OpenAI(api_key=xai_key, base_url="https://api.x.ai/v1")
                response = xai_client.chat.completions.create(
                    model="grok-4.20-0309-non-reasoning",
                    messages=[{"role": "user", "content": prompt}],
                )
                suggestion = response.choices[0].message.content.strip()
                return {"suggestion": suggestion, "is_critical": False}
            except Exception as e:
                print(f"Break AI error: {e}")

        # Fallback suggestions
        fallbacks = [
            "Press your palms together firmly for 10 seconds then release to feel the blood return. Focus entirely on the tingling sensation in your fingertips.",
            "Look out the window and find 3 things that are blue. Briefly imagine the texture of each object as if you were touching it.",
            "Hum a single deep note and feel the vibration in your chest. Let the vibration anchor you to the present moment for one minute.",
            "Gently trace the outline of your own hand with one finger. Close your eyes and focus strictly on the physical contact point."
        ]
        import random
        return {"suggestion": random.choice(fallbacks), "is_critical": False}

    # ── Update Milestone Progress ───────────────────────────────────
    @web_app.post("/api/milestones/update")
    async def update_milestone(req: MilestoneUpdateRequest):
        user_id = req.user_id
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        sb = _get_supabase()
        if not sb:
            return {"status": "ok", "message": "In-memory mode — progress not saved."}

        try:
            updates = {}
            if req.completed is not None:
                updates["completed"] = req.completed
            if req.items_completed is not None:
                updates["items_completed"] = req.items_completed
            
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()

            res = sb.table("milestones").upsert({
                "user_id": user_id,
                "node_id": req.node_id,
                **updates
            }, on_conflict="user_id,node_id").execute()
            
            return {"status": "ok", "data": res.data}
        except Exception as e:
            print(f"Milestone update error: {e}")
            raise HTTPException(status_code=500, detail="Failed to update milestone.")

    # ── Get user profile ────────────────────────────────────────────
    @web_app.get("/api/profile/{user_id}")
    async def get_profile(user_id: str):
        try:
            uuid.UUID(user_id)
        except ValueError:
            user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_id))

        sb = _get_supabase()
        if sb:
            try:
                res = sb.table("users").select("*").eq("id", user_id).single().execute()
                return {
                    "user_id": user_id,
                    "major": res.data.get("major"),
                    "skills": res.data.get("skills", []),
                    "interests": res.data.get("interests", []),
                    "sleep_hours": res.data.get("sleep_hours"),
                    "work_hours": res.data.get("work_hours"),
                    "rest_hours": res.data.get("rest_hours"),
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
    import uvicorn  # type: ignore
    uvicorn.run(api, host="0.0.0.0", port=8000)
