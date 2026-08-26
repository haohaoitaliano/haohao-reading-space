import { FileAudio, Video } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { formatFileSize } from "@/lib/audio-file";
import { getAdminCourseMediaLibrary, type CloudCourseMediaItem } from "@/lib/cloud-course-data";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function MediaPreview({ item }: { item: CloudCourseMediaItem }) {
  if (item.kind === "audio") {
    return (
      <audio controls preload="metadata" src={item.signedUrl} style={{ width: "100%" }}>
        当前浏览器不支持音频播放。
      </audio>
    );
  }

  return (
    <video controls preload="metadata" src={item.signedUrl} style={{ width: "100%", borderRadius: 8 }}>
      当前浏览器不支持视频播放。
    </video>
  );
}

export default async function TeacherMediaPage() {
  await requireAdmin();
  const result = await getAdminCourseMediaLibrary();

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="素材库" subtitle="音频、视频和课程素材" backHref="/teacher" />
        <section className="hero">
          <p className="kicker">Media Library</p>
          <h1>查看已上传素材。</h1>
          <p>示范音频和示范视频仍在课程编辑页上传、替换和删除。</p>
        </section>

        {result.error ? <p className="notice" role="alert">素材库暂时无法读取。</p> : null}
        {!result.error && result.items.length === 0 ? (
          <p className="notice">还没有上传示范音频或示范视频。请进入课程编辑页添加素材。</p>
        ) : null}

        <section className="stack">
          {result.items.map((item) => {
            const Icon = item.kind === "audio" ? FileAudio : Video;
            return (
              <article className="item-card stack" key={item.id}>
                <div className="row start">
                  <span className="brand-mark" style={{ width: 38, height: 38, background: item.kind === "audio" ? "var(--sky)" : "var(--olive)" }}>
                    <Icon size={18} />
                  </span>
                  <div className="submission-card-main">
                    <div className="row start">
                      <div>
                        <strong className="file-name">{item.fileName}</strong>
                        <p className="submission-meta">
                          {item.kind === "audio" ? "音频" : "视频"} · {item.mimeType} · {formatFileSize(item.sizeBytes)} · {formatUpdatedAt(item.updatedAt)}
                        </p>
                      </div>
                      <span className={`pill ${item.kind === "audio" ? "sky" : "olive"}`}>
                        {item.kind === "audio" ? "Audio" : "Video"}
                      </span>
                    </div>
                    <p className="submission-course" lang="it">
                      Giorno {item.dayNumber} · {item.courseTitle}
                    </p>
                    {item.courseChineseTitle ? <p style={{ margin: "2px 0 0" }}>{item.courseChineseTitle}</p> : null}
                  </div>
                </div>

                <MediaPreview item={item} />

                <Link className="button secondary full" href={`/teacher/courses/${item.courseId}/edit`}>
                  跳转到课程编辑页
                </Link>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
