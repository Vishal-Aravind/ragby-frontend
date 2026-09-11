// Shared password policy, used by signup and by the reset-confirm route so
// the two cannot drift. The old rule was six characters with no other
// constraint, checked in two places with the same magic number.

export const MIN_PASSWORD_LENGTH = 8;

// Not a serious breach corpus — that belongs in a service. This is the
// short list that shows up in casual credential stuffing and costs nothing
// to reject. Compared lowercased.
const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "1234567890", "qwerty123", "qwertyuiop", "abc12345", "11111111",
  "iloveyou", "welcome1", "admin123", "letmein1", "sunshine",
  "princess", "football", "baseball", "trustno1", "passw0rd",
  "zavo1234", "ragby123", "changeme", "secret123",
]);

/**
 * Returns an error string, or null when the password is acceptable.
 *
 * Deliberately not a complexity matrix. Length plus a reuse check catches
 * far more real attacks than forcing a symbol, and it does not push people
 * into "Password1!".
 */
export function validatePassword(password, { email, name } = {}) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password.length > 72) {
    // bcrypt truncates beyond this, so anything longer is a silent lie
    // about how much of it protects the account.
    return "Password must be 72 characters or fewer.";
  }

  const lower = password.toLowerCase();

  if (COMMON.has(lower)) {
    return "That password is too common. Please choose another.";
  }

  if (/^(.)\1+$/.test(password)) {
    return "Please choose a less predictable password.";
  }

  const localPart = typeof email === "string" ? email.split("@")[0] : "";
  if (localPart.length >= 4 && lower.includes(localPart.toLowerCase())) {
    return "Password must not contain your email address.";
  }

  if (typeof name === "string" && name.length >= 4 && lower.includes(name.toLowerCase())) {
    return "Password must not contain your name.";
  }

  return null;
}
