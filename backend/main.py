import asyncio
import base64
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import time
from urllib.parse import quote
import urllib.request

import httpx
import joblib
from fastapi import Cookie, Depends, FastAPI, File, Header, HTTPException, Query, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse

from .db import get_connection, init_db
from .schemas import AnalysisRequest, ClinicalPredictRequest, DeviceConfig, PatientCreate, PatientVitalsUpdate, QuestionnairePayload, ScreeningCreate

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
from oa_screening.movement_prediction import predict_video
from oa_screening.risk_engine import combine_screening, recommendation_for
from oa_screening.xray_model import XRayModelSpec

MODEL_PATH = PROJECT_ROOT / "artifacts" / "movement_baseline.joblib"
XRAY_MODEL_PATH = PROJECT_ROOT / "artifacts" / "xray_checkpoint.pth"
CLINICAL_MODEL_PATH = PROJECT_ROOT / "artifacts" / "clinical_biomechanical_oa_model.joblib"

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
SESSION_SECRET = os.environ.get("SESSION_SECRET", "oa_ner_session_secret_lts")
SESSION_MAX_AGE_SECONDS = 7 * 24 * 3600

MAX_VIDEO_BYTES = 100 * 1024 * 1024
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}

OAUTH_STATES: dict[str, dict[str, object]] = {}

app = FastAPI(title="OA Risk Screening App", version="0.4.0")

