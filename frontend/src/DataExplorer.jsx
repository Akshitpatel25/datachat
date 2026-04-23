import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'

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

  // Chart data
  const typeCounts = {}
  selCols.forEach(c => { typeCounts[c.dataType] = (typeCounts[c.dataType] || 0) + 1 })
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }))

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
        <div className="space-y-4 animate-fade-in border-t border-[#333] pt-3">
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

          {/* Data type donut */}
          {typeData.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Data Types</h4>
              <div className="flex justify-center">
                <PieChart width={160} height={160}>
                  <Pie data={typeData} dataKey="value" nameKey="name"
                       cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {typeData.map((d, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name} <span className="text-white">{d.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* PII analysis */}
          {piiCount > 0 && (
            <div className="bg-[#1a1111] border border-[#3a2020] rounded-lg p-3">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">PII Analysis</h4>
              <div className="flex items-center gap-4 text-xs mb-2">
                <span>🔴 {piiCount} PII</span>
                <span>🟢 {cleanCount} Clean</span>
              </div>
              <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full"
                     style={{ width: `${(piiCount / selCols.length) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Columns per table bar */}
          {tableBarData.length > 1 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Columns per Table</h4>
              <ResponsiveContainer width="100%" height={Math.max(80, tableBarData.length * 40)}>
                <BarChart data={tableBarData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }}
                         width={80} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}
                       label={{ position: 'right', fill: '#aaa', fontSize: 10 }}>
                    {tableBarData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % 3]} />)}
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
