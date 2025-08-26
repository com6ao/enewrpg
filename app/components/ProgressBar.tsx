"use client";

type LabeledProps = {
  current: number;
  max: number;
  label?: string;
  color?: string;
  height?: number;
};

type PercentProps = {
  value: number; // already in percentage 0-100
  color?: string;
  height?: number;
};

type Props = LabeledProps | PercentProps;

export default function ProgressBar(props: Props) {
  const pct = "value" in props
    ? Math.max(0, Math.min(100, Math.round(props.value)))
    : Math.max(0, Math.min(100, Math.round((props.current / props.max) * 100)));

  const color = props.color ?? "#2ecc71";
  const height = props.height ?? ("value" in props ? 8 : 10);
  const showInfo = !("value" in props);

  return (
    <div style={showInfo ? { width: "100%", background: "#222", borderRadius: 8, padding: 2 } : { height, background: "#222", borderRadius: 6, overflow: "hidden" }}>
      {showInfo && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#bbb", marginBottom: 2 }}>
          <span>{props.label ?? "HP"}</span>
          <span>
            {props.current}/{props.max}
          </span>
        </div>
      )}
      {showInfo ? (
        <div style={{ width: "100%", height, background: "#444", borderRadius: 6, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: color,
              transition: "width 300ms linear",
            }}
          />
        </div>
      ) : (
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 300ms linear" }} />
      )}
    </div>
  );
}
