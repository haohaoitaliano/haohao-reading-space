import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type HeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
};

export function Header({ title, subtitle, backHref }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="row" style={{ justifyContent: "flex-start" }}>
        {backHref ? (
          <Link aria-label="返回" className="button ghost" href={backHref} style={{ minHeight: 38, padding: 8 }}>
            <ChevronLeft size={20} />
          </Link>
        ) : (
          <div className="brand-mark">好</div>
        )}
        <div>
          <strong>{title}</strong>
          {subtitle ? <p style={{ margin: "2px 0 0", fontSize: 12 }}>{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}
