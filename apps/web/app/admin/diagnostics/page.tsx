'use client'

import { useState } from 'react'

interface ServiceResult {
  ok: boolean
  latencyMs: number
  detail?: string
  preview?: string
}

interface DiagnosticsResponse {
  timestamp: string
  services: {
    database: ServiceResult
    openrouter: ServiceResult
    r2: ServiceResult
    resend: ServiceResult
    openmeteo: ServiceResult
    opentripmap: ServiceResult
    mapbox: ServiceResult
  }
}

interface SimulationStep {
  label: string
  tried: string
  ok: boolean
  latencyMs: number
  detail?: string
}

interface SimulationResult {
  ok: boolean
  totalMs: number
  steps: SimulationStep[]
  preview?: string
}

interface SimulationResponse {
  timestamp: string
  simulation: SimulationResult
}

const SERVICE_META: Record<string, { label: string; description: string; icon: string }> = {
  database: { label: 'Neon PostgreSQL', description: 'Primary database via Drizzle ORM', icon: 'database' },
  openrouter: { label: 'OpenRouter AI', description: 'AI itinerary & place card generation', icon: 'smart_toy' },
  r2: { label: 'Cloudflare R2', description: 'Avatar & trip cover image storage', icon: 'cloud_upload' },
  resend: { label: 'Resend Email', description: 'Transactional email delivery', icon: 'mail' },
  openmeteo: { label: 'Open-Meteo', description: 'Weather forecast (free, no key)', icon: 'partly_cloudy_day' },
  opentripmap: { label: 'OpenTripMap', description: 'Points of interest enrichment', icon: 'explore' },
  mapbox: { label: 'Mapbox', description: 'Destination search autocomplete', icon: 'map' },
}

function StatusBadge({ ok, loading }: { ok: boolean | null; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant animate-pulse">
        <span className="w-2 h-2 rounded-full bg-outline-variant inline-block" />
        Testing…
      </span>
    )
  }
  if (ok === null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-outline-variant inline-block" />
        Idle
      </span>
    )
  }
  return ok ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
      OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
      FAIL
    </span>
  )
}

export default function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingService, setLoadingService] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  async function runAll() {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/admin/diagnostics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DiagnosticsResponse = await res.json()
      setResults(data)
      setTimestamp(data.timestamp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run diagnostics')
    } finally {
      setLoading(false)
    }
  }

  async function runOne(key: string) {
    setLoadingService(key)
    setError(null)
    try {
      const res = await fetch(`/api/admin/diagnostics?service=${key}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DiagnosticsResponse = await res.json()
      setResults(prev => prev
        ? { ...prev, services: { ...prev.services, [key]: data.services[key as keyof typeof data.services] }, timestamp: data.timestamp }
        : data
      )
      setTimestamp(data.timestamp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoadingService(null)
    }
  }

  async function runSimulation() {
    setSimLoading(true)
    setSimError(null)
    setSimulation(null)
    try {
      const res = await fetch('/api/admin/diagnostics', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: SimulationResponse = await res.json()
      setSimulation(data.simulation)
    } catch (e) {
      setSimError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setSimLoading(false)
    }
  }

  const services = Object.entries(SERVICE_META)
  const allOk = results && Object.values(results.services).every(s => s.ok)
  const failCount = results ? Object.values(results.services).filter(s => !s.ok).length : 0

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">Administration</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight mb-1">Diagnostics</h1>
          <p className="text-on-surface-variant">Test all external services and integrations</p>
        </div>

        {/* Run all button + summary */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <button
            onClick={runAll}
            disabled={loading}
            className="inline-flex items-center gap-2 horizon-gradient text-on-primary px-6 py-3 rounded-2xl font-headline font-semibold text-sm disabled:opacity-60 transition-opacity"
          >
            <span className="material-symbols-outlined text-[20px]">
              {loading ? 'hourglass_empty' : 'play_circle'}
            </span>
            {loading ? 'Running all tests…' : 'Run All Tests'}
          </button>

          {results && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold ${allOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <span className="material-symbols-outlined text-[18px]">
                {allOk ? 'check_circle' : 'warning'}
              </span>
              {allOk ? 'All systems operational' : `${failCount} service${failCount !== 1 ? 's' : ''} failing`}
              {timestamp && <span className="font-normal text-xs opacity-70 ml-2">· {new Date(timestamp).toLocaleTimeString()}</span>}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {/* Service rows */}
        <div className="flex flex-col gap-3">
          {services.map(([key, meta]) => {
            const result = results?.services[key as keyof typeof results.services] ?? null
            const isLoading = loading || loadingService === key
            return (
              <div
                key={key}
                className="bg-surface-container-lowest rounded-3xl p-5 shadow-card flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Icon + info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {meta.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{meta.label}</p>
                    <p className="text-xs text-on-surface-variant">{meta.description}</p>
                    {result && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs text-on-surface-variant">{result.latencyMs}ms</span>
                        {result.detail && (
                          <span className={`text-xs truncate max-w-xs ${result.ok ? 'text-on-surface-variant' : 'text-red-600'}`}>
                            {result.detail}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status + test button */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge ok={result?.ok ?? null} loading={isLoading} />
                  <button
                    onClick={() => runOne(key)}
                    disabled={loading || loadingService !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                    Test
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Trip Generation Simulation ─────────────────────────────── */}
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="font-headline font-bold text-xl text-on-surface">Trip Generation Simulation</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              End-to-end AI pipeline test using a fixed mock trip:{' '}
              <span className="font-medium text-on-surface">Paris · 2 days · couple · cultural</span>.
              Each step reports what was attempted and whether it succeeded. Makes a real AI call — may take 10–30 s.
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card">
            {/* Run button + summary badge */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
              <button
                onClick={runSimulation}
                disabled={simLoading}
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-2xl font-semibold text-sm disabled:opacity-60 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {simLoading ? 'hourglass_empty' : 'science'}
                </span>
                {simLoading ? 'Simulating…' : 'Run Simulation'}
              </button>

              {simLoading && <StatusBadge ok={null} loading={true} />}
              {simulation && !simLoading && (
                <div className="flex items-center gap-2">
                  <StatusBadge ok={simulation.ok} loading={false} />
                  <span className="text-xs text-on-surface-variant">{simulation.totalMs}ms total</span>
                </div>
              )}
            </div>

            {simError && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {simError}
              </div>
            )}

            {/* Step-by-step results */}
            {(simulation?.steps ?? (simLoading ? [] : null)) !== null && (
              <div className="flex flex-col gap-2">
                {(simulation?.steps ?? []).map((step, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl border px-4 py-3 ${
                      step.ok
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 ${step.ok ? 'text-green-600' : 'text-red-500'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {step.ok ? 'check_circle' : 'cancel'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${step.ok ? 'text-green-800' : 'text-red-800'}`}>
                            Step {i + 1}: {step.label}
                          </span>
                          <span className="text-xs text-on-surface-variant">{step.latencyMs}ms</span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Tried: <span className="font-mono">{step.tried}</span>
                        </p>
                        {step.detail && (
                          <p className={`text-xs mt-1 font-mono break-words ${step.ok ? 'text-green-700' : 'text-red-700'}`}>
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pending steps shown as idle when loading */}
                {simLoading && (
                  <div className="rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-outline">hourglass_empty</span>
                      <span className="text-sm text-on-surface-variant">Running next step…</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Back link */}
        <div className="mt-8">
          <a href="/admin" className="text-sm text-primary hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Admin
          </a>
        </div>
      </div>
    </div>
  )
}
