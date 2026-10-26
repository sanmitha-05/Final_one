import { useState } from 'react'
import { Upload, X, AlertCircle, CheckCircle2, FileSpreadsheet, ArrowRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { saveLocalVehiclesBatch, VehicleRegistryRecord } from '../../lib/mockStore'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ImportCustomerExcelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ImportCustomerExcelModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportCustomerExcelModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [rawRows, setRawRows] = useState<any[]>([])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Column mapping states
  const [vinCol, setVinCol] = useState('')
  const [nameCol, setNameCol] = useState('')
  const [contactCol, setContactCol] = useState('')
  const [modelCol, setModelCol] = useState('')
  const [regCol, setRegCol] = useState('')
  const [deliveryCol, setDeliveryCol] = useState('')

  if (!isOpen) return null

  // Auto-detect matching column from headers
  const autoDetectColumn = (headers: string[], candidates: string[]) => {
    return (
      headers.find((h) =>
        candidates.some((c) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === c.replace(/[^a-z0-9]/g, ''))
      ) ||
      headers.find((h) =>
        candidates.some((c) => h.toLowerCase().trim().includes(c))
      ) ||
      ''
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setParsing(true)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        if (jsonData.length === 0) {
          setError('The uploaded sheet contains no rows.')
          setParsing(false)
          return
        }

        const headers = Object.keys(jsonData[0])
        setAvailableColumns(headers)
        setRawRows(jsonData)

        // Run auto-detection
        setVinCol(autoDetectColumn(headers, ['chassis', 'vin', 'chassisno', 'frameno', 'chassisnumber', 'chassisvin', 'chassis#', 'vinno']))
        setNameCol(autoDetectColumn(headers, ['customername', 'customer', 'name', 'clientname', 'ownername', 'owner', 'custname', 'buyername']))
        setContactCol(autoDetectColumn(headers, ['contact', 'contactnumber', 'phone', 'mobile', 'phonenumber', 'mobilenumber', 'customercontact', 'telephone', 'mobileno', 'contactno']))
        setModelCol(autoDetectColumn(headers, ['model', 'vehiclemodel', 'variant', 'bikemodel', 'product', 'modelvariant', 'vehicletype']))
        setRegCol(autoDetectColumn(headers, ['registrationnumber', 'regno', 'regnumber', 'registrationno', 'vehicleregno', 'platenumber', 'rcnumber', 'rcno']))
        setDeliveryCol(autoDetectColumn(headers, ['deliverydate', 'dateofdelivery', 'invoicedate', 'saledate', 'purchasedate', 'date']))
      } catch (err: any) {
        setError('Failed to parse spreadsheet file: ' + err.message)
      } finally {
        setParsing(false)
      }
    }

    reader.readAsArrayBuffer(selectedFile)
  }

  const handleConfirmImport = async () => {
    if (!vinCol) {
      toast.error('Please map the Chassis / VIN column. It is required to identify bikes.')
      return
    }

    setImporting(true)
    setError(null)

    try {
      const recordsToImport: VehicleRegistryRecord[] = rawRows
        .filter((r) => r[vinCol] && String(r[vinCol]).trim().length > 0)
        .map((r) => {
          const rawVin = String(r[vinCol]).trim().toUpperCase()
          const name = nameCol && r[nameCol] ? String(r[nameCol]).trim() : ''
          const contact = contactCol && r[contactCol] ? String(r[contactCol]).trim() : ''
          const model = modelCol && r[modelCol] ? String(r[modelCol]).trim() : 'Raptee.HV'
          const reg = regCol && r[regCol] ? String(r[regCol]).trim().toUpperCase() : ''
          const delDate = deliveryCol && r[deliveryCol] ? String(r[deliveryCol]).trim() : null

          return {
            chassis_vin: rawVin,
            customer_name: name,
            customer_contact: contact,
            vehicle_model: model,
            registration_number: reg,
            delivery_date: delDate,
          }
        })

      if (recordsToImport.length === 0) {
        throw new Error('No valid records with Chassis/VIN were found in the file.')
      }

      // 1. Sync to local storage store for immediate offline/local auto-lookup
      saveLocalVehiclesBatch(recordsToImport)

      // 2. Sync to Supabase if configured
      if (isSupabaseConfigured) {
        const payload = recordsToImport.map((v) => ({
          chassis_vin: v.chassis_vin,
          customer_name: v.customer_name || null,
          customer_contact: v.customer_contact || null,
          vehicle_model: v.vehicle_model || null,
          registration_number: v.registration_number || null,
          delivery_date: (v as any).delivery_date || null,
          updated_at: new Date().toISOString(),
        }))

        const { error: dbError } = await supabase
          .from('customer_vehicles')
          .upsert(payload, { onConflict: 'chassis_vin' })

        if (dbError) {
          console.warn('Supabase customer_vehicles upsert warning:', dbError.message)
        }
      }

      toast.success(`Successfully imported ${recordsToImport.length} customer vehicles!`)
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Import Customer & Vehicle Details</h2>
              <p className="text-xs text-gray-400">
                Upload Excel (.xlsx, .xls) or CSV workbook to auto-map customer details by Chassis #
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-lg p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Area */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Select Excel / CSV File
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-teal-500 transition-colors bg-gray-50/50">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                onChange={handleFileUpload}
                className="hidden"
                id="customer-excel-input"
              />
              <label htmlFor="customer-excel-input" className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm font-semibold text-gray-800 block">
                  {file ? file.name : 'Choose Spreadsheet (.ods, .xlsx, .xls, .csv)'}
                </span>
                <span className="text-xs text-gray-400 block mt-1">
                  Supports customer contact lists, vehicle delivery registers, and PDI sheets
                </span>
              </label>
            </div>
          </div>

          {parsing && (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-500">
              <LoadingSpinner size="sm" />
              <span>Parsing sheet headers and rows...</span>
            </div>
          )}

          {/* Column Mapping Section */}
          {availableColumns.length > 0 && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wide">
                <span>Match Excel Columns</span>
                <span className="text-[11px] text-teal-700 font-semibold lowercase">
                  ({rawRows.length} rows detected)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="form-label form-label-required font-semibold text-gray-700">
                    Chassis / VIN #
                  </label>
                  <select
                    value={vinCol}
                    onChange={(e) => setVinCol(e.target.value)}
                    className="form-input text-xs"
                    required
                  >
                    <option value="">- Select VIN Column -</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label font-semibold text-gray-700">
                    Customer Name
                  </label>
                  <select
                    value={nameCol}
                    onChange={(e) => setNameCol(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="">- Select Name Column -</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label font-semibold text-gray-700">
                    Contact / Phone Number
                  </label>
                  <select
                    value={contactCol}
                    onChange={(e) => setContactCol(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="">- Select Contact Column -</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label font-semibold text-gray-700">
                    Vehicle Model / Variant
                  </label>
                  <select
                    value={modelCol}
                    onChange={(e) => setModelCol(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="">- Select Model Column -</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label font-semibold text-gray-700">
                    Registration Number
                  </label>
                  <select
                    value={regCol}
                    onChange={(e) => setRegCol(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="">- Select Registration Column -</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label font-semibold text-gray-700">
                    Delivery Date (Optional)
                  </label>
                  <select
                    value={deliveryCol}
                    onChange={(e) => setDeliveryCol(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="">- Select Delivery Date Column -</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Preview of first 3 rows */}
          {rawRows.length > 0 && vinCol && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-gray-600 uppercase">
                Preview (First {Math.min(3, rawRows.length)} Records)
              </span>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white text-[11px]">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 border-b">Chassis / VIN</th>
                      <th className="p-2 border-b">Customer Name</th>
                      <th className="p-2 border-b">Contact</th>
                      <th className="p-2 border-b">Model</th>
                      <th className="p-2 border-b">Reg #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="p-2 font-mono font-bold text-teal-700">
                          {r[vinCol] || '—'}
                        </td>
                        <td className="p-2">{nameCol ? r[nameCol] : '—'}</td>
                        <td className="p-2">{contactCol ? r[contactCol] : '—'}</td>
                        <td className="p-2">{modelCol ? r[modelCol] : 'Raptee.HV'}</td>
                        <td className="p-2 font-mono">{regCol ? r[regCol] : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            {rawRows.length > 0 ? `${rawRows.length} rows ready to import` : 'No file selected'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing || rawRows.length === 0 || !vinCol}
              className="btn-primary btn-sm bg-teal-600 hover:bg-teal-700"
            >
              {importing ? 'Importing Customers...' : 'Import Customer Vehicles'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
