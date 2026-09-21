import re

with open("frontend/src/components/Header.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import { ROLES, getAccountsForRole, getRoleConfig, isTabAllowedForRole } from '../utils/auth';", "import { ROLES, getRoleConfig, isTabAllowedForRole } from '../utils/auth';")

content = content.replace("const roleAccounts = getAccountsForRole(currentRoleId);", "")

# Remove the block displaying the role switcher
start_str = "                  {/* Role / Account Switcher (Demo Simulator feature) */}"
end_str = "                  {/* Footer Actions: Sign Out */}"
start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

with open("frontend/src/components/Header.jsx", "w", encoding="utf-8") as f:
    f.write(content)
