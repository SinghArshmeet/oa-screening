with open("frontend/src/utils/api.js", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import {\n  isSupabaseConfigured,", "import { getSession } from './auth';\nimport {\n  isSupabaseConfigured,")

helper = """
async function authFetch(url, options = {}) {
  const session = await getSession();
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  // Remove credentials: 'include' if we want, or leave it. It's fine.
  return fetch(url, { ...options, headers });
}
"""

content = content.replace("export const mockPatients = [", helper + "\nexport const mockPatients = [")

# Replace fetch(`${API_BASE}...`) with authFetch(`${API_BASE}...`)
# but only for API_BASE calls that used credentials: 'include'
content = content.replace("fetch(`${API_BASE}/api/patients`", "authFetch(`${API_BASE}/api/patients`")
content = content.replace("fetch(`${API_BASE}/api/patients/${patientId}/vitals`", "authFetch(`${API_BASE}/api/patients/${patientId}/vitals`")
content = content.replace("fetch(`${API_BASE}/api/questionnaire`", "authFetch(`${API_BASE}/api/questionnaire`")
content = content.replace("fetch(`${API_BASE}/api/clinical/predict`", "authFetch(`${API_BASE}/api/clinical/predict`")
content = content.replace("fetch(`${API_BASE}/api/screenings`", "authFetch(`${API_BASE}/api/screenings`")
content = content.replace("fetch(`${API_BASE}/api/screenings/latest/${patientId}`", "authFetch(`${API_BASE}/api/screenings/latest/${patientId}`")
content = content.replace("fetch(`${API_BASE}/api/movement/analyze-video`", "authFetch(`${API_BASE}/api/movement/analyze-video`")
content = content.replace("fetch(`${API_BASE}/api/xray/analyze`", "authFetch(`${API_BASE}/api/xray/analyze`")

with open("frontend/src/utils/api.js", "w", encoding="utf-8") as f:
    f.write(content)
