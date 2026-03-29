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
  isAtRisk?: boolean;
  focusTrigger?: number;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
};

/* ── Custom node ─────────────────────────────────────────── */
function CareerNodeComponent({ data }: { data: Record<string, unknown> }) {
  const label = (data.label as string) ?? "Milestone";
  const role = data.role as string | undefined;
  const stress = (data.stressLevel as string) ?? "low";
  const months = (data.timelineMonths as number) ?? 0;
  const description = data.description as string | undefined;
  const checklist = (data.checklist as string[]) ?? [];
  const itemsCompleted = (data.items_completed as string[]) ?? [];
  const completed = Boolean(data.completed);
  const isNextStep = Boolean(data.isNextStep);
  const isZenActive = Boolean(data.isZenActive);

  const progress = checklist.length > 0
    ? Math.round((itemsCompleted.length / checklist.length) * 100)
    : 0;

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
      className={`group relative rounded-2xl border bg-[#0a0f1a]/80 px-5 py-4 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${completed && !isZenActive ? "border-calm-mint ring-1 ring-calm-mint/30 shadow-[0_0_20px_rgba(74,155,142,0.11)]" : borderColor[stress] ?? borderColor.low
        } ${isNextStep ? "ring-[3px] ring-emerald-500/80 shadow-[0_0_40px_rgba(16,185,129,0.3)] border-emerald-400" : ""
        }`}
      style={{
        width: 240,
        fontFamily: "'Inter', sans-serif",
        boxShadow: isNextStep
          ? "0 0 50px rgba(16, 185, 129, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)"
          : "0 8px 40px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)",
        pointerEvents: isZenActive && !isNextStep && !completed ? "none" : "auto",
        animation: isNextStep ? "zen-pulse 3s infinite ease-in-out" : "none",
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold tracking-tight text-white leading-snug">{label}</p>
            {isNextStep && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </div>
          {role && <p className="mt-0.5 text-[11px] text-slate-500 font-medium">{role}</p>}
        </div>
        {isNextStep && (
          <div className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-emerald-400 ring-1 ring-emerald-500/30">
            Focus
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold ${badgeColor[stress] ?? badgeColor.low}`}>
          {stress}
        </span>
        <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-400 ring-1 ring-white/5">
          {timeline}
        </span>
            {completed ? (
              <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold ring-1 transition-colors bg-calm-mint/20 text-calm-mint ring-calm-mint/40 flex items-center gap-1`}>
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                COMPLETED
              </span>
            ) : (
              <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold ring-1 transition-colors bg-calm-teal/10 text-calm-cyan ring-calm-teal/20`}>
                {itemsCompleted.length}/{checklist.length} STEPS
              </span>
            )}
      </div>

      {description && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{description}</p>
      )}

      {/* Progress Bar */}
      {checklist.length > 0 && (
        <div className="mt-4 h-1 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-calm-teal transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
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
  isAtRisk = false,
  focusTrigger = 0,
  className = "",
  onNodeClick: onNodeClickProp,
}: CareerMapProps) {
  const effectiveAtRisk = isAtRisk || burnoutZone === "risk";
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

  // Zentering on the next step node
  useEffect(() => {
    if (!effectiveAtRisk) return;

    const nextStepNode = nodes.find(n => !n.data?.completed);
    if (nextStepNode) {
      fitView({
        nodes: [{ id: nextStepNode.id }],
        duration: 800,
        padding: 0.75
      });
    }
  }, [effectiveAtRisk, focusTrigger, fitView, nodes.length === 0]); // Re-run when risk is toggled or next step requested

  /* Burnout-adaptive styling & The Rule of One logic */
  const styledNodes = useMemo(() => {
    // Identify the "Immediate Next Step" node
    // It's the first non-completed node in the sequence
    const nextStepNodeId = effectiveAtRisk
      ? nodes.find(n => !n.data?.completed)?.id
      : null;

    return nodes.map((n) => {
      const stress = n.data?.stressLevel as string | undefined;
      const months = (n.data?.timelineMonths as number) ?? 0;
      const isHighLoad = stress === "high" || months >= 12;
      const isCompleted = Boolean(n.data?.completed);
      const isNextStepNode = n.id === nextStepNodeId;

      let opacity = 1;
      let filter: string | undefined;
      let extra = "";

      if (effectiveAtRisk) {
        if (isNextStepNode) {
          // Rule of One: Clear & Highlighted
          opacity = 1;
          filter = "none";
        } else if (isCompleted) {
          // Already done: Slightly dimmed but readable
          opacity = 0.5;
          filter = "grayscale(0.5)";
        } else {
          // Future: Blurred and dimmed
          opacity = 0.3;
          filter = "blur(4px) grayscale(1)";
          extra = "pointer-events-none";
        }
      } else if (burnoutZone === "early_warning" && isHighLoad) {
        opacity = 0.45;
        filter = "grayscale(0.3)";
      }

      return {
        ...n,
        data: {
          ...n.data,
          isNextStep: isNextStepNode,
          isZenActive: effectiveAtRisk
        },
        style: {
          ...n.style,
          opacity,
          filter,
          transition: "all 0.8s ease-in-out",
        },
        className: [n.className, extra].filter(Boolean).join(" "),
        draggable: effectiveAtRisk ? isNextStepNode : true,
        selectable: effectiveAtRisk ? isNextStepNode : true,
      };
    });
  }, [nodes, burnoutZone, effectiveAtRisk]);

  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const isNextStepEdge = effectiveAtRisk && e.target === styledNodes.find(n => n.data.isNextStep)?.id;

        return {
          ...e,
          type: "bezier" as const,
          style: {
            stroke: effectiveAtRisk ? (isNextStepEdge ? "#10b981" : "#475569") : "url(#edge-gradient)",
            strokeWidth: effectiveAtRisk ? (isNextStepEdge ? 3 : 1) : 2.5,
            opacity: effectiveAtRisk ? (isNextStepEdge ? 0.7 : 0.15) : 0.8,
            filter: effectiveAtRisk && !isNextStepEdge ? "blur(2px)" : "none",
            transition: "all 0.8s ease-in-out",
          },
          animated: effectiveAtRisk ? isNextStepEdge : true,
        };
      }),
    [edges, burnoutZone, effectiveAtRisk, styledNodes],
  );

  const handleNodeClick = (_: React.MouseEvent, node: CareerNode) => {
    onNodeClickProp?.(node.id);
  };


  return (
    <div
      style={{ height: 650 }}
      className={`relative w-full overflow-hidden rounded-2xl border border-white/5 shadow-2xl transition-colors duration-1000 ${effectiveAtRisk ? "bg-[#1a1614]" : "bg-[#0f1a24]/60"
        } ${className}`}
    >
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.1}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        panOnScroll={true}
        selectionOnDrag={true}
        panOnDrag={[1, 2]}
        colorMode="dark"
      >
        <style>
          {`
            @keyframes zen-pulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(16, 185, 129, 0.3); }
              50% { transform: scale(1.02); box-shadow: 0 0 60px rgba(16, 185, 129, 0.5); }
            }
          `}
        </style>
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
        <Controls showInteractive={false} className="hidden sm:flex !bg-slate-900/80 backdrop-blur !border-white/5 !rounded-xl !shadow-xl [&_button]:!fill-slate-300 [&_button]:!border-white/5 hover:[&_button]:!bg-slate-800" />
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
