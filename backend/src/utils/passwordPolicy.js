export const MIN_PASSWORD_CHARACTERS = 12;
export const MAX_PASSWORD_BYTES = 72; // bcrypt only considers the first 72 UTF-8 bytes.

export function validateNewPassword(password) {
  if (typeof password !== 'string') return 'Password must be text.';
  if ([...password].length < MIN_PASSWORD_CHARACTERS) {
    return `Use at least ${MIN_PASSWORD_CHARACTERS} characters.`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Password must be no more than ${MAX_PASSWORD_BYTES} UTF-8 bytes.`;
  }
  return null;
}
