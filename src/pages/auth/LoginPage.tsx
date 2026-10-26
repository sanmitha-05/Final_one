import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, AlertCircle, Eye, EyeOff, Shield, Lock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { UserRole } from '../../types/database'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('cce')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        setLoading(false)
        return
      }

      const res = await signUp(email, password, fullName.trim(), role)
      if (res.error) {
        setError(res.error.message || 'Failed to create account. Please try again.')
        setLoading(false)
      } else if (res.pendingApproval) {
        setSuccessMsg(
          res.message ||
            'Registration submitted successfully! Your account is pending Administrator approval before you can sign in.'
        )
        setMode('signin')
        setPassword('')
        setLoading(false)
      } else {
        setSuccessMsg('Account created successfully! Redirecting...')
        setTimeout(() => {
          navigate('/')
        }, 800)
      }
      return
    }

    const res = await signIn(email, password)
    if (res.error) {
      if (res.error.message === 'EMAIL_NOT_CONFIRMED') {
        setError('__EMAIL_NOT_CONFIRMED__')
      } else {
        setError(res.error.message || 'Invalid credentials. Please check your email and password.')
      }
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-raptee-500 flex items-center justify-center shadow-xl shadow-raptee-500/25 ring-4 ring-raptee-500/20">
          <Zap className="h-8 w-8 text-white fill-white/20" />
        </div>

        <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Raptee<span className="text-raptee-400">.HV</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400 font-medium">
          Complaint Management & Field Intelligence Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200/80">
          {/* Tab Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setSuccessMsg(null)
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setSuccessMsg(null)
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign Up (New Account)
            </button>
          </div>

          {/* Alerts */}
          {error === '__EMAIL_NOT_CONFIRMED__' ? (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Email Not Confirmed</p>
                  <p className="mt-1 text-amber-700">
                    Your Supabase project requires email verification. To fix this permanently, disable email confirmation in your Supabase dashboard:
                  </p>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-amber-700 pl-1 font-medium">
                <li>Open <strong>Supabase Dashboard → Authentication → Settings</strong></li>
                <li>Under <strong>User Signups</strong>, turn <strong>OFF</strong> "Enable email confirmations"</li>
                <li>Click <strong>Save</strong>, then try signing in again</li>
              </ol>
            </div>
          ) : error ? (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium">{error}</span>
                {(error.includes('Invalid') || error.includes('credentials')) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup')
                        setError(null)
                      }}
                      className="text-raptee-700 font-semibold underline hover:text-raptee-800"
                    >
                      Need an account? Click to register now
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="form-input text-sm"
                    placeholder="e.g. Radhika S or Sanmitha V"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Assigned Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="form-input text-sm font-medium"
                  >
                    <option value="cce">CCE — Customer Care Executive</option>
                    <option value="field_intelligence">Field Intelligence (FI) Specialist</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select your primary departmental role for access permissions
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input text-sm"
                placeholder="name@raptee.com"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input text-sm pr-10"
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-raptee-500 hover:bg-raptee-600 active:bg-raptee-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-raptee-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Authenticating...'
                    : mode === 'signup'
                    ? 'Register Account'
                    : 'Sign In to Portal'}
                </span>
              </button>
            </div>
          </form>

          {/* Secure Environment Notice */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>TLS 1.3 Encrypted & RLS Protected</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              v1.0.0 Live
            </span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Internal system for authorized Raptee.HV personnel only.
        </p>
      </div>
    </div>
  )
}
