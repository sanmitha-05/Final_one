import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getLocalComplaints } from '../lib/mockStore'
import type { Complaint, ComplaintStatus } from '../types/database'

interface UseComplaintsParams {
  search?: string
  status?: ComplaintStatus | 'resolved_direct' | 'escalated_resolved' | ''
  communicated?: 'yes' | 'no' | ''
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

interface UseComplaintsResult {
  complaints: Complaint[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useComplaints({
  search = '',
  status = '',
  communicated = '',
  dateFrom = '',
  dateTo = '',
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortDir = 'desc',
}: UseComplaintsParams = {}): UseComplaintsResult {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      setError(null)

      // 1. If Supabase is not configured, query local store
      if (!isSupabaseConfigured) {
        let all = getLocalComplaints()

        if (search) {
          const s = search.toLowerCase()
          all = all.filter(
            (c) =>
              c.incident_id.toLowerCase().includes(s) ||
              c.chassis_vin.toLowerCase().includes(s) ||
              c.incident_problem.toLowerCase().includes(s) ||
              (c.customer_name && c.customer_name.toLowerCase().includes(s))
          )
        }

        if (status === 'resolved_direct') {
          all = all.filter((c) => c.status === 'resolved' && !c.is_escalated)
        } else if (status === 'escalated_resolved') {
          all = all.filter((c) => c.status === 'resolved' && !!c.is_escalated)
        } else if (status) {
          all = all.filter((c) => c.status === status)
        }

        if (communicated === 'yes') {
          all = all.filter((c) => c.status === 'resolved' && !!c.communicated_to_customer)
        } else if (communicated === 'no') {
          all = all.filter((c) => c.status === 'resolved' && !c.communicated_to_customer)
        }

        if (dateFrom) {
          all = all.filter((c) => c.date_of_report >= dateFrom)
        }

        if (dateTo) {
          all = all.filter((c) => c.date_of_report <= dateTo)
        }

        const count = all.length
        const from = (page - 1) * pageSize
        const to = from + pageSize
        const paged = all.slice(from, to)

        if (!cancelled) {
          setComplaints(paged)
          setTotal(count)
          setLoading(false)
        }
        return
      }

      // 2. Query real Supabase PostgreSQL
      try {
        let query = supabase.from('complaints').select('*', { count: 'exact' })

        if (search) {
          query = query.or(
            `incident_id.ilike.%${search}%,chassis_vin.ilike.%${search}%,incident_problem.ilike.%${search}%,customer_name.ilike.%${search}%`
          )
        }

        if (status === 'resolved_direct') {
          query = query.eq('status', 'resolved').eq('is_escalated', false)
        } else if (status === 'escalated_resolved') {
          query = query.eq('status', 'resolved').eq('is_escalated', true)
        } else if (status) {
          query = query.eq('status', status)
        }

        if (communicated === 'yes') {
          query = query.eq('status', 'resolved').eq('communicated_to_customer', true)
        } else if (communicated === 'no') {
          query = query.eq('status', 'resolved').eq('communicated_to_customer', false)
        }

        if (dateFrom) {
          query = query.gte('date_of_report', dateFrom)
        }

        if (dateTo) {
          query = query.lte('date_of_report', dateTo)
        }

        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to)

        const { data, error: err, count } = await query

        if (cancelled) return

        if (err) {
          console.warn('Supabase fetch failed, falling back to local store:', err.message)
          const local = getLocalComplaints()
          setComplaints(local.slice((page - 1) * pageSize, page * pageSize))
          setTotal(local.length)
        } else {
          setComplaints(data ?? [])
          setTotal(count ?? 0)
        }
      } catch (e: any) {
        if (!cancelled) {
          const local = getLocalComplaints()
          setComplaints(local.slice((page - 1) * pageSize, page * pageSize))
          setTotal(local.length)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => {
      cancelled = true
    }
  }, [search, status, communicated, dateFrom, dateTo, page, pageSize, sortBy, sortDir, tick])

  return { complaints, total, loading, error, refetch }
}
