'use client'
import { useEffect, useState } from 'react'
import { UserPlus, Crown, Shield, Headset, Trash2, Loader2, Clock, SlidersHorizontal } from 'lucide-react'

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', agent: 'Agent' }
const ROLE_ICONS = { owner: Crown, admin: Shield, agent: Headset }
const ROLE_COLORS = {
  owner: 'bg-amber-50 text-amber-700 border-amber-200',
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  agent: 'bg-gray-50 text-gray-600 border-gray-200',
}

// Extra tabs an owner/admin can grant to an individual agent, beyond the
// Conversations + Leads default. Team management is never grantable this
// way — kept in sync with GRANTABLE_PERMISSIONS in the team/[memberId] API route.
const PERMISSION_LABELS = {
  documents: 'Documents',
  integrations: 'Integrations',
  flows: 'Flows',
  analytics: 'Analytics',
  api: 'API',
  campaigns: 'Campaigns',
  templates: 'Templates',
  shop: 'Shop',
  appointments: 'Appointments',
  events: 'Events',
}

export default function TeamTab({ project }) {
  const projectId = project?.id || project
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('agent')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [permissionsOpenFor, setPermissionsOpenFor] = useState(null)
  const [savingPermissionsFor, setSavingPermissionsFor] = useState(null)

  const fetchTeam = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/team?projectId=${projectId}`)
      if (res.ok) setData(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { if (projectId) fetchTeam() }, [projectId])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email: inviteEmail.trim(), role: inviteRole }),
      })
      const result = await res.json()
      if (!res.ok) { setError(result.error || 'Failed to invite'); return }
      setInviteEmail('')
      await fetchTeam()
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (memberId, role) => {
    await fetch(`/api/team/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await fetchTeam()
  }

  const handlePermissionToggle = async (member, key) => {
    const current = member.permissions || []
    const next = current.includes(key) ? current.filter(p => p !== key) : [...current, key]
    setSavingPermissionsFor(member.id)
    try {
      await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: next }),
      })
      await fetchTeam()
    } finally {
      setSavingPermissionsFor(null)
    }
  }

  const handleRemove = async (memberId) => {
    if (!confirm('Remove this teammate from the project?')) return
    setRemovingId(memberId)
    try {
      await fetch(`/api/team/${memberId}`, { method: 'DELETE' })
      await fetchTeam()
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading team...</div>
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Could not load team.</div>

  const canManage = data.myRole === 'owner' || data.myRole === 'admin'
  const seats = data.seats || { used: 1, limit: 1 }
  const atSeatLimit = seats.limit !== null && seats.used >= seats.limit

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground">Who has access to this project, and what they can do.</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full border bg-gray-50 text-gray-600 whitespace-nowrap">
          {seats.limit === null ? `${seats.used} seat${seats.used === 1 ? '' : 's'} used` : `${seats.used} / ${seats.limit} seats used`}
        </span>
      </div>

      {/* Members list */}
      <div className="border rounded-xl divide-y bg-white overflow-hidden">
        {/* Owner row — not a project_members row, always shown, never editable */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Crown size={14} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{data.owner?.name || data.owner?.email || 'Owner'}</p>
              {data.owner?.name && <p className="text-xs text-gray-400 truncate">{data.owner.email}</p>}
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-amber-50 text-amber-700 border-amber-200">
            Owner
          </span>
        </div>

        {data.members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No teammates yet — invite one below.
          </div>
        ) : (
          data.members.map(m => {
            const Icon = ROLE_ICONS[m.role]
            const permissionsExpanded = permissionsOpenFor === m.id
            return (
              <div key={m.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${ROLE_COLORS[m.role]}`}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.email}</p>
                      {m.status === 'pending' && (
                        <p className="text-xs text-amber-600 flex items-center gap-1"><Clock size={10} /> Pending</p>
                      )}
                      {m.role === 'agent' && (m.permissions || []).length > 0 && (
                        <p className="text-xs text-indigo-600 truncate">
                          +{m.permissions.length} extra tab{m.permissions.length === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && m.role === 'agent' && (
                      <button
                        onClick={() => setPermissionsOpenFor(permissionsExpanded ? null : m.id)}
                        title="Custom permissions"
                        className={`p-1.5 rounded-lg hover:bg-gray-100 ${permissionsExpanded ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}
                      >
                        <SlidersHorizontal size={13} />
                      </button>
                    )}
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.id, e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[m.role]}`}>
                        {ROLE_LABELS[m.role]}
                      </span>
                    )}
                    {canManage && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={removingId === m.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        {removingId === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>
                {permissionsExpanded && (
                  <div className="px-4 pb-3 -mt-1 bg-gray-50/50">
                    <p className="text-xs text-muted-foreground mb-2">
                      Extra tabs this agent can see, beyond Conversations and Leads:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={(m.permissions || []).includes(key)}
                            disabled={savingPermissionsFor === m.id}
                            onChange={() => handlePermissionToggle(m, key)}
                            className="accent-indigo-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Invite form — owner/admin only */}
      {canManage && (
        <div className="border rounded-xl p-5 space-y-3 bg-white">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus size={14} /> Invite a teammate
          </h3>
          {atSeatLimit ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              You've used all {seats.limit} seat{seats.limit === 1 ? '' : 's'} on your current plan. Upgrade your plan to invite more teammates.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              They need an existing Zavo account — ask them to sign up first if they don't have one yet.
            </p>
          )}
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              disabled={atSeatLimit}
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:bg-gray-50"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              disabled={atSeatLimit}
              className="border rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim() || atSeatLimit}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              {inviting ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
              Invite
            </button>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
            <p><strong>Admin</strong> — everything except billing and deleting the project.</p>
            <p><strong>Agent</strong> — Conversations and Leads only.</p>
          </div>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-muted-foreground">Only the owner or an admin can manage team members.</p>
      )}
    </div>
  )
}