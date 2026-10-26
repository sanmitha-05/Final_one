import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { getLocalComplaints } from '../../lib/mockStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const COLORS = ['#F59E0B', '#EC4899', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6']

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [complaints, setComplaints] = useState<any[]>([])

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true)
      try {
        if (!isSupabaseConfigured) {
          setComplaints(getLocalComplaints())
          setLoading(false)
          return
        }

        const { data } = await supabase.from('complaints').select('*')
        if (data) setComplaints(data)
      } catch (err) {
        console.error('Analytics load error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Calculate distributions
  const statusCounts: Record<string, number> = {}
  const problemCounts: Record<string, number> = {}

  let totalResolved = 0
  let communicatedCount = 0

  complaints.forEach((c) => {
    let key: string = c.status
    if (c.status === 'resolved') {
      totalResolved++
      if (c.communicated_to_customer) communicatedCount++
      key = c.is_escalated ? 'escalated_&_resolved' : 'resolved_(direct)'
    }
    statusCounts[key] = (statusCounts[key] || 0) + 1
    const p = c.incident_problem || 'Other'
    problemCounts[p] = (problemCounts[p] || 0) + 1
  })

  const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').toUpperCase(),
    value,
  }))

  const problemBarData = Object.entries(problemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([problem, count]) => ({
      problem: problem.length > 18 ? problem.slice(0, 18) + '...' : problem,
      count,
    }))

  const total = complaints.length
  const resolutionRate = total > 0 ? Math.round((totalResolved / total) * 100) : 0
  const escalationRate = total > 0 ? Math.round(((statusCounts['escalated'] || 0) + (statusCounts['escalated_&_resolved'] || 0) + (statusCounts['in_progress'] || 0)) / total * 100) : 0
  const commRate = totalResolved > 0 ? Math.round((communicatedCount / totalResolved) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Executive Analytics & Field Intelligence Insights</h1>
        <p className="page-subtitle">
          Module 10: Real-time trends, root-cause occurrences & resolution performance
        </p>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Complaints</span>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{total}</div>
        </div>

        <div className="stat-card border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold uppercase">Resolution Rate</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{resolutionRate}%</div>
        </div>

        <div className="stat-card border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-teal-700 mb-2">
            <span className="text-xs font-semibold uppercase">Customer Comm.</span>
            <CheckCircle className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-bold text-teal-700">{commRate}%</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{communicatedCount} of {totalResolved} resolved</div>
        </div>

        <div className="stat-card border-l-4 border-l-pink-500">
          <div className="flex items-center justify-between text-pink-700 mb-2">
            <span className="text-xs font-semibold uppercase">Escalation Rate</span>
            <AlertTriangle className="w-4 h-4 text-pink-500" />
          </div>
          <div className="text-2xl font-bold text-pink-700">{escalationRate}%</div>
        </div>

        <div className="stat-card border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-xs font-semibold uppercase">Open FI Cases</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {(statusCounts['escalated'] || 0) + (statusCounts['in_progress'] || 0)}
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Complaint Status Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }: any) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Frequent Issues Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Top Recurring Vehicle Issues
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={problemBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="problem" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#00897B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
