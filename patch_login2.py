import re

with open("frontend/src/views/LoginView.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import { ROLES, DEMO_ACCOUNTS, loginWithPassword, signupUser, loginWithGoogle, formatSupabaseUser, getSession } from '../utils/auth';", "import { ROLES, loginWithPassword, signupUser, loginWithGoogle, formatSupabaseUser, getSession } from '../utils/auth';")

# In handleRoleSelect:
# const handleRoleSelect = (roleId) => {
#    setSelectedRole(roleId);
#    const demoAcc = DEMO_ACCOUNTS.find((acc) => acc.role === roleId) || DEMO_ACCOUNTS[0];
#    setIdentifier(demoAcc.email);
#    setPassword(demoAcc.password);
#  };
old_role_select = """  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    const demoAcc = DEMO_ACCOUNTS.find((acc) => acc.role === roleId) || DEMO_ACCOUNTS[0];
    setIdentifier(demoAcc.email);
    setPassword(demoAcc.password);
  };"""

new_role_select = """  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
  };"""

content = content.replace(old_role_select, new_role_select)

with open("frontend/src/views/LoginView.jsx", "w", encoding="utf-8") as f:
    f.write(content)
