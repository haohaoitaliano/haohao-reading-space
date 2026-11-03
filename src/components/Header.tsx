import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type HeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  showBrandImage?: boolean;
};

export function Header({ title, subtitle, backHref, showBrandImage = false }: HeaderProps) {
  const backLabel = backHref === "/teacher" ? "返回老师后台" : "返回";

  return (
    <header className="topbar">
      <div className="row" style={{ justifyContent: "flex-start" }}>
        {backHref ? (
          <Link aria-label={backLabel} className="button ghost" href={backHref} style={{ minHeight: 38, padding: 8 }}>
            <ChevronLeft size={20} />
          </Link>
        ) : showBrandImage ? (
          <Image
            alt="好好意语"
            className="brand-mark"
            height={40}
            src="/icons/icon-192.png"
            style={{ objectFit: "contain" }}
            unoptimized
            width={40}
          />
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
