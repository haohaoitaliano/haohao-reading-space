import Link from "next/link";
import { AlertCircle } from "lucide-react";

const errorMessages: Record<string, string> = {
  missing_configuration: "登录服务尚未正确配置，请联系管理员。",
  missing_code: "登录链接缺少必要信息，请返回登录页重新发送一封邮件。",
  exchange_failed: "登录链接无效、已过期或已被使用，请重新发送一封登录邮件。",
  missing_user: "登录会话未能建立，请重新尝试。",
  profile_failed: "账号资料暂时无法读取，请稍后重试或联系管理员。",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason = "" } = await searchParams;
  const message = errorMessages[reason] ?? "登录过程中发生错误，请重新尝试。";

  return (
    <main className="app-shell">
      <section className="screen">
        <div className="quiet-card">
          <AlertCircle size={28} aria-hidden="true" />
          <h1 style={{ marginTop: 14 }}>未能完成登录</h1>
          <p>{message}</p>
          <Link className="button full" href="/login">返回登录页</Link>
        </div>
      </section>
    </main>
  );
}
