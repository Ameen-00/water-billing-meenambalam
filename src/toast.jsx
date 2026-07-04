import { useEffect, useState } from "react";

// A tiny toast system — call toast.success("…") / toast.error("…") anywhere.
let listeners = [];
let items = [];
let counter = 0;

function emit() {
  for (const l of listeners) l([...items]);
}

export function toast(message, type = "info") {
  const t = { id: ++counter, message, type };
  items = [...items, t];
  emit();
  setTimeout(() => {
    items = items.filter((x) => x.id !== t.id);
    emit();
  }, 3500);
}
toast.success = (m) => toast(m, "success");
toast.error = (m) => toast(m, "error");

const STYLES = {
  success: "bg-sky-600",
  error: "bg-rose-600",
  info: "bg-slate-800",
};
const ICONS = { success: "✓", error: "!", info: "i" };

export function Toaster() {
  const [list, setList] = useState([]);
  useEffect(() => {
    listeners.push(setList);
    return () => { listeners = listeners.filter((l) => l !== setList); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg ${STYLES[t.type]}`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs font-bold">{ICONS[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
