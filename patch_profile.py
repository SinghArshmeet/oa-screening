import re

with open("frontend/src/views/CompleteProfileView.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import { ROLES } from '../utils/auth';", "import { ROLES } from '../utils/auth';\nimport { supabase } from '../utils/supabase';")

# In handleSubmit, add a call to supabase.auth.updateUser
old_submit = """      // Attempt to save to local session so it persists on reload
      const sessionKey = 'oa_ner_auth_session';
      sessionStorage.setItem(sessionKey, JSON.stringify(updatedUser));"""

new_submit = """      // Update Supabase user metadata
      await supabase.auth.updateUser({
        data: {
          role_id: role,
          station: station.trim(),
          staff_id: updatedUser.staffId,
          profile_completed: true
        }
      });
      
      // Attempt to save to local session so it persists on reload
      const sessionKey = 'oa_ner_auth_session';
      sessionStorage.setItem(sessionKey, JSON.stringify(updatedUser));"""

content = content.replace(old_submit, new_submit)

with open("frontend/src/views/CompleteProfileView.jsx", "w", encoding="utf-8") as f:
    f.write(content)
