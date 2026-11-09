import { ArrowRight } from "lucide-react";
import Link from "next/link";

type StudentApplauseCardProps = {
  total: number;
  today: number;
  unavailable?: boolean;
  href?: string;
  id?: string;
};

function CardContent({ total, today, unavailable }: Omit<StudentApplauseCardProps, "href" | "id">) {
  return (
    <>
      <div className="applause-card-heading">
        <strong>👏 累计收到掌声：{unavailable ? "—" : total}</strong>
        {!unavailable && today > 0 ? <span>+{today} 今天</span> : null}
      </div>
      <p>每一次努力，都值得被看见。🌱</p>
    </>
  );
}

export function StudentApplauseCard(props: StudentApplauseCardProps) {
  if (props.href) {
    return (
      <Link className="quiet-card applause-card metric-link" href={props.href}>
        <div><CardContent {...props} /></div>
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    );
  }

  return (
    <section className="quiet-card applause-card" id={props.id}>
      <div><CardContent {...props} /></div>
    </section>
  );
}
