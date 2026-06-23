# haohao-reading-space

好好意语共读空间 7 天免费公测版。当前阶段接入 Supabase Auth 和 `student` / `admin` 角色权限；课程、示范音频和学生录音仍保存在浏览器 IndexedDB 中。

## 本地启动

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

打开 `http://localhost:3001`。

## Supabase 项目配置

1. 在 Supabase Dashboard 创建项目。
2. 打开 **Project Settings → API**，复制 Project URL 和公开的 anon key。
3. 在本机 `.env.local` 中填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

不要在浏览器代码、`.env.local.example` 或 Git 中加入 `service_role` 密钥。本项目当前不需要它。

4. 打开 **Authentication → URL Configuration**：
   - Site URL：`http://localhost:3001`
   - Redirect URL：`http://localhost:3001/auth/callback`
5. 打开 **Authentication → Sign In / Providers → Email**：
   - 保持 Email provider 启用。
   - 开发和小范围公测期间关闭 **Confirm email**。
   - 关闭后，新用户注册不会收到确认邮件，`signUp` 会直接返回登录 session。
   - 正式开放前可在同一位置重新开启 **Confirm email**。
6. 公测前建议配置自有 SMTP。
7. 在 **SQL Editor** 执行：

```text
supabase/migrations/202606220001_auth_profiles.sql
```

Migration 会创建 `profiles`、新用户触发器、默认 `student` 角色、RLS 策略和角色保护触发器。

## 创建首个 admin

1. 启动项目并打开 `/register`。
2. 使用自己的昵称、邮箱和密码注册。关闭 Confirm email 后会直接登录，profile 自动创建为 `student`。
3. 如果 Confirm email 仍开启，请先完成邮件确认，再到 `/login` 使用邮箱和密码登录。
4. 在 Supabase SQL Editor 先确认账号：

```sql
select id, email, created_at
from auth.users
order by created_at desc;
```

5. 用自己的真实邮箱提升角色：

```sql
update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('你的邮箱@example.com')
  limit 1
);
```

6. 退出后重新登录，访问 `/teacher`。应用中没有“成为管理员”按钮。

## 权限验证

### 新学生

1. 在 `/register` 使用一个未注册邮箱创建账号。
2. 在 SQL Editor 检查：

```sql
select u.email, p.display_name, p.role, p.status
from auth.users u
join public.profiles p on p.id = u.id
order by p.created_at desc;
```

新用户应为 `student`。

3. 使用学生会话访问 `/teacher`，应跳转到 `/forbidden`。
4. 尝试通过 Supabase 客户端把自己的 `role` 改成 `admin`，RLS 或安全字段触发器应拒绝。
5. 学生应只能修改自己的 `display_name`，不能读取其他 profile。

### admin

1. 按上面的 SQL 将测试账号设为 `admin`。
2. 重新登录后应进入 `/teacher`。
3. admin 可读取和管理全部 profile。

### 登出

1. 在个人资料或老师后台点击“退出登录”。
2. 再次访问 `/home`、`/courses` 或 `/teacher`，应跳转到 `/login`。

## 本地数据说明

- 课程文字、老师示范音频和学生录音仍使用 IndexedDB。
- 新的本地录音会关联 Supabase `user_id` 和 `profiles.display_name`。
- 本阶段不接入课程数据库、Supabase Storage 或 OpenAI API。
- AI 反馈仍为模拟内容，暂不开发老师点评。

## 检查命令

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
