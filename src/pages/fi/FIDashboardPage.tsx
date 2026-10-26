import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  RotateCcw,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useFIComplaints } from '../../hooks/useFIComplaints'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import ManageProblemCategoriesModal from '../../components/fi/ManageProblemCategoriesModal'

export default function FIDashboardPage() {
  const navigate = useNavigate()
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { complaints, total, loading, refetch } = useFIComplaints({
    search: searchTerm,
    dateFrom,
    dateTo,
    page,
    pageSize,
  })

  const handleReset = () => {
    setSearchTerm('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div className="space-y-6">
      {/* Header matching Module 5 requirements */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Field Intelligence Dashboard</h1>
          <p className="page-subtitle">
            View complaints escalated by CCE. Investigate and submit resolution.
          </p>
        </div>
        <div>
          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            className="btn-secondary flex items-center gap-2 border-teal-200 text-teal-800 bg-teal-50 hover:bg-teal-100 shadow-sm font-semibold"
          >
            <Tag className="w-4 h-4 text-teal-600" />
            <span>Manage Problem Categories</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar matching reference */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Universal Search */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Incident ID, Chassis / VIN, Problem..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="form-input pl-9 text-xs sm:text-sm"
            />
          </div>

          {/* Date of Escalation Range Filter */}
          <div className="md:col-span-5 flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="form-input text-xs"
              placeholder="From"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="form-input text-xs"
              placeholder="To"
            />
          </div>

          {/* Reset */}
          <div className="md:col-span-1">
            <button
              onClick={handleReset}
              className="btn-secondary w-full justify-center btn-sm text-xs py-2.5"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active FI Queue Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            title="FI Queue Clear"
            description="No active escalated complaints require investigation right now. Great job!"
            action={
              <button onClick={handleReset} className="btn-secondary btn-sm mt-3">
                Refresh Queue
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-raptee-500 focus:ring-raptee-500"
                    />
                  </th>
                  <th>Incident ID</th>
                  <th>Date of Report</th>
                  <th>Chassis / VIN</th>
                  <th>Incident / Problem</th>
                  <th>Status</th>
                  <th className="text-center">Communicated to Customer</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-raptee-500 focus:ring-raptee-500"
                      />
                    </td>
                    <td className="font-semibold text-gray-900 font-mono">
                      {c.incident_id}
                    </td>
                    <td className="text-gray-600">{c.date_of_report}</td>
                    <td className="font-mono text-xs text-gray-700">
                      {c.chassis_vin}
                    </td>
                    <td className="text-gray-800 font-medium">
                      {c.incident_problem}
                    </td>
                    <td>
                      <StatusBadge status={c.status} isEscalated={true} />
                    </td>
                    <td className="text-center">
                      {c.status === 'resolved' ? (
                        c.communicated_to_customer ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Yes</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending (CCE)</span>
                          </span>
                        )
                      ) : (
                        <span className="text-gray-300 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => navigate(`/fi/complaints/${c.id}/investigate`)}
                        className="btn-primary btn-sm bg-teal-600 hover:bg-teal-700"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Open Resolution Form</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div>
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} -{' '}
            {Math.min(page * pageSize, total)} of {total} escalated complaints
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-teal-50 text-teal-700 font-semibold rounded border border-teal-200">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal for FI to add/remove problem categories */}
      <ManageProblemCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
      />
    </div>
  )
}
