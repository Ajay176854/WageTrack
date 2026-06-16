/**
 * PDF generation utilities using jsPDF
 * Lazy-loaded to avoid bundling in initial load
 */

let jsPDFModule = null

async function getJsPDF() {
  if (!jsPDFModule) {
    const mod = await import('jspdf')
    await import('jspdf-autotable')
    jsPDFModule = mod.jsPDF || mod.default
  }
  return jsPDFModule
}

/**
 * Generate a standard WageTrack PDF header
 */
function addPdfHeader(doc, title, subtitle = '') {
  doc.setFillColor(13, 17, 23)
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor(240, 192, 64)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 18)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (subtitle) doc.text(subtitle, 14, 28)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34)
  return 45 // starting Y position after header
}

/**
 * Generate a workers list PDF
 */
export async function generateWorkersListPDF(workers, currentUser) {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF('p', 'mm', 'a4')

  addPdfHeader(doc, 'WageTrack Workers List', `Exported by: ${currentUser.username} (${currentUser.role})`)

  const tableData = workers.map((w) => [w.emp_id || w.id, w.name, (w.category || 'piece_work').toUpperCase()])

  doc.autoTable({
    startY: 45,
    head: [['EMP ID', 'Worker Name', 'Category']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [240, 192, 64], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  return doc
}

/**
 * Generate a report PDF
 */
export async function generateReportPDF(title, periodLabel, reportRows, totals) {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF('p', 'mm', 'a4')

  const startY = addPdfHeader(doc, title, `Period: ${periodLabel}`)

  // Summary section
  doc.setFillColor(241, 243, 244)
  doc.rect(14, startY, 182, 18, 'F')
  doc.setTextColor(184, 134, 11)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')

  const summaryItems = [
    ['TOTAL WORKERS', String(totals.workerCount || 0), 20],
    ['TOTAL WAGE', `Rs.${(totals.totalWage || 0).toLocaleString()}`, 65],
    ['TOTAL OT', `Rs.${(totals.totalOT || 0).toLocaleString()}`, 110],
    ['NET PAY', `Rs.${(totals.netPay || 0).toLocaleString()}`, 155],
  ]

  summaryItems.forEach(([label, value, x]) => {
    doc.setTextColor(184, 134, 11)
    doc.setFontSize(7)
    doc.text(label, x, startY + 6)
    doc.setTextColor(32, 33, 36)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(value, x, startY + 14)
    doc.setFont('helvetica', 'normal')
  })

  // Data table
  if (reportRows.length > 0) {
    doc.autoTable({
      startY: startY + 24,
      head: [reportRows[0].map(() => '').length ? Object.keys(reportRows[0]) : ['Worker', 'Days', 'Wage', 'OT', 'Advance', 'Net']],
      body: reportRows.map((row) => Object.values(row)),
      theme: 'striped',
      headStyles: { fillColor: [240, 192, 64], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
    })
  }

  return doc
}

/**
 * Download a jsPDF doc
 */
export function downloadPdf(doc, filename) {
  doc.save(filename)
}