allowed_origins = list(dict.fromkeys([
    FRONTEND_ORIGIN,
    "https://orthonex.vercel.app",
    "https://oa-ner-scanning-project.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
init_db()


def _patient_exists(conn, patient_id: int | None) -> None:
    if patient_id is not None and conn.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Patient record was not found.")


def _create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn = get_connection()
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
    conn.execute("INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, int(time.time()) + SESSION_MAX_AGE_SECONDS))
    conn.commit(); conn.close()
    return token


def _current_user(token: str | None) -> dict[str, object] | None:
    if not token:
        return None
    conn = get_connection()
    row = conn.execute("""SELECT u.id,u.email,u.name,u.picture,u.role,u.role_id,u.role_badge,u.station,u.staff_id
        FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token=? AND s.expires_at>?""", (token, int(time.time()))).fetchone()
    conn.close()
    return dict(row) if row else None


def get_current_user_optional(
    oa_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_station: str | None = Header(default=None, alias="X-User-Station"),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> dict[str, object] | None:
    token = oa_session or (authorization.split(" ", 1)[1] if authorization and authorization.startswith("Bearer ") else None)
    db_user = _current_user(token)
    if db_user:
        return db_user

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
        if not GOOGLE_CLIENT_ID:
            return {
                "id": 1,
                "email": "screener@phc.assam.gov.in",
                "name": "S. Terangpi, ANM",
                "role": "Clinical Screener",
                "role_id": "screener",
                "role_badge": "Station Screener",
                "station": "Diphu PHC"
            }
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return user


def require_role(*allowed_roles: str):
    def role_checker(user: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
        user_role = str(user.get("role_id") or "screener").lower()
        if allowed_roles and user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access forbidden: Role '{user_role}' does not have permission for this resource. Required: {', '.join(allowed_roles)}"
            )
        return user
    return role_checker


def _questionnaire_result(payload: QuestionnairePayload) -> tuple[int, str, list[str]]:
    score = float(payload.pain) * 1.5
    factors: list[str] = []

    # Age factor
    if payload.age >= 65:
        score += 3.0
        factors.append("Age 65 or above")
    elif payload.age >= 55:
        score += 2.0
        factors.append("Age 55–64")
    elif payload.age >= 45:
        score += 1.0
        factors.append("Age 45–54")

    # Pain severity (VAS 0-10)
    if payload.pain >= 7:
        factors.append("Severe knee pain (VAS >= 7)")
    elif payload.pain >= 4:
        factors.append("Moderate knee pain (VAS 4–6)")

    # Morning stiffness duration (0-90 minutes)
    if payload.stiffness >= 30:
        score += 2.0
        factors.append("Morning stiffness 30 minutes or more")
    elif payload.stiffness >= 15:
        score += 1.0
        factors.append("Morning stiffness 15–29 minutes")
    score += min(10.0, float(payload.stiffness) / 5.0)

    # Functional activity difficulties (0-3 each)
    score += 2.0 * float(payload.walking_difficulty + payload.stairs_difficulty + payload.squat_difficulty)
    if payload.squat_difficulty >= 2:
        factors.append("Significant squatting difficulty")
    if payload.walking_difficulty >= 2:
        factors.append("Walking difficulty")
    if payload.stairs_difficulty >= 2:
        factors.append("Stair climbing difficulty")

    # Previous knee trauma
    if payload.previous_knee_injury:
        score += 4.0
        factors.append("Previous knee trauma/injury")

    # Symptom duration
    if payload.symptom_duration_weeks >= 12:
        score += 2.0
        factors.append("Symptoms persistent >= 12 weeks")
    elif payload.symptom_duration_weeks >= 4:
        score += 1.0

    # Occupational tea plantation and terrain loading
    if payload.tea_plucking:
        score += 4.0
        factors.append("High physical tea-plucking workload")
    if payload.heavy_loads:
        score += 3.0
        factors.append("Frequent heavy-load carriage (>15kg)")
    if payload.deep_squatting:
        score += 3.0
        factors.append("Prolonged deep squatting (>4h)")
    if payload.slope_walking:
        score += 2.0
        factors.append("Frequent hilly/slope walking")

    final_score = min(40, round(score))
    category = "high" if final_score >= 25 else "moderate" if final_score >= 14 else "low"
    return final_score, category, factors


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "message": "OA screening backend ready",
        "model_loaded": MODEL_PATH.exists(),
        "clinical_model_loaded": CLINICAL_MODEL_PATH.exists(),
        "xray_model_loaded": XRAY_MODEL_PATH.exists(),
        "google_auth_configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    }


@app.get("/auth/status")
def auth_status(user: dict[str, object] | None = Depends(get_current_user_optional)) -> dict[str, object]:
    return {
        "authenticated": user is not None,
        "google_configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "user": user
    }


@app.get("/auth/google/login")
def google_login(role: str = Query(default="screener", pattern="^(screener|officer|admin)$")):
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="Google authentication is not configured.")
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    state = secrets.token_urlsafe(32)
    OAUTH_STATES[state] = {"verifier": verifier, "role": role, "expires_at": time.time() + 600}
    params = (
        f"client_id={quote(GOOGLE_CLIENT_ID)}",
        f"redirect_uri={quote(GOOGLE_REDIRECT_URI)}",
        "response_type=code",
        f"scope={quote('openid email profile')}",
        f"code_challenge={quote(challenge)}",
        "code_challenge_method=S256",
        f"state={quote(state)}",
        "access_type=offline",
        "prompt=select_account"
    )
    return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(params))


@app.get("/auth/google/callback")
async def google_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error or not code or not state:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/?auth_error={quote(error or 'missing_oauth_response')}")
    state_data = OAUTH_STATES.pop(state, None)
    if not state_data or float(state_data["expires_at"]) < time.time():
        return RedirectResponse(f"{FRONTEND_ORIGIN}/?auth_error=invalid_or_expired_state")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                    "code_verifier": state_data["verifier"]
                }
            )
            tokens = token_resp.raise_for_status().json()
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            info = user_resp.raise_for_status().json()
    except (httpx.HTTPError, KeyError):
        return RedirectResponse(f"{FRONTEND_ORIGIN}/?auth_error=google_exchange_failed")
    email, subject = info.get("email"), info.get("sub")
    if not email or not subject or info.get("email_verified") is not True:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/?auth_error=missing_google_identity")
    role_id = str(state_data["role"])
    labels = {
        "screener": ("Clinical Screener", "Station Screener"),
        "officer": ("Medical Officer", "Medical Officer"),
        "admin": ("System Administrator", "System Admin")
    }
    role_info = labels.get(role_id, ("Clinical Screener", "Station Screener"))
    conn = get_connection()
    row = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if row:
        user_id = row["id"]
        conn.execute("UPDATE users SET name=?, picture=?, sub=? WHERE id=?", (info.get("name") or email, info.get("picture"), subject, user_id))
    else:
        cursor = conn.execute(
            "INSERT INTO users (email, name, picture, sub, role, role_id, role_badge, staff_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (email, info.get("name") or email, info.get("picture"), subject, role_info[0], role_id, role_info[1], f"NER-GOOG-{secrets.randbelow(9000)+1000}")
        )
        user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    response = RedirectResponse(f"{FRONTEND_ORIGIN}/?auth_success=1")
    response.set_cookie("oa_session", _create_session(user_id), max_age=SESSION_MAX_AGE_SECONDS, httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")
    return response


@app.get("/auth/me")
def auth_me(user: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    return {
        "id": user.get("staff_id") or f"NER-USER-{user['id']}",
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "roleId": user["role_id"],
        "roleBadge": user["role_badge"],
        "station": user["station"],
        "picture": user["picture"],
        "isDemo": False
    }


@app.post("/auth/logout")
def logout(response: Response, oa_session: str | None = Cookie(default=None)) -> dict[str, str]:
    if oa_session:
        conn = get_connection()
        conn.execute("DELETE FROM sessions WHERE session_token=?", (oa_session,))
        conn.commit()
        conn.close()
    response.delete_cookie("oa_session", path="/")
    return {"message": "Signed out"}


@app.post("/api/patients")
def create_patient(payload: PatientCreate, user: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    if not payload.consent:
        raise HTTPException(status_code=422, detail="Recorded consent is required before creating a patient record.")
    
    bmi = payload.bmi
    if bmi is None and payload.height_cm and payload.weight_kg and payload.height_cm > 0:
        bmi = round(payload.weight_kg / ((payload.height_cm / 100.0) ** 2), 1)

    assigned_station = payload.assigned_station or str(user.get("station") or "Diphu PHC")
    triage_status = payload.triage_status or "pending_survey"
    referral_status = payload.referral_status or "none"

    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO patients (
            name, age, gender, occupation, region, state, district, abha_id,
            height_cm, weight_kg, bmi, assigned_station, triage_status, referral_status, consent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            payload.name.strip(), payload.age, payload.gender, payload.occupation,
            payload.region, payload.state, payload.district, payload.abha_id,
            payload.height_cm, payload.weight_kg, bmi, assigned_station, triage_status, referral_status,
            int(payload.consent)
        )
    )
    conn.commit()
    patient_id = cursor.lastrowid
    conn.close()
    return {
        "id": patient_id,
        "name": payload.name.strip(),
        "age": payload.age,
        "gender": payload.gender,
        "occupation": payload.occupation,
        "region": payload.region,
        "state": payload.state,
        "district": payload.district,
        "abha_id": payload.abha_id,
        "height_cm": payload.height_cm,
        "weight_kg": payload.weight_kg,
        "bmi": bmi,
        "assigned_station": assigned_station,
        "triage_status": triage_status,
        "referral_status": referral_status,
        "consent": payload.consent,
        "message": "Patient registered successfully"
    }


@app.get("/api/patients")
def list_patients(
    station: str | None = Query(default=None),
    role: str | None = Query(default=None),
    user: dict[str, object] = Depends(require_authenticated_user)
) -> list[dict[str, object]]:
    conn = get_connection()
    user_role = (role or str(user.get("role_id") or "screener")).lower()
    user_station = station or str(user.get("station") or "")

    query = """SELECT id, name, age, gender, occupation, region, state, district, abha_id,
                      height_cm, weight_kg, bmi, assigned_station, triage_status, referral_status,
                      consent, created_at FROM patients"""
    params = []
    conditions = []

    if user_role == "screener":
        # Screeners only see their assigned station or local region/district queue
        if user_station:
            parts = [p.strip() for p in user_station.replace('/', ',').split(',') if p.strip()]
            words = [parts[0]]
            first_word = parts[0].split()[0]
            if first_word and first_word not in words:
                words.append(first_word)
            if len(parts) > 1 and parts[-1] not in words:
                words.append(parts[-1])

            sub_conds = []
            for w in words:
                sub_conds.append("(assigned_station LIKE ? OR region LIKE ? OR district LIKE ? OR state LIKE ?)")
                params.extend([f"%{w}%", f"%{w}%", f"%{w}%", f"%{w}%"])
            if sub_conds:
                conditions.append("(" + " OR ".join(sub_conds) + ")")
    elif user_role == "officer":
        # Medical Officers see patients in their clinical referral network
        if user_station:
            keyword = user_station.split(",")[0].strip()
            # If specified station, filter to relevant regional hospital or referral queue
            if "safdarjung" in keyword.lower() or "delhi" in keyword.lower():
                conditions.append("(region LIKE ? OR state LIKE ? OR assigned_station LIKE ?)")
                params.extend(["%Delhi%", "%Delhi%", "%Safdarjung%"])
            elif "noida" in keyword.lower():
                conditions.append("(region LIKE ? OR state LIKE ? OR district LIKE ?)")
                params.extend(["%Noida%", "%Uttar Pradesh%", "%Gautam%"])
            elif "diphu" in keyword.lower() or "assam" in keyword.lower():
                conditions.append("(region LIKE ? OR state LIKE ? OR assigned_station LIKE ?)")
                params.extend(["%Assam%", "%Assam%", "%Diphu%"])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY id DESC"
    rows = conn.execute(query, tuple(params)).fetchall()
    conn.close()

    result = []
    for row in rows:
        d = dict(row)
        if user_role == "admin":
            # For system admin audit view, mask patient personal names for ABDM privacy compliance
            name_parts = (d.get("name") or "Patient").split()
            masked_name = f"{name_parts[0]} " + ("".join(["*"] * len(name_parts[-1])) if len(name_parts) > 1 else "***")
            d["name"] = masked_name
        result.append(d)
    return result


@app.patch("/api/patients/{patient_id}/vitals")
def update_patient_vitals(
    patient_id: int,
    payload: PatientVitalsUpdate,
    _: dict[str, object] = Depends(require_authenticated_user)
) -> dict[str, object]:
    conn = get_connection()
    _patient_exists(conn, patient_id)

    bmi = payload.bmi
    if bmi is None and payload.height_cm and payload.weight_kg and payload.height_cm > 0:
        bmi = round(payload.weight_kg / ((payload.height_cm / 100.0) ** 2), 1)

    updates = []
    values = []
    if payload.height_cm is not None:
        updates.append("height_cm = ?")
        values.append(payload.height_cm)
    if payload.weight_kg is not None:
        updates.append("weight_kg = ?")
        values.append(payload.weight_kg)
    if bmi is not None:
        updates.append("bmi = ?")
        values.append(bmi)

    if updates:
        values.append(patient_id)
        conn.execute(f"UPDATE patients SET {', '.join(updates)} WHERE id = ?", tuple(values))
        conn.commit()
    conn.close()
    return {
        "status": "success",
        "patient_id": patient_id,
        "height_cm": payload.height_cm,
        "weight_kg": payload.weight_kg,
        "bmi": bmi,
        "message": "Patient vitals updated successfully"
    }


@app.post("/api/questionnaire")
def save_questionnaire(payload: QuestionnairePayload, _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    score, category, factors = _questionnaire_result(payload)
    conn = get_connection()
    _patient_exists(conn, payload.patient_id)
    cursor = conn.execute(
        "INSERT INTO questionnaires (patient_id, raw_score, category, payload_json) VALUES (?, ?, ?, ?)",
        (payload.patient_id, score, category, payload.model_dump_json())
    )
    conn.commit()
    record_id = cursor.lastrowid
    conn.close()
    return {
        "id": record_id,
        "patient_id": payload.patient_id,
        "raw_score": score,
        "category": category,
        "contributing_factors": factors,
        "recommendation": recommendation_for(category),
        "data_source": "backend_rule_engine",
        "is_simulated": False
    }


@app.post("/api/movement/analyze-video")
async def analyze_movement_video(file: UploadFile = File(...), _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    raw_filename = Path(file.filename or "").name
    suffix = Path(raw_filename).suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload an MP4, MOV, AVI, MKV, or WebM video.")
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=503, detail="Movement model is unavailable.")
    content = await file.read(MAX_VIDEO_BYTES + 1)
    if not content or len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=413, detail="Video must be between 1 byte and 100 MB.")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
        temp.write(content)
        temp_path = Path(temp.name)
    try:
        result = predict_video(temp_path, MODEL_PATH)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        temp_path.unlink(missing_ok=True)
    return {
        "status": "success",
        "filename": raw_filename or "gait_session.mp4",
        "dataset_label": result["dataset_label"],
        "category": result["category"],
        "binary_screening": result.get("binary_screening", "screen_negative"),
        "screening_tier": result.get("screening_tier", "Screen Negative (Low Risk)"),
        "screening_positive_prob": result.get("screening_positive_prob", 0.0),
        "confidence": result["confidence"],
        "probabilities": result["probabilities"],
        "features": result["features"],
        "recommendation": recommendation_for(result["category"]),
        "is_simulated": False,
        "data_source": "backend_model"
    }


@app.post("/api/clinical/predict")
def predict_clinical_oa_risk(payload: ClinicalPredictRequest, _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    if not CLINICAL_MODEL_PATH.exists():
        raise HTTPException(status_code=503, detail="Clinical biomechanical OA model is not available.")
    
    try:
        bundle = joblib.load(CLINICAL_MODEL_PATH)
        pipeline = bundle["pipeline"]
        feature_names = bundle["feature_names"]
        
        koos_pain = max(0.0, min(100.0, 100.0 - (payload.pain * 10.0)))
        womac_pain = max(0.0, min(20.0, payload.pain * 2.0))
        womac_stiffness = max(0.0, min(8.0, (payload.stiffness / 60.0) * 8.0))
        womac_function = max(0.0, min(68.0, womac_pain * 3.4))
        womac_total = womac_pain + womac_stiffness + womac_function
        
        data_dict = {
            "side": float(payload.side),
            "age": float(payload.age),
            "sex": float(payload.sex),
            "bmi": float(payload.bmi),
            "bp_sys": float(payload.bp_sys),
            "bp_dias": float(payload.bp_dias),
            "koos_pain": koos_pain,
            "womac_pain": womac_pain,
            "womac_stiffness": womac_stiffness,
            "womac_function": womac_function,
            "womac_total": womac_total,
            "gait_speed_20m": float(payload.gait_speed or 0.95),
            "walk_time_400m": 320.0 if (payload.gait_speed or 0.95) < 1.0 else 260.0,
            "knee_flexion_deg": float(payload.knee_flexion_deg or 135.0),
            "knee_alignment_deg": 2.0,
            "knee_deficit_deg": float(payload.knee_deficit_deg or 10.0),
            "knee_force_max": 120.0 if payload.age > 65 else 160.0,
        }
        
        X_input = [[data_dict.get(col, 0.0) for col in feature_names]]
        probs = pipeline.predict_proba(X_input)[0]
        pred_idx = int(pipeline.predict(X_input)[0])
        
        prob_oa_pain = float(probs[1])
        risk_category = "high" if prob_oa_pain >= 0.65 else "moderate" if prob_oa_pain >= 0.35 else "low"
        
        return {
            "status": "success",
            "predicted_class": bundle["class_names"][pred_idx],
            "oa_pain_probability": round(prob_oa_pain, 4),
            "risk_category": risk_category,
            "model_accuracy": bundle["metrics"]["accuracy"],
            "model_roc_auc": bundle["metrics"]["roc_auc"],
            "cohort": bundle.get("provenance", "OAI Cohort"),
            "contributing_factors": [
                f"Pain VAS: {payload.pain}/10 (KOOS Pain: {round(koos_pain, 1)})",
                f"Morning Stiffness: {payload.stiffness} mins",
                f"Gait Velocity: {payload.gait_speed or 0.95} m/s",
                f"BMI: {payload.bmi} kg/m²"
            ]
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Inference error: {error}") from error


@app.post("/api/movement/analyze")
def combine_analysis(payload: AnalysisRequest, _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    outcome = combine_screening(payload.movement_category, payload.questionnaire_category)
    return {
        "patient_id": payload.patient_id,
        "movement_category": outcome.movement_category,
        "questionnaire_category": outcome.questionnaire_category,
        "combined_category": outcome.combined_category,
        "recommendation": outcome.recommendation,
        "explanation": outcome.explanation
    }


@app.post("/api/xray/analyze")
async def analyze_xray_image(file: UploadFile = File(...), user: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    raw_filename = Path(file.filename or "").name
    suffix = Path(raw_filename).suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload a valid PNG, JPG, or JPEG X-ray image.")
    content = await file.read(MAX_IMAGE_BYTES + 1)
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 20 MB.")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
        temp.write(content)
        temp_path = Path(temp.name)
    try:
        spec = XRayModelSpec(checkpoint_path=XRAY_MODEL_PATH)
        pred = spec.predict(temp_path)
    except Exception as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        temp_path.unlink(missing_ok=True)
    return {
        "status": "success",
        "filename": raw_filename or "knee_xray.png",
        "kl_grade": pred.kl_grade,
        "label": pred.label,
        "risk_level": pred.risk_level,
        "confidence": round(pred.confidence * 100, 1),
        "probabilities": pred.probabilities,
        "findings": pred.findings,
        "gradcam_base64": pred.gradcam_base64,
        "recommendation": pred.recommendation,
        "is_simulated": False,
        "data_source": "xray_spec_gradcam"
    }


@app.post("/api/upload")
async def upload_media(file: UploadFile = File(...), _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    raw_filename = Path(file.filename or "").name
    suffix = Path(raw_filename).suffix.lower()
    allowed_all = ALLOWED_VIDEO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS
    if suffix not in allowed_all:
        raise HTTPException(status_code=415, detail="Unsupported file format.")
    content = await file.read(MAX_VIDEO_BYTES + 1)
    if not content or len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=413, detail="File must be between 1 byte and 100 MB.")
    safe_name = f"upload_{secrets.token_hex(8)}{suffix}"
    return {
        "status": "success",
        "original_filename": raw_filename,
        "safe_filename": safe_name,
        "size_bytes": len(content)
    }


@app.post("/api/screenings")
def save_screening(payload: ScreeningCreate, _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    conn = get_connection()
    _patient_exists(conn, payload.patient_id)
    
    gait_metrics_dict = dict(payload.gait_metrics or {})
    if payload.clinical_prediction and "clinical_prediction" not in gait_metrics_dict:
        gait_metrics_dict["clinical_prediction"] = payload.clinical_prediction
    if payload.vitals and "vitals" not in gait_metrics_dict:
        gait_metrics_dict["vitals"] = payload.vitals
    if payload.clinical_symptoms and "clinical_symptoms" not in gait_metrics_dict:
        gait_metrics_dict["clinical_symptoms"] = payload.clinical_symptoms

    gait_metrics_str = json.dumps(gait_metrics_dict) if gait_metrics_dict else None
    vitals_str = json.dumps(payload.vitals) if payload.vitals else None
    clinical_metrics_str = json.dumps(payload.clinical_symptoms) if payload.clinical_symptoms else None
    
    clinical_risk_cat = payload.clinical_risk_category
    if not clinical_risk_cat and payload.clinical_prediction and isinstance(payload.clinical_prediction, dict):
        clinical_risk_cat = payload.clinical_prediction.get("risk_category")
        
    clinical_prob = payload.clinical_probability
    if clinical_prob is None and payload.clinical_prediction and isinstance(payload.clinical_prediction, dict):
        clinical_prob = payload.clinical_prediction.get("oa_pain_probability")

    cursor = conn.execute(
        """
        INSERT INTO screenings (
            patient_id, status, questionnaire_score, questionnaire_category,
            movement_category, movement_confidence, gait_metrics_json,
            xray_grade, combined_result, recommendation, data_source,
            simulation_status, movement_result, questionnaire_result,
            clinical_risk_category, clinical_probability, vitals_json, clinical_metrics_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.patient_id,
            payload.status,
            payload.questionnaire_score,
            payload.questionnaire_category,
            payload.movement_category,
            payload.movement_confidence,
            gait_metrics_str,
            payload.xray_grade,
            payload.combined_result,
            payload.recommendation,
            payload.data_source,
            payload.simulation_status,
            payload.movement_result,
            payload.questionnaire_result,
            clinical_risk_cat,
            clinical_prob,
            vitals_str,
            clinical_metrics_str
        )
    )
    conn.commit()
    record_id = cursor.lastrowid
    conn.close()
    return {"id": record_id, "message": "Screening saved successfully"}


@app.get("/api/screenings")
def list_screenings(_: dict[str, object] = Depends(require_authenticated_user)) -> list[dict[str, object]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT s.*, p.name AS patient_name FROM screenings s LEFT JOIN patients p ON p.id=s.patient_id ORDER BY s.id DESC"
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("gait_metrics_json"):
            try:
                d["gait_metrics"] = json.loads(d["gait_metrics_json"])
            except Exception:
                d["gait_metrics"] = None
        if d.get("vitals_json"):
            try:
                d["vitals"] = json.loads(d["vitals_json"])
            except Exception:
                d["vitals"] = None
        if d.get("clinical_metrics_json"):
            try:
                d["clinical_symptoms"] = json.loads(d["clinical_metrics_json"])
            except Exception:
                d["clinical_symptoms"] = None
        result.append(d)
    return result


@app.get("/api/screenings/latest/{patient_id}")
def get_latest_screening(patient_id: int, _: dict[str, object] = Depends(require_authenticated_user)) -> dict[str, object]:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM screenings WHERE patient_id = ? ORDER BY id DESC LIMIT 1",
        (patient_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="No previous screening found for this patient.")
    d = dict(row)
    if d.get("gait_metrics_json"):
        try:
            d["gait_metrics"] = json.loads(d["gait_metrics_json"])
        except Exception:
            d["gait_metrics"] = None
    if d.get("vitals_json"):
        try:
            d["vitals"] = json.loads(d["vitals_json"])
        except Exception:
            d["vitals"] = None
    if d.get("clinical_metrics_json"):
        try:
            d["clinical_symptoms"] = json.loads(d["clinical_metrics_json"])
        except Exception:
            d["clinical_symptoms"] = None
    return d


@app.post("/api/hardware/connect")
def connect_device(payload: DeviceConfig, user: dict[str, object] = Depends(require_role("admin"))) -> dict[str, object]:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO devices (name, device_type, ip, status, config_json, last_connected) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        (payload.name.strip(), payload.device_type, payload.ip, payload.status, payload.config_json)
    )
    conn.commit()
    device_id = cursor.lastrowid
    conn.close()
    return {"id": device_id, "status": "connected"}


@app.get("/api/hardware/devices")
def list_devices(user: dict[str, object] = Depends(require_role("admin", "officer"))) -> list[dict[str, object]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, device_type, ip, status, config_json, last_connected FROM devices ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def _clean_esp_host(host_or_ip: str) -> tuple[str, int]:
    raw = host_or_ip.strip().replace("http://", "").replace("https://", "").rstrip("/")
    if ":" in raw:
        parts = raw.split(":", 1)
        try:
            return parts[0], int(parts[1])
        except ValueError:
            return parts[0], 80
    return raw, 80


@app.get("/api/hardware/ping")
def ping_hardware(ip: str = Query(...)) -> dict[str, object]:
    host, port = _clean_esp_host(ip)
    t0 = time.time()
    try:
        url = f"http://{host}:{port}/status" if port != 80 else f"http://{host}/status"
        with urllib.request.urlopen(url, timeout=1.2) as response:
            latency = round((time.time() - t0) * 1000)
            return {"reachable": True, "latency_ms": latency, "status_code": response.status, "target": host}
    except Exception as e:
        return {"reachable": False, "target": host, "error": "Device did not respond"}


@app.get("/api/esp/ping")
def esp_ping(ip: str = Query(...)) -> dict[str, object]:
    return ping_hardware(ip)


@app.get("/api/esp/status")
async def esp_status(ip: str = Query(...)) -> dict[str, object]:
    host, port = _clean_esp_host(ip)
    base_url = f"http://{host}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{base_url}/status")
            if resp.status_code == 200:
                try:
                    return resp.json()
                except Exception:
                    return {"raw": resp.text, "status": "ok"}
            raise HTTPException(status_code=resp.status_code, detail=f"ESP returned status {resp.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Cannot reach ESP32-CAM at {host}: {exc}") from exc


@app.get("/api/esp/control")
async def esp_control(
    ip: str = Query(...),
    var: str = Query(...),
    val: int = Query(...)
) -> dict[str, object]:
    host, port = _clean_esp_host(ip)
    base_url = f"http://{host}"
    try:
        async with httpx.AsyncClient(timeout=3.5) as client:
            if var == "flash":
                # Try dedicated /flash first, fallback to /control?var=flash
                try:
                    resp = await client.get(f"{base_url}/flash?val={val}")
                    if resp.status_code == 200:
                        return {"status": "ok", "variable": var, "val": val, "response": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text}
                except Exception:
                    pass
            resp = await client.get(f"{base_url}/control?var={var}&val={val}")
            return {"status": "ok" if resp.status_code == 200 else "error", "status_code": resp.status_code, "variable": var, "val": val}
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send command to ESP32-CAM at {host}: {exc}") from exc


@app.get("/api/esp/frame")
async def esp_frame(ip: str = Query(...)):
    host, port = _clean_esp_host(ip)
    capture_url = f"http://{host}/capture"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(capture_url)
            if resp.status_code == 200:
                return Response(content=resp.content, media_type="image/jpeg", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
            raise HTTPException(status_code=resp.status_code, detail="Failed to capture frame from ESP32-CAM")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch frame from ESP32-CAM at {host}: {exc}") from exc


@app.get("/api/esp/stream")
async def esp_stream(ip: str = Query(...)):
    host, port = _clean_esp_host(ip)
    stream_url = f"http://{host}:{port}/stream" if port != 80 else f"http://{host}:81/stream"

    async def stream_generator():
        client = httpx.AsyncClient(timeout=None)
        try:
            async with client.stream("GET", stream_url) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk
        except Exception:
            pass
        finally:
            await client.aclose()

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=123456789000000000000987654321",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Access-Control-Allow-Origin": "*"
        }
    )


class EspWebSocketHub:
    """Relays real-time binary JPEG frames and control commands between ESP32-CAM and web clients."""

    def __init__(self):
        self.camera_ws: WebSocket | None = None
        self.viewers: set[WebSocket] = set()
        self.last_frame: bytes | None = None
        self.fps_count: int = 0
        self.fps_timer: float = time.time()
        self.current_fps: float = 0.0
        self.camera_status: dict = {"flash": 0, "resolution": "QVGA"}

    async def register_camera(self, ws: WebSocket):
        await ws.accept()
        self.camera_ws = ws
        await self.broadcast_viewer_event({"type": "camera_status", "online": True, "fps": self.current_fps})

    def unregister_camera(self, ws: WebSocket):
        if self.camera_ws == ws:
            self.camera_ws = None
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self.broadcast_viewer_event({"type": "camera_status", "online": False}))
            except Exception:
                pass

    async def register_viewer(self, ws: WebSocket):
        await ws.accept()
        self.viewers.add(ws)
        # Send initial status
        try:
            await ws.send_json({
                "type": "camera_status",
                "online": self.camera_ws is not None,
                "fps": self.current_fps,
                **self.camera_status
            })
            if self.last_frame:
                await ws.send_bytes(self.last_frame)
        except Exception:
            pass

    def unregister_viewer(self, ws: WebSocket):
        self.viewers.discard(ws)

    async def broadcast_frame(self, frame_bytes: bytes):
        self.last_frame = frame_bytes
        self.fps_count += 1
        now = time.time()
        if now - self.fps_timer >= 1.0:
            self.current_fps = round(self.fps_count / (now - self.fps_timer), 1)
            self.fps_count = 0
            self.fps_timer = now

        dead = []
        for v in list(self.viewers):
            try:
                await v.send_bytes(frame_bytes)
            except Exception:
                dead.append(v)
        for d in dead:
            self.viewers.discard(d)

    async def broadcast_viewer_event(self, event: dict):
        dead = []
        for v in list(self.viewers):
            try:
                await v.send_json(event)
            except Exception:
                dead.append(v)
        for d in dead:
            self.viewers.discard(d)

    async def send_command_to_camera(self, cmd: dict):
        if self.camera_ws:
            try:
                await self.camera_ws.send_json(cmd)
                return True
            except Exception:
                self.camera_ws = None
        return False


esp_hub = EspWebSocketHub()


@app.websocket("/api/esp/ws/camera")
async def esp_camera_ws(websocket: WebSocket):
    """ESP32-CAM connects here to push live binary JPEG frames."""
    await esp_hub.register_camera(websocket)
    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                await esp_hub.broadcast_frame(message["bytes"])
            elif "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                    if "flash" in data:
                        esp_hub.camera_status["flash"] = data["flash"]
                    await esp_hub.broadcast_viewer_event({"type": "camera_telemetry", **data})
                except Exception:
                    pass
    except (WebSocketDisconnect, Exception):
        esp_hub.unregister_camera(websocket)


@app.websocket("/api/esp/ws/viewer")
async def esp_viewer_ws(websocket: WebSocket):
    """Frontend web browser connects here to stream video and send hardware commands."""
    await esp_hub.register_viewer(websocket)
    try:
        while True:
            text = await websocket.receive_text()
            try:
                cmd = json.loads(text)
                await esp_hub.send_command_to_camera(cmd)
            except Exception:
                pass
    except (WebSocketDisconnect, Exception):
        esp_hub.unregister_viewer(websocket)


@app.get("/api/esp/ws/status")
def esp_ws_status() -> dict[str, object]:
    """HTTP status of cloud WebSocket relay."""
    return {
        "camera_online": esp_hub.camera_ws is not None,
        "viewers_count": len(esp_hub.viewers),
        "fps": esp_hub.current_fps,
        "has_last_frame": esp_hub.last_frame is not None,
        "status": esp_hub.camera_status
    }


@app.get("/api/esp/live.jpg")
async def esp_live_frame():
    """Returns the most recent JPEG frame captured by ESP32-CAM."""
    if not esp_hub.last_frame:
        raise HTTPException(status_code=404, detail="No camera frame received yet.")
    return Response(content=esp_hub.last_frame, media_type="image/jpeg", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/api/esp/stream.mjpg")
async def esp_mjpeg_stream():
    """Multipart MJPEG stream of live ESP32-CAM frames for direct <img> rendering."""
    async def frame_generator():
        last_sent = None
        while True:
            if esp_hub.last_frame and esp_hub.last_frame != last_sent:
                last_sent = esp_hub.last_frame
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(last_sent)).encode() + b"\r\n\r\n" +
                    last_sent +
                    b"\r\n"
                )
            await asyncio.sleep(0.04)  # ~25 FPS check cycle

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )
