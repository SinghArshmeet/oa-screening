import re

with open("frontend/src/utils/auth.js", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
"""export function formatSupabaseUser(user) {
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
}""",
"""export function formatSupabaseUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const roleId = meta.role_id; // Do not default! Let CompleteProfileView catch it
  const roleConfig = getRoleConfig(roleId || 'screener');
  return {
    id: user.id,
    email: user.email,
    name: meta.full_name || user.email,
    roleId: roleId || null,
    role: roleConfig.label,
    roleBadge: roleConfig.badge,
    station: meta.station || null,
    isDemo: false
  };
}"""
)

with open("frontend/src/utils/auth.js", "w", encoding="utf-8") as f:
    f.write(content)
