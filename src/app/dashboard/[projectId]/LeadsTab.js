'use client'
import { useEffect, useState } from 'react'

export default function LeadsTab({ project }) {
  const projectId = project?.id || project
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/leads?projectId=${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setLeads(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        console.error('LeadsTab error:', err)
        setError('Failed to load leads.')
        setLoading(false)
      })
  }, [projectId])

  const exportCSV = () => {
    const header = 'Name,Email,Phone,Date\n'
    const rows = leads.map(l =>
      `"${l.name}","${l.email}","${l.phone}","${new Date(l.created_at).toLocaleDateString()}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
  }

  if (loading) return (
    <div className="p-6 text-sm text-muted-foreground">Loading leads...</div>
  )

  if (error) return (
    <div className="p-6 text-sm text-red-500">{error}</div>
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Leads</h2>
          <p className="text-sm text-muted-foreground">{leads.length} captured</p>
        </div>
        {leads.length > 0 && (
          <button
            onClick={exportCSV}
            className="text-sm border rounded px-3 py-1.5 hover:bg-muted"
          >
            Export CSV
          </button>
        )}
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No leads yet. Enable lead capture in Settings.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => (
                <tr key={lead.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                  <td className="px-4 py-3">{lead.name}</td>
                  <td className="px-4 py-3">{lead.email}</td>
                  <td className="px-4 py-3">{lead.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}