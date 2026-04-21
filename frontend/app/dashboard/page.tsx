'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  FiUsers, FiUserCheck, FiMail, FiMessageSquare, FiRefreshCw,
  FiHome, FiSearch, FiChevronDown, FiChevronUp,
  FiPhone, FiMapPin, FiCalendar, FiAlertCircle, FiArrowUp
} from 'react-icons/fi'
import { RiNurseLine } from 'react-icons/ri'
import { motion, AnimatePresence } from 'motion/react'

interface Stats {
  total_sessions: number
  total_leads: number
  qualified_leads: number
  emails_sent: number
  today_sessions: number
  today_leads: number
  trend: { day: string; count: number }[]
}
interface Lead {
  lead_id: string; session_id: string; name: string; email: string; phone: string
  care_need: string; care_type: string; location: string; age: string
  conditions: string; insurance: string; budget: string; notes: string
  status: string; email_sent: boolean; created_at: string; updated_at: string
  living_arrangement?: string
}

const STATUS_OPTIONS = ['New', 'Contacted', 'Qualified', 'Converted', 'Not Interested']
const STATUS_STYLES: Record<string, string> = {
  'New':            'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Contacted':      'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Qualified':      'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Converted':      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Not Interested': 'bg-white/5 text-white/30 border-white/10',
}
const STATUS_BAR: Record<string, string> = {
  'New': 'bg-blue-500', 'Contacted': 'bg-amber-500',
  'Qualified': 'bg-violet-500', 'Converted': 'bg-emerald-500', 'Not Interested': 'bg-white/20',
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

function AnimatedNumber({ value, loading }: { value: number | undefined; loading: boolean }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (loading || value === undefined) return
    const start = display
    const end = value
    if (start === end) return
    const steps = 30
    const inc = (end - start) / steps
    let step = 0
    const id = setInterval(() => {
      step++
      setDisplay(Math.round(start + inc * step))
      if (step >= steps) { setDisplay(end); clearInterval(id) }
    }, 20)
    return () => clearInterval(id)
  }, [value, loading])
  if (loading) return <span className="text-white/20">—</span>
  return <>{display.toLocaleString()}</>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    setError(null)
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`${BACKEND}/dashboard/stats`),
        fetch(`${BACKEND}/dashboard/leads?limit=200${filter ? `&status=${filter}` : ''}`),
      ])
      if (!sRes.ok) throw new Error(`Stats API error: ${sRes.status}`)
      if (!lRes.ok) throw new Error(`Leads API error: ${lRes.status}`)
      const s = await sRes.json()
      const l = await lRes.json()
      setStats(s)
      setLeads(l.leads || [])
      setLastRefresh(new Date().toLocaleTimeString())
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to connect to backend'
      setError(msg)
    }
    finally { setLoading(false); setRefreshing(false) }
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const id = setInterval(() => fetchData(), 30000); return () => clearInterval(id) }, [fetchData])

  const updateStatus = async (leadId: string, status: string) => {
    setUpdating(leadId)
    setUpdateError(null)
    try {
      const res = await fetch(`${BACKEND}/dashboard/leads/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, status }),
      })
      if (!res.ok) throw new Error(`Update failed: ${res.status}`)
      setLeads(prev => prev.map(l => l.lead_id === leadId ? { ...l, status } : l))
    } catch (e) {
      setUpdateError('Failed to update status — please try again')
      setTimeout(() => setUpdateError(null), 3000)
    } finally {
      setUpdating(null)
    }
  }

  const filtered = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) ||
      l.phone?.includes(q) || l.location?.toLowerCase().includes(q) || l.care_need?.toLowerCase().includes(q)
  })

  const maxTrend = Math.max(...(stats?.trend?.map(t => t.count) ?? [1]), 1)
  const conversionRate = stats && stats.total_leads > 0 ? Math.round((stats.qualified_leads / stats.total_leads) * 100) : 0

  const statCards = [
    { label: 'Total Sessions', value: stats?.total_sessions, change: `+${stats?.today_sessions ?? 0} today`, icon: <FiMessageSquare className="w-5 h-5" />, accent: 'from-blue-500/20 to-blue-600/5', iconBg: 'bg-blue-500/20 text-blue-400', border: 'border-blue-500/20' },
    { label: 'Total Leads', value: stats?.total_leads, change: `+${stats?.today_leads ?? 0} today`, icon: <FiUsers className="w-5 h-5" />, accent: 'from-violet-500/20 to-violet-600/5', iconBg: 'bg-violet-500/20 text-violet-400', border: 'border-violet-500/20' },
    { label: 'Qualified Leads', value: stats?.qualified_leads, change: `${conversionRate}% conversion`, icon: <FiUserCheck className="w-5 h-5" />, accent: 'from-emerald-500/20 to-emerald-600/5', iconBg: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/20' },
    { label: 'Emails Sent', value: stats?.emails_sent, change: 'Notifications fired', icon: <FiMail className="w-5 h-5" />, accent: 'from-orange-500/20 to-orange-600/5', iconBg: 'bg-orange-500/20 text-orange-400', border: 'border-orange-500/20' },
  ]

  return (
    <div className="min-h-screen bg-[#080f1a] font-sans text-white">

      {/* ── NAVBAR ── */}
      <nav className="bg-[#080f1a]/90 backdrop-blur-md border-b border-white/8 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">IS</span>
            </div>
            <span className="text-sm font-bold">InfoSenior<span className="text-blue-400">.care</span></span>
            <div className="h-4 w-px bg-white/15 mx-1" />
            <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">Live Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/25">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                {lastRefresh}
              </div>
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white px-3 py-2 rounded-lg hover:bg-white/8 transition-all disabled:opacity-40"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-white/30 hover:text-white px-3 py-2 rounded-lg hover:bg-white/8 transition-all">
              <FiHome className="w-3.5 h-3.5" /> Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">Failed to load dashboard</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchData(true)}
              className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-xl transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status update error toast */}
        {updateError && (
          <div className="fixed bottom-6 right-6 z-50 bg-red-500/90 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl">
            {updateError}
          </div>
        )}

        {/* ── HERO BANNER ── */}
        <div className="relative rounded-3xl overflow-hidden h-36 sm:h-44">
          <Image
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=1600&q=80"
            alt="Dashboard hero"
            fill className="object-cover object-center" unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080f1a]/95 via-[#0f172a]/80 to-transparent" />
          <div className="absolute inset-0 flex items-center px-8 sm:px-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-green-400 uppercase tracking-widest">Live</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Operations Dashboard</h1>
              <p className="text-sm text-white/50 mt-1">InfoSenior.care · Real-time lead intelligence</p>
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className={`relative rounded-2xl overflow-hidden border ${s.border} bg-[#0d1829] group cursor-default`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.accent}`} />
              <div className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{s.label}</p>
                  <div className={`w-9 h-9 ${s.iconBg} rounded-xl flex items-center justify-center`}>
                    {s.icon}
                  </div>
                </div>
                <p className="text-4xl font-bold text-white mb-2">
                  <AnimatedNumber value={s.value} loading={loading} />
                </p>
                <div className="flex items-center gap-1.5">
                  <FiArrowUp className="w-3 h-3 text-green-400" />
                  <p className="text-xs text-white/40">{s.change}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── CHART + PIPELINE ── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Bar chart */}
          <div className="lg:col-span-2 bg-[#0d1829] rounded-2xl border border-white/8 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-bold text-white">Lead Volume</p>
                <p className="text-xs text-white/30 mt-0.5">Last 7 days</p>
              </div>
              <span className="text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-lg">Daily</span>
            </div>

            {!stats?.trend?.length ? (
              <div className="flex items-center justify-center h-40 text-white/20 text-sm">No data yet</div>
            ) : (
              <div className="relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                  {[maxTrend, Math.round(maxTrend * 0.66), Math.round(maxTrend * 0.33), 0].map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-white/20 w-4 text-right shrink-0">{v}</span>
                      <div className="flex-1 border-t border-white/5" />
                    </div>
                  ))}
                </div>
                {/* Bars */}
                <div className="flex items-end gap-2 h-40 pl-8">
                  {stats.trend.map((t, i) => {
                    const pct = Math.max((t.count / maxTrend) * 100, 3)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                        <div className="relative w-full flex items-end" style={{ height: '120px' }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${pct}%` }}
                            transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                            className="w-full bg-gradient-to-t from-blue-700 to-blue-400 rounded-t-lg group-hover/bar:from-blue-600 group-hover/bar:to-blue-300 transition-colors"
                          />
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0d1829] border border-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {t.count} lead{t.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <p className="text-[10px] text-white/25">
                          {new Date(t.day).toLocaleDateString('en', { weekday: 'short' })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="bg-[#0d1829] rounded-2xl border border-white/8 p-6">
            <p className="text-sm font-bold text-white mb-1">Lead Pipeline</p>
            <p className="text-xs text-white/30 mb-6">By current status</p>
            <div className="space-y-4">
              {STATUS_OPTIONS.map(s => {
                const count = leads.filter(l => l.status === s).length
                const pct = leads.length > 0 ? (count / leads.length) * 100 : 0
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/50">{s}</span>
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full ${STATUS_BAR[s]} rounded-full`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── LEADS TABLE ── */}
        <div className="bg-[#0d1829] rounded-2xl border border-white/8 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <RiNurseLine className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">All Leads</p>
                <p className="text-xs text-white/30">{filtered.length} records</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/25" />
                <input
                  type="text" placeholder="Search leads..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-white/5 border border-white/8 text-white placeholder-white/25 text-xs rounded-xl pl-8 pr-4 py-2.5 outline-none focus:border-blue-500/50 transition-all w-52"
                />
              </div>
              <select
                value={filter} onChange={e => setFilter(e.target.value)}
                className="bg-white/5 border border-white/8 text-white/50 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="">All Status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Lead', 'Contact', 'Care Need', 'Location', 'Status', 'Notified', 'Date', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-white/25 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${50 + (j * 13) % 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <FiAlertCircle className="w-8 h-8 text-white/10 mx-auto mb-3" />
                      <p className="text-sm text-white/25">No leads found</p>
                    </td>
                  </tr>
                ) : filtered.map((lead, idx) => (
                  <>
                    <motion.tr
                      key={lead.lead_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => setExpandedLead(expandedLead === lead.lead_id ? null : lead.lead_id)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {lead.name ? lead.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white/90">{lead.name || <span className="text-white/25 italic font-normal text-xs">Anonymous</span>}</p>
                            <p className="text-[10px] text-white/25 font-mono">{lead.lead_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {lead.phone && <div className="flex items-center gap-1.5 text-xs text-white/60"><FiPhone className="w-3 h-3 text-white/25 shrink-0" />{lead.phone}</div>}
                          {lead.email && <div className="flex items-center gap-1.5 text-xs text-white/40"><FiMail className="w-3 h-3 text-white/25 shrink-0" />{lead.email}</div>}
                          {!lead.phone && !lead.email && <span className="text-xs text-white/20 italic">No contact</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-[180px]">
                        <p className="text-xs text-white/60 truncate">{lead.care_need || '—'}</p>
                        {lead.care_type && <span className="text-[10px] font-semibold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full mt-1 inline-block">{lead.care_type}</span>}
                      </td>
                      <td className="px-5 py-4">
                        {lead.location ? <div className="flex items-center gap-1.5 text-xs text-white/50"><FiMapPin className="w-3 h-3 text-white/25 shrink-0" />{lead.location}</div> : <span className="text-xs text-white/20">—</span>}
                        {lead.age && <p className="text-[10px] text-white/25 mt-0.5">Age {lead.age}</p>}
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={e => updateStatus(lead.lead_id, e.target.value)}
                          disabled={updating === lead.lead_id}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all ${STATUS_STYLES[lead.status] ?? 'bg-white/5 text-white/30 border-white/10'} ${updating === lead.lead_id ? 'opacity-40' : ''}`}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${lead.email_sent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/25'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${lead.email_sent ? 'bg-emerald-400' : 'bg-white/20'}`} />
                          {lead.email_sent ? 'Sent' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-white/30">
                          <FiCalendar className="w-3 h-3 shrink-0" />
                          <div>
                            <p>{new Date(lead.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                            <p className="text-[10px] text-white/20">{new Date(lead.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {expandedLead === lead.lead_id ? <FiChevronUp className="w-4 h-4 text-white/25" /> : <FiChevronDown className="w-4 h-4 text-white/25" />}
                      </td>
                    </motion.tr>

                    <AnimatePresence>
                      {expandedLead === lead.lead_id && (
                        <motion.tr
                          key={`${lead.lead_id}-exp`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-white/5 bg-white/[0.015]"
                        >
                          <td colSpan={8} className="px-6 py-5">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                              {[
                                ['Conditions', lead.conditions],
                                ['Insurance', lead.insurance],
                                ['Budget', lead.budget],
                                ['Living', lead.living_arrangement ?? ''],
                                ['Session', lead.session_id?.slice(0, 16) + '...'],
                                ['Notes', lead.notes],
                              ].map(([label, val]) => (
                                <div key={label}>
                                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">{label}</p>
                                  <p className="text-xs text-white/55 leading-relaxed">{val || <span className="text-white/20 italic">—</span>}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
