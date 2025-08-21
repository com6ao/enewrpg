"use client";
type Props = { 
  current: number; 
  max: number; 
  label?: string; 
  color?: string;
};

export default function Bar({ current, max, label = "HP", color = "#2ecc71" }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  return (
    <div style={{ width: "100%", background: "#222", borderRadius: 8, padding: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#bbb", marginBottom: 2 }}>
        <span>{label}</span>
        <span>{current}/{max}</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "#444", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 300ms linear",
          }}
        />
      </div>
    </div>
  );
}
