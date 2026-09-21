import re

with open("frontend/src/views/LoginView.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "import { ROLES, DEMO_ACCOUNTS, loginUser, loginAsDemo, registerUser } from '../utils/auth';",
    "import { ROLES, DEMO_ACCOUNTS, loginWithPassword, signupUser, loginWithGoogle, formatSupabaseUser, getSession } from '../utils/auth';"
)

content = re.sub(
    r"const handleRegisterSubmit = async \(e\) => \{.*?\};",
    """const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await signupUser({
        email: regEmail,
        password: regPassword,
        name: regName,
        roleId: regRole,
        station: regStation
      });
      setRegSuccessMessage('Account created successfully! You can now log in.');
      setTimeout(() => {
        setAuthMode('login');
        setRegSuccessMessage('');
        setIdentifier(regEmail);
        setPassword('');
      }, 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };""",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"const handleSubmit = async \(e\) => \{.*?\};",
    """const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const { user } = await loginWithPassword({
        email: identifier,
        password
      });
      if (user) {
        onLogin(formatSupabaseUser(user));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };""",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"const handleGoogleLogin = \(\) => \{.*?\};",
    """const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setErrorMessage(err.message || 'Google Login failed');
    }
  };""",
    content,
    flags=re.DOTALL
)

with open("frontend/src/views/LoginView.jsx", "w", encoding="utf-8") as f:
    f.write(content)
