import re

with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "import { getStoredUser, logoutUser, fetchServerUserProfile, getRoleConfig, isTabAllowedForRole } from './utils/auth';",
    "import { getStoredUser, logoutUser, getRoleConfig, isTabAllowedForRole, onAuthStateChange, formatSupabaseUser, getSession } from './utils/auth';"
)

use_effect_code = """
  useEffect(() => {
    let isMounted = true;
    
    // Initial fetch
    getSession().then((session) => {
      if (isMounted) {
        const user = formatSupabaseUser(session?.user);
        if (user) {
          const stored = getStoredUser();
          if (stored && stored.profileCompleted) {
            setCurrentUser({ ...user, profileCompleted: true });
          } else {
            setCurrentUser(user);
          }
        }
      }
    });

    // Listen to changes
    const subscription = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const user = formatSupabaseUser(session?.user);
        if (user) {
          const stored = getStoredUser();
          if (stored && stored.profileCompleted) {
            setCurrentUser({ ...user, profileCompleted: true });
          } else {
            setCurrentUser(user);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);
"""

# Replace the existing useEffect in App.jsx
content = re.sub(
    r"useEffect\(\(\) => \{.*?\}, \[\]\);",
    use_effect_code,
    content,
    flags=re.DOTALL
)

with open("frontend/src/App.jsx", "w", encoding="utf-8") as f:
    f.write(content)
