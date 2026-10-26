import { useState } from 'react'
import { X, Plus, Trash2, Tag, Check, AlertCircle } from 'lucide-react'
import { useProblemCategories } from '../../hooks/useProblemCategories'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ManageProblemCategoriesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ManageProblemCategoriesModal({
  isOpen,
  onClose,
}: ManageProblemCategoriesModalProps) {
  const { categories, loading, addCategory, removeCategory } = useProblemCategories()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    setSaving(true)
    const success = await addCategory(newCategoryName)
    if (success) {
      setNewCategoryName('')
    }
    setSaving(false)
  }

  const handleDelete = async (name: string) => {
    setDeletingName(name)
    await removeCategory(name)
    setDeletingName(null)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Manage Incident / Problem Categories</h2>
              <p className="text-xs text-gray-400">
                Field Intelligence Control • Dynamically add or remove options in the CCE dropdown
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Add New Category Form */}
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="form-label text-xs font-semibold text-gray-700 uppercase">
              Add New Category
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. MCU Over-temperature Warning, Throttle Lag..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="form-input text-sm flex-1"
                maxLength={60}
              />
              <button
                type="submit"
                disabled={saving || !newCategoryName.trim()}
                className="btn-primary shrink-0 bg-teal-600 hover:bg-teal-700 text-xs py-2 px-3.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{saving ? 'Adding...' : 'Add'}</span>
              </button>
            </div>
          </form>

          {/* Current Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Configured Categories ({categories.length})</span>
              <span className="text-[11px] text-gray-400">Synced to Supabase DB</span>
            </div>

            {loading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto bg-gray-50/50">
                {categories.map((cat, idx) => {
                  const isOther = cat === 'Other'
                  return (
                    <div
                      key={`${cat}-${idx}`}
                      className="flex items-center justify-between p-3 hover:bg-white transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-mono font-semibold">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-800">{cat}</span>
                        {isOther && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            Standard Fallback
                          </span>
                        )}
                      </div>

                      {!isOther && (
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          disabled={deletingName === cat}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          title={`Delete "${cat}"`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 flex items-start gap-2">
            <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              Any changes made here immediately appear in the <strong>Complaint Registration Form</strong> for all CCE and service personnel.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
          <button onClick={onClose} className="btn-secondary btn-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
