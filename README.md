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
7. 在 **SQL Editor** 按顺序执行：

```text
supabase/migrations/202606220001_auth_profiles.sql
supabase/migrations/202606230001_camps_and_invites.sql
```

第一个 migration 创建身份资料和角色权限；第二个创建训练营、哈希邀请码、成员关系、RLS 和安全兑换函数。不要修改或重复执行已经应用的旧 migration。

## 创建公测训练营和邀请码

先确保至少有一个 `active` admin profile，再在 SQL Editor 执行：

```text
supabase/seed/202606230001_reading_beta_7d.sql
```

该 seed 创建或更新 `reading-beta-7d` 训练营，并生成 30 天有效、最多使用 20 次的测试邀请码 `LETTURA01`。SQL 只把邀请码用于计算 SHA-256 哈希，`camp_invites` 不保存明文。正式邀请码应由管理员生成随机高熵字符串，并只保存哈希与脱敏提示。

### 测试邀请码兑换

1. 使用尚未加入训练营的 student 登录，访问 `/join-camp`。
2. 输入测试邀请码并提交，成功后应进入 `/home`。
3. 再次兑换同一邀请码应返回“已经加入”，且不重复创建成员或增加使用次数。
4. 未加入 active 训练营的 student 访问 `/home`、`/courses` 或 `/circle` 应返回 `/join-camp`。

在 SQL Editor 检查成员记录：

```sql
select c.slug, m.user_id, m.status, m.joined_at,
       m.ai_analysis_limit, m.ai_analysis_used
from public.camp_members m
join public.camps c on c.id = m.camp_id
where c.slug = 'reading-beta-7d'
order by m.joined_at desc;
```

检查邀请码使用次数时只读取脱敏提示，不查询或输出哈希：

```sql
select c.slug, i.code_hint, i.max_uses, i.used_count,
       i.expires_at, i.is_active
from public.camp_invites i
join public.camps c on c.id = i.camp_id
where c.slug = 'reading-beta-7d';
```

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
2. 输入有效训练营邀请码，注册成功后应直接进入 `/home`。
3. 在 SQL Editor 检查：

```sql
select u.email, p.display_name, p.role, p.status
from auth.users u
join public.profiles p on p.id = u.id
order by p.created_at desc;
```

新用户应为 `student`。

4. 使用学生会话访问 `/teacher`，应跳转到 `/forbidden`。
5. 尝试通过 Supabase 客户端读取 `camp_invites` 或插入 `camp_members`，RLS 应拒绝。
6. 未加入训练营的 student 访问课程内容应跳转到 `/join-camp`。
7. 尝试通过 Supabase 客户端把自己的 `role` 改成 `admin`，RLS 或安全字段触发器应拒绝。

### admin

1. 按上面的 SQL 将测试账号设为 `admin`。
2. 重新登录后应进入 `/teacher`。
3. admin 可读取和管理全部 profile。

### 登出

1. 在个人资料或老师后台点击“退出登录”。
2. 再次访问 `/home`、`/courses` 或 `/teacher`，应跳转到 `/login`。

## 本地数据说明

- 训练营、邀请码和成员关系使用 Supabase Database；邀请码兑换由数据库函数原子处理。
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
