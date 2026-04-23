import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import DataExplorer from './DataExplorer.jsx'
import './App.css'

const API = 'http://localhost:8000'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
      <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
      <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
    </div>
  )
}

function MessageBubble({ message, suggestions, onSuggestionClick }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      {!isUser && <span className="text-xs text-muted mb-1 ml-1">🗄️ DataChat</span>}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser ? 'bg-bubble-user text-white rounded-br-md'
               : 'bg-bubble-assistant border border-border text-gray-100 rounded-bl-md'
      }`}>
        {isUser
          ? <p className="whitespace-pre-wrap">{message.content}</p>
          : <div className="markdown-body"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        }
      </div>
      <span className="text-[10px] text-muted mt-1 mx-1">{formatTime(message.timestamp)}</span>
      {!isUser && suggestions && suggestions.length > 0 && (
        <div className="mt-2 ml-1">
          <span className="text-[10px] text-muted">💡 Try asking:</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => onSuggestionClick(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-[#444]
                           bg-[#2a2a2a] text-[#aaa] hover:bg-[#333] hover:text-white
                           transition-colors cursor-pointer">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SampleChips({ questions, onSelect }) {
  if (!questions.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3 mb-2 px-1">
      {questions.map((q, i) => (
        <button key={i} onClick={() => onSelect(q)}
          className="text-xs px-3 py-1.5 rounded-full border border-border
                     bg-surface text-gray-300 hover:bg-border hover:text-white
                     transition-colors cursor-pointer">
          {q}
        </button>
      ))}
    </div>
  )
}

function StatsBadge({ icon, count, label }) {
  if (!count && count !== 0) return null
  return (
    <span className="text-[11px] text-gray-400 flex items-center gap-1">
      <span>{icon}</span>
      <span className="text-white font-medium">{count}</span>
      <span>{label}</span>
    </span>
  )
}

/* ─── Skeleton shimmer for loading ─── */
function Skeleton({ className = '' }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />
}

/* ─── Animated count-up hook ─── */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) { setValue(0); return }
    let start = 0
    const step = Math.max(1, Math.ceil(target / (duration / 20)))
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(start)
    }, 20)
    return () => clearInterval(timer)
  }, [target, duration])
  return value
}

function StatCard({ icon, count, label, color }) {
  const animated = useCountUp(count)
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-3 flex items-center gap-3"
         style={{ borderLeft: `3px solid ${color}` }}>
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xl font-bold text-white">{animated}</div>
        <div className="text-[11px] text-gray-400">{label}</div>
      </div>
    </div>
  )
}

/* ─── Custom donut tooltip ─── */
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-[#222] border border-[#444] rounded-lg px-3 py-2 text-xs text-white">
      <span style={{ color: d.payload.color }}>●</span> {d.name}: <b>{d.value}</b>
    </div>
  )
}

function TagPill({ tag, count }) {
  let bg = '#555'
  if (tag.includes('Sensitive') && !tag.includes('Non')) bg = '#ef4444'
  else if (tag.includes('NonSensitive')) bg = '#f59e0b'
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs px-2.5 py-0.5 rounded-full text-white" style={{ background: bg }}>
        {tag}
      </span>
      <span className="text-xs text-gray-400 font-medium">{count}</span>
    </div>
  )
}

/* ─── Analytics Panel ─── */
function AnalyticsPanel({ onSendMessage }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [panelWidth, setPanelWidth] = useState(380)
  const isDragging = useRef(false)
  const panelRef = useRef(null)

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/analytics`)
      setData(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  // Drag-to-resize logic
  useEffect(() => {
    function onMouseMove(e) {
      if (!isDragging.current) return
      const newWidth = window.innerWidth - e.clientX
      const minW = 320
      const maxW = Math.floor(window.innerWidth * 0.5)
      setPanelWidth(Math.max(minW, Math.min(maxW, newWidth)))
    }
    function onMouseUp() { isDragging.current = false; document.body.style.cursor = '' ; document.body.style.userSelect = '' }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [])

  function startDrag(e) {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const barHeight = data?.tables_by_service?.length
    ? Math.max(160, data.tables_by_service.length * 40)
    : 160

  return (
    <div ref={panelRef} className="shrink-0 bg-[#111] border-l border-border flex h-full analytics-panel-enter"
         style={{ width: panelWidth }}>
      {/* Drag handle */}
      <div onMouseDown={startDrag}
           className="w-1.5 cursor-col-resize hover:bg-[#2563eb]/40 transition-colors shrink-0
                      flex items-center justify-center group"
           title="Drag to resize">
        <div className="w-0.5 h-8 bg-[#444] rounded-full group-hover:bg-[#2563eb] transition-colors" />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="font-semibold text-sm text-white">📊 Data Overview</span>
        <button onClick={fetchData}
          className="text-xs text-gray-400 hover:text-white cursor-pointer transition-colors"
          title="Refresh">🔄</button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-5">
        {/* Data Explorer */}
        <DataExplorer onSendMessage={onSendMessage} />

        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" />
              <Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" />
            </div>
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[100px]" />
          </>
        ) : data ? (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="🗄️" count={data.totals.tables} label="Tables" color="#2563eb" />
              <StatCard icon="📈" count={data.totals.dashboards} label="Dashboards" color="#22c55e" />
              <StatCard icon="⚙️" count={data.totals.pipelines} label="Pipelines" color="#f59e0b" />
              <StatCard icon="🌊" count={data.totals.topics} label="Topics" color="#8b5cf6" />
            </div>

            {/* Donut Chart */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Asset Distribution</h3>
              <div className="flex items-center justify-center">
                <PieChart width={200} height={200}>
                  <Pie data={data.asset_distribution} dataKey="value" nameKey="name"
                       cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {data.asset_distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {data.asset_distribution.map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />
                    {d.name} <span className="text-white font-medium">{d.value}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Bar Chart */}
            {data.tables_by_service.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tables by Service</h3>
                <ResponsiveContainer width="100%" height={barHeight}>
                  <BarChart data={data.tables_by_service} layout="vertical"
                            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} />
                    <YAxis type="category" dataKey="service" tick={{ fill: '#aaa', fontSize: 11 }}
                           width={100} axisLine={false} tickLine={false} />
                    <Bar dataKey="tables" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={20}
                         label={{ position: 'right', fill: '#aaa', fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tags */}
            {data.top_tags.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Classifications</h3>
                <div className="space-y-1">
                  {data.top_tags.map((t, i) => (
                    <TagPill key={i} tag={t.tag} count={t.count} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">Failed to load analytics</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-[10px] text-gray-500 shrink-0">
        Live from OpenMetadata • Updated just now
      </div>
      </div>
    </div>
  )
}

/* ─── Main App ─── */
export default function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [sampleQuestions, setSampleQuestions] = useState([])
  const [conversationId] = useState(() => crypto.randomUUID())
  const [initialized, setInitialized] = useState(false)
  const [chipsVisible, setChipsVisible] = useState(true)
  const [stats, setStats] = useState(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API}/health`)
        const data = await res.json()
        if (data.status === 'ok') {
          setIsConnected(true)
          if (data.stats) setStats(data.stats)
          setMessages([{
            id: crypto.randomUUID(), role: 'assistant',
            content: '👋 Hello! I\'m DataChat, your AI-powered data catalog assistant.\n\n' +
              'I can help you discover tables, understand data lineage, find PII data, ' +
              'and explore your organization\'s data assets. What would you like to know?',
            timestamp: Date.now(),
          }])
        }
      } catch {
        setIsConnected(false)
        setMessages([{
          id: crypto.randomUUID(), role: 'assistant',
          content: '❌ Could not connect to the DataChat backend. Make sure the server is running at ' + API,
          timestamp: Date.now(),
        }])
      }
      try {
        const res = await fetch(`${API}/sample-questions`)
        const data = await res.json()
        setSampleQuestions(Array.isArray(data) ? data : [])
      } catch { /* ignore */ }
      setInitialized(true)
    }
    init()
  }, [])

  async function sendMessage(text) {
    const msg = text.trim()
    if (!msg || isLoading) return
    setChipsVisible(false)
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), role: 'user', content: msg, timestamp: Date.now(),
    }])
    setInputValue('')
    setIsLoading(true)
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversation_id: conversationId }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', content: data.response,
        timestamp: Date.now(), suggestions: data.suggestions || [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: '❌ Failed to get a response. Please check that the backend is running.',
        timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue) }
  }

  if (!initialized) {
    return (
      <div className="h-screen bg-bg flex items-center justify-center">
        <div className="text-center animate-pulse-slow">
          <div className="text-5xl mb-4">🗄️</div>
          <p className="text-gray-400 text-sm">Connecting to DataChat…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-bg flex flex-col text-white font-[system-ui,'Inter',sans-serif]">
      {/* ── Navbar ── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-chat shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗄️</span>
            <span className="font-semibold text-base tracking-tight">DataChat</span>
          </div>
          {stats && (
            <div className="hidden sm:flex items-center gap-3 ml-2 pl-3 border-l border-border">
              <StatsBadge icon="📊" count={stats.tables} label="Tables" />
              <StatsBadge icon="📈" count={stats.dashboards} label="Dashboards" />
              <StatsBadge icon="⚙️" count={stats.pipelines} label="Pipelines" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAnalytics(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface
                       text-gray-300 hover:bg-border hover:text-white transition-colors cursor-pointer">
            {showAnalytics ? '📊 Hide' : '📊 Analytics'}
          </button>
          <span className="text-xs text-muted hidden sm:inline">Powered by OpenMetadata</span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent' : 'bg-red-500'}`} />
            <span className={isConnected ? 'text-accent' : 'text-red-400'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </span>
        </div>
      </header>

      {/* ── Body: Chat + Analytics ── */}
      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 overflow-y-auto chat-scroll px-4 py-6 bg-bg">
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <MessageBubble key={msg.id} message={msg}
                  suggestions={idx === messages.length - 1 && msg.role === 'assistant' ? msg.suggestions : undefined}
                  onSuggestionClick={sendMessage} />
              ))}
              {chipsVisible && messages.length === 1 && messages[0].role === 'assistant' && (
                <div className="ml-1"><SampleChips questions={sampleQuestions} onSelect={sendMessage} /></div>
              )}
              {isLoading && (
                <div className="flex flex-col items-start mb-4">
                  <span className="text-xs text-muted mb-1 ml-1">🗄️ DataChat</span>
                  <div className="bg-bubble-assistant border border-border rounded-2xl rounded-bl-md px-4 py-3">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </main>
          <footer className="border-t border-border bg-chat px-4 py-3 shrink-0">
            <div className="max-w-3xl mx-auto flex gap-2">
              <input ref={inputRef} type="text" value={inputValue}
                onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                disabled={isLoading} placeholder="Ask about your data…"
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm
                           text-white placeholder-muted outline-none
                           focus:border-bubble-user focus:ring-1 focus:ring-bubble-user/40
                           disabled:opacity-50 transition-colors" />
              <button onClick={() => sendMessage(inputValue)}
                disabled={isLoading || !inputValue.trim()}
                className="bg-bubble-user hover:bg-blue-600 disabled:opacity-40
                           text-white rounded-xl px-4 py-2.5 text-sm font-medium
                           transition-colors cursor-pointer disabled:cursor-not-allowed">
                →
              </button>
            </div>
          </footer>
        </div>

        {/* Analytics panel */}
        {showAnalytics && <AnalyticsPanel onSendMessage={sendMessage} />}
      </div>
    </div>
  )
}
