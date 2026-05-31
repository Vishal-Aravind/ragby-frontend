'use client'
import { useEffect, useState } from 'react'
import { MessageSquare, Users, Bot, GitBranch, PhoneCall, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function AnalyticsTab({ project }) {
  const projectId = project?.id || project
  const [stats, setStats]       = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!projectId) return
    fetchAnalytics()
  }, [projectId])

  const fetchAnalytics = async () => {
    setLoading(true)
    const res = await fetch(`/api/analytics?project_id=${projectId}`)
    if (res.ok) {
      const data = await res.json()
      setStats(data.stats)
      setChartData(data.chart)
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="p-6 text-sm text-muted-foreground">Loading analytics...</div>
  )

  if (!stats) return (
    <div className="p-6 text-sm text-muted-foreground">No data yet. Start receiving WhatsApp messages to see analytics.</div>
  )

  const statCards = [
    { label: "Total Conversations", value: stats.total_conversations, icon: Users, color: "blue" },
    { label: "Total Messages", value: stats.total_messages, icon: MessageSquare, color: "purple" },
    { label: "Bot Replies", value: stats.bot_messages, icon: Bot, color: "green" },
    { label: "User Messages", value: stats.user_messages, icon: TrendingUp, color: "orange" },
    { label: "Flow Triggers", value: stats.flow_triggers, icon: GitBranch, color: "indigo" },
    { label: "Handoffs", value: stats.handoffs, icon: PhoneCall, color: "red" },
  ]

  const colorMap = {
    blue:   { bg: "bg-blue-50",   text: "text-blue-700",   icon: "text-blue-500"   },
    purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-500" },
    green:  { bg: "bg-green-50",  text: "text-green-700",  icon: "text-green-500"  },
    orange: { bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-500" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "text-indigo-500" },
    red:    { bg: "bg-red-50",    text: "text-red-700",    icon: "text-red-500"    },
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const c = colorMap[card.color]
          const Icon = card.icon
          return (
            <div key={card.label} className={`${c.bg} border rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                <Icon size={16} className={c.icon} />
              </div>
              <p className={`text-2xl font-bold ${c.text}`}>{(card.value || 0).toLocaleString()}</p>
            </div>
          )
        })}
      </div>

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
    </div>
  )
}