import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

type HeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
};

export function Header({ title, subtitle, backHref }: HeaderProps) {
  const backLabel = backHref === "/teacher" ? "返回老师后台" : "返回";

  return (
    <header className="topbar">
      <div className="row" style={{ justifyContent: "flex-start" }}>
        {backHref ? (
          <Link aria-label={backLabel} className="button ghost" href={backHref} style={{ minHeight: 38, padding: 8 }}>
            <ChevronLeft size={20} />
          </Link>
        ) : (
          <BrandMark />
        )}
        <div>
          <strong>{title}</strong>
          {subtitle ? <p style={{ margin: "2px 0 0", fontSize: 12 }}>{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}
