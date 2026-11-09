"use client";

import { ArrowRight } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SelectLearningSpaceButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button full" disabled={pending} type="submit">
      {pending ? "正在加载…" : <>进入这个训练营 <ArrowRight size={18} /></>}
    </button>
  );
}
