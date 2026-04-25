import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const API = 'http://localhost:8000'

const SVC_ICONS = {
  Snowflake: '❄️', Mysql: '🐬', BigQuery: '📊', Postgres: '🐘',
  Redshift: '🔴', Hive: '🐝', Trino: '🔺', Glue: '🧪',
}
const TYPE_COLORS = {
  VARCHAR: '#2563eb', STRING: '#2563eb', TEXT: '#2563eb', CHAR: '#2563eb',
  INT: '#22c55e', INTEGER: '#22c55e', BIGINT: '#22c55e', SMALLINT: '#22c55e', NUMERIC: '#22c55e', NUMBER: '#22c55e',
  DATE: '#f59e0b', DATETIME: '#f59e0b', TIMESTAMP: '#f59e0b', TIME: '#f59e0b',
  BOOLEAN: '#8b5cf6', BOOL: '#8b5cf6',
  FLOAT: '#06b6d4', DOUBLE: '#06b6d4', DECIMAL: '#06b6d4',
}
const PIE_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899']

function StepDots({ current }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${s <= current ? 'bg-[#2563eb]' : 'bg-[#555]'}`} />
          <span className={`text-[10px] ${s <= current ? 'text-gray-300' : 'text-gray-600'}`}>
            Step {s}
          </span>
        </div>
      ))}
    </div>
  )
}

function Breadcrumb({ db, tables, step, onGoTo }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-3 flex-wrap">
      {db && (
        <button onClick={() => onGoTo(1)} className="hover:text-white cursor-pointer transition-colors">
          🗄️ {db}
        </button>
      )}
      {tables.length > 0 && (
        <>
          <span>→</span>
          <button onClick={() => onGoTo(2)} className="hover:text-white cursor-pointer transition-colors">
            📋 {tables.map(t => t.name).join(', ')}
          </button>
        </>
      )}
      {step >= 3 && <><span>→</span><span className="text-gray-400">📊 Columns</span></>}
    </div>
  )
}

/* ─── Step 1: Database picker ─── */
function Step1({ onSelect }) {
  const [databases, setDatabases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`${API}/explorer/databases`).then(r => r.json()).then(d => {
      setDatabases(Array.isArray(d) ? d : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton-shimmer h-14 rounded-lg" />)}</div>

  return (
    <div className="animate-fade-in">
      <p className="text-[11px] text-gray-500 mb-2">Select a database service:</p>
      <div className="grid grid-cols-2 gap-2">
        {databases.map(db => (
          <button key={db.name} onClick={() => setSelected(db.name)}
            className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
              selected === db.name
                ? 'border-[#2563eb] bg-[#1e3a5f]'
                : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
            }`}>
            <div className="flex items-center gap-2">
              <span className="text-base">{SVC_ICONS[db.serviceType] || '🗄️'}</span>
              <div className="min-w-0">
                <div className="text-xs text-white font-medium truncate">{db.displayName}</div>
                <div className="text-[10px] text-gray-500">{db.tableCount} tables</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <button onClick={() => onSelect(selected)}
          className="mt-3 w-full text-xs py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8]
                     text-white font-medium cursor-pointer transition-colors">
          Next →
        </button>
      )}
    </div>
  )
}

