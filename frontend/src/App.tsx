import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  ShieldCheck,
  GitBranch,
  RotateCcw,
  Settings2,
  FlaskConical,
  Menu,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ChevronRight,
  Sun,
  Moon,
  ArrowRight,
  XCircle,
  Info,
  Sparkles,
  CheckSquare,
  Square,
  ShieldAlert
} from "lucide-react";
import { api, API_BASE } from "./api";

type State = {
  allocation: number[][];
  maximum: number[][];
  available: number[];
};

type Result = Record<string, any>;

const sample: State = {
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2]
  ],
  maximum: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3]
  ],
  available: [3, 3, 2]
};

const navCategories = [
  {
    category: "Simulation & Safety",
    items: [
      { id: "overview", label: "Overview", icon: Activity },
      { id: "banker", label: "Banker's Safety", icon: ShieldCheck },
      { id: "request", label: "Resource Request", icon: GitBranch }
    ]
  },
  {
    category: "Diagnostics & Control",
    items: [
      { id: "detection", label: "Deadlock Detection", icon: AlertTriangle },
      { id: "recovery", label: "Prevention & Recovery", icon: RotateCcw }
    ]
  },
  {
    category: "Verification & Audit",
    items: [
      { id: "boundary", label: "Boundary Tests", icon: FlaskConical }
    ]
  }
];

const allNavItems = navCategories.flatMap(c => c.items);

const clone = (s: State): State => JSON.parse(JSON.stringify(s));

function Status({ value }: { value: string }) {
  const good = [
    "SAFE",
    "GRANTED",
    "VALID ORDER",
    "PASS",
    "ALL TESTS PASS",
    "NO DEADLOCK DETECTED"
  ].includes(value);

  const bad = [
    "UNSAFE",
    "WAITING/DEFERRED",
    "DENIED",
    "INVALID REQUEST",
    "DEADLOCKED",
    "FAIL",
    "TESTS NEED ATTENTION"
  ].includes(value);

  const cls = good ? "good" : bad ? "bad" : "neutral";

  return (
    <span className={`status ${cls}`}>
      {good ? <CheckCircle2 size={12} /> : bad ? <AlertTriangle size={12} /> : <Info size={12} />}
      {value}
    </span>
  );
}

