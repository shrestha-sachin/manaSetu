"""
Quick diagnostic script to test API keys and database connectivity.
Run: python test_connections.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

print("=" * 60)
print("  ManaSetu Connection Diagnostics")
print("=" * 60)

errors = []
warnings = []

# ── 1. Check environment variables exist ──────────────────────
print("\n[1/4] Checking environment variables...")

gemini_key = os.environ.get("GEMINI_API_KEY", "")
supa_url = os.environ.get("SUPABASE_URL", "")
supa_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not gemini_key or gemini_key == "your_gemini_api_key_here":
    errors.append("GEMINI_API_KEY is missing or placeholder")
    print("  GEMINI_API_KEY: MISSING")
else:
    print(f"  GEMINI_API_KEY: Set (starts with {gemini_key[:10]}...)")

if not supa_url or "your_" in supa_url:
    errors.append("SUPABASE_URL is missing or placeholder")
    print("  SUPABASE_URL: MISSING")
else:
    print(f"  SUPABASE_URL: {supa_url}")

if not supa_key or "your_" in supa_key:
    errors.append("SUPABASE_SERVICE_ROLE_KEY is missing or placeholder")
    print("  SUPABASE_SERVICE_ROLE_KEY: MISSING")
else:
    print(f"  SUPABASE_SERVICE_ROLE_KEY: Set (starts with {supa_key[:20]}...)")

# ── 2. Test Gemini API ────────────────────────────────────────
print("\n[2/4] Testing Gemini API...")
if gemini_key and gemini_key != "your_gemini_api_key_here":
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say 'hello' in one word.",
        )
        text = response.text.strip()
        print(f"  Gemini response: \"{text}\"")
        print("  Gemini API: OK")
    except Exception as e:
        errors.append(f"Gemini API call failed: {e}")
        print(f"  Gemini API: FAILED - {e}")
else:
    print("  Skipped (no API key)")

# ── 3. Test Supabase connection ───────────────────────────────
print("\n[3/4] Testing Supabase connection...")
if supa_url and supa_key and "your_" not in supa_url and "your_" not in supa_key:
    try:
        from supabase import create_client
        sb = create_client(supa_url, supa_key)
        print("  Supabase client created: OK")

        # Try listing tables by querying the users table
        try:
            res = sb.table("users").select("id").limit(3).execute()
            row_count = len(res.data) if res.data else 0
            print(f"  'users' table: OK ({row_count} rows returned, limit 3)")
        except Exception as e:
            err_str = str(e)
            if "relation" in err_str and "does not exist" in err_str:
                errors.append("'users' table does not exist in Supabase")
                print(f"  'users' table: NOT FOUND - Table needs to be created")
            else:
                errors.append(f"'users' table query failed: {e}")
                print(f"  'users' table: FAILED - {e}")

        try:
            res = sb.table("burnout_checkins").select("id").limit(3).execute()
            row_count = len(res.data) if res.data else 0
            print(f"  'burnout_checkins' table: OK ({row_count} rows returned, limit 3)")
        except Exception as e:
            err_str = str(e)
            if "relation" in err_str and "does not exist" in err_str:
                errors.append("'burnout_checkins' table does not exist in Supabase")
                print(f"  'burnout_checkins' table: NOT FOUND - Table needs to be created")
            else:
                errors.append(f"'burnout_checkins' table query failed: {e}")
                print(f"  'burnout_checkins' table: FAILED - {e}")

    except Exception as e:
        errors.append(f"Supabase connection failed: {e}")
        print(f"  Supabase connection: FAILED - {e}")
else:
    print("  Skipped (no Supabase credentials)")

# ── 4. Test full onboard + career-map flow via running server ─
print("\n[4/4] Testing live API endpoints (localhost:8000)...")
try:
    import httpx
    base = "http://localhost:8000"

    # Health check
    r = httpx.get(f"{base}/health", timeout=5)
    health = r.json()
    print(f"  /health: {r.status_code} -> {health}")

    if health.get("supabase") != "connected":
        warnings.append("Health endpoint reports Supabase not connected (may be fine if env vars aren't loaded by Modal)")
    if health.get("gemini") != "configured":
        warnings.append("Health endpoint reports Gemini not configured")

except httpx.ConnectError:
    warnings.append("Could not reach localhost:8000 - server may not be running locally (Modal serve uses a different URL)")
    print("  Could not connect to localhost:8000")
    print("  (This is expected if you're only running via 'modal serve')")
except Exception as e:
    warnings.append(f"API test error: {e}")
    print(f"  API test: {e}")

# ── Summary ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  SUMMARY")
print("=" * 60)

if not errors and not warnings:
    print("\n  All checks passed! Everything looks good.")
elif errors:
    print(f"\n  {len(errors)} error(s):")
    for i, e in enumerate(errors, 1):
        print(f"    {i}. {e}")
if warnings:
    print(f"\n  {len(warnings)} warning(s):")
    for i, w in enumerate(warnings, 1):
        print(f"    {i}. {w}")

print()
sys.exit(1 if errors else 0)
