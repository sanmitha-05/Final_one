import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bike,
  Search,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Phone,
  User,
  Hash,
  Shield,
  FileText,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { getAllLocalVehicles, VehicleRegistryRecord } from '../../lib/mockStore'
import ImportCustomerExcelModal from '../../components/vehicles/ImportCustomerExcelModal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function VehicleRegistryPage() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<VehicleRegistryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const loadVehicles = async () => {
    setLoading(true)
    if (!isSupabaseConfigured) {
      setVehicles(getAllLocalVehicles())
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('customer_vehicles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !data || data.length === 0) {
        setVehicles(getAllLocalVehicles())
      } else {
        const mapped: VehicleRegistryRecord[] = data.map((d: any) => ({
          chassis_vin: d.chassis_vin,
          customer_name: d.customer_name || '',
          customer_contact: d.customer_contact || '',
          vehicle_model: d.vehicle_model || 'Raptee.HV',
          registration_number: d.registration_number || '',
        }))
        setVehicles(mapped)
      }
    } catch {
      setVehicles(getAllLocalVehicles())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const filtered = vehicles.filter((v) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase().trim()
    return (
      v.chassis_vin.toLowerCase().includes(term) ||
      v.customer_name.toLowerCase().includes(term) ||
      v.customer_contact.toLowerCase().includes(term) ||
      v.registration_number.toLowerCase().includes(term) ||
      v.vehicle_model.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Bike className="w-7 h-7 text-raptee-500" />
            <span>Customer & Vehicle Registry</span>
          </h1>
          <p className="page-subtitle">
            Manage customer database mapped to chassis numbers for instant auto-filling during complaint registration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadVehicles()}
            className="btn-secondary btn-sm p-2 text-gray-500 hover:text-gray-700"
            title="Refresh Registry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Customer Excel (.xlsx / .csv)</span>
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Chassis #, Customer Name, Contact, Reg #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input pl-9 text-xs sm:text-sm"
          />
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Showing <span className="font-bold text-gray-900">{filtered.length}</span> of{' '}
          <span className="font-bold text-gray-900">{vehicles.length}</span> registered vehicles
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-xs text-gray-500">Loading customer & vehicle records...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-800">No Vehicles Found</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Upload your customer service-log Excel file (.xlsx or .csv) to auto-map customer names, phone numbers, and vehicle models by Chassis VIN.
            </p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="btn-primary mt-2 bg-emerald-600 hover:bg-emerald-700"
            >
              Upload Customer Excel Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Chassis / VIN</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Contact #</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Registration #</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((v) => (
                  <tr key={v.chassis_vin} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                      {v.chassis_vin}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-800">
                      {v.customer_name || <span className="text-gray-400 italic">Not specified</span>}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {v.customer_contact ? (
                        <span className="flex items-center gap-1.5 font-mono text-xs">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {v.customer_contact}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      {v.vehicle_model || 'Raptee.HV'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-700">
                      {v.registration_number ? (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold text-gray-800">
                          {v.registration_number}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/complaints/new`)}
                        className="btn-secondary btn-sm text-xs font-medium text-raptee-700 hover:bg-raptee-50 border-raptee-200"
                        title="Create Complaint for this vehicle"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register Issue</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Excel Import Modal */}
      <ImportCustomerExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          loadVehicles()
        }}
      />
    </div>
  )
}
