export function validateLoginFields(email: string, password: string) {
  if (!email.trim()) return "请输入你的邮箱";
  if (!password) return "请输入密码";
  return null;
}

export function validateRegistrationFields(
  displayName: string,
  email: string,
  password: string,
  passwordConfirmation: string,
  invitationCode: string,
) {
  if (!displayName.trim()) return "请输入你的昵称";
  if (!email.trim()) return "请输入你的邮箱";
  if (password.length < 6) return "密码至少需要 6 个字符";
  if (password !== passwordConfirmation) return "两次输入的密码不一致";
  if (!invitationCode.trim()) return "请输入训练营邀请码";
  return null;
}
