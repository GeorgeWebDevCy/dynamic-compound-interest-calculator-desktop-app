import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import { buildProjection, getNetAnnualRate } from './lib/projection'
import {
  COMPOUNDING_OPTIONS,
  CONTRIBUTION_OPTIONS,
  DEFAULT_SETTINGS,
  type CompoundSettings,
} from './types/finance'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 1,
  notation: 'compact',
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
})

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

function App() {
  const [settings, setSettings] = useState<CompoundSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    if (!window.configAPI) {
      setLoading(false)
      return
    }

    window.configAPI
      .load()
      .then((stored) => {
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored })
        }
      })
      .catch((error) => console.warn('Unable to load saved settings', error))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || !window.configAPI) {
      return
    }

    setSaveState('saving')
    const debounce = window.setTimeout(() => {
      window.configAPI
        ?.save(settings)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 350)

    return () => window.clearTimeout(debounce)
  }, [settings, loading])

  const projection = useMemo(() => buildProjection(settings), [settings])
  const expenseDrag = settings.fundExpenseRatio + settings.platformFee
  const netAnnualRate = useMemo(
    () => getNetAnnualRate(settings.annualReturn, expenseDrag),
    [settings.annualReturn, expenseDrag],
  )

  const updateField = (field: keyof CompoundSettings, value: number) => {
    setSettings((prev) => ({
      ...prev,
      [field]: Number.isFinite(value) ? value : prev[field],
    }))
  }

  const handleInputChange =
    (field: keyof CompoundSettings) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = Number(event.target.value)
      updateField(field, Number.isNaN(value) ? 0 : value)
    }

  const resetDefaults = () => {
    setSettings({ ...DEFAULT_SETTINGS })
  }

  const renderTable = () =>
    projection.table.map((row) => (
      <tr key={row.year}>
        <td>Year {decimalFormatter.format(row.year)}</td>
        <td>{currencyFormatter.format(row.endingBalance)}</td>
        <td>{currencyFormatter.format(row.contributions)}</td>
        <td>{currencyFormatter.format(row.growth)}</td>
      </tr>
    ))

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Freedom24 × VUAA preset</p>
          <h1>Dynamic Compound Interest Planner</h1>
          <p className="subtitle">
            Adjust the assumptions behind the Vanguard S&P 500 UCITS ETF (VUAA.EU) and Freedom24
            custody fees to project growth on desktop with instant feedback.
          </p>
        </div>
        <div className="header-actions">
          <StatusBadge state={loading ? 'saving' : saveState} />
          <button className="ghost" type="button" onClick={resetDefaults}>
            Reset to preset
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Inputs</h2>
            <span className="panel-meta">Every change recalculates instantly</span>
          </div>

          <div className="input-grid">
            <label>
              <span>Initial principal (€)</span>
              <input
                type="number"
                min={0}
                step={100}
                value={settings.principal}
                onChange={handleInputChange('principal')}
              />
            </label>

            <label>
              <span>Periodic contribution (€)</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.contribution}
                onChange={handleInputChange('contribution')}
              />
            </label>

            <label>
              <span>Contribution cadence</span>
              <select value={settings.contributionFrequency} onChange={handleInputChange('contributionFrequency')}>
                {CONTRIBUTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Compounding frequency</span>
              <select value={settings.compoundingFrequency} onChange={handleInputChange('compoundingFrequency')}>
                {COMPOUNDING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Expected annual return (%)</span>
              <input
                type="number"
                min={0}
                max={40}
                step={0.1}
                value={settings.annualReturn}
                onChange={handleInputChange('annualReturn')}
              />
            </label>

            <label>
              <span>Investment duration (years)</span>
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={settings.years}
                onChange={handleInputChange('years')}
              />
            </label>

            <label>
              <span>ETF expense ratio (VUAA — 0.07%)</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={settings.fundExpenseRatio}
                onChange={handleInputChange('fundExpenseRatio')}
              />
            </label>

            <label>
              <span>Platform fee (Freedom24 custody %)</span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={settings.platformFee}
                onChange={handleInputChange('platformFee')}
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Projection</h2>
            <span className="panel-meta">
              Net return after expenses: {percentFormatter.format(netAnnualRate)}
            </span>
          </div>

          <div className="projection-summary">
            <div>
              <p className="eyebrow">Projected balance</p>
              <h3>{currencyFormatter.format(projection.totals.endingBalance)}</h3>
              <p className="muted">
                Over {settings.years} years assuming {percentFormatter.format(settings.annualReturn / 100)} gross
                return and {percentFormatter.format(expenseDrag / 100)} expenses.
              </p>
            </div>
            <div className="stat-grid">
              <StatCard label="Total contributions" value={currencyFormatter.format(projection.totals.contributions)} />
              <StatCard label="Growth / returns" value={currencyFormatter.format(projection.totals.growth)} />
              <StatCard label="Expense drag" value={`${expenseDrag.toFixed(2)}% yearly`} />
              <StatCard
                label="Contribution cadence"
                value={`${settings.contributionFrequency}× per year`}
              />
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={projection.chartPoints}>
                <defs>
                  <linearGradient id="line" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  stroke="#9ca3af"
                  tickFormatter={(value) => `Y${decimalFormatter.format(value)}`}
                />
                <YAxis
                  stroke="#9ca3af"
                  tickFormatter={(value) => compactCurrencyFormatter.format(value)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="url(#line)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Yearly breakdown</h2>
          <span className="panel-meta">Includes contributions and growth separated</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>End balance</th>
                <th>Total contributions</th>
                <th>Growth / returns</th>
              </tr>
            </thead>
            <tbody>{renderTable()}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="stat-card">
    <span className="muted">{label}</span>
    <strong>{value}</strong>
  </div>
)

const StatusBadge = ({ state }: { state: SaveState }) => {
  let label = 'Ready'
  let className = 'status ready'

  if (state === 'saving') {
    label = 'Saving…'
    className = 'status saving'
  } else if (state === 'saved') {
    label = 'Saved'
    className = 'status saved'
  } else if (state === 'error') {
    label = 'Retrying failed'
    className = 'status error'
  }

  return <span className={className}>{label}</span>
}

const ChartTooltip = ({
  active,
  payload,
}: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const point = payload[0].payload as { year: number; balance: number }

  return (
    <div className="tooltip-card">
      <span>Year {decimalFormatter.format(point.year)}</span>
      <strong>{currencyFormatter.format(point.balance)}</strong>
    </div>
  )
}

export default App
