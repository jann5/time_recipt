import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { type AppLanguage } from '../i18n'

interface SettingsCardProps {
  onNavigate?: (screen: 'weekly' | 'settings' | 'daily') => void
  language: AppLanguage
  onLanguageChange?: (nextLanguage: AppLanguage) => Promise<void>
}

type BrowserCategory = 'productive' | 'distraction'
type DomainCategory = 'productive' | 'distraction' | 'neutral'
type DomainSource = 'manual' | 'system' | 'auto'

interface BrowserRule {
  pattern: string
  label: string
  category: BrowserCategory
  browsers: string[]
}

interface BrowserRuleDraft {
  pattern: string
  label: string
  category: BrowserCategory
}

interface UserSettings {
  distraction_apps: string[]
  work_apps: string[]
  browser_rules: BrowserRule[]
  daily_report_time: string
  notifications_enabled: boolean
  language: AppLanguage
}

interface BrowserDomainInsight {
  host: string
  label: string
  today_seconds: number
  total_seconds: number
  category: DomainCategory
  confidence: number
  source: DomainSource
}

interface BrowserInsightBucket {
  browser_name: string
  domains: BrowserDomainInsight[]
}

interface BrowserInsights {
  browsers: BrowserInsightBucket[]
}

interface AppInsight {
  name: string
  today_seconds: number
  total_seconds: number
  category: DomainCategory
  confidence: number
  source: DomainSource
}

interface AppInsights {
  apps: AppInsight[]
}

const supportedBrowsers = ['Google Chrome', 'Safari']

const fallbackSettings: UserSettings = {
  distraction_apps: [
    'WhatsApp Messenger',
    'Telegram',
    'Discord',
    'Spotify',
    'Steam',
    'Amazon Prime Video',
    'CapCut',
  ],
  work_apps: ['Visual Studio Code', 'Terminal', 'Figma'],
  browser_rules: [
    { pattern: 'youtube.com', label: 'YouTube', category: 'distraction', browsers: [] },
    { pattern: 'reddit.com', label: 'Reddit', category: 'distraction', browsers: [] },
    { pattern: 'figma.com', label: 'Figma', category: 'productive', browsers: [] },
    { pattern: 'github.com', label: 'GitHub', category: 'productive', browsers: [] },
  ],
  daily_report_time: '22:00',
  notifications_enabled: true,
  language: 'pl',
}

const fallbackBrowserInsights: BrowserInsights = {
  browsers: [],
}

const fallbackAppInsights: AppInsights = {
  apps: [],
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/>
      <path d="M12 19l-7-7 7-7"/>
    </svg>
  )
}

function normalizeUnique(values: string[]): string[] {
  const unique = new Set<string>()
  const ordered: string[] = []

  values.forEach((value) => {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || unique.has(key)) {
      return
    }
    unique.add(key)
    ordered.push(trimmed)
  })

  return ordered
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

function formatDuration(seconds: number, language: AppLanguage): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return language === 'en' ? `${h}h ${m}m` : `${h}h ${m}m`
  }
  return language === 'en' ? `${m}m` : `${m}m`
}

function sourceLabel(source: DomainSource, language: AppLanguage): string {
  if (source === 'manual') {
    return language === 'en' ? 'manual' : 'ręczne'
  }
  if (source === 'system') {
    return language === 'en' ? 'database' : 'baza'
  }
  return language === 'en' ? 'automatic' : 'automatyczne'
}

function isHelperOrUpdaterApp(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    normalized.includes('helper')
    || normalized.includes('updater')
    || normalized.includes('updateagent')
    || normalized.includes('autoupdate')
    || normalized.includes('softwareupdate')
    || normalized.includes('(gpu)')
    || normalized.includes('(renderer)')
    || normalized.includes('(alerts)')
  )
}

function isBrowserShellApp(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return [
    'google chrome',
    'safari',
    'brave browser',
    'arc',
    'firefox',
    'microsoft edge',
  ].includes(normalized)
}

