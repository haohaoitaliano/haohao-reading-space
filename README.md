# haohao-reading-space

好好意语共读空间 7 天免费公测版。当前阶段已接入 Supabase Auth、训练营、云端课程文字、私有示范音频和私有学生录音。

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
supabase/migrations/202606230002_cloud_courses.sql
supabase/migrations/202606230003_cloud_course_audio.sql
supabase/migrations/202606230004_fix_course_audio_storage_rls.sql
supabase/migrations/202606240001_cloud_student_recordings.sql
```

这些 migration 依次创建身份与角色、训练营与邀请码、云端课程、私有课程音频及其 RLS 修复、私有学生录音与提交记录。不要修改已经应用的旧 migration。

`202606230003_cloud_course_audio.sql` 会自动创建私有 `course-audio` bucket、20 MB 文件上限和允许的音频 MIME 类型，不需要在 Dashboard 手动创建 bucket。

`202606240001_cloud_student_recordings.sql` 会自动创建私有 `student-recordings` bucket、30 MB 文件上限、`student_submissions` 表和 Database/Storage RLS，也不需要在 Dashboard 手动创建 bucket。

## 创建公测训练营和邀请码

先确保至少有一个 `active` admin profile，再在 SQL Editor 执行：

```text
supabase/seed/202606230001_reading_beta_7d.sql
```

该 seed 创建或更新 `reading-beta-7d` 训练营，并生成 30 天有效、最多使用 20 次的测试邀请码 `LETTURA01`。SQL 只把邀请码用于计算 SHA-256 哈希，`camp_invites` 不保存明文。正式邀请码应由管理员生成随机高熵字符串，并只保存哈希与脱敏提示。

创建 7 节公测课程时执行：

```text
supabase/seed/202606230002_reading_beta_courses.sql
```

课程 seed 只插入尚不存在的 `camp_id + day_number`，可重复执行；已有课程、正文和词汇不会被覆盖。Giorno 1-4 初始为已解锁，Giorno 5-7 使用未来解锁时间。

验证课程数量与状态：

```sql
select c.day_number, c.italian_title, c.status, c.unlock_at
from public.courses c
join public.camps camp on camp.id = c.camp_id
where camp.slug = 'reading-beta-7d'
order by c.day_number;
```

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
4. 在老师后台新建或编辑课程，保存后刷新学生页面确认云端文字同步。
5. 将课程设为 `draft`，student 不应在课程列表或直接 URL 中读取该课程。
6. 将 `unlock_at` 改为未来时间，student 只能看到标题和解锁时间，不能读取正文与词汇。
7. 在课程编辑页选择 MP3、M4A、WAV、WebM 或 OGG，试听后上传；确认进度、替换和删除均正常。
8. Storage 中的对象路径应为 `camp_id/course_id/...`，bucket 必须保持 private。

### 云端示范音频

1. admin 在已创建课程的编辑页选择不超过 20 MB 的音频并点击“上传到云端”。
2. 上传成功后刷新老师页面，播放器应使用短时 signed URL。
3. student 刷新已发布且已解锁课程，应能播放同一音频。
4. student 访问未解锁课程时不应获得播放器；直接读取对应 `course_audio` 或 Storage 对象也应被 RLS 拒绝。
5. admin 替换音频后旧对象会被清理；删除后学生页面显示“暂无示范音频”。

### 云端学生录音

1. student 打开一节已发布且已解锁课程，允许麦克风权限，录制并试听。
2. 选择“对同学公开”或“仅老师可见”，提交后确认显示版本号，并在 `/my-work` 播放。
3. 再次录制并提交同一课程，确认版本递增；在“我的作业”测试替换和删除自己的录音。
4. 公开录音应出现在同一期其他 student 的 `/circle`，`teacher_only` 不应出现；其他 student 直接读取其元数据或 Storage 对象应被 RLS 拒绝。
5. admin 打开 `/teacher`，应能查看并通过短时 signed URL 播放所有学生提交，但学生仍不能访问老师后台。
6. Storage 对象路径应为 `camp_id/user_id/submission_id/...`，`student-recordings` bucket 必须保持 private。

### 作业圈

- `/circle` 只查询当前 student 的 active 训练营，并只展示其他成员选择 `public` 的未删除提交。
- 列表按提交时间从新到旧排列，显示昵称、课程、版本、提交时间和播放器；`teacher_only` 与其他训练营记录由查询和 RLS 双重隔离。
- 页面不会把邮箱、`user_id`、Storage 路径或 Supabase signed URL 序列化到客户端。播放器请求同源受保护接口，由服务端按当前会话和 RLS 生成短时播放凭证并转发音频。
- 播放凭证失效或加载失败时，页面会显示刷新提示；刷新页面后会重新生成播放凭证。
- 本阶段不包含点赞、评论、排行榜或老师点评。

### 登出

1. 在个人资料或老师后台点击“退出登录”。
2. 再次访问 `/home`、`/courses` 或 `/teacher`，应跳转到 `/login`。

## 本地数据说明

- 训练营、邀请码、成员关系、课程文字、解锁信息、词汇和示范音频元数据使用 Supabase Database。
- 云端课程是学生页和老师课程管理的正式数据源，不会自动回退到模拟课程。
- IndexedDB 课程代码暂时保留用于原型对照，但新的课程文字修改不再写入 IndexedDB。
- 老师示范音频存入私有 Supabase Storage，页面只使用 5 分钟 signed URL。
- 学生已提交录音存入私有 Supabase Storage，提交元数据存入 `student_submissions`，页面只使用 5 分钟 signed URL。
- 浏览器录音停止后的未提交 Blob 只保存在内存中，刷新后可以丢失。
- 旧 IndexedDB 课程、示范音频和学生提交模块仍保留用于原型对照与兼容，但不再是新课程或新提交的正式数据源，也不会自动上传历史记录。
- 本阶段仍不接入 OpenAI API。
- AI 反馈仍为模拟内容，暂不开发老师点评。

## 检查命令

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
