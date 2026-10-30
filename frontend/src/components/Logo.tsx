import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-[#2DD4A7]">
        <ShieldCheck size={18} aria-hidden />
      </span>
      SafeBuy AI
    </Link>
  );
}