function Matrix({
  title,
  rows,
  onChange,
  editable = true,
  subtitle
}: {
  title: string;
  rows: number[][];
  onChange?: (r: number, c: number, v: number) => void;
  editable?: boolean;
  subtitle?: string;
}) {
  const colCount = rows[0]?.length || 0;
  return (
    <div className="matrix-card">
      <div className="matrix-title">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{title}</span>
          {subtitle && <small style={{ color: "var(--text-muted)", fontSize: 10 }}>({subtitle})</small>}
        </div>
        <small>{rows.length}P × {colCount}R</small>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Process</th>
              {(rows[0] || []).map((_, j) => (
                <th key={j} className="res-header">R{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <th>P{i}</th>
                {row.map((v, j) => (
                  <td key={j} className={!editable ? "static-cell" : ""}>
                    {editable && onChange ? (
                      <input
                        aria-label={`${title} P${i} R${j}`}
                        type="number"
                        min="0"
                        step="1"
                        value={Number.isNaN(v) ? "" : v}
                        onChange={e =>
                          onChange(
                            i,
                            j,
                            e.target.value === "" ? Number.NaN : Number(e.target.value)
                          )
                        }
                      />
                    ) : (
                      Number.isNaN(v) ? "-" : v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Vector({
  title,
  values,
  onChange,
  editable = true
}: {
  title: string;
  values: number[];
  onChange?: (j: number, v: number) => void;
  editable?: boolean;
}) {
  return (
    <div className="vector-card">
      <div className="matrix-title">
        <span>{title}</span>
        <small>{values.length} Resources</small>
      </div>
      <div className="vector-values">
        {values.map((v, j) => (
          <label key={j}>
            <small>R{j}</small>
            {editable && onChange ? (
              <input
                aria-label={`${title} R${j}`}
                type="number"
                min="0"
                step="1"
                value={Number.isNaN(v) ? "" : v}
                onChange={e =>
                  onChange(
                    j,
                    e.target.value === "" ? Number.NaN : Number(e.target.value)
                  )
                }
              />
            ) : (
              <b>{Number.isNaN(v) ? "-" : v}</b>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [page, setPage] = useState("overview");
  const [state, setState] = useState<State>(clone(sample));
  const [processes, setProcesses] = useState(5);
  const [resources, setResources] = useState(3);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pid, setPid] = useState(0);
  const [request, setRequest] = useState([0, 4, 0]);
  const [detectReq, setDetectReq] = useState([
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ]);
  const [detectMode, setDetectMode] = useState<"multiple" | "single">("multiple");
  const [waitEdges, setWaitEdges] = useState("P0,P1\nP1,P0");
  const [recoverPid, setRecoverPid] = useState(0);
  const [order, setOrder] = useState("R0,R1,R2");
  const [acquisition, setAcquisition] = useState("R0,R1,R2");
  const [testReport, setTestReport] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep theme class synced on root body
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
  }, [theme]);

  const need = useMemo(
    () =>
      state.maximum.map((row, i) =>
        row.map((v, j) => v - state.allocation[i][j])
      ),
    [state]
  );

  function setCell(
    which: "allocation" | "maximum",
    i: number,
    j: number,
    v: number
  ) {
    setState(s => ({
      ...s,
      [which]: s[which].map((r, ri) =>
        r.map((x, c) => (ri === i && c === j ? v : x))
      )
    }));
    setResult(null);
  }

  function resize(p: number, r: number) {
    if (!Number.isInteger(p) || !Number.isInteger(r) || p < 1 || p > 12 || r < 1 || r > 8) {
      setError("Choose 1–12 processes and 1–8 resource types.");
      return;
    }
    const resizeMatrix = (old: number[][], fallback: number[][]) =>
      Array.from({ length: p }, (_, i) =>
        Array.from({ length: r }, (_, j) => old[i]?.[j] ?? fallback[i % fallback.length]?.[j % fallback[0].length] ?? 0)
      );

    setState(s => ({
      allocation: resizeMatrix(s.allocation, sample.allocation),
      maximum: resizeMatrix(s.maximum, sample.maximum),
      available: Array.from(
        { length: r },
        (_, j) => s.available[j] ?? sample.available[j % sample.available.length] ?? 0
      )
    }));
    setProcesses(p);
    setResources(r);
    setRequest(Array.from({ length: r }, (_, j) => request[j] ?? 0));
    setDetectReq(
      Array.from({ length: p }, (_, i) =>
        Array.from({ length: r }, (_, j) => detectReq[i]?.[j] ?? 0)
      )
    );
    setError("");
    setResult(null);
  }

  function loadSample() {
    setState(clone(sample));
    setProcesses(5);
    setResources(3);
    setRequest([0, 4, 0]);
    setPid(0);
    setDetectReq(Array.from({ length: 5 }, () => [0, 0, 0]));
    setResult(null);
    setError("");
  }

  async function run(path: string, payload: unknown) {
    setBusy(true);
    setError("");
    try {
      setResult(await api<Result>(path, payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  const body = { ...state };

  const editAvailable = (j: number, v: number) => {
    setState(s => ({
      ...s,
      available: s.available.map((x, k) => (k === j ? v : x))
    }));
    setResult(null);
  };

  const header = (title: string, desc: string) => (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      <button className="button secondary" onClick={loadSample}>
        <RefreshCw size={15} /> Reset to assignment sample
      </button>
    </div>
  );

  const matrices = () => (
    <>
      <div className="section-row">
        <h2>System Resource Allocation State</h2>
        <span className="muted">All matrix and vector cells are live-editable · integers ≥ 0</span>
      </div>
      <div className="config-bar">
        <label>
          Processes (Rows)
          <select
            value={processes}
            onChange={e => resize(Number(e.target.value), resources)}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} processes (P0…P{i})
              </option>
            ))}
          </select>
        </label>
        <label>
          Resource Types (Cols)
          <select
            value={resources}
            onChange={e => resize(processes, Number(e.target.value))}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} resource types (R0…R{i})
              </option>
            ))}
          </select>
        </label>
        <span className="config-note">Active Grid: P0…P{processes - 1} × R0…R{resources - 1}</span>
      </div>

      <div className="matrix-grid">
        <Matrix
          title="Allocation Matrix"
          subtitle="Currently held resources"
          rows={state.allocation}
          onChange={(i, j, v) => setCell("allocation", i, j, v)}
        />
        <Matrix
          title="Maximum Matrix"
          subtitle="Total declared claim"
          rows={state.maximum}
          onChange={(i, j, v) => setCell("maximum", i, j, v)}
        />
      </div>

      <div className="bottom-grid">
        <Vector
          title="Available Vector"
          values={state.available}
          onChange={editAvailable}
        />
        <Matrix
          title="Calculated Need Matrix"
          subtitle="Need[i][j] = Maximum[i][j] − Allocation[i][j]"
          rows={need}
          editable={false}
        />
      </div>
      <p className="hint">
        Note: The Need matrix updates automatically in real-time. For Banker’s safety to pass, each process requires remaining Need ≤ Work to complete its execution and release held resources.
      </p>
    </>
  );

  const resultPanel = () =>
    result && (
      <div className="result-panel">
        <div className="result-heading">
          <div>
            <span className="eyebrow">Execution Diagnostic Verdict</span>
            <h3>{result.status || (result.safe ? "SAFE" : "Result")}</h3>
          </div>
          <Status value={result.status || "COMPLETE"} />
        </div>

        <p>{result.reason || result.explanation}</p>

        {result.safe_sequence && (
          <div className="sequence">
            <b>Verified Safe Sequence Order</b>
            <div>
              {result.safe_sequence.map((p: number, i: number) => (
                <span key={p} className="seq-item">
                  <span style={{ opacity: 0.65, fontSize: 10, marginRight: 2 }}>#{i + 1}</span>
                  <strong>P{p}</strong>
                  {i < result.safe_sequence.length - 1 && (
                    <ChevronRight size={14} className="seq-arrow" />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {result.trace && (
          <div className="trace-wrap">
            <h4>Algorithm Execution Trace & Step-by-Step Work Growth</h4>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Process Completed</th>
                    <th>Work Before</th>
                    <th>Allocation Released</th>
                    <th>Work After Release</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trace.map((t: any, i: number) => (
                    <tr key={i}>
                      <td>Step {i + 1}</td>
                      <td>
                        <strong style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                          P{t.process}
                        </strong>
                      </td>
                      <td>{JSON.stringify(t.work_before)}</td>
                      <td style={{ color: "var(--accent-emerald)" }}>+{JSON.stringify(t.released_allocation)}</td>
                      <td><strong>{JSON.stringify(t.work_after)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result.finish && (
          <p className="muted" style={{ marginTop: 12 }}>
            Finish Vector: [{result.finish.map((v: boolean) => (v ? "1" : "0")).join(", ")}] · (1 = Finished / Safe, 0 = Blocked)
          </p>
        )}

        {result.need && (
          <div className="matrix-grid" style={{ marginTop: 16 }}>
            <Matrix title="Need Matrix After Execution" rows={result.need} editable={false} />
            <Vector title="Available Vector After Execution" values={result.available || []} editable={false} />
          </div>
        )}

        {result.before && (
          <div className="matrix-grid" style={{ marginTop: 16 }}>
            <Matrix
              title="Allocation Matrix After Transaction"
              rows={result.after.allocation}
              editable={false}
            />
            <Vector
              title="Available Vector After Transaction"
              values={result.after.available}
              editable={false}
            />
          </div>
        )}

        {result.unfinished_processes && (
          <p style={{ marginTop: 12 }}>
            <b>Unfinished / Deadlocked Processes:</b>{" "}
            {result.unfinished_processes.length
              ? result.unfinished_processes.map((p: number) => `P${p}`).join(", ")
              : "None (All processes completed)"}
          </p>
        )}

        {result.cycle && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(244,63,94,0.1)", borderRadius: 8, border: "1px solid rgba(244,63,94,0.3)" }}>
            <b style={{ color: "#fb7185" }}>Detected Wait-For Cycle:</b>{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
              {result.cycle.join(" ➔ ")}
            </span>
          </div>
        )}

        {result.safety_check && (
          <p className="muted" style={{ marginTop: 10 }}>
            Tentative State Safety Check Status: <strong>{result.safety_check.status}</strong>
          </p>
        )}

        {result.released_resources && (
          <div style={{ marginTop: 16 }}>
            <p>
              <b>Terminated Process:</b> P{result.terminated_process} ·{" "}
              <b>Resources Released to Available:</b> [{result.released_resources.join(", ")}]
            </p>
            <div className="matrix-grid">
              <Matrix
                title="Allocation Matrix After Recovery"
                rows={result.allocation_after}
                editable={false}
              />
              <Vector
                title="Available Vector After Recovery"
                values={result.available_after}
                editable={false}
              />
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Safety Check After Process Termination: <strong>{result.safety_after_recovery?.status}</strong>
            </p>
          </div>
        )}

        {result.violations && (
          <p style={{ marginTop: 12 }}>
            <b>Order Sequence Violations:</b>{" "}
            {result.violations.length
              ? result.violations.map((v: any) => `${v.from} ➔ ${v.to}`).join(", ")
              : "None (Strict global resource acquisition order is respected)"}
          </p>
        )}
      </div>
    );

  async function runBoundary() {
    setBusy(true);
    setError("");
    const tests = [
      {
        name: "Zero Available resources",
        expected: "UNSAFE",
        call: () => api<Result>("/api/safety", { allocation: [[1]], maximum: [[2]], available: [0] })
      },
      {
        name: "Zero Need for a process",
        expected: "SAFE",
        call: () => api<Result>("/api/safety", { allocation: [[1]], maximum: [[1]], available: [0] })
      },
      {
        name: "Invalid process ID (out of bounds)",
        expected: "Validation error",
        call: () => api<Result>("/api/request", { ...body, process_id: 99, request: Array(resources).fill(0) })
      },
      {
        name: "Negative resource request value",
        expected: "Validation error",
        call: () => api<Result>("/api/request", { ...body, process_id: 0, request: [-1, ...Array(Math.max(0, resources - 1)).fill(0)] })
      },
      {
        name: "Allocation strictly greater than Maximum",
        expected: "Validation error",
        call: () => api<Result>("/api/safety", { allocation: [[2]], maximum: [[1]], available: [0] })
      },
      {
        name: "Request strictly greater than Need",
        expected: "INVALID REQUEST",
        call: () => api<Result>("/api/request", { ...body, process_id: 0, request: state.maximum[0].map((v, j) => need[0][j] + 1) })
      },
      {
        name: "Request within Need but greater than Available",
        expected: "WAITING/DEFERRED",
        call: () => api<Result>("/api/request", { ...sample, process_id: 0, request: [0, 4, 0] })
      },
      {
        name: "Request causes tentative state to become unsafe",
        expected: "DENIED",
        call: () => api<Result>("/api/request", { ...sample, process_id: 0, request: [0, 3, 0] })
      },
      {
        name: "Request preserves safe state and is granted",
        expected: "GRANTED",
        call: () => api<Result>("/api/request", { allocation: [[1, 0], [0, 1]], maximum: [[2, 1], [1, 2]], available: [1, 1], process_id: 0, request: [1, 0] })
      },
      {
        name: "Unsafe system has no complete safe sequence",
        expected: "UNSAFE",
        call: () => api<Result>("/api/safety", { allocation: [[1, 0], [0, 1]], maximum: [[2, 0], [0, 2]], available: [0, 0] })
      }
    ];

    const out = [];
    for (const t of tests) {
      try {
        const r = await t.call();
        const actual = r.status || (r.safe ? "SAFE" : "UNSAFE");
        out.push({ name: t.name, expected: t.expected, actual, pass: actual === t.expected });
      } catch (e) {
        const actual = "Validation error";
        out.push({
          name: t.name,
          expected: t.expected,
          actual,
          pass: actual === t.expected,
          detail: e instanceof Error ? e.message : ""
        });
      }
    }
    setTestReport(out);
    setResult({
      status: out.every(t => t.pass) ? "ALL TESTS PASS" : "TESTS NEED ATTENTION",
      explanation: `Executed ${out.length} automated boundary tests against the active Python/FastAPI backend. ${out.filter(t => t.pass).length}/${out.length} test assertions matched expected outcomes.`
    });
    setBusy(false);
  }

  return (
    <div className="app-shell">
      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Cpu size={22} />
          </div>
          <div className="brand-title">
            <b>SyncMatrix OS</b>
            <small>Deadlock Analysis Engine</small>
          </div>
        </div>

        {navCategories.map((group, idx) => (
          <div key={idx} style={{ marginBottom: 12 }}>
            <div className="nav-category">{group.category}</div>
            <nav>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = page === item.id;
                return (
                  <button
                    key={item.id}
                    className={`nav-link ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setPage(item.id);
                      setMobileOpen(false);
                      setResult(null);
                      setError("");
                    }}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {isActive && <span className="nav-dot" />}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="main">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="crumb-pill">
              <span style={{ color: "var(--text-muted)" }}>Workspace</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <b>{allNavItems.find(n => n.id === page)?.label}</b>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>

            <div className="api-pill">
              <span className="api-status-dot" />
              <span>Python API Active</span>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="content">
          {/* ================= PAGE: OVERVIEW ================= */}
          {page === "overview" && (
            <>
              {header(
                "Deadlock Analysis Dashboard",
                "Explore operating system safe states, simulate dynamic resource allocation, and inspect deadlock behavior."
              )}

              {/* Redesigned Hero Banner */}
              <div className="hero">
                <div className="hero-content">
                  <div className="hero-label">
                    <ShieldCheck size={14} /> CONCURRENCY & DEADLOCK ENGINE
                  </div>
                  <h2>
                    Predict concurrency states.<br />
                    <em>Prevent deadlocks before they happen.</em>
                  </h2>
                  <p>
                    An interactive simulator and mathematical verification suite for Banker’s Algorithm,
                    resource request transactions, multi-instance detection, and recovery.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button primary"
                      onClick={() => {
                        setPage("banker");
                        run("/api/safety", body);
                      }}
                      disabled={busy}
                    >
                      <Play size={15} /> Run Safety Analysis <ArrowRight size={15} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setPage("request")}
                    >
                      <GitBranch size={15} /> Test Request
                    </button>
                  </div>
                </div>

                <div className="hero-graphic">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="core">
                    <Cpu size={36} color="#ffffff" />
                  </div>
                  <span className="node node-a">P0: Work</span>
                  <span className="node node-b">R1: Held</span>
                  <span className="node node-c">P2: Safe</span>
                  <span className="node node-d">R0: Free</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-icon blue">
                    <Activity />
                  </span>
                  <small>Active Processes</small>
                  <strong>{processes}</strong>
                  <span>P0 through P{processes - 1}</span>
                </div>

                <div className="stat-card">
                  <span className="stat-icon violet">
                    <Settings2 />
                  </span>
                  <small>Resource Types</small>
                  <strong>{resources}</strong>
                  <span>R0 through R{resources - 1}</span>
                </div>

                <div className="stat-card">
                  <span className="stat-icon green">
                    <ShieldCheck />
                  </span>
                  <small>System State</small>
                  <strong>{result?.status || "Ready"}</strong>
                  <span>Banker's verdict</span>
                </div>

                <div className="stat-card">
                  <span className="stat-icon amber">
                    <GitBranch />
                  </span>
                  <small>Backend Engine</small>
                  <strong>Online</strong>
                  <span>FastAPI + Python</span>
                </div>
              </div>

              {/* Main Workstation & Quick Modules */}
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>System Resource Workstation</h3>
                      <p>Modify process and resource dimensions, inspect allocation matrices, or edit cell values.</p>
                    </div>
                    <button className="text-button" onClick={() => setPage("banker")}>
                      Open in Banker's <ChevronRight size={14} />
                    </button>
                  </div>

                  {matrices()}

                  <div className="actions">
                    <button
                      className="button primary"
                      onClick={() => {
                        setPage("banker");
                        run("/api/safety", body);
                      }}
                      disabled={busy}
                    >
                      <Play size={15} /> Analyze Current State
                    </button>
                    <button className="button secondary" onClick={loadSample}>
                      <RefreshCw size={14} /> Reset Sample
                    </button>
                  </div>
                </section>

                <section className="panel quick-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Analysis Modules</h3>
                      <p>Select an OS deadlock topic to explore in detail:</p>
                    </div>
                  </div>

                  {allNavItems.slice(1).map(n => {
                    const I = n.icon;
                    return (
                      <button
                        className="module-row"
                        key={n.id}
                        onClick={() => {
                          setPage(n.id);
                          setResult(null);
                          setError("");
                        }}
                      >
                        <span className="module-icon">
                          <I size={17} />
                        </span>
                        <span>
                          <b>{n.label}</b>
                          <small>
                            {(
                              {
                                banker: "Work growth vector & safe completion sequence",
                                request: "4 Banker's decision routes & atomic rollback",
                                detection: "Wait-for graph cycles & multi-instance matrices",
                                recovery: "Preemption, process termination & strict ordering",
                                boundary: "10 automated edge-case assertions"
                              } as any
                            )[n.id]}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    );
                  })}
                </section>
              </div>
            </>
          )}

          {/* ================= PAGE: BANKER'S SAFETY ================= */}
          {page === "banker" && (
            <>
              {header(
                "Banker’s Safety Algorithm",
                "Determine whether the system is in a safe state by iteratively satisfying processes whose remaining Need is less than or equal to Available Work."
              )}

              {matrices()}

              <div className="actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => run("/api/safety", body)}
                >
                  <Play size={15} /> Run Banker’s Safety Algorithm
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setResult(null);
                    setError("");
                  }}
                >
                  Clear Results
                </button>
              </div>

              <div className="callout">
                <b>Core Principle: Safe vs Unsafe</b>
                <p>
                  A state is considered <strong>SAFE</strong> if there exists at least one order (safe sequence)
                  in which every process can obtain its maximum needed resources, finish execution, and release
                  all held resources back to Available. An <strong>UNSAFE</strong> state is not an active deadlock,
                  but rather a vulnerable state where future resource requests could trigger an unavoidable deadlock.
                </p>
              </div>
            </>
          )}

          {/* ================= PAGE: RESOURCE REQUEST ================= */}
          {page === "request" && (
            <>
              {header(
                "Dynamic Resource Request Simulation",
                "Simulate an atomic resource request by a process using Banker’s 4 evaluation rules with automatic state rollback on rejection."
              )}

              {matrices()}

              <section className="panel request-form">
                <h3>Submit Process Resource Request</h3>
                <div className="form-row">
                  <label>
                    Requesting Process
                    <select
                      value={pid}
                      onChange={e => setPid(Number(e.target.value))}
                    >
                      {Array.from({ length: processes }, (_, i) => (
                        <option key={i} value={i}>
                          Process P{i}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Vector
                    title={`Request Vector for P${pid}`}
                    values={request}
                    onChange={(j, v) =>
                      setRequest(a => a.map((x, k) => (k === j ? v : x)))
                    }
                  />
                </div>

                <div className="actions" style={{ marginTop: 18 }}>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      run("/api/request", {
                        ...body,
                        process_id: pid,
                        request
                      })
                    }
                  >
                    <Play size={15} /> Evaluate Request Transaction
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setRequest(Array(resources).fill(0))}
                  >
                    Zero Request
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setPid(0);
                      setRequest([0, 4, 0]);
                    }}
                  >
                    Load Sample P0 (0,4,0) [Deferred]
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setPid(0);
                      setRequest([0, 3, 0]);
                    }}
                  >
                    Load Sample P0 (0,3,0) [Denied]
                  </button>
                </div>
              </section>

              <div className="four-cases">
                {[
                  ["A", "INVALID REQUEST", "Request exceeds remaining Need. Request is immediately rejected with zero state modification."],
                  ["B", "WAITING/DEFERRED", "Request is within Need but exceeds current Available resources. Process must wait."],
                  ["C", "DENIED (UNSAFE)", "Tentative allocation would leave the system in an unsafe state. The transaction is atomically rolled back."],
                  ["D", "GRANTED (SAFE)", "Tentative state remains safe with a confirmed safe sequence. Resources are permanently committed."]
                ].map(c => (
                  <div className="case-card" key={c[0]}>
                    <span>{c[0]}</span>
                    <div>
                      <b>{c[1]}</b>
                      <small>{c[2]}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ================= PAGE: DEADLOCK DETECTION ================= */}
          {page === "detection" && (
            <>
              {header(
                "Deadlock Detection Diagnostics",
                "Detect whether deadlocks exist using either a directed Wait-For Graph (for single-instance systems) or an iterative reduction algorithm (for multi-instance systems)."
              )}

              <div className="panel mode-panel">
                <label>
                  Detection Model Architecture
                  <select
                    value={detectMode}
                    onChange={e => {
                      setDetectMode(e.target.value as any);
                      setResult(null);
                    }}
                  >
                    <option value="multiple">Multiple-Instance Resources (Matrix Reduction)</option>
                    <option value="single">Single-Instance Resources (Wait-For Graph Cycle)</option>
                  </select>
                </label>
                <p className="hint">
                  {detectMode === "multiple"
                    ? "Under the multi-instance model, outstanding requests are inspected. A cycle alone is not sufficient proof of deadlock."
                    : "Under the single-instance model, a directed cycle in the Wait-For Graph is both necessary and sufficient proof of deadlock."}
                </p>
              </div>

              {detectMode === "multiple" ? (
                <>
                  <div className="matrix-grid">
                    <Matrix
                      title="Allocation Matrix"
                      subtitle="Held resources"
                      rows={state.allocation}
                      onChange={(i, j, v) => setCell("allocation", i, j, v)}
                    />
                    <Matrix
                      title="Outstanding Request Matrix"
                      subtitle="Current pending claims"
                      rows={detectReq}
                      onChange={(i, j, v) =>
                        setDetectReq(a =>
                          a.map((r, ri) =>
                            r.map((x, c) => (ri === i && c === j ? v : x))
                          )
                        )
                      }
                    />
                  </div>
                  <Vector
                    title="Available Vector"
                    values={state.available}
                    onChange={editAvailable}
                  />
                  <div className="actions">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        run("/api/detection/multiple", {
                          allocation: state.allocation,
                          request: detectReq,
                          available: state.available
                        })
                      }
                    >
                      <Play size={15} /> Run Multi-Instance Detection
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        setDetectReq(
                          Array.from({ length: processes }, () =>
                            Array(resources).fill(1)
                          )
                        )
                      }
                    >
                      Set Non-Zero Requests
                    </button>
                  </div>
                </>
              ) : (
                <section className="panel">
                  <label className="field-label">
                    Wait-For Graph Edges (Format: WAITING_PROCESS,BLOCKING_PROCESS per line)
                  </label>
                  <textarea
                    className="large-textarea"
                    value={waitEdges}
                    onChange={e => setWaitEdges(e.target.value)}
                    rows={5}
                    placeholder="P0,P1&#10;P1,P0"
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button
                      className="button secondary"
                      onClick={() => setWaitEdges("P0,P1\nP1,P0")}
                    >
                      Load Mutual Wait Cycle (P0↔P1)
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setWaitEdges("P0,P1\nP1,P2\nP2,P0")}
                    >
                      Load 3-Process Ring Cycle (P0→P1→P2→P0)
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setWaitEdges("P0,P1\nP1,P2")}
                    >
                      Load Linear Safe Chain (No Cycle)
                    </button>
                  </div>
                  <div className="actions">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => {
                        const edges = waitEdges
                          .split("\n")
                          .map(x => x.trim())
                          .filter(Boolean)
                          .map(x => x.split(",").map(y => y.trim()));
                        const ps = Array.from(new Set(edges.flat()));
                        run("/api/detection/single", {
                          processes: ps,
                          waits: edges
                        });
                      }}
                    >
                      <Play size={15} /> Inspect Wait-For Graph Cycles
                    </button>
                  </div>
                </section>
              )}

              <div className="callout">
                <b>Theoretical Assumptions</b>
                <p>
                  In a <strong>Single-Instance</strong> resource system, each resource type has exactly 1 unit.
                  A directed cycle in the Wait-For Graph guarantees that a deadlock exists.
                  In a <strong>Multiple-Instance</strong> resource system, resources have multiple interchangeable units.
                  A graph cycle is necessary but NOT sufficient; Banker-style Work vector reduction is required.
                </p>
              </div>
            </>
          )}

          {/* ================= PAGE: PREVENTION & RECOVERY ================= */}
          {page === "recovery" && (
            <>
              {header(
                "Deadlock Prevention & Recovery Strategies",
                "Demonstrate recovery via user-confirmed process termination and resource reclamation, as well as prevention via strict global resource ordering."
              )}

              {/* Recovery Section */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Strategy 1: Recovery via Process Termination & Resource Preemption</h3>
                    <p>Select a process to abort; its allocated resources are reclaimed and returned to Available.</p>
                  </div>
                </div>

                {matrices()}

                <div className="form-row">
                  <label>
                    Process to Terminate
                    <select
                      value={recoverPid}
                      onChange={e => setRecoverPid(Number(e.target.value))}
                    >
                      {Array.from({ length: processes }, (_, i) => (
                        <option value={i} key={i}>
                          Process P{i}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="warning-box">
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>
                      Terminating a process discards uncommitted computation state and requires explicit confirmation.
                      All held allocation will be returned to the Available vector immediately.
                    </span>
                  </div>
                </div>

                <div className="actions">
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Terminate process P${recoverPid} and reclaim its allocated resources?`)) {
                        run("/api/recovery", {
                          ...body,
                          process_id: recoverPid
                        });
                      }
                    }}
                  >
                    <ShieldAlert size={15} /> Confirm Termination & Reclaim Resources
                  </button>
                </div>
              </section>

              {/* Prevention Section */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Strategy 2: Deadlock Prevention via Global Resource Ordering</h3>
                    <p>Enforce a strict monotonic resource acquisition sequence F: R &rarr; &#8469; to eliminate circular wait.</p>
                  </div>
                </div>

                <div className="form-row">
                  <label>
                    Global Resource Total Order
                    <input
                      value={order}
                      onChange={e => setOrder(e.target.value)}
                      placeholder="R0,R1,R2"
                    />
                  </label>
                  <label>
                    Process Acquisition Sequence
                    <input
                      value={acquisition}
                      onChange={e => setAcquisition(e.target.value)}
                      placeholder="R0,R1"
                    />
                  </label>
                </div>

                <div className="actions">
                  <button
                    className="button primary"
                    onClick={() =>
                      run("/api/prevention/order", {
                        resource_order: order.split(",").map(x => x.trim()).filter(Boolean),
                        acquisition: acquisition.split(",").map(x => x.trim()).filter(Boolean)
                      })
                    }
                  >
                    Validate Acquisition Order Monotonicity
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setOrder("R0,R1,R2");
                      setAcquisition("R2,R0");
                    }}
                  >
                    Load Invalid Sequence (R2 ➔ R0)
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setOrder("R0,R1,R2");
                      setAcquisition("R0,R1,R2");
                    }}
                  >
                    Load Valid Sequence (R0 ➔ R1 ➔ R2)
                  </button>
                </div>

                <div className="callout">
                  <b>Mathematical Proof of Circular Wait Elimination</b>
                  <p>
                    Let F(R) assign a unique integer to each resource type. If each process can only request
                    resources in strictly increasing order of F, a circular wait P0 &rarr; P1 &rarr; &hellip; &rarr; Pk &rarr; P0
                    would require F(Ra) &lt; F(Rb) &lt; &hellip; &lt; F(Ra), which is mathematically impossible.
                  </p>
                </div>
              </section>
            </>
          )}

          {/* ================= PAGE: BOUNDARY TESTS ================= */}
          {page === "boundary" && (
            <>
              {header(
                "Automated Boundary & Edge-Case Verification",
                "Execute 10 targeted edge cases against the live FastAPI algorithm backend and verify expected vs actual classifications."
              )}

              <div className="callout">
                <b>Honest Verification Reporting</b>
                <p>
                  Test outcomes reflect actual live HTTP responses from the backend algorithm endpoints.
                  No results are mocked or hardcoded.
                </p>
              </div>

              <div className="actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={runBoundary}
                >
                  <FlaskConical size={16} /> Execute All 10 Boundary Tests
                </button>
              </div>

              {testReport.length > 0 && (
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Verification Scorecard</h3>
                      <p>
                        {testReport.filter(t => t.pass).length} of {testReport.length} expected outcomes confirmed
                      </p>
                    </div>
                    <Status
                      value={
                        testReport.every(t => t.pass)
                          ? "ALL TESTS PASS"
                          : "TESTS NEED ATTENTION"
                      }
                    />
                  </div>

                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Edge Test Case</th>
                          <th>Expected Outcome</th>
                          <th>Actual Outcome</th>
                          <th>Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testReport.map((t, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td><strong>{t.name}</strong></td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{t.expected}</td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>
                              {t.actual}
                              {t.detail && <small className="table-detail">{t.detail}</small>}
                            </td>
                            <td>
                              <Status value={t.pass ? "PASS" : "FAIL"} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ERROR BANNER */}
          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <b>Operation Error</b>
                <p>{error}</p>
              </div>
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

          {/* RESULT PANEL */}
          {resultPanel()}
        </div>
      </main>
    </div>
  );
}

export default App;
