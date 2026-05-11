use chrono::{Datelike, Duration as ChronoDuration, Local, NaiveDate};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::ffi::c_void;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::window::Window;
use tauri::{Emitter, LogicalSize, Manager, State};
use tokio::sync::Mutex;
use url::Url;

const MIN_REPORT_ENTRY_SECONDS: u64 = 10 * 60;

#[cfg(target_os = "macos")]
use core_foundation_sys::base::{kCFAllocatorDefault, CFRelease};
#[cfg(target_os = "macos")]
use core_foundation_sys::dictionary::{
    kCFTypeDictionaryKeyCallBacks, kCFTypeDictionaryValueCallBacks, CFDictionaryCreate,
    CFDictionaryRef,
};
#[cfg(target_os = "macos")]
use core_foundation_sys::number::{kCFBooleanFalse, kCFBooleanTrue};
#[cfg(target_os = "macos")]
use core_foundation_sys::string::CFStringRef;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
    static kAXTrustedCheckOptionPrompt: CFStringRef;
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityKind {
    App,
    BrowserTab,
}

impl Default for ActivityKind {
    fn default() -> Self {
        Self::App
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BrowserCategory {
    Productive,
    Distraction,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DomainCategory {
    Productive,
    Distraction,
    Neutral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserRule {
    pub pattern: String,
    pub label: String,
    pub category: BrowserCategory,
    #[serde(default)]
    pub browsers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUsage {
    pub name: String,
    pub time_seconds: u64,
    #[serde(default)]
    pub window_titles: Vec<String>,
    #[serde(default)]
    pub activity_kind: ActivityKind,
    #[serde(default)]
    pub browser_name: Option<String>,
    #[serde(default)]
    pub browser_host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStats {
    pub date: String,
    pub apps: Vec<AppUsage>,
    pub alt_tab_count: u64,
    pub last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UserSettings {
    pub distraction_apps: Vec<String>,
    pub work_apps: Vec<String>,
    pub browser_rules: Vec<BrowserRule>,
    pub daily_report_time: String,
    pub notifications_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReport {
    pub date: String,
    pub daily_report_time: String,
    pub productive_apps: Vec<AppUsage>,
    pub distraction_apps: Vec<AppUsage>,
    pub neutral_apps: Vec<AppUsage>,
    pub alt_tab_count: u64,
    pub total_productive_seconds: u64,
    pub total_distraction_seconds: u64,
    pub total_neutral_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyDayHistory {
    pub date: String,
    pub day: String,
    pub productivity: u8,
    pub streak: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyHistory {
    pub week_label: String,
    pub week_start: String,
    pub week_end: String,
    pub days: Vec<WeeklyDayHistory>,
    pub average_productivity: u8,
    pub best_day_label: String,
    pub best_day_productivity: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserDomainInsight {
    pub host: String,
    pub label: String,
    pub today_seconds: u64,
    pub total_seconds: u64,
    pub category: DomainCategory,
    pub confidence: u8,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserInsightBucket {
    pub browser_name: String,
    pub domains: Vec<BrowserDomainInsight>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserInsights {
    pub browsers: Vec<BrowserInsightBucket>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppInsight {
    pub name: String,
    pub today_seconds: u64,
    pub total_seconds: u64,
    pub category: DomainCategory,
    pub confidence: u8,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppInsights {
    pub apps: Vec<AppInsight>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrackingProbe {
    pub accessibility_permission: bool,
    pub can_read_frontmost_app: bool,
    pub frontmost_app: Option<String>,
    pub error: Option<String>,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            distraction_apps: vec![
                "WhatsApp Messenger".to_string(),
                "Telegram".to_string(),
                "Discord".to_string(),
                "Spotify".to_string(),
                "Steam".to_string(),
                "Amazon Prime Video".to_string(),
                "CapCut".to_string(),
            ],
            work_apps: vec![
                "Visual Studio Code".to_string(),
                "Code".to_string(),
                "Terminal".to_string(),
                "iTerm2".to_string(),
                "Figma".to_string(),
                "Notes".to_string(),
                "Notatki".to_string(),
                "Xcode".to_string(),
                "Obsidian".to_string(),
                "Notion".to_string(),
                "Linear".to_string(),
                "Jira".to_string(),
            ],
            browser_rules: default_browser_rules(),
            daily_report_time: "22:00".to_string(),
            notifications_enabled: true,
        }
    }
}

#[derive(Debug, Clone)]
struct ActivityContext {
    front_app: String,
    tracked_name: String,
    activity_kind: ActivityKind,
    browser_name: Option<String>,
    browser_host: Option<String>,
    window_title: String,
}

struct AppState {
    current_activity: Arc<Mutex<Option<ActivityContext>>>,
    activity_start_time: Arc<Mutex<Option<Instant>>>,
    daily_stats: Arc<Mutex<DailyStats>>,
    settings: Arc<Mutex<UserSettings>>,
    alt_tab_count: Arc<Mutex<u64>>,
    last_front_app: Arc<Mutex<Option<String>>>,
    data_dir: PathBuf,
}

impl AppState {
    pub fn new() -> Self {
        let data_dir = Self::get_data_dir();
        let _ = fs::create_dir_all(&data_dir);

        let today = today_key();
        let stats = Self::load_daily_stats(&data_dir, &today);
        let settings = Self::load_settings(&data_dir);

        Self {
            current_activity: Arc::new(Mutex::new(None)),
            activity_start_time: Arc::new(Mutex::new(None)),
            daily_stats: Arc::new(Mutex::new(stats)),
            settings: Arc::new(Mutex::new(settings)),
            alt_tab_count: Arc::new(Mutex::new(0)),
            last_front_app: Arc::new(Mutex::new(None)),
            data_dir,
        }
    }

    fn get_data_dir() -> PathBuf {
        ProjectDirs::from("com", "jannawrot", "distraction-receipt")
            .map(|dirs| dirs.data_local_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from("./data"))
    }

    fn load_daily_stats(data_dir: &PathBuf, date: &str) -> DailyStats {
        let path = data_dir.join(format!("{date}.json"));
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(stats) = serde_json::from_str::<DailyStats>(&content) {
                return stats;
            }
        }

        DailyStats {
            date: date.to_string(),
            apps: Vec::new(),
            alt_tab_count: 0,
            last_updated: Local::now().to_rfc3339(),
        }
    }

    fn load_settings(data_dir: &PathBuf) -> UserSettings {
        let path = data_dir.join("settings.json");
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<UserSettings>(&content) {
                return normalize_settings(settings);
            }
        }
        normalize_settings(UserSettings::default())
    }

    fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
        let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, json).map_err(|e| e.to_string())?;
        fs::rename(&temp_path, path).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn write_stats_snapshot(&self, snapshot: &DailyStats) -> Result<(), String> {
        let path = self.data_dir.join(format!("{}.json", snapshot.date));
        Self::write_json_atomic(&path, snapshot)
    }

    pub async fn save_daily_stats(&self) -> Result<(), String> {
        let snapshot = self.daily_stats.lock().await.clone();
        self.write_stats_snapshot(&snapshot)
    }

    pub async fn save_settings(&self) -> Result<(), String> {
        let settings = self.settings.lock().await.clone();
        let path = self.data_dir.join("settings.json");
        Self::write_json_atomic(&path, &settings)
    }

    pub async fn ensure_current_day(&self) -> Result<(), String> {
        let today = today_key();
        let current_snapshot = self.daily_stats.lock().await.clone();
        if current_snapshot.date == today {
            return Ok(());
        }

        self.write_stats_snapshot(&current_snapshot)?;

        let new_stats = Self::load_daily_stats(&self.data_dir, &today);
        {
            let mut stats = self.daily_stats.lock().await;
            *stats = new_stats;
        }
        {
            let mut alt_tab_count = self.alt_tab_count.lock().await;
            *alt_tab_count = 0;
        }
        {
            let mut last_front_app = self.last_front_app.lock().await;
            *last_front_app = None;
        }
        {
            let has_activity = self.current_activity.lock().await.is_some();
            let mut activity_start_time = self.activity_start_time.lock().await;
            *activity_start_time = if has_activity {
                Some(Instant::now())
            } else {
                None
            };
        }

        self.save_daily_stats().await
    }

    fn read_daily_stats_files(&self) -> Vec<DailyStats> {
        let mut all_stats = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.data_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !is_daily_stats_path(&path) {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(stats) = serde_json::from_str::<DailyStats>(&content) {
                        all_stats.push(stats);
                    }
                }
            }
        }

        all_stats.sort_by(|a, b| b.date.cmp(&a.date));
        all_stats
    }
}

async fn flush_current_activity_elapsed(state: &AppState) -> Result<(), String> {
    let pending_update = {
        let current_activity = state.current_activity.lock().await.clone();
        let mut activity_start_time = state.activity_start_time.lock().await;

        match (current_activity, *activity_start_time) {
            (Some(context), Some(start_time)) => {
                let elapsed = start_time.elapsed().as_secs();
                if elapsed > 0 {
                    *activity_start_time = Some(start_time + Duration::from_secs(elapsed));
                    Some((context, elapsed))
                } else {
                    None
                }
            }
            (None, Some(_)) => {
                *activity_start_time = None;
                None
            }
            _ => None,
        }
    };

    let Some((context, elapsed)) = pending_update else {
        return Ok(());
    };

    {
        let mut stats = state.daily_stats.lock().await;
        upsert_app_usage(&mut stats.apps, &context, elapsed);
        stats.last_updated = Local::now().to_rfc3339();
    }

    state.save_daily_stats().await
}

#[tauri::command]
async fn get_daily_stats(state: State<'_, AppState>) -> Result<DailyStats, String> {
    state.ensure_current_day().await?;
    flush_current_activity_elapsed(&state).await?;
    state.save_daily_stats().await?;
    Ok(state.daily_stats.lock().await.clone())
}

#[tauri::command]
async fn get_daily_report(state: State<'_, AppState>) -> Result<DailyReport, String> {
    state.ensure_current_day().await?;
    flush_current_activity_elapsed(&state).await?;
    state.save_daily_stats().await?;

    let stats = state.daily_stats.lock().await.clone();
    let settings = state.settings.lock().await.clone();

    let mut productive_apps = Vec::new();
    let mut distraction_apps = Vec::new();
    let mut neutral_apps = Vec::new();

    let mut total_productive_seconds = 0_u64;
    let mut total_distraction_seconds = 0_u64;
    let mut total_neutral_seconds = 0_u64;

    let mut sorted_apps = stats.apps.clone();
    sorted_apps.sort_by(|a, b| b.time_seconds.cmp(&a.time_seconds));

    for app in sorted_apps {
        if app.time_seconds < MIN_REPORT_ENTRY_SECONDS {
            continue;
        }

        match classify_usage(&app, &settings) {
            UsageBucket::Productive => {
                total_productive_seconds += app.time_seconds;
                productive_apps.push(app);
            }
            UsageBucket::Distraction => {
                total_distraction_seconds += app.time_seconds;
                distraction_apps.push(app);
            }
            UsageBucket::Neutral => {
                total_neutral_seconds += app.time_seconds;
                neutral_apps.push(app);
            }
        }
    }

    Ok(DailyReport {
        date: stats.date,
        daily_report_time: settings.daily_report_time,
        productive_apps,
        distraction_apps,
        neutral_apps,
        alt_tab_count: stats.alt_tab_count,
        total_productive_seconds,
        total_distraction_seconds,
        total_neutral_seconds,
    })
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<UserSettings, String> {
    Ok(state.settings.lock().await.clone())
}

#[tauri::command]
async fn get_browser_insights(state: State<'_, AppState>) -> Result<BrowserInsights, String> {
    state.ensure_current_day().await?;
    flush_current_activity_elapsed(&state).await?;
    state.save_daily_stats().await?;

    let settings = state.settings.lock().await.clone();
    let today = today_key();
    let cutoff_date = Local::now().date_naive() - ChronoDuration::days(30);

    let all_stats = state.read_daily_stats_files();
    let mut totals_by_browser_host: HashMap<(String, String), (u64, u64)> = HashMap::new();

    for stats in all_stats {
        let parsed_date = NaiveDate::parse_from_str(&stats.date, "%Y-%m-%d").ok();
        if parsed_date.map_or(true, |date| date < cutoff_date) {
            continue;
        }

        let is_today = stats.date == today;
        for usage in stats.apps {
            if usage.activity_kind != ActivityKind::BrowserTab {
                continue;
            }

            let (Some(browser_name), Some(browser_host)) = (usage.browser_name, usage.browser_host)
            else {
                continue;
            };

            if usage.time_seconds == 0 {
                continue;
            }

            let entry = totals_by_browser_host
                .entry((browser_name, browser_host))
                .or_insert((0, 0));
            entry.0 += usage.time_seconds;
            if is_today {
                entry.1 += usage.time_seconds;
            }
        }
    }

    let mut grouped: HashMap<String, Vec<BrowserDomainInsight>> = HashMap::new();
    for ((browser_name, host), (total_seconds, today_seconds)) in totals_by_browser_host {
        if total_seconds == 0 {
            continue;
        }

        let classification = classify_browser_domain(&host, &browser_name, &settings);
        grouped
            .entry(browser_name)
            .or_default()
            .push(BrowserDomainInsight {
                host: host.clone(),
                label: classification.label,
                today_seconds,
                total_seconds,
                category: classification.category,
                confidence: classification.confidence,
                source: classification.source,
            });
    }

    let mut browsers = grouped
        .into_iter()
        .map(|(browser_name, mut domains)| {
            domains.sort_by(|a, b| {
                b.today_seconds
                    .cmp(&a.today_seconds)
                    .then_with(|| b.total_seconds.cmp(&a.total_seconds))
                    .then_with(|| a.host.cmp(&b.host))
            });
            BrowserInsightBucket {
                browser_name,
                domains,
            }
        })
        .collect::<Vec<_>>();

    browsers.sort_by(|a, b| a.browser_name.cmp(&b.browser_name));

    Ok(BrowserInsights { browsers })
}

#[tauri::command]
async fn get_app_insights(state: State<'_, AppState>) -> Result<AppInsights, String> {
    state.ensure_current_day().await?;
    flush_current_activity_elapsed(&state).await?;
    state.save_daily_stats().await?;

    let settings = state.settings.lock().await.clone();
    let today = today_key();
    let cutoff_date = Local::now().date_naive() - ChronoDuration::days(30);

    let all_stats = state.read_daily_stats_files();
    let mut totals_by_app: HashMap<String, (u64, u64)> = HashMap::new();

    for stats in all_stats {
        let parsed_date = NaiveDate::parse_from_str(&stats.date, "%Y-%m-%d").ok();
        if parsed_date.map_or(true, |date| date < cutoff_date) {
            continue;
        }

        let is_today = stats.date == today;
        for usage in stats.apps {
            if usage.activity_kind != ActivityKind::App {
                continue;
            }

            let app_name = usage.name.trim();
            if app_name.is_empty()
                || is_helper_or_updater_app(app_name)
                || is_browser_shell_app(app_name)
                || is_web_only_pseudo_app(app_name)
            {
                continue;
            }

            if usage.time_seconds == 0 {
                continue;
            }

            let entry = totals_by_app.entry(app_name.to_string()).or_insert((0, 0));
            entry.0 += usage.time_seconds;
            if is_today {
                entry.1 += usage.time_seconds;
            }
        }
    }

    let mut apps = totals_by_app
        .into_iter()
        .map(|(name, (total_seconds, today_seconds))| {
            let classification = classify_native_app(&name, &settings);
            AppInsight {
                name,
                today_seconds,
                total_seconds,
                category: classification.category,
                confidence: classification.confidence,
                source: classification.source,
            }
        })
        .collect::<Vec<_>>();

    apps.sort_by(|a, b| {
        b.today_seconds
            .cmp(&a.today_seconds)
            .then_with(|| b.total_seconds.cmp(&a.total_seconds))
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(AppInsights { apps })
}

#[tauri::command]
async fn update_settings(
    new_settings: UserSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let normalized = normalize_settings(new_settings);
    if !is_valid_report_time(&normalized.daily_report_time) {
        return Err("daily_report_time must be in HH:MM format".to_string());
    }

    {
        let mut settings = state.settings.lock().await;
        *settings = normalized;
    }

    state.save_settings().await
}

#[tauri::command]
async fn add_distraction_app(app_name: String, state: State<'_, AppState>) -> Result<(), String> {
    let app_name = app_name.trim();
    if app_name.is_empty() {
        return Err("app_name cannot be empty".to_string());
    }
    if is_helper_or_updater_app(app_name) {
        return Err("helper/updater apps are not allowed in distraction apps".to_string());
    }
    if is_browser_shell_app(app_name) {
        return Err("browser app should be configured in browser rules".to_string());
    }
    if is_web_only_pseudo_app(app_name) {
        return Err("web-only app should be configured in browser rules".to_string());
    }

    {
        let mut settings = state.settings.lock().await;
        if !contains_case_insensitive(&settings.distraction_apps, app_name) {
            settings.distraction_apps.push(app_name.to_string());
            settings.distraction_apps =
                normalize_distraction_app_list(std::mem::take(&mut settings.distraction_apps));
        }
    }

    state.save_settings().await
}

#[tauri::command]
async fn remove_distraction_app(
    app_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let key = app_name.trim().to_lowercase();
    {
        let mut settings = state.settings.lock().await;
        settings
            .distraction_apps
            .retain(|candidate| candidate.trim().to_lowercase() != key);
    }
    state.save_settings().await
}

#[tauri::command]
async fn get_all_stats(state: State<'_, AppState>) -> Result<Vec<DailyStats>, String> {
    state.ensure_current_day().await?;
    flush_current_activity_elapsed(&state).await?;
    state.save_daily_stats().await?;
    Ok(state.read_daily_stats_files())
}

#[tauri::command]
async fn get_weekly_history(state: State<'_, AppState>) -> Result<WeeklyHistory, String> {
    state.ensure_current_day().await?;
    flush_current_activity_elapsed(&state).await?;
    state.save_daily_stats().await?;

    let settings = state.settings.lock().await.clone();
    let all_stats = state.read_daily_stats_files();
    let today = Local::now().date_naive();
    let week_start = today - ChronoDuration::days(today.weekday().num_days_from_monday() as i64);
    let week_end = week_start + ChronoDuration::days(6);

    let mut days = Vec::with_capacity(7);
    let mut average_sum: u64 = 0;
    let mut average_count: u64 = 0;
    let mut best_day_productivity: u8 = 0;
    let mut best_day_label = "-".to_string();

    for index in 0..7 {
        let day = week_start + ChronoDuration::days(index);
        let day_key = day.format("%Y-%m-%d").to_string();
        let day_label = weekday_label(day.weekday().num_days_from_monday());

        let stats_for_day = all_stats.iter().find(|stats| stats.date == day_key);
        let (productive, distraction) = match stats_for_day {
            Some(stats) => calculate_day_split(stats, &settings),
            None => (0, 0),
        };

        let total = productive + distraction;
        let productivity = if total == 0 {
            0
        } else {
            ((productive as f64 / total as f64) * 100.0).round() as u8
        };

        if total > 0 {
            average_sum += productivity as u64;
            average_count += 1;
            if productivity >= best_day_productivity {
                best_day_productivity = productivity;
                best_day_label = day_label.to_string();
            }
        }

        days.push(WeeklyDayHistory {
            date: day_key,
            day: day_label.to_string(),
            productivity,
            streak: productivity >= 70,
        });
    }

    let average_productivity = if average_count == 0 {
        0
    } else {
        (average_sum / average_count) as u8
    };

    Ok(WeeklyHistory {
        week_label: format!(
            "Tydzień {} · {}",
            today.iso_week().week(),
            format_week_range(week_start, week_end)
        ),
        week_start: week_start.format("%Y-%m-%d").to_string(),
        week_end: week_end.format("%Y-%m-%d").to_string(),
        days,
        average_productivity,
        best_day_label,
        best_day_productivity,
    })
}

#[tauri::command]
async fn mark_day_off(date: String, state: State<'_, AppState>) -> Result<(), String> {
    let parsed = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|_| "date must be in YYYY-MM-DD format".to_string())?;
    let date_key = parsed.format("%Y-%m-%d").to_string();

    state.ensure_current_day().await?;

    let today = today_key();
    if date_key == today {
        {
            let mut stats = state.daily_stats.lock().await;
            stats.apps.clear();
            stats.alt_tab_count = 0;
            stats.last_updated = Local::now().to_rfc3339();
        }
        {
            let mut alt_tab_count = state.alt_tab_count.lock().await;
            *alt_tab_count = 0;
        }
        return state.save_daily_stats().await;
    }

    let mut stats = AppState::load_daily_stats(&state.data_dir, &date_key);
    stats.apps.clear();
    stats.alt_tab_count = 0;
    stats.last_updated = Local::now().to_rfc3339();
    let path = state.data_dir.join(format!("{date_key}.json"));
    AppState::write_json_atomic(&path, &stats)
}

#[tauri::command]
async fn save_receipt_as_image(
    _window: Window,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use std::process::Command;

    state.ensure_current_day().await?;
    let date = state.daily_stats.lock().await.date.clone();

    let screenshots_dir = state.data_dir.join("screenshots");
    fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;

    let filename = format!("receipt_{date}.png");
    let filepath = screenshots_dir.join(&filename);

    let output = Command::new("screencapture")
        .args(["-w", filepath.to_str().ok_or("invalid screenshot path")?])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to capture screenshot".to_string());
    }

    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
async fn request_macos_permissions(open_settings: Option<bool>) -> Result<bool, String> {
    let accessibility_trusted = check_accessibility_permissions(true);
    if open_settings.unwrap_or(false) || !accessibility_trusted {
        open_accessibility_settings();
    }

    // Accessibility API by itself can be flaky in some setups.
    // If we can already read the frontmost app, treat permissions as ready.
    let can_read_frontmost = read_frontmost_app_name().is_ok();
    Ok(accessibility_trusted || can_read_frontmost)
}

#[tauri::command]
async fn check_macos_permissions() -> Result<bool, String> {
    let accessibility_trusted = check_accessibility_permissions(false);
    if accessibility_trusted {
        return Ok(true);
    }

    let can_read_frontmost = read_frontmost_app_name().is_ok();
    Ok(can_read_frontmost)
}

fn read_frontmost_app_name() -> Result<String, String> {
    use std::process::Command;

    let app_script = r#"
        tell application "System Events"
            name of first application process whose frontmost is true
        end tell
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(app_script)
        .output()
        .map_err(|error| format!("Nie udało się uruchomić osascript: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() { stderr } else { stdout };
        let details = if details.is_empty() {
            "Brak szczegółów".to_string()
        } else {
            details
        };
        return Err(format!(
            "Brak autoryzacji do odczytu aktywnego okna (System Events): {details}"
        ));
    }

    let app_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if app_name.is_empty() {
        return Err("Aktywna aplikacja nie została odczytana.".to_string());
    }

    Ok(app_name)
}

#[tauri::command]
async fn get_tracking_probe() -> Result<TrackingProbe, String> {
    let accessibility_permission = check_accessibility_permissions(false);
    if !accessibility_permission {
        return Ok(TrackingProbe {
            accessibility_permission,
            can_read_frontmost_app: false,
            frontmost_app: None,
            error: Some("Brak uprawnienia Accessibility.".to_string()),
        });
    }

    match read_frontmost_app_name() {
        Ok(frontmost_app) => Ok(TrackingProbe {
            accessibility_permission,
            can_read_frontmost_app: true,
            frontmost_app: Some(frontmost_app),
            error: None,
        }),
        Err(error) => Ok(TrackingProbe {
            accessibility_permission,
            can_read_frontmost_app: false,
            frontmost_app: None,
            error: Some(error),
        }),
    }
}

#[derive(Debug, Clone)]
struct ActiveWindow {
    app_name: String,
    window_title: String,
    url: Option<String>,
}

impl ActiveWindow {
    fn from_app_and_title(app: &str, title: &str, url: Option<String>) -> Self {
        Self {
            app_name: app.to_string(),
            window_title: title.to_string(),
            url,
        }
    }
}

fn get_active_window() -> Option<ActiveWindow> {
    use std::process::Command;

    let app_script = r#"
        tell application "System Events"
            name of first application process whose frontmost is true
        end tell
    "#;

    let app_output = Command::new("osascript")
        .arg("-e")
        .arg(app_script)
        .output()
        .ok()?;

    if !app_output.status.success() {
        return None;
    }

    let app_name = String::from_utf8_lossy(&app_output.stdout)
        .trim()
        .to_string();

    let title_script: String = match app_name.as_str() {
        "Google Chrome" => r#"
            tell application "Google Chrome"
                if (count of windows) > 0 then
                    return title of active tab of front window
                end if
            end tell
        "#
        .to_string(),
        "Brave Browser" => r#"
            tell application "Brave Browser"
                if (count of windows) > 0 then
                    return title of active tab of front window
                end if
            end tell
        "#
        .to_string(),
        "Safari" => r#"
            tell application "Safari"
                if (count of windows) > 0 then
                    return name of front document
                end if
            end tell
        "#
        .to_string(),
        "Firefox" => r#"
            tell application "Firefox"
                if (count of windows) > 0 then
                    return name of front window
                end if
            end tell
        "#
        .to_string(),
        "Arc" => r#"
            tell application "Arc"
                if (count of windows) > 0 then
                    return title of active tab of front window
                end if
            end tell
        "#
        .to_string(),
        _ => format!(
            r#"
            tell application "System Events"
                tell process "{}"
                    if (count of windows) > 0 then
                        return name of front window
                    end if
                end tell
            end tell
        "#,
            &app_name
        ),
    };

    let window_title = Command::new("osascript")
        .arg("-e")
        .arg(title_script)
        .output()
        .ok()
        .map(|output| {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                String::new()
            }
        })
        .unwrap_or_default();

    let url = if is_browser_application(&app_name) {
        let url_script: String = match app_name.as_str() {
            "Safari" => r#"
                tell application "Safari"
                    if (count of windows) > 0 then
                        return URL of front document
                    end if
                end tell
            "#
            .to_string(),
            _ => format!(
                r#"
                tell application "{}"
                    if (count of windows) > 0 then
                        return URL of active tab of front window
                    end if
                end tell
            "#,
                &app_name
            ),
        };

        Command::new("osascript")
            .arg("-e")
            .arg(url_script)
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if value.is_empty() {
                        None
                    } else {
                        Some(value)
                    }
                } else {
                    None
                }
            })
    } else {
        None
    };

    Some(ActiveWindow::from_app_and_title(
        &app_name,
        &window_title,
        url,
    ))
}

async fn tracking_loop(state: Arc<AppState>, app_handle: tauri::AppHandle) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        interval.tick().await;

        if state.ensure_current_day().await.is_err() {
            continue;
        }

        let Some(active_window) = get_active_window() else {
            continue;
        };

        let settings = state.settings.lock().await.clone();
        let context = build_activity_context(&active_window, &settings);
        let now = Instant::now();
        let now_rfc3339 = Local::now().to_rfc3339();

        let mut current_activity = state.current_activity.lock().await;
        let mut activity_start_time = state.activity_start_time.lock().await;
        let mut last_front_app = state.last_front_app.lock().await;
        let mut alt_tab_count = state.alt_tab_count.lock().await;
        let mut stats = state.daily_stats.lock().await;

        if let (Some(previous), Some(start_time)) = (current_activity.clone(), *activity_start_time)
        {
            let elapsed = start_time.elapsed().as_secs();
            if elapsed > 0 {
                upsert_app_usage(&mut stats.apps, &previous, elapsed);
            }
        }

        if current_activity
            .as_ref()
            .map(|entry| entry.front_app.as_str())
            != Some(context.front_app.as_str())
        {
            if current_activity.is_some() {
                *alt_tab_count += 1;
                stats.alt_tab_count = *alt_tab_count;
            }
            *last_front_app = Some(context.front_app.clone());
        }

        *current_activity = Some(context.clone());
        *activity_start_time = Some(now);

        upsert_app_usage(&mut stats.apps, &context, 0);
        stats.last_updated = now_rfc3339;

        let _ = app_handle.emit("app-switched", &context.tracked_name);

        drop(stats);
        drop(alt_tab_count);
        drop(last_front_app);
        drop(activity_start_time);
        drop(current_activity);

        let _ = state.save_daily_stats().await;
    }
}

fn today_key() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn build_activity_context(window: &ActiveWindow, settings: &UserSettings) -> ActivityContext {
    if is_browser_application(&window.app_name) {
        if let Some(url_value) = &window.url {
            if let Some(host) = extract_host(url_value) {
                if let Some(rule) =
                    find_browser_rule(&host, &window.app_name, &settings.browser_rules)
                {
                    return ActivityContext {
                        front_app: window.app_name.clone(),
                        tracked_name: rule.label.clone(),
                        activity_kind: ActivityKind::BrowserTab,
                        browser_name: Some(window.app_name.clone()),
                        browser_host: Some(host),
                        window_title: window.window_title.clone(),
                    };
                }

                return ActivityContext {
                    front_app: window.app_name.clone(),
                    tracked_name: format_host_label(&host),
                    activity_kind: ActivityKind::BrowserTab,
                    browser_name: Some(window.app_name.clone()),
                    browser_host: Some(host),
                    window_title: window.window_title.clone(),
                };
            }
        }

        return ActivityContext {
            front_app: window.app_name.clone(),
            tracked_name: window.app_name.clone(),
            activity_kind: ActivityKind::BrowserTab,
            browser_name: Some(window.app_name.clone()),
            browser_host: None,
            window_title: window.window_title.clone(),
        };
    }

    ActivityContext {
        front_app: window.app_name.clone(),
        tracked_name: window.app_name.clone(),
        activity_kind: ActivityKind::App,
        browser_name: None,
        browser_host: None,
        window_title: window.window_title.clone(),
    }
}

fn extract_host(url_value: &str) -> Option<String> {
    Url::parse(url_value)
        .ok()
        .and_then(|url| url.host_str().map(|host| host.to_lowercase()))
}

fn format_host_label(host: &str) -> String {
    let without_www = host.strip_prefix("www.").unwrap_or(host);
    without_www.to_string()
}

fn is_browser_application(app_name: &str) -> bool {
    matches!(
        app_name,
        "Google Chrome" | "Brave Browser" | "Safari" | "Firefox" | "Arc" | "Microsoft Edge"
    )
}

fn is_valid_report_time(value: &str) -> bool {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 || parts[0].len() != 2 || parts[1].len() != 2 {
        return false;
    }

    let hour = parts[0].parse::<u8>().ok();
    let minute = parts[1].parse::<u8>().ok();
    matches!((hour, minute), (Some(h), Some(m)) if h < 24 && m < 60)
}

fn normalize_app_list(apps: Vec<String>) -> Vec<String> {
    let mut unique = HashSet::new();
    let mut normalized = Vec::new();

    for app in apps {
        let trimmed = app.trim();
        if trimmed.is_empty() {
            continue;
        }
        let key = trimmed.to_lowercase();
        if unique.insert(key) {
            normalized.push(trimmed.to_string());
        }
    }

    normalized
}

fn is_helper_or_updater_app(app_name: &str) -> bool {
    let normalized = app_name.trim().to_lowercase();
    normalized.contains("helper")
        || normalized.contains("updater")
        || normalized.contains("updateagent")
        || normalized.contains("autoupdate")
        || normalized.contains("softwareupdate")
        || normalized.contains("(gpu)")
        || normalized.contains("(renderer)")
        || normalized.contains("(alerts)")
}

fn is_browser_shell_app(app_name: &str) -> bool {
    matches!(
        app_name.trim().to_lowercase().as_str(),
        "google chrome" | "safari" | "brave browser" | "arc" | "firefox" | "microsoft edge"
    )
}

fn is_web_only_pseudo_app(app_name: &str) -> bool {
    matches!(
        app_name.trim().to_lowercase().as_str(),
        "youtube"
            | "twitter"
            | "x"
            | "facebook"
            | "instagram"
            | "tiktok"
            | "reddit"
            | "netflix"
            | "messenger"
    )
}

fn normalize_distraction_app_list(apps: Vec<String>) -> Vec<String> {
    normalize_app_list(apps)
        .into_iter()
        .filter(|app| {
            !is_helper_or_updater_app(app)
                && !is_browser_shell_app(app)
                && !is_web_only_pseudo_app(app)
        })
        .collect()
}

fn normalize_browser_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn normalize_browser_rules(rules: Vec<BrowserRule>) -> Vec<BrowserRule> {
    let mut dedupe = HashSet::new();
    let mut normalized = Vec::new();

    for mut rule in rules {
        let pattern = rule.pattern.trim().to_lowercase();
        if pattern.is_empty() {
            continue;
        }

        let label = rule.label.trim();
        let label = if label.is_empty() {
            format_host_label(&pattern)
        } else {
            label.to_string()
        };

        let mut browsers = rule
            .browsers
            .drain(..)
            .map(|entry| normalize_browser_name(&entry))
            .filter(|entry| !entry.is_empty())
            .collect::<Vec<_>>();
        browsers.sort();
        browsers.dedup();

        let key = format!("{}|{:?}|{}", pattern, rule.category, browsers.join(","));
        if dedupe.insert(key) {
            normalized.push(BrowserRule {
                pattern,
                label,
                category: rule.category,
                browsers,
            });
        }
    }

    normalized
}

fn normalize_settings(settings: UserSettings) -> UserSettings {
    let mut distraction_apps = normalize_distraction_app_list(settings.distraction_apps);
    let work_apps = normalize_app_list(settings.work_apps);
    let work_keys: HashSet<String> = work_apps
        .iter()
        .map(|app| app.trim().to_lowercase())
        .collect();

    distraction_apps.retain(|app| !work_keys.contains(&app.trim().to_lowercase()));

    let mut browser_rules = normalize_browser_rules(settings.browser_rules);
    if browser_rules.is_empty() {
        browser_rules = default_browser_rules();
    }

    let daily_report_time = if is_valid_report_time(&settings.daily_report_time) {
        settings.daily_report_time
    } else {
        "22:00".to_string()
    };

    UserSettings {
        distraction_apps,
        work_apps,
        browser_rules,
        daily_report_time,
        notifications_enabled: settings.notifications_enabled,
    }
}

fn contains_case_insensitive(collection: &[String], value: &str) -> bool {
    let key = value.trim().to_lowercase();
    collection
        .iter()
        .any(|item| item.trim().to_lowercase() == key)
}

fn is_daily_stats_path(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };

    if file_name.len() != "YYYY-MM-DD.json".len() || !file_name.ends_with(".json") {
        return false;
    }

    let date_part = &file_name[..10];
    NaiveDate::parse_from_str(date_part, "%Y-%m-%d").is_ok()
}

fn default_browser_rules() -> Vec<BrowserRule> {
    vec![
        BrowserRule {
            pattern: "youtube.com".to_string(),
            label: "YouTube".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "reddit.com".to_string(),
            label: "Reddit".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "x.com".to_string(),
            label: "X".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "twitter.com".to_string(),
            label: "Twitter".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "instagram.com".to_string(),
            label: "Instagram".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "facebook.com".to_string(),
            label: "Facebook".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "tiktok.com".to_string(),
            label: "TikTok".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "netflix.com".to_string(),
            label: "Netflix".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "discord.com".to_string(),
            label: "Discord".to_string(),
            category: BrowserCategory::Distraction,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "figma.com".to_string(),
            label: "Figma".to_string(),
            category: BrowserCategory::Productive,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "github.com".to_string(),
            label: "GitHub".to_string(),
            category: BrowserCategory::Productive,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "stackoverflow.com".to_string(),
            label: "Stack Overflow".to_string(),
            category: BrowserCategory::Productive,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "notion.so".to_string(),
            label: "Notion".to_string(),
            category: BrowserCategory::Productive,
            browsers: Vec::new(),
        },
        BrowserRule {
            pattern: "linear.app".to_string(),
            label: "Linear".to_string(),
            category: BrowserCategory::Productive,
            browsers: Vec::new(),
        },
    ]
}

fn find_browser_rule<'a>(
    host: &str,
    browser: &str,
    rules: &'a [BrowserRule],
) -> Option<&'a BrowserRule> {
    let browser_key = normalize_browser_name(browser);

    if let Some(rule) = rules.iter().find(|rule| {
        !rule.browsers.is_empty()
            && rule.browsers.iter().any(|entry| entry == &browser_key)
            && host_matches_pattern(host, &rule.pattern)
    }) {
        return Some(rule);
    }

    rules
        .iter()
        .find(|rule| rule.browsers.is_empty() && host_matches_pattern(host, &rule.pattern))
}

fn host_matches_pattern(host: &str, pattern: &str) -> bool {
    let host = host.to_lowercase();
    let pattern = pattern.trim().to_lowercase();
    if pattern.is_empty() {
        return false;
    }

    if pattern.contains('.') {
        host == pattern || host.ends_with(&format!(".{pattern}"))
    } else {
        host.contains(&pattern)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UsageBucket {
    Productive,
    Distraction,
    Neutral,
}

#[derive(Debug, Clone)]
struct DomainClassification {
    category: DomainCategory,
    confidence: u8,
    source: String,
    label: String,
}

fn domain_category_from_browser_category(category: BrowserCategory) -> DomainCategory {
    match category {
        BrowserCategory::Productive => DomainCategory::Productive,
        BrowserCategory::Distraction => DomainCategory::Distraction,
    }
}

fn is_system_browser_rule(rule: &BrowserRule) -> bool {
    if !rule.browsers.is_empty() {
        return false;
    }

    let pattern = rule.pattern.trim().to_lowercase();
    matches!(
        pattern.as_str(),
        "youtube.com"
            | "reddit.com"
            | "x.com"
            | "twitter.com"
            | "instagram.com"
            | "facebook.com"
            | "tiktok.com"
            | "netflix.com"
            | "discord.com"
            | "figma.com"
            | "github.com"
            | "stackoverflow.com"
            | "notion.so"
            | "linear.app"
    )
}

fn heuristic_domain_score(host: &str) -> i32 {
    let normalized = host.to_lowercase();

    let productive_markers = [
        "github",
        "gitlab",
        "bitbucket",
        "figma",
        "notion",
        "linear",
        "jira",
        "atlassian",
        "slack",
        "stackoverflow",
        "stackexchange",
        "developer",
        "docs",
        "documentation",
        "mdn",
        "vercel",
        "aws",
        "azure",
        "cloud",
        "gcp",
        "npmjs",
        "rust-lang",
        "react",
        "openai",
        "chatgpt",
    ];

    let distraction_markers = [
        "youtube",
        "netflix",
        "primevideo",
        "tiktok",
        "instagram",
        "facebook",
        "twitter",
        "x.com",
        "xvideos",
        "twitch",
        "reddit",
        "9gag",
        "pinterest",
        "snapchat",
        "messenger",
        "discord",
    ];

    let mut score = 0_i32;

    for marker in productive_markers {
        if normalized.contains(marker) {
            score += 16;
        }
    }

    for marker in distraction_markers {
        if normalized.contains(marker) {
            score -= 18;
        }
    }

    if normalized.ends_with(".edu")
        || normalized.contains("learn")
        || normalized.contains("academy")
        || normalized.contains("training")
    {
        score += 10;
    }

    if normalized.contains("news") || normalized.contains("sport") {
        score -= 4;
    }

    score.clamp(-95, 95)
}

fn heuristic_app_score(app_name: &str) -> i32 {
    let normalized = app_name.to_lowercase();

    let productive_markers = [
        "code",
        "studio",
        "terminal",
        "iterm",
        "warp",
        "xcode",
        "figma",
        "notion",
        "obsidian",
        "notes",
        "notatki",
        "preview",
        "postman",
        "docker",
        "slack",
        "teams",
        "zoom",
        "meet",
        "word",
        "excel",
        "powerpoint",
        "numbers",
        "pages",
        "keynote",
        "jira",
        "linear",
        "raycast",
        "finder",
    ];

    let distraction_markers = [
        "steam",
        "spotify",
        "music",
        "netflix",
        "prime video",
        "discord",
        "messenger",
        "telegram",
        "whatsapp",
        "arcade",
        "twitch",
        "vlc",
        "tv",
        "youtube",
        "facebook",
        "instagram",
        "tiktok",
        "twitter",
        "x ",
        "x.",
    ];

    let mut score = 0_i32;

    for marker in productive_markers {
        if normalized.contains(marker) {
            score += 15;
        }
    }

    for marker in distraction_markers {
        if normalized.contains(marker) {
            score -= 17;
        }
    }

    if normalized.contains("notes") || normalized.contains("notatki") {
        score += 20;
    }

    score.clamp(-95, 95)
}

fn app_name_matches_exact(normalized: &str, candidates: &[&str]) -> bool {
    candidates.iter().any(|candidate| normalized == *candidate)
}

fn app_name_matches_contains(normalized: &str, markers: &[&str]) -> bool {
    markers.iter().any(|marker| normalized.contains(*marker))
}

fn classify_native_app_from_catalog(app_name: &str) -> Option<DomainClassification> {
    let normalized = app_name.trim().to_lowercase();

    let productive_exact = [
        "notes",
        "notatki",
        "apple notes",
        "notion",
        "obsidian",
        "craft",
        "bear",
        "ulysses",
        "visual studio code",
        "code",
        "cursor",
        "windsurf",
        "zed",
        "sublime text",
        "xcode",
        "android studio",
        "intellij idea",
        "pycharm",
        "webstorm",
        "goland",
        "clion",
        "datagrip",
        "rider",
        "terminal",
        "iterm2",
        "warp",
        "postman",
        "insomnia",
        "docker desktop",
        "figma",
        "slack",
        "microsoft teams",
        "zoom",
        "google meet",
        "raycast",
        "alfred",
        "finder",
        "preview",
        "pages",
        "numbers",
        "keynote",
        "calendar",
        "kalendarz",
        "mail",
        "outlook",
        "thunderbird",
        "jira",
        "linear",
    ];

    let distraction_exact = [
        "spotify",
        "steam",
        "discord",
        "telegram",
        "whatsapp",
        "whatsapp messenger",
        "messenger",
        "apple music",
        "music",
        "tv",
        "apple tv",
        "netflix",
        "amazon prime video",
        "vlc",
        "iina",
        "twitch",
        "epic games launcher",
        "battle.net",
        "blizzard battle.net",
        "ea app",
    ];

    let productive_contains = [
        "visual studio",
        "jetbrains",
        "idea",
        "code",
        "terminal",
        "editor",
        "notatki",
        "notes",
        "calendar",
        "mail",
        "figma",
        "notion",
        "linear",
        "jira",
        "postman",
        "docker",
    ];

    let distraction_contains = [
        "game", "gaming", "launcher", "player", "music", "video", "stream", "social",
    ];

    if app_name_matches_exact(&normalized, &productive_exact) {
        return Some(DomainClassification {
            category: DomainCategory::Productive,
            confidence: 96,
            source: "system".to_string(),
            label: app_name.to_string(),
        });
    }

    if app_name_matches_exact(&normalized, &distraction_exact) {
        return Some(DomainClassification {
            category: DomainCategory::Distraction,
            confidence: 95,
            source: "system".to_string(),
            label: app_name.to_string(),
        });
    }

    if app_name_matches_contains(&normalized, &productive_contains) {
        return Some(DomainClassification {
            category: DomainCategory::Productive,
            confidence: 82,
            source: "system".to_string(),
            label: app_name.to_string(),
        });
    }

    if app_name_matches_contains(&normalized, &distraction_contains) {
        return Some(DomainClassification {
            category: DomainCategory::Distraction,
            confidence: 75,
            source: "system".to_string(),
            label: app_name.to_string(),
        });
    }

    None
}

fn classify_browser_domain(
    host: &str,
    browser_name: &str,
    settings: &UserSettings,
) -> DomainClassification {
    if let Some(rule) = find_browser_rule(host, browser_name, &settings.browser_rules) {
        let source = if is_system_browser_rule(rule) {
            "system".to_string()
        } else {
            "manual".to_string()
        };

        return DomainClassification {
            category: domain_category_from_browser_category(rule.category),
            confidence: if source == "manual" { 100 } else { 96 },
            source,
            label: if rule.label.trim().is_empty() {
                format_host_label(host)
            } else {
                rule.label.clone()
            },
        };
    }

    let score = heuristic_domain_score(host);
    let category = if score >= 20 {
        DomainCategory::Productive
    } else if score <= -20 {
        DomainCategory::Distraction
    } else {
        DomainCategory::Neutral
    };

    let confidence = match score.abs() {
        0..=9 => 35,
        10..=19 => 48,
        20..=34 => 65,
        35..=54 => 78,
        _ => 90,
    };

    DomainClassification {
        category,
        confidence,
        source: "auto".to_string(),
        label: format_host_label(host),
    }
}

fn classify_native_app(app_name: &str, settings: &UserSettings) -> DomainClassification {
    if matches_setting_rule(app_name, &settings.work_apps) {
        return DomainClassification {
            category: DomainCategory::Productive,
            confidence: 100,
            source: "manual".to_string(),
            label: app_name.to_string(),
        };
    }

    if matches_setting_rule(app_name, &settings.distraction_apps) {
        return DomainClassification {
            category: DomainCategory::Distraction,
            confidence: 100,
            source: "manual".to_string(),
            label: app_name.to_string(),
        };
    }

    if let Some(classification) = classify_native_app_from_catalog(app_name) {
        return classification;
    }

    let score = heuristic_app_score(app_name);
    let category = if score >= 28 {
        DomainCategory::Productive
    } else if score <= -28 {
        DomainCategory::Distraction
    } else {
        DomainCategory::Neutral
    };

    let confidence = match score.abs() {
        0..=12 => 35,
        13..=27 => 48,
        28..=40 => 64,
        41..=60 => 78,
        _ => 90,
    };

    DomainClassification {
        category,
        confidence,
        source: "auto".to_string(),
        label: app_name.to_string(),
    }
}

fn classify_usage(usage: &AppUsage, settings: &UserSettings) -> UsageBucket {
    if usage.activity_kind == ActivityKind::BrowserTab {
        if let (Some(host), Some(browser_name)) = (&usage.browser_host, &usage.browser_name) {
            let classification = classify_browser_domain(host, browser_name, settings);
            return match classification.category {
                DomainCategory::Productive => UsageBucket::Productive,
                DomainCategory::Distraction => UsageBucket::Distraction,
                DomainCategory::Neutral => UsageBucket::Neutral,
            };
        }
    }

    let classification = classify_native_app(&usage.name, settings);
    match classification.category {
        DomainCategory::Productive => UsageBucket::Productive,
        DomainCategory::Distraction => UsageBucket::Distraction,
        DomainCategory::Neutral => UsageBucket::Neutral,
    }
}

fn calculate_day_split(stats: &DailyStats, settings: &UserSettings) -> (u64, u64) {
    let mut productive = 0_u64;
    let mut distraction = 0_u64;

    for app in &stats.apps {
        match classify_usage(app, settings) {
            UsageBucket::Productive => productive += app.time_seconds,
            UsageBucket::Distraction => distraction += app.time_seconds,
            UsageBucket::Neutral => {}
        }
    }

    (productive, distraction)
}

fn matches_setting_rule(app_name: &str, rules: &[String]) -> bool {
    let key = app_name.to_lowercase();
    rules.iter().any(|rule| key.contains(&rule.to_lowercase()))
}

fn weekday_label(weekday_from_monday: u32) -> &'static str {
    match weekday_from_monday {
        0 => "Pon",
        1 => "Wt",
        2 => "Śr",
        3 => "Czw",
        4 => "Pt",
        5 => "Sob",
        _ => "Nd",
    }
}

fn format_week_range(start: NaiveDate, end: NaiveDate) -> String {
    if start.month() == end.month() {
        format!(
            "{}-{}.{}.{}",
            start.day(),
            end.day(),
            end.month(),
            end.year()
        )
    } else {
        format!(
            "{}.{}-{}.{}.{}",
            start.day(),
            start.month(),
            end.day(),
            end.month(),
            end.year()
        )
    }
}

fn upsert_app_usage(apps: &mut Vec<AppUsage>, context: &ActivityContext, elapsed_seconds: u64) {
    let title = context.window_title.trim();

    if let Some(existing) = apps.iter_mut().find(|entry| {
        entry.name == context.tracked_name
            && entry.activity_kind == context.activity_kind
            && entry.browser_host == context.browser_host
            && entry.browser_name == context.browser_name
    }) {
        existing.time_seconds += elapsed_seconds;
        if !title.is_empty() && !existing.window_titles.iter().any(|stored| stored == title) {
            existing.window_titles.push(title.to_string());
        }
        return;
    }

    let mut window_titles = Vec::new();
    if !title.is_empty() {
        window_titles.push(title.to_string());
    }

    apps.push(AppUsage {
        name: context.tracked_name.clone(),
        time_seconds: elapsed_seconds,
        window_titles,
        activity_kind: context.activity_kind,
        browser_name: context.browser_name.clone(),
        browser_host: context.browser_host.clone(),
    });
}

#[cfg(target_os = "macos")]
fn check_accessibility_permissions(prompt: bool) -> bool {
    let value = unsafe {
        if prompt {
            kCFBooleanTrue
        } else {
            kCFBooleanFalse
        }
    };

    unsafe {
        let keys: [*const c_void; 1] = [kAXTrustedCheckOptionPrompt.cast::<c_void>()];
        let values: [*const c_void; 1] = [value.cast::<c_void>()];

        let options = CFDictionaryCreate(
            kCFAllocatorDefault,
            keys.as_ptr(),
            values.as_ptr(),
            1,
            &kCFTypeDictionaryKeyCallBacks,
            &kCFTypeDictionaryValueCallBacks,
        );

        if options.is_null() {
            return false;
        }

        let trusted = AXIsProcessTrustedWithOptions(options);
        CFRelease(options.cast::<c_void>());
        trusted
    }
}

#[cfg(not(target_os = "macos"))]
fn check_accessibility_permissions(_prompt: bool) -> bool {
    true
}

fn open_accessibility_settings() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let startup_size = LogicalSize::new(290.0, 500.0);
                let _ = window.set_resizable(false);
                let _ = window.set_maximizable(false);
                let _ = window.set_min_size(Some(LogicalSize::new(260.0, 420.0)));
                let _ = window.set_max_size(Some(startup_size));
                let _ = window.set_size(startup_size);
                let _ = window.center();
            }

            let open_item =
                MenuItem::with_id(app, "open", "Open Distraction Receipt", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu =
                Menu::with_items(app, &[&open_item, &settings_item, &separator, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("navigate-to", "settings");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            let state: State<AppState> = app.state();
            let state_arc = Arc::new(AppState {
                current_activity: state.current_activity.clone(),
                activity_start_time: state.activity_start_time.clone(),
                daily_stats: state.daily_stats.clone(),
                settings: state.settings.clone(),
                alt_tab_count: state.alt_tab_count.clone(),
                last_front_app: state.last_front_app.clone(),
                data_dir: state.data_dir.clone(),
            });

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(tracking_loop(state_arc, app_handle));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_daily_stats,
            get_daily_report,
            get_settings,
            get_browser_insights,
            get_app_insights,
            update_settings,
            add_distraction_app,
            remove_distraction_app,
            get_all_stats,
            get_weekly_history,
            mark_day_off,
            check_macos_permissions,
            get_tracking_probe,
            request_macos_permissions,
            save_receipt_as_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
