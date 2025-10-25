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
import {
  formatHoldingsDate,
  getWholeMonthsUntilYearEnd,
  isPurchaseDateInFuture,
  normalizeDateValue,
} from './lib/dates'
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

const detailedEuroFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
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

type NumericSettingKey = {
  [K in keyof CompoundSettings]: CompoundSettings[K] extends number ? K : never
}[keyof CompoundSettings]

type DateSettingKey = {
  [K in keyof CompoundSettings]: CompoundSettings[K] extends string ? K : never
}[keyof CompoundSettings]

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

  const remainingContributionMonths = useMemo(
    () => getWholeMonthsUntilYearEnd(settings.vuaaPurchaseDate),
    [settings.vuaaPurchaseDate],
  )

  const purchaseDateInFuture = useMemo(
    () => isPurchaseDateInFuture(settings.vuaaPurchaseDate),
    [settings.vuaaPurchaseDate],
  )

  const projection = useMemo(
    () => buildProjection(settings, { remainingContributionMonths }),
    [settings, remainingContributionMonths],
  )
  const expenseDrag = settings.fundExpenseRatio + settings.platformFee
  const netAnnualRate = useMemo(
    () => getNetAnnualRate(settings.annualReturn, expenseDrag),
    [settings.annualReturn, expenseDrag],
  )
  const currentYear = new Date().getFullYear()

  const updateField = <K extends keyof CompoundSettings>(
    field: K,
    value: CompoundSettings[K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleNumericInputChange =
    (field: NumericSettingKey) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const nextValue = Number(event.target.value)
      const sanitizedValue = Number.isNaN(nextValue) ? 0 : nextValue
      updateField(field, sanitizedValue as CompoundSettings[NumericSettingKey])
    }

  const handleDateChange =
    (field: DateSettingKey) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      const normalized = normalizeDateValue(value)
      updateField(field, normalized as CompoundSettings[DateSettingKey])
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
                onChange={handleNumericInputChange('principal')}
              />
            </label>

            <label>
              <span>Periodic contribution (€)</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.contribution}
                onChange={handleNumericInputChange('contribution')}
              />
            </label>

            <label>
              <span>Contribution cadence</span>
              <select
                value={settings.contributionFrequency}
                onChange={handleNumericInputChange('contributionFrequency')}
              >
                {CONTRIBUTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Compounding frequency</span>
              <select
                value={settings.compoundingFrequency}
                onChange={handleNumericInputChange('compoundingFrequency')}
              >
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
                onChange={handleNumericInputChange('annualReturn')}
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
                onChange={handleNumericInputChange('years')}
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
                onChange={handleNumericInputChange('fundExpenseRatio')}
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
                onChange={handleNumericInputChange('platformFee')}
              />
            </label>

            <label>
              <span>Freedom24 EUR balance</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.freedom24EuroBalance}
                onChange={handleNumericInputChange('freedom24EuroBalance')}
              />
            </label>

            <label>
              <span>Freedom24 USD balance</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.freedom24UsdBalance}
                onChange={handleNumericInputChange('freedom24UsdBalance')}
              />
            </label>

            <label>
              <span>VUAA shares held</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={settings.vuaaShareCount}
                onChange={handleNumericInputChange('vuaaShareCount')}
              />
            </label>

            <label>
              <span>Average purchase price (€)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={settings.vuaaPurchasePrice}
                onChange={handleNumericInputChange('vuaaPurchasePrice')}
              />
            </label>

            <label>
              <span>Last purchase date</span>
              <input
                type="date"
                value={normalizeDateValue(settings.vuaaPurchaseDate)}
                onChange={handleDateChange('vuaaPurchaseDate')}
              />
              <span className="input-hint">
                {purchaseDateInFuture
                  ? 'Purchase date is in the future — contributions begin once it passes.'
                  : remainingContributionMonths === 0
                    ? `No whole months remain in ${currentYear} after today.`
                    : `${remainingContributionMonths} whole month${
                        remainingContributionMonths === 1 ? '' : 's'
                      } remain in ${currentYear} to plan contributions.`}
              </span>
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
            <div className="holdings-card">
              <h4>Holdings snapshot</h4>
              <dl>
                <div>
                  <dt>Freedom24 EUR balance</dt>
                  <dd>{currencyFormatter.format(settings.freedom24EuroBalance)}</dd>
                </div>
                <div>
                  <dt>Freedom24 USD balance</dt>
                  <dd>{usdCurrencyFormatter.format(settings.freedom24UsdBalance)}</dd>
                </div>
                <div>
                  <dt>VUAA shares held</dt>
                  <dd>{settings.vuaaShareCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                </div>
                <div>
                  <dt>Average purchase price</dt>
                  <dd>{detailedEuroFormatter.format(settings.vuaaPurchasePrice)}</dd>
                </div>
                <div>
                  <dt>Last purchase date</dt>
                  <dd>{formatHoldingsDate(settings.vuaaPurchaseDate)}</dd>
                </div>
              </dl>
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
