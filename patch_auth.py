import re

with open("frontend/src/utils/auth.js", "r", encoding="utf-8") as f:
    content = f.read()

import_statement = "import { supabase } from './supabase';\n\n"

# Find the end of isTabAllowedForRole function
match = re.search(r'export function isTabAllowedForRole.*?}', content, re.DOTALL)
if match:
    keep_content = content[:match.end()]
    
    new_auth_content = """

export async function signupUser({ email, password, name, roleId, station }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role_id: roleId,
        station: station,
      }
    }
  });
  if (error) throw error;
  return data;
}

export async function loginWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}

export function formatSupabaseUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const roleId = meta.role_id || 'screener';
  const roleConfig = getRoleConfig(roleId);
  return {
    id: user.id,
    email: user.email,
    name: meta.full_name || user.email,
    roleId: roleId,
    role: roleConfig.label,
    roleBadge: roleConfig.badge,
    station: meta.station || 'Diphu PHC, Assam',
    isDemo: false
  };
}

export function getStoredUser() {
  // Try to load synchronously from localStorage if possible (Supabase stores it in localstorage)
  try {
    const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      const sbData = JSON.parse(localStorage.getItem(sbKey));
      if (sbData && sbData.user) {
        return formatSupabaseUser(sbData.user);
      }
    }
  } catch(e) {}
  return null;
}
"""
    final_content = import_statement + keep_content + new_auth_content
    with open("frontend/src/utils/auth.js", "w", encoding="utf-8") as f:
        f.write(final_content)
