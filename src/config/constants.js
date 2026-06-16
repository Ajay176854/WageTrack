// ── Unit Definitions ─────────────────────────────────────────────────────────
export const UNITS = ['unit1', 'unit2', 'unit3', 'unit4']

export const UNIT_LABELS = {
  unit1: 'Unit 1',
  unit2: 'Unit 2',
  unit3: 'Unit 3',
  unit4: 'Unit 4',
  maintenance: 'Maintenance',
}

export const UNIT_COLORS = {
  unit1: { color: 'var(--accent)', bg: 'rgba(240,192,64,0.12)' },
  unit2: { color: 'var(--accent2)', bg: 'rgba(74,222,128,0.12)' },
  unit3: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  unit4: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
}

// ── Category Definitions ─────────────────────────────────────────────────────
export const CATEGORIES = [
  'piece_work',
  'bundle_packing',
  'cover_packing',
  'monthly_salary',
  'daily_wages',
]

export const CATEGORY_LABELS = {
  piece_work: 'Piece Work',
  bundle_packing: 'Bundle Packing',
  cover_packing: 'Cover Packing',
  monthly_salary: 'Monthly Salary',
  daily_wages: 'Daily Wages',
}

export const CATEGORY_COLORS = {
  piece_work:      { color: 'var(--accent)',  bg: 'rgba(184,134,11,0.12)' },
  bundle_packing:  { color: '#60a5fa',        bg: 'rgba(96,165,250,0.12)' },
  cover_packing:   { color: '#a78bfa',        bg: 'rgba(167,139,250,0.12)' },
  monthly_salary:  { color: 'var(--accent2)', bg: 'rgba(30,126,52,0.12)' },
  daily_wages:     { color: '#fb923c',        bg: 'rgba(251,146,60,0.12)' },
}

// ── Attendance Statuses ──────────────────────────────────────────────────────
export const ATTENDANCE_STATUSES = ['present', 'absent', 'forenoon', 'afternoon']

export const STATUS_COLORS = {
  present:   'var(--accent2)',
  absent:    'var(--accent3)',
  forenoon:  '#60a5fa',
  afternoon: '#fb923c',
}

// ── Worker Emojis (cycled for new workers) ───────────────────────────────────
export const WORKER_EMOJIS = ['👷', '🧑‍🏭', '👩‍🏭', '🧑‍🌾', '👩‍🌾', '🧑', '👩', '🧑‍💼']

// ── RBAC Permissions ─────────────────────────────────────────────────────────
export const PERMISSION_ACTIONS = ['attendance', 'work', 'payment']

// ── Legacy category-to-unit mapping (for backward compat) ────────────────────
export const CATEGORY_UNIT_MAP = {
  piece_work: 'unit1',
  daily: 'unit1',
  monthly_salary: 'unit2',
  permanent: 'unit2',
  bundle_packing: 'unit3',
  cover_packing: 'unit3',
  packing: 'unit3',
  daily_wages: 'unit4',
  other: 'unit4',
  maintenance: 'maintenance',
}
