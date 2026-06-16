import { supabase } from '../config/supabase'

const UNITS = ['unit1', 'unit2', 'unit3', 'unit4']

function getTableName(unit) {
  if (!unit || !UNITS.includes(unit)) {
    throw new Error(`Invalid unit provided to attendanceService: ${unit}`)
  }
  return `${unit}_attendance`
}

export const attendanceService = {
  /**
   * Fetch attendance records with optional filters
   */
  async getAll(filters = {}) {
    const unitsToQuery = filters.unit ? [filters.unit] : UNITS

    const fetchForUnit = async (unit) => {
      let query = supabase.from(getTableName(unit)).select('*, unit: \'' + unit + '\'')

      if (filters.workerId) query = query.eq('worker_id', filters.workerId)
      if (filters.date) query = query.eq('date', filters.date)
      if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('date', filters.dateTo)

      const { data, error } = await query
      if (error) throw error
      return (data || []).map(row => ({ ...row, unit }))
    }

    const results = await Promise.all(unitsToQuery.map(fetchForUnit))
    const allData = results.flat()
    
    return allData.sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  /**
   * Get attendance for a specific date
   */
  async getByDate(date, unit = null) {
    return this.getAll({ date, unit })
  },

  /**
   * Get attendance for a specific worker on a date
   */
  async getForWorker(workerId, date, unit) {
    if (!unit) throw new Error('Unit is required for getForWorker')
    const { data, error } = await supabase
      .from(getTableName(unit))
      .select('*')
      .eq('worker_id', workerId)
      .eq('date', date)
      .maybeSingle()
    if (error) throw error
    if (data) data.unit = unit
    return data
  },

  /**
   * Upsert attendance (one record per worker per day)
   */
  async upsert(attendanceData) {
    if (!attendanceData.unit) throw new Error('Unit is required for upsert')
    
    const table = getTableName(attendanceData.unit)
    const payload = { ...attendanceData }
    delete payload.unit

    if (!payload.id) {
      payload.id = crypto.randomUUID()
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict: 'worker_id,date' })
      .select()
      .single()
    if (error) throw error
    return { ...data, unit: attendanceData.unit }
  },

  /**
   * Bulk upsert (mark all present)
   */
  async bulkUpsert(records) {
    if (records.length === 0) return []
    
    const grouped = records.reduce((acc, rec) => {
      if (!acc[rec.unit]) acc[rec.unit] = []
      acc[rec.unit].push(rec)
      return acc
    }, {})

    const results = []

    for (const [unit, recs] of Object.entries(grouped)) {
      const table = getTableName(unit)
      const payloads = recs.map(r => {
        const payload = { ...r }
        delete payload.unit
        if (!payload.id) payload.id = crypto.randomUUID()
        return payload
      })

      const { data, error } = await supabase
        .from(table)
        .upsert(payloads, { onConflict: 'worker_id,date' })
        .select()
      if (error) throw error
      
      const mapped = data.map(d => ({ ...d, unit }))
      results.push(...mapped)
    }

    return results
  },

  /**
   * Update a specific field (status, OT, advance)
   */
  async updateField(workerId, date, field, value, unit) {
    if (!unit) throw new Error('Unit is required for updateField')
    const existing = await this.getForWorker(workerId, date, unit)

    if (existing) {
      const updates = {}
      if (field === 'status') updates.status = value
      if (field === 'ot_hours') updates.ot_hours = value
      if (field === 'ot_amount') updates.ot_amount = value
      if (field === 'advance') updates.advance = value

      const { data, error } = await supabase
        .from(getTableName(unit))
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return { ...data, unit }
    } else {
      // Create new record
      const newRecord = {
        worker_id: workerId,
        date,
        unit,
        status: field === 'status' ? value : 'present',
        ot_hours: field === 'ot_hours' ? value : 0,
        ot_amount: field === 'ot_amount' ? value : 0,
        advance: field === 'advance' ? value : 0,
      }
      return this.upsert(newRecord)
    }
  },

  /**
   * Subscribe to real-time changes
   */
  subscribe(callback) {
    const channels = UNITS.map(unit => {
      return supabase
        .channel(`${unit}_attendance_changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: `${unit}_attendance` }, (payload) => {
           if (payload.new) payload.new.unit = unit
           if (payload.old) payload.old.unit = unit
           callback(payload)
        })
        .subscribe()
    })

    return {
      unsubscribe: () => {
        channels.forEach(ch => supabase.removeChannel(ch))
      }
    }
  },
}
