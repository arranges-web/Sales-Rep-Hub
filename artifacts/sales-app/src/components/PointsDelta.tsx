import { useEffect, useRef, useState } from "react";

interface DeltaItem {
  id: number;
  amount: number;
}

let nextId = 1;

/**
 * Renders a transient "+N" badge that pops above its sibling whenever
 * `value` increases. Multiple rapid increases stack vertically.
 */
export function PointsDelta({ value }: { value: number }) {
  const prevRef = useRef<number | null>(null);
  const [items, setItems] = useState<DeltaItem[]>([]);

  useEffect(() => {
    if (prevRef.current == null) {
      prevRef.current = value;
      return;
    }
    const delta = value - prevRef.current;
    prevRef.current = value;
    if (delta > 0) {
      const id = nextId++;
      setItems((arr) => [...arr, { id, amount: delta }]);
      window.setTimeout(() => {
        setItems((arr) => arr.filter((i) => i.id !== id));
      }, 1700);
    }
  }, [value]);

  if (items.length === 0) return null;
  return (
    <span className="pointer-events-none absolute right-0 top-0 flex flex-col items-end">
      {items.map((it) => (
        <span
          key={it.id}
          className="jt-pop font-stat rounded-md border border-[#FFBF00]/40 bg-[#FFBF00]/15 px-2 py-0.5 text-xs font-bold text-[#FFBF00] shadow"
        >
          +{it.amount.toLocaleString()}
        </span>
      ))}
    </span>
  );
}
