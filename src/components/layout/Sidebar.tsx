import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Search,
  BookOpen,
  BarChart3,
  ShieldCheck,
  LogOut,
  Zap,
  ChevronRight,
  Bike,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles?: string[]
  end?: boolean
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'New Complaint',
    to: '/complaints/new',
    icon: <FilePlus size={18} />,
    roles: ['cce', 'admin'],
  },
  {
    label: 'Complaint Report',
    to: '/complaints',
    icon: <FileText size={18} />,
    roles: ['cce', 'admin'],
    end: true,
  },
  {
    label: 'Field Intelligence',
    to: '/fi/dashboard',
    icon: <Search size={18} />,
    roles: ['field_intelligence', 'admin'],
  },
  {
    label: 'Vehicles & Customers',
    to: '/vehicles',
    icon: <Bike size={18} />,
  },
  {
    label: 'Knowledge Base',
    to: '/knowledge',
    icon: <BookOpen size={18} />,
  },
  {
    label: 'Analytics',
    to: '/analytics',
    icon: <BarChart3 size={18} />,
  },
  {
    label: 'Admin',
    to: '/admin',
    icon: <ShieldCheck size={18} />,
    roles: ['admin'],
  },
]

function roleLabel(role: string) {
  if (role === 'cce') return 'CCE'
  if (role === 'field_intelligence') return 'Field Intelligence'
  if (role === 'admin') return 'Administrator'
  return role
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true
    if (!profile) return false
    return item.roles.includes(profile.role)
  })

  return (
    <aside
      className="flex flex-col h-screen w-[260px] shrink-0"
      style={{ background: '#0f1923' }}
    >
      {/* Branding */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ background: '#00897B' }}
        >
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-base leading-tight tracking-tight">Raptee.HV</div>
          <div className="text-xs text-gray-400 font-medium leading-tight">Field Intelligence Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={14} className="text-gray-500 shrink-0" />
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shrink-0"
              style={{ background: '#00897B' }}
            >
              {getInitials(profile.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold truncate">{profile.full_name}</div>
              <div className="text-gray-400 text-xs truncate">{roleLabel(profile.role)}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="sidebar-nav-item w-full mt-1 text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
