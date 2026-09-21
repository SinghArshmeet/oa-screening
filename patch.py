import re

with open("backend/main.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import time\n", "import time\nimport jwt\n")

start_str = "def _create_session(user_id: int) -> str:"
end_str = "def create_patient("

start_idx = content.find(start_str)
end_idx = content.find(end_str)

replacement = """SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

def get_current_user_optional(
    authorization: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_station: str | None = Header(default=None, alias="X-User-Station"),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> dict[str, object] | None:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            if SUPABASE_JWT_SECRET:
                payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            else:
                payload = jwt.decode(token, options={"verify_signature": False})
            
            user_metadata = payload.get("user_metadata", {})
            return {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "name": user_metadata.get("full_name", payload.get("email", "User")),
                "role_id": user_metadata.get("role_id", "screener"),
                "role": "Medical Officer" if user_metadata.get("role_id") == "officer" else "System Administrator" if user_metadata.get("role_id") == "admin" else "Clinical Screener",
                "station": user_metadata.get("station", "Diphu PHC"),
                "staff_id": user_metadata.get("staff_id", "NER-101")
            }
        except Exception as e:
            print(f"JWT Decode error: {e}")
            pass
            
    if x_user_role:
        role_clean = x_user_role.lower().strip()
        role_label = "Clinical Screener" if role_clean == "screener" else "Medical Officer" if role_clean == "officer" else "System Administrator"
        role_badge = "Station Screener" if role_clean == "screener" else "Medical Officer" if role_clean == "officer" else "System Admin"
        return {
            "id": 99,
            "email": x_user_email or f"{role_clean}@phc.assam.gov.in",
            "name": x_user_name or f"Authorized {role_label}",
            "role": role_label,
            "role_id": role_clean,
            "role_badge": role_badge,
            "station": x_user_station or ("Diphu PHC" if role_clean == "screener" else "GMCH Ortho Unit" if role_clean == "officer" else "ICMR Telemetry Hub"),
            "staff_id": f"NER-{role_clean.upper()}-01"
        }
    return None

def require_authenticated_user(user: dict[str, object] | None = Depends(get_current_user_optional)) -> dict[str, object]:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return user

def require_role(*allowed_roles: str):
    def role_checker(user: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
        user_role = str(user.get("role_id") or "screener").lower()
        if allowed_roles and user_role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Access forbidden: Role '{user_role}' required.")
        return user
    return role_checker

def create_patient("""

content = content[:start_idx] + replacement + content[end_idx + len("def create_patient("):]

with open("backend/main.py", "w", encoding="utf-8") as f:
    f.write(content)
