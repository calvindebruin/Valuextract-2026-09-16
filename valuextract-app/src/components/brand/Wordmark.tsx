export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <span className={`${scale} font-extrabold tracking-tight`}>
      <span className="text-vx-text print-text">Value</span>
      <span className="text-vx-gold print-gold">Xtract</span>
    </span>
  );
}