/* ─── Step 2: Table picker ─── */
function Step2({ service, onSelect, onBack }) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch(`${API}/explorer/tables?service=${encodeURIComponent(service)}`)
      .then(r => r.json()).then(d => setTables(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [service])

  function toggle(tbl) {
    setSelected(prev => {
      const exists = prev.find(t => t.fqn === tbl.fqn)
      if (exists) return prev.filter(t => t.fqn !== tbl.fqn)
      if (prev.length >= 3) return prev
      return [...prev, tbl]
    })
  }

  const filtered = tables.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))

  if (loading) return <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton-shimmer h-8 rounded" />)}</div>

  return (
    <div className="animate-fade-in">
      <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filter tables…"
        className="w-full mb-2 px-3 py-1.5 text-xs bg-[#1a1a1a] border border-[#333] rounded-lg
                   text-white placeholder-gray-600 outline-none focus:border-[#2563eb]" />
      <div className="max-h-[200px] overflow-y-auto chat-scroll space-y-0.5">
        {filtered.map(t => (
          <label key={t.fqn}
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs
                        hover:bg-[#1a1a1a] transition-colors ${
                          selected.find(s => s.fqn === t.fqn) ? 'bg-[#1e3a5f]' : ''
                        }`}>
            <input type="checkbox" checked={!!selected.find(s => s.fqn === t.fqn)}
              onChange={() => toggle(t)} className="accent-[#2563eb]" />
            <span className="text-white truncate flex-1">{t.name}</span>
            <span className="text-[10px] text-gray-500 shrink-0">{t.columnCount} cols</span>
            {t.hasPII && <span className="text-[10px] shrink-0">🔴</span>}
          </label>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 mt-1">{selected.length}/3 selected</p>
      <div className="flex gap-2 mt-2">
        <button onClick={onBack}
          className="text-xs text-gray-400 hover:text-white cursor-pointer transition-colors">← Back</button>
        <button onClick={() => onSelect(selected)} disabled={!selected.length}
          className="flex-1 text-xs py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8]
                     text-white font-medium cursor-pointer transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed">
          Next →
        </button>
      </div>
    </div>
  )
}

/* ─── Step 3: Column picker + Charts ─── */
function QualityCard({ tableFqn, tableName }) {
  const [qData, setQData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/explorer/quality?table=${encodeURIComponent(tableFqn)}`)
      .then(r => r.json()).then(setQData).catch(() => {})
      .finally(() => setLoading(false))
  }, [tableFqn])

  if (loading) return <div className="skeleton-shimmer h-24 rounded-lg" />

  if (!qData || qData.score === null) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-[10px] p-3.5">
        <div className="text-[11px] text-gray-500 mb-1">{tableName}</div>
        <div className="text-center py-3">
          <div className="text-gray-500 text-xs">No data quality tests configured</div>
          <div className="text-[10px] text-gray-600 mt-1">Run tests in OpenMetadata to see results</div>
        </div>
      </div>
    )
  }

  const scoreColor = qData.score >= 80 ? '#22c55e' : qData.score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-[10px] p-3.5">
      <div className="text-[11px] text-gray-500 mb-2">{tableName}</div>
      <div className="flex items-center gap-4">
        {/* Score circle */}
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#2a2a2a" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke={scoreColor} strokeWidth="3"
                    strokeDasharray={`${qData.score * 0.94} 100`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-white">{qData.score}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex gap-3 text-[11px] mb-2">
            <span className="text-green-400">✅ {qData.passed} Passed</span>
            <span className="text-red-400">❌ {qData.failed} Failed</span>
          </div>
          <div className="space-y-0.5">
            {qData.tests.slice(0, 3).map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-400 truncate">{t.name}</span>
                {t.column && <span className="text-gray-600 text-[10px] shrink-0">({t.column})</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const CHART_SECTION = "bg-[#1a1a1a] border border-[#333] rounded-[10px] p-3.5 mb-3"
const CHART_TITLE = "text-[11px] font-semibold text-[#9ca3af] uppercase tracking-[1px] mb-2.5"
const BAR_COLORS = ['#2563eb', '#22c55e', '#f59e0b']

function Step3({ tables, onBack, onSendMessage }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [showCharts, setShowCharts] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => {
    const params = tables.map(t => `tables=${encodeURIComponent(t.fqn)}`).join('&')
    fetch(`${API}/explorer/columns?${params}`)
      .then(r => r.json()).then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [tables])

  function toggleCol(tableFqn, colName) {
    const key = `${tableFqn}.${colName}`
    setSelected(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 10) return prev
      return [...prev, key]
    })
  }

  function getSelectedColumns() {
    const cols = []
    for (const tbl of data) {
      for (const col of tbl.columns) {
        if (selected.includes(`${tbl.tableFqn}.${col.name}`)) {
          cols.push({ ...col, tableName: tbl.tableName, tableFqn: tbl.tableFqn })
        }
      }
    }
    return cols
  }

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-20 rounded-lg" />)}</div>

  const selCols = getSelectedColumns()
  const piiCount = selCols.filter(c => c.isPII).length
  const cleanCount = selCols.length - piiCount

  const colsPerTable = {}
  selCols.forEach(c => { colsPerTable[c.tableName] = (colsPerTable[c.tableName] || 0) + 1 })
  const tableBarData = Object.entries(colsPerTable).map(([name, count]) => ({ name, count }))

  return (
    <div className="animate-fade-in">
      {/* Column picker */}
      <div className="max-h-[220px] overflow-y-auto chat-scroll space-y-2 mb-3">
        {data.map(tbl => (
          <div key={tbl.tableFqn}>
            <button onClick={() => setCollapsed(p => ({ ...p, [tbl.tableFqn]: !p[tbl.tableFqn] }))}
              className="flex items-center gap-1 text-xs font-medium text-gray-300 mb-1 cursor-pointer hover:text-white">
              <span>{collapsed[tbl.tableFqn] ? '▶' : '▼'}</span>
              <span>📋 {tbl.tableName}</span>
              <span className="text-[10px] text-gray-600 ml-1">({tbl.columns.length} cols)</span>
            </button>
            {!collapsed[tbl.tableFqn] && (
              <div className="space-y-0.5 ml-3">
                {tbl.columns.map(col => {
                  const key = `${tbl.tableFqn}.${col.name}`
                  const typeColor = TYPE_COLORS[col.dataType] || '#555'
                  return (
                    <label key={key}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer text-[11px]
                                 hover:bg-[#1a1a1a] transition-colors">
                      <input type="checkbox" checked={selected.includes(key)}
                        onChange={() => toggleCol(tbl.tableFqn, col.name)} className="accent-[#2563eb]" />
                      <span className="text-white truncate">{col.name}</span>
                      <span className="px-1 py-0 rounded text-[10px] font-mono shrink-0"
                            style={{ background: typeColor + '22', color: typeColor }}>
                        {col.dataType}
                      </span>
                      {col.isPII && <span className="text-[10px] shrink-0">🔴</span>}
                      {col.isPrimaryKey && <span className="text-[10px] shrink-0">🔑</span>}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mb-2">{selected.length}/10 columns selected</p>

      <div className="flex gap-2 mb-3">
        <button onClick={onBack}
          className="text-xs text-gray-400 hover:text-white cursor-pointer transition-colors">← Back</button>
        <button onClick={() => setShowCharts(true)} disabled={!selected.length}
          className="flex-1 text-xs py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8]
                     text-white font-medium cursor-pointer transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed">
          📊 Generate Charts
        </button>
      </div>

      {/* Charts */}
      {showCharts && selCols.length > 0 && (
        <div className="space-y-3 animate-fade-in border-t border-[#333] pt-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#1a1a1a] rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{selCols.length}</div>
              <div className="text-[10px] text-gray-500">Columns</div>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{tableBarData.length}</div>
              <div className="text-[10px] text-gray-500">Tables</div>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{piiCount} 🔴</div>
              <div className="text-[10px] text-gray-500">PII</div>
            </div>
          </div>

          {/* Chart 1: Privacy & Sensitivity */}
          <div className={CHART_SECTION}>
            <h4 className={CHART_TITLE}>🔴 Privacy & Sensitivity</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg p-3 text-center"
                   style={{
                     background: piiCount > 0 ? '#2d1515' : '#1a1a1a',
                     border: `1px solid ${piiCount > 0 ? '#ef4444' : '#333'}`,
                   }}>
                <div className="text-2xl font-bold" style={{ color: piiCount > 0 ? '#ef4444' : '#666' }}>
                  {piiCount}
                </div>
                <div className="text-[10px] text-gray-400">Sensitive Columns</div>
              </div>
              <div className="rounded-lg p-3 text-center"
                   style={{ background: '#0f2a1a', border: '1px solid #22c55e' }}>
                <div className="text-2xl font-bold text-[#22c55e]">{cleanCount}</div>
                <div className="text-[10px] text-gray-400">Clean Columns</div>
              </div>
            </div>
            <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden flex">
              {piiCount > 0 && (
                <div className="h-full bg-[#ef4444] rounded-l-full"
                     style={{ width: `${(piiCount / selCols.length) * 100}%` }} />
              )}
              <div className="h-full bg-[#22c55e] flex-1 rounded-r-full" />
            </div>
            <div className="text-[10px] text-gray-500 mt-1.5 text-center">
              {piiCount > 0
                ? `${piiCount} of ${selCols.length} columns are sensitive`
                : '✅ No sensitive columns detected'}
            </div>
          </div>

          {/* Chart 2: Data Quality */}
          <div>
            <h4 className={`${CHART_TITLE} px-1`}>✅ Data Quality</h4>
            <div className="space-y-2">
              {tables.map(t => (
                <QualityCard key={t.fqn} tableFqn={t.fqn} tableName={t.name} />
              ))}
            </div>
          </div>

          {/* Chart 3: Table Comparison — only if 2-3 tables */}
          {tableBarData.length > 1 && (
            <div className={CHART_SECTION}>
              <h4 className={CHART_TITLE}>📊 Table Comparison</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tableBarData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false}
                         tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#222', border: '1px solid #444', borderRadius: 8, fontSize: 11 }}
                           formatter={(v, n) => [`${v} columns`, '']}
                           labelStyle={{ color: '#fff' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}
                       label={{ position: 'top', fill: '#aaa', fontSize: 11 }}>
                    {tableBarData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % 3]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Lineage shortcuts */}
          <div className="space-y-1.5">
            {tables.map(t => (
              <button key={t.fqn}
                onClick={() => onSendMessage(`What is the lineage of the table with FQN ${t.fqn}?`)}
                className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-[#333]
                           bg-[#1a1a1a] text-gray-300 hover:border-[#2563eb] hover:text-white
                           cursor-pointer transition-colors">
                🔗 Explore lineage of <span className="text-white font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Data Explorer ─── */
export default function DataExplorer({ onSendMessage }) {
  const [expanded, setExpanded] = useState(true)
  const [step, setStep] = useState(1)
  const [selectedDb, setSelectedDb] = useState(null)
  const [selectedTables, setSelectedTables] = useState([])

  function handleDbSelect(name) {
    setSelectedDb(name)
    setStep(2)
  }

  function handleTableSelect(tables) {
    setSelectedTables(tables)
    setStep(3)
  }

  function goToStep(s) {
    setStep(s)
    if (s <= 1) { setSelectedDb(null); setSelectedTables([]) }
    if (s <= 2) { setSelectedTables([]) }
  }

  return (
    <div className="border-b border-[#333] pb-4 mb-4">
      <button onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 w-full text-left mb-3 cursor-pointer group">
        <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
          {expanded ? '▼' : '▶'}
        </span>
        <span className="text-sm font-semibold text-white">🔍 Data Explorer</span>
      </button>

      {expanded && (
        <div className="animate-fade-in">
          <StepDots current={step} />
          <Breadcrumb db={selectedDb} tables={selectedTables} step={step} onGoTo={goToStep} />

          {step === 1 && <Step1 onSelect={handleDbSelect} />}
          {step === 2 && selectedDb && (
            <Step2 service={selectedDb} onSelect={handleTableSelect} onBack={() => goToStep(1)} />
          )}
          {step === 3 && selectedTables.length > 0 && (
            <Step3 tables={selectedTables} onBack={() => goToStep(2)} onSendMessage={onSendMessage} />
          )}
        </div>
      )}
    </div>
  )
}
