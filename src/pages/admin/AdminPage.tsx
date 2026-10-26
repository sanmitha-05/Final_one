import { useState, useEffect } from 'react'
import { ShieldCheck, Users, ToggleLeft, ToggleRight, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import type { UserProfile, UserRole } from '../../types/database'

export default function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err: any) {
      console.error('Error fetching user profiles:', err)
      toast.error('Failed to load user accounts: ' + (err.message || 'unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      toast.success('Role updated successfully')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role.')
    }
  }

  const handleApprove = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: true })
        .eq('id', userId)

      if (error) throw error
      toast.success('User approved — they can now sign in ✓')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve user.')
    }
  }

  const handleDeactivate = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId)

      if (error) throw error
      toast.success('User access revoked.')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate user.')
    }
  }

  const pendingUsers = users.filter((u) => !u.is_active)
  const activeUsers = users.filter((u) => u.is_active)

  function roleLabel(role: string) {
    if (role === 'cce') return 'CCE — Customer Care'
    if (role === 'field_intelligence') return 'Field Intelligence (FI)'
    if (role === 'admin') return 'Administrator'
    return role
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-raptee-500" />
            Administration & User Governance
          </h1>
          <p className="page-subtitle">
            Approve new accounts, manage roles and deactivate access
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="btn-secondary btn-sm flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Pending Approval Banner */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              {pendingUsers.length} account{pendingUsers.length > 1 ? 's' : ''} pending your approval
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These users have registered but cannot access the platform until you approve them below.
            </p>
          </div>
        </div>
      )}

      {/* Pending Approval Table */}
      {pendingUsers.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-amber-100 bg-amber-50/50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-800">
              Pending Approval ({pendingUsers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Requested Role</th>
                  <th>Registered</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u) => (
                  <tr key={u.id} className="bg-amber-50/30">
                    <td className="font-semibold text-gray-900">{u.full_name}</td>
                    <td className="text-gray-600 text-xs font-mono">{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="form-input text-xs py-1 px-2 max-w-[200px]"
                      >
                        <option value="cce">CCE — Customer Care</option>
                        <option value="field_intelligence">Field Intelligence (FI)</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td className="text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleApprove(u.id)}
                        className="btn-primary btn-sm text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Access</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Users Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900">
              Active Employees ({activeUsers.length})
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            Role changes take effect immediately at next sign-in
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-500">No active accounts yet.</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Once employees sign up and you approve them above, they will appear here.
              Your own admin account will appear here after signing in.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Email</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold text-gray-900">{u.full_name}</td>
                    <td className="text-gray-600 text-xs font-mono">{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="form-input text-xs py-1 px-2 max-w-[200px]"
                      >
                        <option value="cce">CCE — Customer Care</option>
                        <option value="field_intelligence">Field Intelligence (FI)</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td>
                      <span className="badge badge-resolved">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="btn-secondary btn-sm text-xs text-red-600 hover:bg-red-50 border-red-200"
                      >
                        <ToggleLeft className="w-3.5 h-3.5" />
                        Revoke Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-slate-700">How User Approval Works</p>
        <ul className="list-disc list-inside space-y-1 text-slate-500">
          <li>When a new employee registers on the Sign Up page, they are flagged as <strong>Pending</strong></li>
          <li>They <strong>cannot log in</strong> until you click <strong>Approve Access</strong> here</li>
          <li>You can change any user's role at any time — it takes effect immediately</li>
          <li>Revoking access instantly blocks that user from signing in</li>
          <li>Role permissions are enforced server-side via PostgreSQL RLS — not just UI</li>
        </ul>
      </div>
    </div>
  )
}
