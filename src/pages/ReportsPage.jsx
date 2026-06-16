import { useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { entriesService } from '../services/entries.service'
import { attendanceService } from '../services/attendance.service'
import { generateReportPDF, downloadPdf } from '../utils/pdf'
import { calcMonthlyTotals } from '../utils/wage'
import { getDateRange, formatDate } from '../utils/date'
import UnitTabs from '../components/common/UnitTabs'
import EmptyState from '../components/common/EmptyState'
import { CATEGORY_LABELS } from '../config/constants'
import { formatCurrency } from '../utils/helpers'
import styles from '../styles/Reports.module.css'

export default function ReportsPage() {
  const { workers, currentUnit, setCurrentUnit } = useAppContext()
  
  const [period, setPeriod] = useState('week')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const range = period === 'custom' ? customRange : getDateRange(period)
      if (!range.from || !range.to) {
        alert('Please select date range')
        setLoading(false)
        return
      }

      // Fetch data for range
      const [entries, attendance] = await Promise.all([
        entriesService.getAll({ dateFrom: range.from, dateTo: range.to, unit: currentUnit === 'all' ? null : currentUnit }),
        attendanceService.getAll({ dateFrom: range.from, dateTo: range.to, unit: currentUnit === 'all' ? null : currentUnit })
      ])

      // Process report per worker
      const rows = []
      let totals = { workerCount: 0, totalWage: 0, totalOT: 0, advanceTotal: 0, netPay: 0 }

      const filteredWorkers = currentUnit === 'all' ? workers : workers.filter(w => w.unit === currentUnit)

      filteredWorkers.forEach(worker => {
        const workerEntries = entries.filter(e => e.worker_id === worker.id)
        const workerAtt = attendance.filter(a => a.worker_id === worker.id)
        
        if (workerEntries.length === 0 && workerAtt.length === 0) return // Skip inactive workers

        const stats = calcMonthlyTotals(worker, workerEntries, workerAtt)

        rows.push({
          id: worker.id,
          name: worker.name,
          category: CATEGORY_LABELS[worker.category] || worker.category,
          daysPresent: stats.daysPresent,
          wage: stats.basePay,
          ot: stats.otTotal,
          advance: stats.advanceTotal,
          net: stats.netPay
        })

        totals.workerCount++
        totals.totalWage += stats.basePay
        totals.totalOT += stats.otTotal
        totals.advanceTotal += stats.advanceTotal
        totals.netPay += stats.netPay
      })

      // Sort by net pay descending
      rows.sort((a, b) => b.net - a.net)

      setReportData({ rows, totals, range })
    } catch (err) {
      console.error(err)
      alert('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPdf = async () => {
    if (!reportData) return
    const { rows, totals, range } = reportData
    
    const periodLabel = `${formatDate(range.from)} to ${formatDate(range.to)}`
    const title = `${currentUnit === 'all' ? 'All Units' : currentUnit.toUpperCase()} Wage Report`
    
    const doc = await generateReportPDF(title, periodLabel, rows, totals)
    downloadPdf(doc, `WageTrack_Report_${currentUnit}_${range.from}.pdf`)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Reports</h2>
      </div>

      <UnitTabs activeUnit={currentUnit} onChange={setCurrentUnit} />

      <div className={styles.filtersCard}>
        <div className={styles.periodSelect}>
          <button className={`${styles.periodBtn} ${period === 'today' ? styles.active : ''}`} onClick={() => setPeriod('today')}>Today</button>
          <button className={`${styles.periodBtn} ${period === 'week' ? styles.active : ''}`} onClick={() => setPeriod('week')}>This Week</button>
          <button className={`${styles.periodBtn} ${period === 'month' ? styles.active : ''}`} onClick={() => setPeriod('month')}>This Month</button>
          <button className={`${styles.periodBtn} ${period === 'custom' ? styles.active : ''}`} onClick={() => setPeriod('custom')}>Custom</button>
        </div>

        {period === 'custom' && (
          <div className={styles.customRange}>
            <input type="date" value={customRange.from} onChange={e => setCustomRange(p => ({...p, from: e.target.value}))} />
            <span>to</span>
            <input type="date" value={customRange.to} onChange={e => setCustomRange(p => ({...p, to: e.target.value}))} />
          </div>
        )}

        <button 
          className="btn btn-primary" 
          onClick={handleGenerate} 
          disabled={loading}
          style={{ width: '100%', marginTop: '16px' }}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {reportData && (
        <div className={styles.reportResults}>
          <div className={styles.resultsHeader}>
            <div className={styles.resultsTitle}>
              <h3>Report Summary</h3>
              <p className={styles.resultsDate}>{formatDate(reportData.range.from)} - {formatDate(reportData.range.to)}</p>
            </div>
            <button className="btn btn-secondary" onClick={handleExportPdf}>
              Export PDF
            </button>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryBox}>
              <div className={styles.sLabel}>Workers Active</div>
              <div className={styles.sValue}>{reportData.totals.workerCount}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.sLabel}>Total Wage</div>
              <div className={styles.sValue}>{formatCurrency(reportData.totals.totalWage)}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.sLabel}>Total OT</div>
              <div className={styles.sValue}>{formatCurrency(reportData.totals.totalOT)}</div>
            </div>
            <div className={styles.summaryBox} style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>
              <div className={styles.sLabel} style={{ color: 'var(--accent2)' }}>Net Pay</div>
              <div className={styles.sValue} style={{ color: 'var(--accent2)' }}>{formatCurrency(reportData.totals.netPay)}</div>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Days</th>
                  <th>Wage</th>
                  <th>OT</th>
                  <th>Adv</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.rowName}>{row.name}</div>
                      <div className={styles.rowCat}>{row.category}</div>
                    </td>
                    <td>{row.daysPresent}</td>
                    <td>{row.wage}</td>
                    <td>{row.ot}</td>
                    <td>{row.advance}</td>
                    <td style={{ fontWeight: 600 }}>{row.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!reportData && !loading && (
        <div style={{ marginTop: '32px' }}>
          <EmptyState title="No report generated" message="Select a date range and click Generate Report." />
        </div>
      )}
    </div>
  )
}