function isWebOnlyPseudoApp(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return [
    'youtube',
    'twitter',
    'x',
    'facebook',
    'instagram',
    'tiktok',
    'reddit',
    'netflix',
    'messenger',
  ].includes(normalized)
}

function sanitizeDistractionApps(apps: string[]): string[] {
  return normalizeUnique(
    apps.filter((appName) => !isHelperOrUpdaterApp(appName) && !isBrowserShellApp(appName) && !isWebOnlyPseudoApp(appName)),
  )
}

function sanitizeSettings(settings: UserSettings): UserSettings {
  const normalizedLanguage: AppLanguage = settings.language === 'en' ? 'en' : 'pl'

  return {
    ...settings,
    distraction_apps: sanitizeDistractionApps(settings.distraction_apps),
    work_apps: normalizeUnique(settings.work_apps),
    language: normalizedLanguage,
  }
}

function createEmptyRuleDraft(): BrowserRuleDraft {
  return {
    pattern: '',
    label: '',
    category: 'productive',
  }
}

function settingsEqual(a: UserSettings, b: UserSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function effectiveAutoCategory(category: DomainCategory): BrowserCategory {
  return category === 'distraction' ? 'distraction' : 'productive'
}

function normalizeDomainPattern(rawPattern: string): string {
  const trimmed = rawPattern.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }

  try {
    const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`
    const parsed = new URL(candidate)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim()
  }
}

function extractAppNamesFromFiles(files: FileList): string[] {
  const names = new Set<string>()

  Array.from(files).forEach((file) => {
    const fileWithPath = file as File & { webkitRelativePath?: string }
    const relativePath = fileWithPath.webkitRelativePath || file.name
    const segments = relativePath.split('/').filter(Boolean)

    const topLevelAppSegment = segments.find((segment) => segment.toLowerCase().endsWith('.app'))
    if (!topLevelAppSegment) {
      return
    }

    const appName = topLevelAppSegment.replace(/\.app$/i, '').trim()
    if (!appName || isHelperOrUpdaterApp(appName) || isBrowserShellApp(appName) || isWebOnlyPseudoApp(appName)) {
      return
    }

    names.add(appName)
  })

  return Array.from(names)
}

export default function SettingsCard({ onNavigate, language, onLanguageChange }: SettingsCardProps) {
  const isEnglish = language === 'en'
  const copy = {
    settingsAria: isEnglish ? 'Settings' : 'Ustawienia',
    backAria: isEnglish ? 'Back' : 'Wróć',
    title: isEnglish ? 'SETTINGS' : 'USTAWIENIA',
    printTime: isEnglish ? 'PRINT TIME' : 'GODZINA WYDRUKU',
    browserTabs: isEnglish ? '2. BROWSER TABS' : '2. KARTY PRZEGLĄDARKI',
    appsSection: isEnglish ? '3. APPS' : '3. APLIKACJE',
    collapse: isEnglish ? 'Collapse' : 'Zwiń',
    expand: isEnglish ? 'Expand' : 'Rozwiń',
    loadingDomains: isEnglish
      ? 'Loading visited domains...'
      : 'Ładowanie odwiedzonych domen...',
    noDomains: isEnglish
      ? 'No visited domains in this browser (last 30 days).'
      : 'Brak odwiedzonych domen w tej przeglądarce (ostatnie 30 dni).',
    today: isEnglish ? 'today' : 'dziś',
    days30: isEnglish ? '30 days' : '30 dni',
    confidence: isEnglish ? 'confidence' : 'pewność',
    productive: isEnglish ? 'Productive' : 'Produktywna',
    distraction: isEnglish ? 'Distracting' : 'Rozpraszająca',
    domainPlaceholder: isEnglish
      ? 'Domain or URL, e.g. youtube.com'
      : 'Domena lub URL, np. youtube.com',
    labelPlaceholder: isEnglish
      ? 'Receipt label (optional)'
      : 'Nazwa na paragonie (opcjonalnie)',
    productivePlural: isEnglish ? 'Productive' : 'Produktywne',
    distractionPlural: isEnglish ? 'Distracting' : 'Rozpraszające',
    addDomain: isEnglish ? '+ Add domain' : '+ Dodaj domenę',
    loadingApps: isEnglish
      ? 'Loading app classifications...'
      : 'Ładowanie klasyfikacji aplikacji...',
    noApps: isEnglish
      ? 'No apps available for manual settings.'
      : 'Brak aplikacji do ręcznego ustawienia.',
    addAppsFromFolder: isEnglish
      ? '+ Add apps from folder (default: productive)'
      : '+ Dodaj aplikacje z folderu (domyślnie jako produktywne)',
    autoSaveInfo: isEnglish
      ? 'Changes are saved automatically.'
      : 'Zmiany zapisują się automatycznie.',
    timeFormatError: isEnglish
      ? 'Invalid time format. Use HH:MM.'
      : 'Niepoprawny format godziny. Użyj HH:MM.',
    saveError: isEnglish
      ? 'Could not save settings.'
      : 'Nie udało się zapisać ustawień.',
    loadSettingsError: isEnglish
      ? 'Could not load settings:'
      : 'Błąd pobierania ustawień:',
    loadDomainsError: isEnglish
      ? 'Could not load browser domains:'
      : 'Błąd pobierania domen przeglądarek:',
    loadAppsError: isEnglish
      ? 'Could not load app classifications:'
      : 'Błąd pobierania klasyfikacji aplikacji:',
    noAppsFoundInFolder: isEnglish
      ? 'No .app apps found (helpers, browsers and web pseudo-apps are skipped).'
      : 'Nie znaleziono aplikacji .app (helpery, przeglądarki i webowe pseudo-apki są pomijane).',
    domainRecognizeError: isEnglish
      ? 'Could not recognize domain.'
      : 'Nie udało się rozpoznać domeny.',
    domainInputError: isEnglish
      ? 'Enter domain or URL, e.g. youtube.com.'
      : 'Podaj domenę lub URL, np. youtube.com.',
    languageSection: isEnglish ? 'LANGUAGE' : 'JĘZYK',
    languageSaving: isEnglish ? 'Saving language...' : 'Zapisywanie języka...',
    languagePolish: isEnglish ? 'Polish' : 'Polski',
    languageEnglish: 'English',
  }

  const [settings, setSettings] = useState<UserSettings>(() => ({
    ...fallbackSettings,
    language,
  }))
  const [browserInsights, setBrowserInsights] = useState<BrowserInsights>(fallbackBrowserInsights)
  const [appInsights, setAppInsights] = useState<AppInsights>(fallbackAppInsights)
  const [loading, setLoading] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [loadingAppInsights, setLoadingAppInsights] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isChangingLanguage, setIsChangingLanguage] = useState(false)
  const [expandedBrowser, setExpandedBrowser] = useState<string | null>(null)
  const [appsPanelOpen, setAppsPanelOpen] = useState(false)
  const [timeDraft, setTimeDraft] = useState(fallbackSettings.daily_report_time)
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, BrowserRuleDraft>>({})

  const loadBrowserInsights = useCallback(async () => {
    try {
      const data = await invoke<BrowserInsights>('get_browser_insights')
      setBrowserInsights(data)
    } catch (error) {
      console.error(copy.loadDomainsError, error)
    } finally {
      setLoadingInsights(false)
    }
  }, [copy.loadDomainsError])

  const loadAppInsights = useCallback(async () => {
    try {
      const data = await invoke<AppInsights>('get_app_insights')
      setAppInsights(data)
    } catch (error) {
      console.error(copy.loadAppsError, error)
    } finally {
      setLoadingAppInsights(false)
    }
  }, [copy.loadAppsError])

  const persistSettings = async (nextSettings: UserSettings) => {
    try {
      setSaveError(null)
      await invoke('update_settings', { newSettings: nextSettings })
      await loadBrowserInsights()
      await loadAppInsights()
    } catch (error) {
      console.error('Błąd zapisywania ustawień:', error)
      setSaveError(copy.saveError)
    }
  }

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await invoke<UserSettings>('get_settings')
        const sanitized = sanitizeSettings(data)
        setSettings(sanitized)
        setTimeDraft(sanitized.daily_report_time)

        if (!settingsEqual(data, sanitized)) {
          await invoke('update_settings', { newSettings: sanitized })
        }
      } catch (error) {
        console.error(copy.loadSettingsError, error)
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
    void loadBrowserInsights()
    void loadAppInsights()

    const interval = window.setInterval(() => {
      void loadBrowserInsights()
      void loadAppInsights()
    }, 15000)

    return () => {
      clearInterval(interval)
    }
  }, [copy.loadSettingsError, loadAppInsights, loadBrowserInsights])

  const insightBrowsers = useMemo(
    () => browserInsights.browsers.map((entry) => entry.browser_name),
    [browserInsights.browsers],
  )

  const visibleBrowsers = useMemo(
    () => normalizeUnique([...supportedBrowsers, ...insightBrowsers]),
    [insightBrowsers],
  )

  const updateSettings = (nextSettings: UserSettings) => {
    const sanitized = sanitizeSettings(nextSettings)
    setSettings(sanitized)
    void persistSettings(sanitized)
  }

  const changeLanguage = async (nextLanguage: AppLanguage) => {
    if (nextLanguage === language || isChangingLanguage) {
      return
    }

    setIsChangingLanguage(true)
    setSaveError(null)

    try {
      if (onLanguageChange) {
        await onLanguageChange(nextLanguage)
      }
      updateSettings({
        ...settings,
        language: nextLanguage,
      })
    } finally {
      setIsChangingLanguage(false)
    }
  }

  const isInList = (items: string[], value: string) => {
    const key = value.trim().toLowerCase()
    return items.some((item) => item.trim().toLowerCase() === key)
  }

  const currentAppManualCategory = (appName: string): DomainCategory => {
    if (isInList(settings.work_apps, appName)) {
      return 'productive'
    }
    if (isInList(settings.distraction_apps, appName)) {
      return 'distraction'
    }
    return 'neutral'
  }

  const setAppManualCategory = (appName: string, category: DomainCategory) => {
    const appKey = appName.trim().toLowerCase()

    let nextWorkApps = settings.work_apps.filter((entry) => entry.trim().toLowerCase() !== appKey)
    let nextDistractionApps = settings.distraction_apps.filter((entry) => entry.trim().toLowerCase() !== appKey)

    if (category === 'productive') {
      nextWorkApps = normalizeUnique([...nextWorkApps, appName])
    } else if (category === 'distraction') {
      nextDistractionApps = sanitizeDistractionApps([...nextDistractionApps, appName])
    }

    updateSettings({
      ...settings,
      work_apps: nextWorkApps,
      distraction_apps: nextDistractionApps,
    })
  }

  const visibleAppInsights = useMemo(() => {
    const byName = new Map<string, AppInsight>()
    appInsights.apps.forEach((app) => {
      byName.set(app.name.trim().toLowerCase(), app)
    })

    const allNames = normalizeUnique([
      ...appInsights.apps.map((app) => app.name),
      ...settings.work_apps,
      ...settings.distraction_apps,
    ])

    return allNames
      .map((name) => {
        const key = name.trim().toLowerCase()
        const insight = byName.get(key)
        const manualCategory = currentAppManualCategory(name)

        if (!insight) {
          return {
            name,
            today_seconds: 0,
            total_seconds: 0,
            category: manualCategory,
            confidence: manualCategory === 'neutral' ? 35 : 100,
            source: manualCategory === 'neutral' ? 'auto' : 'manual',
          } satisfies AppInsight
        }

        if (manualCategory !== 'neutral') {
          return {
            ...insight,
            category: manualCategory,
            confidence: 100,
            source: 'manual',
          } satisfies AppInsight
        }

        return insight
      })
      .sort((a, b) => (
        b.today_seconds - a.today_seconds
        || b.total_seconds - a.total_seconds
        || a.name.localeCompare(b.name)
      ))
  }, [appInsights.apps, settings.distraction_apps, settings.work_apps])

  const addAppsFromFolder = () => {
    const input = document.createElement('input') as HTMLInputElement & {
      webkitdirectory?: boolean
      directory?: boolean
    }

    input.type = 'file'
    input.multiple = true
    input.webkitdirectory = true
    input.directory = true

    input.onchange = () => {
      const files = input.files
      if (!files || files.length === 0) {
        return
      }

      const appNames = extractAppNamesFromFiles(files)
      if (appNames.length === 0) {
        setSaveError(copy.noAppsFoundInFolder)
        return
      }

      const nextWorkApps = normalizeUnique([...settings.work_apps, ...appNames])
      updateSettings({
        ...settings,
        work_apps: nextWorkApps,
      })
    }

    input.click()
  }

  const saveTime = () => {
    const normalized = timeDraft.trim()
    if (!isValidTime(normalized)) {
      setSaveError(copy.timeFormatError)
      return
    }

    if (normalized === settings.daily_report_time) {
      return
    }

    updateSettings({
      ...settings,
      daily_report_time: normalized,
    })
  }

  const updateRuleDraft = (browser: string, patch: Partial<BrowserRuleDraft>) => {
    setRuleDrafts((currentDrafts) => ({
      ...currentDrafts,
      [browser]: {
        ...(currentDrafts[browser] ?? createEmptyRuleDraft()),
        ...patch,
      },
    }))
  }

  const getRuleDraft = (browser: string): BrowserRuleDraft => {
    return ruleDrafts[browser] ?? createEmptyRuleDraft()
  }

  const addOrUpdateBrowserSpecificRule = (
    browser: string,
    host: string,
    label: string,
    category: BrowserCategory,
  ) => {
    const cleanPattern = normalizeDomainPattern(host)
    if (!cleanPattern) {
      setSaveError(copy.domainRecognizeError)
      return
    }

    const browserKey = browser.toLowerCase()
    const nextRules = [...settings.browser_rules]
    const existingIndex = nextRules.findIndex((rule) => (
      normalizeDomainPattern(rule.pattern) === cleanPattern
        && rule.browsers.map((entry) => entry.toLowerCase()).includes(browserKey)
    ))

    if (existingIndex >= 0) {
      nextRules[existingIndex] = {
        ...nextRules[existingIndex],
        label: label.trim() || cleanPattern,
        category,
        browsers: [browserKey],
      }
    } else {
      nextRules.push({
        pattern: cleanPattern,
        label: label.trim() || cleanPattern,
        category,
        browsers: [browserKey],
      })
    }

    updateSettings({
      ...settings,
      browser_rules: nextRules,
    })
  }

  const addBrowserRule = (browser: string) => {
    const draft = getRuleDraft(browser)
    const cleanPattern = normalizeDomainPattern(draft.pattern)

    if (!cleanPattern) {
      setSaveError(copy.domainInputError)
      return
    }

    addOrUpdateBrowserSpecificRule(browser, cleanPattern, draft.label || cleanPattern, draft.category)
    setRuleDrafts((currentDrafts) => ({
      ...currentDrafts,
      [browser]: createEmptyRuleDraft(),
    }))
  }

  const insightsForBrowser = (browser: string) => {
    return browserInsights.browsers.find((entry) => entry.browser_name === browser)?.domains ?? []
  }

  return (
    <div className="h-full w-full">
      <div
        role="dialog"
        aria-label={copy.settingsAria}
        className="flex-shrink-0 h-full w-full"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: '0',
          minHeight: '100%',
          height: '100%',
          maxHeight: '100%',
          background: '#fbfaf5',
          borderRadius: 0,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 28,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingRight: 24,
          color: '#1c1b1b',
          fontFamily: 'Courier Prime, monospace',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <button
            onClick={() => onNavigate && onNavigate('daily')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: '#1c1b1b',
              opacity: 0.6,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.opacity = '0.6'
            }}
            aria-label={copy.backAria}
          >
            <BackIcon />
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.25em',
              marginBottom: 12,
              color: '#888',
              textTransform: 'uppercase',
            }}
          >
            FUGIT
          </div>

          <div style={{ width: 40, height: 1, background: '#1c1b1b', margin: '0 auto 16px' }} />

          <h1
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.18em',
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
            }}
          >
            {copy.title}
          </h1>
        </div>

        <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 24 }} />

        <div
          className="settings-scroll-panel"
          style={{ flex: 1, overflowY: 'auto', opacity: loading ? 0.7 : 1, paddingRight: 10 }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.2em',
                marginBottom: 12,
                textTransform: 'uppercase',
              }}
            >
              {copy.printTime}
            </div>

            <input
              type="time"
              value={timeDraft}
              onChange={(event) => setTimeDraft(event.target.value)}
              onBlur={saveTime}
              style={{
                width: '100%',
                fontSize: 11,
                padding: '10px 0',
                border: 'none',
                borderBottom: '1px dashed #d0d0d0',
                background: 'transparent',
                fontFamily: 'Courier Prime, monospace',
                color: '#1c1b1b',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.2em',
                marginBottom: 12,
                textTransform: 'uppercase',
              }}
            >
              {copy.browserTabs}
            </div>

            <div style={{ marginTop: 8, paddingTop: 2 }}>
              {visibleBrowsers.map((browser) => {
                const isExpanded = expandedBrowser === browser
                const insights = insightsForBrowser(browser)
                const draft = getRuleDraft(browser)

                return (
                  <div key={browser} style={{ borderBottom: '1px dashed #e8e8e8', paddingBottom: 8 }}>
                    <button
                      onClick={() => setExpandedBrowser(isExpanded ? null : browser)}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'Courier Prime, monospace',
                        fontSize: 11,
                        color: '#1c1b1b',
                        padding: '6px 0',
                      }}
                    >
                      <span>{browser}</span>
                      <span style={{ color: '#666', fontSize: 10 }}>{isExpanded ? copy.collapse : copy.expand}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loadingInsights && (
                          <div style={{ fontSize: 10, color: '#777' }}>{copy.loadingDomains}</div>
                        )}

                        {!loadingInsights && insights.length === 0 && (
                          <div style={{ fontSize: 10, color: '#777' }}>
                            {copy.noDomains}
                          </div>
                        )}

                        {insights.map((domain) => {
                          const selectedCategory = effectiveAutoCategory(domain.category)
                          return (
                            <div
                              key={`${browser}-${domain.host}`}
                              style={{
                                border: '1px dashed #d8d8d8',
                                borderRadius: 4,
                                padding: 8,
                                background: '#fffdf7',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 11 }}>{domain.label}</span>
                                <span style={{ fontSize: 9, color: '#888', textTransform: 'uppercase' }}>
                                  {sourceLabel(domain.source, language)}
                                </span>
                              </div>

                              <div style={{ fontSize: 10, color: '#777', marginBottom: 4 }}>{domain.host}</div>
                              <div style={{ fontSize: 10, color: '#777', marginBottom: 6 }}>
                                {copy.today}: {formatDuration(domain.today_seconds, language)} · {copy.days30}: {formatDuration(domain.total_seconds, language)} · {copy.confidence}: {domain.confidence}%
                              </div>

                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => addOrUpdateBrowserSpecificRule(browser, domain.host, domain.label, 'productive')}
                                  style={{
                                    border: '1px solid #ccc',
                                    background: selectedCategory === 'productive' ? '#f2f7f2' : '#fff',
                                    padding: '4px 7px',
                                    borderRadius: 3,
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    fontFamily: 'Courier Prime, monospace',
                                    color: '#1c1b1b',
                                  }}
                                >
                                  {copy.productive}
                                </button>

                                <button
                                  onClick={() => addOrUpdateBrowserSpecificRule(browser, domain.host, domain.label, 'distraction')}
                                  style={{
                                    border: '1px solid #ccc',
                                    background: selectedCategory === 'distraction' ? '#f8f2f2' : '#fff',
                                    padding: '4px 7px',
                                    borderRadius: 3,
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    fontFamily: 'Courier Prime, monospace',
                                    color: '#1c1b1b',
                                  }}
                                >
                                  {copy.distraction}
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        <div
                          style={{
                            border: '1px dashed #d8d8d8',
                            borderRadius: 4,
                            padding: 8,
                            background: '#fffdf7',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <input
                            value={draft.pattern}
                            onChange={(event) => updateRuleDraft(browser, { pattern: event.target.value })}
                            placeholder={copy.domainPlaceholder}
                            style={{
                              width: '100%',
                              fontSize: 10,
                              padding: '6px 8px',
                              border: '1px solid #ddd',
                              borderRadius: 3,
                              background: '#fff',
                              fontFamily: 'Courier Prime, monospace',
                              color: '#1c1b1b',
                              outline: 'none',
                            }}
                          />

                          <input
                            value={draft.label}
                            onChange={(event) => updateRuleDraft(browser, { label: event.target.value })}
                            placeholder={copy.labelPlaceholder}
                            style={{
                              width: '100%',
                              fontSize: 10,
                              padding: '6px 8px',
                              border: '1px solid #ddd',
                              borderRadius: 3,
                              background: '#fff',
                              fontFamily: 'Courier Prime, monospace',
                              color: '#1c1b1b',
                              outline: 'none',
                            }}
                          />

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={draft.category}
                              onChange={(event) => updateRuleDraft(browser, { category: event.target.value as BrowserCategory })}
                              style={{
                                flex: 1,
                                fontSize: 10,
                                padding: '6px 8px',
                                border: '1px solid #ddd',
                                borderRadius: 3,
                                background: '#fff',
                                fontFamily: 'Courier Prime, monospace',
                                color: '#1c1b1b',
                              }}
                            >
                              <option value="productive">{copy.productivePlural}</option>
                              <option value="distraction">{copy.distractionPlural}</option>
                            </select>

                            <button
                              onClick={() => addBrowserRule(browser)}
                              style={{
                                border: '1px solid #ccc',
                                background: '#fff',
                                cursor: 'pointer',
                                fontFamily: 'Courier Prime, monospace',
                                fontSize: 10,
                                letterSpacing: '0.05em',
                                color: '#1c1b1b',
                                padding: '6px 8px',
                                borderRadius: 3,
                              }}
                            >
                              {copy.addDomain}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setAppsPanelOpen((value) => !value)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                borderBottom: '1px dashed #e8e8e8',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'Courier Prime, monospace',
                fontSize: 10,
                fontWeight: 700,
                color: '#1c1b1b',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                padding: '8px 0',
              }}
            >
              <span>{copy.appsSection}</span>
              <span style={{ color: '#666', fontSize: 10 }}>{appsPanelOpen ? copy.collapse : copy.expand}</span>
            </button>

            {appsPanelOpen && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loadingAppInsights && (
                  <div style={{ fontSize: 10, color: '#777' }}>
                    {copy.loadingApps}
                  </div>
                )}

                {!loadingAppInsights && visibleAppInsights.length === 0 && (
                  <div style={{ fontSize: 10, color: '#777' }}>
                    {copy.noApps}
                  </div>
                )}

                {visibleAppInsights.map((app) => {
                  const manualCategory = currentAppManualCategory(app.name)
                  const selectedCategory: BrowserCategory = manualCategory === 'neutral'
                    ? effectiveAutoCategory(app.category)
                    : manualCategory
                  return (
                    <div
                      key={app.name}
                      style={{
                        border: '1px dashed #d8d8d8',
                        borderRadius: 4,
                        padding: 8,
                        background: '#fffdf7',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11 }}>{app.name}</span>
                        <span style={{ fontSize: 9, color: '#888', textTransform: 'uppercase' }}>
                          {sourceLabel(manualCategory === 'neutral' ? app.source : 'manual', language)}
                        </span>
                      </div>

                      <div style={{ fontSize: 10, color: '#777', marginBottom: 6 }}>
                        {copy.today}: {formatDuration(app.today_seconds, language)} · {copy.days30}: {formatDuration(app.total_seconds, language)} · {copy.confidence}: {manualCategory === 'neutral' ? app.confidence : 100}%
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setAppManualCategory(app.name, 'productive')}
                          style={{
                            border: '1px solid #ccc',
                            background: selectedCategory === 'productive' ? '#f2f7f2' : '#fff',
                            padding: '4px 7px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10,
                            fontFamily: 'Courier Prime, monospace',
                            color: '#1c1b1b',
                          }}
                        >
                          {copy.productive}
                        </button>

                        <button
                          onClick={() => setAppManualCategory(app.name, 'distraction')}
                          style={{
                            border: '1px solid #ccc',
                            background: selectedCategory === 'distraction' ? '#f8f2f2' : '#fff',
                            padding: '4px 7px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10,
                            fontFamily: 'Courier Prime, monospace',
                            color: '#1c1b1b',
                          }}
                        >
                          {copy.distraction}
                        </button>
                      </div>
                    </div>
                  )
                })}

                <button
                  onClick={addAppsFromFolder}
                  style={{
                    marginTop: 4,
                    background: 'none',
                    border: 'none',
                    color: '#1c1b1b',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    cursor: 'pointer',
                    fontFamily: 'Courier Prime, monospace',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  {copy.addAppsFromFolder}
                </button>
              </div>
            )}
          </div>

          {saveError && (
            <div style={{ fontSize: 10, color: '#d32f2f', marginTop: 8 }}>
              {saveError}
            </div>
          )}
          <div style={{ borderTop: '1px dashed #c4c4c4', marginBottom: 20 }} />
          <div style={{ fontSize: 10, color: '#777', textAlign: 'center', fontStyle: 'italic' }}>
            {copy.autoSaveInfo}
          </div>

          <div style={{ borderTop: '1px dashed #c4c4c4', marginTop: 16, paddingTop: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.2em',
                marginBottom: 10,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {copy.languageSection}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  void changeLanguage('pl')
                }}
                disabled={isChangingLanguage}
                style={{
                  border: '1px solid #ccc',
                  background: language === 'pl' ? '#f2f7f2' : '#fff',
                  padding: '6px 10px',
                  borderRadius: 3,
                  cursor: isChangingLanguage ? 'default' : 'pointer',
                  fontSize: 10,
                  fontFamily: 'Courier Prime, monospace',
                  color: '#1c1b1b',
                  opacity: isChangingLanguage ? 0.7 : 1,
                }}
              >
                {copy.languagePolish}
              </button>
              <button
                onClick={() => {
                  void changeLanguage('en')
                }}
                disabled={isChangingLanguage}
                style={{
                  border: '1px solid #ccc',
                  background: language === 'en' ? '#f2f7f2' : '#fff',
                  padding: '6px 10px',
                  borderRadius: 3,
                  cursor: isChangingLanguage ? 'default' : 'pointer',
                  fontSize: 10,
                  fontFamily: 'Courier Prime, monospace',
                  color: '#1c1b1b',
                  opacity: isChangingLanguage ? 0.7 : 1,
                }}
              >
                {copy.languageEnglish}
              </button>
            </div>
            {isChangingLanguage && (
              <div style={{ fontSize: 10, color: '#777', textAlign: 'center', marginTop: 8 }}>
                {copy.languageSaving}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
