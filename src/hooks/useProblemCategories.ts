import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  getLocalProblemCategories,
  addLocalProblemCategory,
  removeLocalProblemCategory,
  DEFAULT_PROBLEM_CATEGORIES,
} from '../lib/mockStore'
import toast from 'react-hot-toast'

export function useProblemCategories() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_PROBLEM_CATEGORIES)
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    if (!isSupabaseConfigured) {
      setCategories(getLocalProblemCategories())
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('problem_categories')
        .select('name')
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (error || !data || data.length === 0) {
        setCategories(getLocalProblemCategories())
      } else {
        const names = data.map((d: any) => d.name)
        // Ensure 'Other' is at the end if present
        const withoutOther = names.filter((n: string) => n !== 'Other')
        const finalCategories = names.includes('Other') ? [...withoutOther, 'Other'] : names
        setCategories(finalCategories)
      }
    } catch {
      setCategories(getLocalProblemCategories())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const addCategory = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Category name cannot be empty.')
      return false
    }

    if (categories.includes(trimmed)) {
      toast.error(`"${trimmed}" already exists.`)
      return false
    }

    // Always update local store
    addLocalProblemCategory(trimmed)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('problem_categories').insert({
          name: trimmed,
          is_active: true,
        })
        if (error) {
          console.warn('Supabase problem_categories insert warning:', error.message)
        }
      } catch (err: any) {
        console.warn('Supabase insert failed:', err)
      }
    }

    await fetchCategories()
    toast.success(`Category "${trimmed}" added successfully!`)
    return true
  }

  const removeCategory = async (name: string) => {
    if (name === 'Other') {
      toast.error('The default "Other" option cannot be removed.')
      return false
    }

    // Always update local store
    removeLocalProblemCategory(name)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('problem_categories')
          .delete()
          .eq('name', name)

        if (error) {
          // If delete fails due to foreign keys, soft delete:
          await supabase
            .from('problem_categories')
            .update({ is_active: false })
            .eq('name', name)
        }
      } catch (err: any) {
        console.warn('Supabase delete category error:', err)
      }
    }

    await fetchCategories()
    toast.success(`Category "${name}" removed.`)
    return true
  }

  return {
    categories,
    loading,
    addCategory,
    removeCategory,
    refetch: fetchCategories,
  }
}
