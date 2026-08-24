'use client'
import { useState } from 'react'
import { HelpCircle, Check, Sparkles, Loader2, Wallet, Target, ShoppingBag, Calendar, Ticket } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function AnalyticsClient({ projectId, initialStats, initialChartData, initialOutcomes, initialGaps }) {
  const [stats, setStats]       = useState(initialStats || null)
  const [chartData, setChartData] = useState(initialChartData || [])
  const [outcomes, setOutcomes] = useState(initialOutcomes || null)

  // ── Unanswered questions ──────────────────────────────────
  const [gaps, setGaps]           = useState(initialGaps || [])
  const [gapsLoading, setGapsLoading] = useState(false)
  const [gapsTab, setGapsTab]     = useState('unresolved') // unresolved | resolved
  const [expandedKey, setExpandedKey] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [savingKey, setSavingKey] = useState(null)

  const fetchGaps = async () => {
    setGapsLoading(true)
    const res = await fetch(`/api/analytics/unanswered-questions?project_id=${projectId}`)
    if (res.ok) {
      const data = await res.json()
      setGaps(data.groups || [])
    }
    setGapsLoading(false)
  }

  const markResolved = async (question) => {
    setSavingKey(question)
    try {
      await fetch('/api/analytics/unanswered-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, question }),
      })
      await fetchGaps()
    } finally {
      setSavingKey(null)
    }
  }

  const saveAnswer = async (question) => {
    if (!answerText.trim()) return
    setSavingKey(question)
    try {
      const res = await fetch('/api/analytics/unanswered-questions/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, question, answer: answerText.trim() }),
      })
      if (res.ok) {
        setExpandedKey(null)
        setAnswerText('')
        await fetchGaps()
      }
    } finally {
      setSavingKey(null)
    }
  }

  const formatRelative = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const days = Math.floor(diff / 86400000)
    if (days <= 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30) return `${days}d ago`
    return new Date(ts).toLocaleDateString()
  }

  if (!stats) return (
    <div className="p-6 text-sm text-muted-foreground">No data yet. Start receiving WhatsApp messages to see analytics.</div>
  )

  const unresolvedGaps = gaps.filter(g => !g.resolved)
  const resolvedGaps = gaps.filter(g => g.resolved)
  const visibleGaps = gapsTab === 'unresolved' ? unresolvedGaps : resolvedGaps

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>

      {/* Business Outcomes — top billing, since these are the numbers a
          merchant can actually act on (revenue, conversion), unlike raw
          activity counts below. */}
      {outcomes && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Business Outcomes</h3>
            <span className="text-xs text-muted-foreground">Last {outcomes.window_days} days · estimate</span>
          </div>

          {/* Primary pair */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-emerald-50 border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Revenue (paid orders)</p>
                <Wallet size={16} className="text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-emerald-700">
                {outcomes.currency}{Number(outcomes.revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-teal-50 border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Est. conversion rate</p>
                <Target size={16} className="text-teal-500" />
              </div>
              <p className="text-3xl font-bold text-teal-700">
                {outcomes.conversion_rate == null ? "—" : `${(outcomes.conversion_rate * 100).toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* Secondary trio */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-sky-50 border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Orders</p>
                <ShoppingBag size={16} className="text-sky-500" />
              </div>
              <p className="text-2xl font-bold text-sky-700">{outcomes.order_count.toLocaleString()}</p>
              {outcomes.order_count > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Avg {outcomes.currency}{(outcomes.revenue / outcomes.order_count).toFixed(2)}
                </p>
              )}
            </div>
            <div className="bg-violet-50 border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Appointments booked</p>
                <Calendar size={16} className="text-violet-500" />
              </div>
              <p className="text-2xl font-bold text-violet-700">{outcomes.appointment_count.toLocaleString()}</p>
            </div>
            <div className="bg-rose-50 border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Event sign-ups</p>
                <Ticket size={16} className="text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-700">{outcomes.registration_count.toLocaleString()}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Estimate = (orders + appointments + sign-ups) ÷ conversations in the last {outcomes.window_days} days.
            Orders, bookings, and sign-ups aren't linked to a specific conversation, so this is a rough
            aggregate — not an exact per-chat funnel.
          </p>
        </div>
      )}

      {/* Legacy activity counters — demoted to a slim inline strip rather
          than their own bordered cards, so the card treatment is reserved
          for the outcomes above. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
        <span><strong className="text-foreground">{(stats.total_conversations || 0).toLocaleString()}</strong> conversations</span>
        <span><strong className="text-foreground">{(stats.total_messages || 0).toLocaleString()}</strong> messages</span>
        <span><strong className="text-foreground">{(stats.user_messages || 0).toLocaleString()}</strong> from users</span>
        <span><strong className="text-foreground">{(stats.bot_messages || 0).toLocaleString()}</strong> bot replies</span>
        <span><strong className="text-foreground">{(stats.handoffs || 0).toLocaleString()}</strong> handoffs*</span>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-4">*Detected from bot flow triggers/keywords — may undercount handoffs the bot's flow doesn't tag.</p>

      {/* Messages per day chart */}
      {chartData.length > 0 && (
        <div className="border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-4">Messages per day (last 14 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => {
                const date = new Date(d)
                return `${date.getMonth()+1}/${date.getDate()}`
              }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={d => new Date(d).toLocaleDateString()}
                formatter={(val, name) => [val, name === 'user' ? 'User' : 'Bot']}
              />
              <Bar dataKey="user" fill="#3b82f6" radius={[3,3,0,0]} name="user" />
              <Bar dataKey="bot" fill="#8b5cf6" radius={[3,3,0,0]} name="bot" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> User messages
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" /> Bot replies
            </span>
          </div>
        </div>
      )}

      {/* Empty state for chart */}
      {chartData.length === 0 && (
        <div className="border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No message data yet for the chart.
        </div>
      )}

      {/* ── Unanswered Questions ── */}
      <div className="border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold">Unanswered Questions</h3>
            {unresolvedGaps.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {unresolvedGaps.length}
              </span>
            )}
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {['unresolved', 'resolved'].map(t => (
              <button key={t} onClick={() => setGapsTab(t)}
                className={`text-xs px-3 py-1 rounded-md font-medium capitalize transition-colors ${
                  gapsTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t} {t === 'unresolved' ? `(${unresolvedGaps.length})` : `(${resolvedGaps.length})`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground px-4 pt-3">
          Questions your bot couldn't find an answer for — add an answer to train it, or dismiss if it's not worth documenting.
        </p>

        <div className="p-4 space-y-2">
          {gapsLoading ? (
            <div className="text-center text-sm text-muted-foreground py-6">Loading...</div>
          ) : visibleGaps.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              {gapsTab === 'unresolved'
                ? (gaps.length === 0 ? 'No unanswered questions yet — nice!' : 'Nothing unresolved right now 🎉')
                : 'Nothing marked resolved yet.'}
            </div>
          ) : (
            visibleGaps.map(g => (
              <div key={g.key} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{g.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Asked {g.count} time{g.count > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">Last asked {formatRelative(g.last_asked_at)}</span>
                    </div>
                  </div>
                  {gapsTab === 'unresolved' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setExpandedKey(expandedKey === g.key ? null : g.key); setAnswerText('') }}
                        className="text-xs border border-indigo-200 text-indigo-600 bg-indigo-50 rounded-lg px-2.5 py-1.5 hover:bg-indigo-100 flex items-center gap-1 font-medium">
                        <Sparkles size={11} /> Answer &amp; train bot
                      </button>
                      <button
                        onClick={() => markResolved(g.question)}
                        disabled={savingKey === g.question}
                        className="text-xs border rounded-lg px-2.5 py-1.5 hover:bg-muted flex items-center gap-1 text-gray-600 disabled:opacity-50">
                        {savingKey === g.question ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Mark resolved
                      </button>
                    </div>
                  )}
                  {gapsTab === 'resolved' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1">
                      <Check size={11} /> Resolved
                    </span>
                  )}
                </div>

                {expandedKey === g.key && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <textarea
                      autoFocus
                      rows={3}
                      placeholder="Type the answer — this gets added to your knowledge base so the bot can answer this next time."
                      value={answerText}
                      onChange={e => setAnswerText(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveAnswer(g.question)}
                        disabled={!answerText.trim() || savingKey === g.question}
                        className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 font-medium">
                        {savingKey === g.question ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {savingKey === g.question ? 'Training...' : 'Save & train bot'}
                      </button>
                      <button
                        onClick={() => { setExpandedKey(null); setAnswerText('') }}
                        className="text-xs border rounded-lg px-3 py-1.5 hover:bg-muted">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
