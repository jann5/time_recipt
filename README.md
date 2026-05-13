# Fugit 🧾

Aplikacja macOS menu bar do śledzenia czasu spędzonego w aplikacjach i wizualizacji produktywności w formie "paragonu".

![Version](https://img.shields.io/badge/version-0.1.0-green)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

<p align="center">
  <a href="https://raw.githubusercontent.com/jann5/time_recipt/main/downloads/Fugit.dmg" download>
    <img src="https://img.shields.io/badge/DOWNLOAD%20FUGIT%20(INTEL%20%2B%20APPLE%20SILICON)-111827?style=for-the-badge&logo=apple&logoColor=white" alt="Download Fugit for macOS (Intel + Apple Silicon)" />
  </a>
</p>

## 📖 Opis

Fugit to **nie jest kolejna aplikacja do produktywności**. To lustrzane odbicie Twojego czasu spędzonego przy komputerze - bez oceniania, bez presji, tylko czyste fakty w formacie, który znasz dobrze z każdego zakupu.

Zamiast wykresów i dashboardów, dostajesz **wizualny paragon** - tak jak ze sklepu. To psychologicznie inny format: "Wydałem dziś 2.5h na YouTube" uderza inaczej niż słupek w analityce.

### Kluczowe cechy:

- 🔒 **100% prywatności** - dane lokalne, żadnej chmury
- 👁️ **Ciche śledzenie** - działa w tle, nie przeszkadza
- 🧾 **Format paragonu** - znajomy, bolesny w odbiorze
- 📊 **Statystyki tygodniowe** - trend i średnia wydajność
- ⚙️ **Konfigurowalne** - Ty decydujesz co jest rozproszeniem
- 🔥 **Streaki** - motywacja przez ciągłość

---

## 🚀 Instalacja i uruchomienie

### Wymagania systemowe

- **macOS** 10.15 lub nowszy
- **Node.js** 18+ (sprawdź: `node --version`)
- **npm** 9+ (sprawdź: `npm --version`)
- **Rust** (instalacja poniżej)

### Krok 1: Instalacja Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Po instalacji uruchom ponownie terminal lub:
```bash
source ~/.cargo/env
```

Sprawdź instalację:
```bash
rustc --version
cargo --version
```

### Krok 2: Instalacja zależności projektu

```bash
cd fugit
npm install
```

### Krok 3: Uruchomienie w trybie deweloperskim

```bash
npm run tauri dev
```

To polecenie:
1. Uruchomi frontend dev server (Vite)
2. Skompiluje backend Rust
3. Otworzy aplikację jako menu bar app

**Pierwsze uruchomienie** może potrwać 2-5 minut (kompilacja Rust).

### Krok 4: Build produkcyjny

```bash
npm run tauri build
```

Aplikacja zostanie zbudowana w `src-tauri/target/release/bundle/`.

---

## 📁 Struktura projektu

```
fugit/
├── src/                          # Frontend (React + TypeScript)
│   ├── App.tsx                   # Główny komponent + routing
│   ├── App.css                   # Style - Unified Design System
│   ├── main.tsx                  # Entry point React
│   ├── components/               # Reusable komponenty
│   │   ├── ReceiptHeader.tsx     # Nagłówek paragonu
│   │   └── AppList.tsx           # Lista aplikacji
│   ├── screens/                  # Ekrany aplikacji
│   │   ├── DailyReceipt.tsx      # Dzienny paragon
│   │   ├── WeeklySummary.tsx     # Podsumowanie tygodnia
│   │   ├── Settings.tsx          # Ustawienia
│   │   └── Onboarding.tsx        # Onboarding 4-krokowy
│   ├── hooks/
│   │   └── useTracking.ts        # Hook do danych Tauri
│   └── types/
│       └── index.ts              # TypeScript interfaces
│
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   └── lib.rs                # Główna logika + śledzenie
│   ├── Cargo.toml                # Zależności Rust
│   ├── tauri.conf.json           # Konfiguracja Tauri
│   └── Entitlements.plist        # Uprawnienia macOS
│
├── package.json                  # Zależności npm
├── tsconfig.json                 # Konfiguracja TypeScript
└── vite.config.ts                # Konfiguracja Vite
```

---

## 🛠 Technologie

### Frontend
- **React 19** - UI library
- **TypeScript** - typowanie
- **Vite** - build tool
- **CSS Variables** - design system

### Backend
- **Rust** - systemowy język programowania
- **Tauri 2.0** - framework desktop (zamiast Electron)
- **AppleScript** - śledzenie aktywnych okien na macOS
- **Tokio** - async runtime

### Darmowy i open-source
- **Zero zależności płatnych**
- **Brak subskrypcji**
- **Brak kont użytkowników**

---

## 🎯 Funkcjonalności

### 1. Śledzenie aktywności
- Sprawdza co 5 sekund aktywną aplikację (via AppleScript)
- Zapisuje czas w poszczególnych appkach
- Liczy przełączania (alt-tab)
- Wszystko lokalnie w `~/Library/Application Support/com.jannawrot.fugit/`

### 2. Dzienny paragon
- Główna metryka: % wydajności
- Lista aplikacji rozpraszających (z ikonami)
- Lista aplikacji produktywnych
- Streak dni z dobrymi wynikami
- Quote motywacyjny

### 3. Tygodniowe podsumowanie
- Średnia wydajność tygodniowa
- Słupkowy wykres 7 dni
- Trend (rosnący/spadkowy/stabilny)
- Liczba aktywnych dni

### 4. Ustawienia
- Dodawanie/usuwanie aplikacji rozpraszających
- Lista domyślnych aplikacji produktywnych
- Godzina raportu (domyślnie 22:00)
- Włączanie/wyłączanie powiadomień
- Wyczyść wszystkie dane

### 5. Menu Bar
- Ikona w pasku menu macOS
- Kliknięcie lewym: pokaż/ukryj okno
- Menu prawym: Open / Settings / Quit

---

## 🔮 Rozwój w przyszłości

### Funkcje do dodania:

#### Wysoki priorytet
- [ ] **Eksport PNG** - zapis paragonu jako obrazek do udostępniania
- [ ] **Pełna logika streaków** - zapisywanie historii streaków
- [ ] **Powiadomienia natywne** - macOS notifications o 22:00
- [ ] **Tryb "nie oceniaj"** - oznaczanie dni jako wolnych

#### Średni priorytet
- [ ] **Detekcja stron www** - YouTube w Safari vs dokumentacja
- [ ] **Kategorie niestandardowe** - nie tylko praca/rozproszenia
- [ ] **Porównania** - wczoraj vs dziś, średnia tygodniowa
- [ ] **Cele dzienne** - ustawianie targetów produktywności

#### Niski priorytet
- [ ] **Wersja iOS** - śledzenie na iPhone (Tauri mobile)
- [ ] **Widget macOS** - w Notification Center
- [ ] **Skróty klawiszowe** - szybkie oznaczanie aktywności
- [ ] **Integracja z Calendar** - blokowanie czasu focus

### Refactoring techniczny:

```rust
// TODO: Zmienić AppleScript na CoreGraphics API
// dla lepszej wydajności i więcej danych (np. tytuły okien)

// TODO: Dodać SQLite zamiast JSON dla lepszej skalowalności

// TODO: Implementacja prawdziwego systemu pluginów
// dla niestandardowych kategorii aplikacji
```

---

## 🐛 Znane problemy

1. **AppleScript wymaga uprawnień** - przy pierwszym uruchomieniu macOS może pytać o dostęp do System Events
2. **Nie śledzi tytułów okien** - tylko nazwy aplikacji (ograniczenie AppleScript)
3. **Brak eksportu PNG** - obecnie tylko placeholder

---

## 📄 Licencja

MIT License - do wolnego użytku, modyfikacji i dystrybucji.

---

## 🤝 Wsparcie

Jeśli masz pomysły lub znajdziesz błąd:
1. Sprawdź czy masz zainstalowane wszystkie wymagania
2. Uruchom z flagą debug: `npm run tauri dev -- --verbose`
3. Zgłoś issue na GitHub

---

**Stworzone z myślą o świadomej pracy przy komputerze. Bez przemocy produktywnościowej.** 🧘‍♂️
