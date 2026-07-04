// Shared UI building blocks — kept small and consistent for an elegant,
// professional look (Kerala backwater blue + gold accents).
import { money } from "./billing";

// A balance shown as a coloured pill: due / credit / settled
export function BalancePill({ amount }) {
  if (amount > 0) return <Pill variant="due">Due {money(amount)}</Pill>;
  if (amount < 0) return <Pill variant="credit">Credit {money(-amount)}</Pill>;
  return <Pill variant="settled">Settled</Pill>;
}

export function WaterDrop({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c-.4 0-.76.22-.94.58C9.3 6.2 5.5 10.1 5.5 14.3a6.5 6.5 0 0 0 13 0c0-4.2-3.8-8.1-5.56-11.52A1.06 1.06 0 0 0 12 2.2Zm0 16.9a4.8 4.8 0 0 1-4.8-4.8c0-.4.33-.72.73-.72.4 0 .72.32.72.72A3.36 3.36 0 0 0 12 17.66c.4 0 .72.32.72.72s-.32.72-.72.72Z" />
    </svg>
  );
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

export function Avatar({ name, size = "h-10 w-10 text-sm" }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full font-semibold ${AVATAR_COLORS[hash]}`}>
      {initials}
    </div>
  );
}

const PILL_STYLES = {
  due: "bg-rose-50 text-rose-700 ring-rose-200",
  credit: "bg-sky-50 text-sky-700 ring-sky-200",
  settled: "bg-slate-100 text-slate-500 ring-slate-200",
  flat: "bg-amber-50 text-amber-700 ring-amber-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function Pill({ variant = "info", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${PILL_STYLES[variant]}`}>
      {children}
    </span>
  );
}

export function Card({ className = "", children, onClick }) {
  const base = "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80";
  const clickable = onClick ? " cursor-pointer transition hover:shadow-md hover:ring-blue-300 active:scale-[0.99]" : "";
  return (
    <div className={base + clickable + " " + className} onClick={onClick}>
      {children}
    </div>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300",
    gold: "bg-amber-500 text-white hover:bg-amber-600 disabled:bg-slate-300",
    ghost: "border border-slate-300 text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-300",
  };
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function Modal({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
