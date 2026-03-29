import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { BurnoutZone } from "./burnout";
import type { CareerEdge, CareerNode } from "../../types/careerMap";

export type CareerMapProps = {
  nodes: CareerNode[];
  edges: CareerEdge[];
  burnoutZone?: BurnoutZone;
  className?: string;
};

/* ── Custom node ─────────────────────────────────────────── */
function CareerNodeComponent({ data }: { data: Record<string, unknown> }) {
  const label = (data.label as string) ?? "Milestone";
  const role = data.role as string | undefined;
  const stress = (data.stressLevel as string) ?? "low";
  const months = (data.timelineMonths as number) ?? 0;
  const readiness = data.readiness as number | undefined;
  const description = data.description as string | undefined;

  const borderColor: Record<string, string> = {
    low: "border-calm-mint/20",
    medium: "border-calm-amber/20",
    high: "border-calm-coral/20",
  };
  const badgeColor: Record<string, string> = {
    low: "bg-calm-mint/10 text-calm-mint ring-1 ring-calm-mint/20",
    medium: "bg-calm-amber/10 text-calm-amber ring-1 ring-calm-amber/20",
    high: "bg-calm-coral/10 text-calm-coral ring-1 ring-calm-coral/20",
  };
  const timeline =
    months === 0 ? "Now" : months < 12 ? `${months} mo` : `${Math.round(months / 12)} yr`;

  return (
    <div
      className={`group relative rounded-2xl border bg-[#0a0f1a]/80 px-5 py-4 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${borderColor[stress] ?? borderColor.low}`}
      style={{
        width: 240,
        fontFamily: "'Inter', sans-serif",
        boxShadow: "0 8px 40px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)",
      }}
    >
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-calm-teal/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-1.5 !rounded-r-none !border-0 !bg-calm-teal/80 !shadow-[0_0_10px_rgba(74,155,142,0.5)]"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-tight text-white leading-snug">{label}</p>
          {role && <p className="mt-0.5 text-[11px] text-slate-500 font-medium">{role}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold ${badgeColor[stress] ?? badgeColor.low}`}>
          {stress}
        </span>
        <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-400 ring-1 ring-white/5">
          {timeline}
        </span>
        {readiness !== undefined && (
          <span className="rounded-lg bg-calm-teal/10 px-2 py-0.5 text-[9px] font-semibold text-calm-cyan ring-1 ring-calm-teal/20">
            {Math.round(readiness * 100)}%
          </span>
        )}
      </div>

      {description && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{description}</p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-1.5 !rounded-l-none !border-0 !bg-calm-cyan/80 !shadow-[0_0_10px_rgba(102,179,193,0.5)]"
      />
    </div>
  );
}

const nodeTypes = { default: CareerNodeComponent };

/* ── Inner (needs ReactFlowProvider ancestor) ────────────── */
function CareerMapInner({
  nodes: nodesProp,
  edges: edgesProp,
  burnoutZone = "healthy",
  className = "",
}: CareerMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CareerNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CareerEdge>([]);
  const { fitView } = useReactFlow();

  // Sync from props & fit view after data arrives
  useEffect(() => {
    if (!nodesProp.length) return;
    const mapped = nodesProp.map((n) => ({ ...n, type: "default" }));
    setNodes(mapped);
    setEdges(edgesProp);
    // Wait one tick so React Flow can measure, then fit
    requestAnimationFrame(() => {
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
    });
  }, [nodesProp, edgesProp, setNodes, setEdges, fitView]);

  /* Burnout-adaptive styling */
  const styledNodes = useMemo(() => {
    return nodes.map((n) => {
      const stress = n.data?.stressLevel as string | undefined;
      const months = (n.data?.timelineMonths as number) ?? 0;
      const isHighLoad = stress === "high" || months >= 12;
      const isLow = stress === "low" && months <= 3;

      let opacity = 1;
      let filter: string | undefined;
      let extra = "";

      if (burnoutZone === "risk") {
        if (isHighLoad) {
          opacity = 0.15;
          filter = "grayscale(0.7)";
        } else if (isLow) {
          extra = "ring-2 ring-calm-mint/70 ring-offset-2 ring-offset-slate-950";
        }
      } else if (burnoutZone === "early_warning" && isHighLoad) {
        opacity = 0.45;
        filter = "grayscale(0.3)";
      }

      return {
        ...n,
        style: { ...n.style, opacity, filter, transition: "all 0.5s ease" },
        className: [n.className, extra].filter(Boolean).join(" "),
      };
    });
  }, [nodes, burnoutZone]);

  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: "bezier" as const,
        style: {
          stroke: burnoutZone === "risk" ? "#475569" : "url(#edge-gradient)",
          strokeWidth: burnoutZone === "risk" ? 2 : 2.5,
          opacity: burnoutZone === "risk" ? 0.3 : 0.8,
        },
        animated: true,
      })),
    [edges, burnoutZone],
  );

  return (
    <div style={{ height: 550 }} className={`w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0f1a24]/60 shadow-2xl ${className}`}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        panOnScroll={true}
        selectionOnDrag={true}
        panOnDrag={[1, 2]}
        colorMode="dark"
      >
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4a9b8e" />
              <stop offset="100%" stopColor="#5b8ea0" />
            </linearGradient>
          </defs>
        </svg>
        <MiniMap
          className="!rounded-xl !bg-slate-950/80 !border-white/5 !shadow-xl"
          maskColor="rgb(15 23 42 / 0.6)"
          nodeColor={() => "#4a9b8e"}
        />
        <Controls showInteractive={false} className="!bg-slate-900/80 backdrop-blur !border-white/5 !rounded-xl !shadow-xl [&_button]:!fill-slate-300 [&_button]:!border-white/5 hover:[&_button]:!bg-slate-800" />
        <Background color="rgba(255,255,255,0.05)" gap={32} size={1} />
      </ReactFlow>
    </div>
  );
}

/* ── Export ───────────────────────────────────────────────── */
export default function CareerMap(props: CareerMapProps) {
  return (
    <ReactFlowProvider>
      <CareerMapInner {...props} />
    </ReactFlowProvider>
  );
}
