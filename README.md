# Fugit

Fugit to lekka aplikacja menu bar na macOS, która śledzi czas spędzony w aplikacjach i pokazuje dzień w formie czytelnego „paragonu produktywności”.

![Version](https://img.shields.io/badge/version-0.1.0-green)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

<p align="center">
  <a href="https://raw.githubusercontent.com/jann5/time_recipt/main/downloads/Fugit.zip" download>
    <img src="https://img.shields.io/badge/DOWNLOAD%20FUGIT%20(INTEL%20%2B%20APPLE%20SILICON)-111827?style=for-the-badge&logo=apple&logoColor=white" alt="Download Fugit for macOS (Intel + Apple Silicon)" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/WA%C5%BBNE-macOS%20mo%C5%BCe%20zablokowa%C4%87%20pierwsze%20uruchomienie%20aplikacji-C2410C?style=for-the-badge&labelColor=111827" alt="Ważne: macOS może zablokować pierwsze uruchomienie aplikacji" />
</p>

<p align="center"><strong>Jeśli pojawi się blokada uruchomienia:</strong><br/>
System Settings → Privacy &amp; Security → przewiń na dół → <strong>"Fugit was blocked"</strong> → <strong>Open Anyway</strong>.
</p>

## Co robi Fugit

- Śledzi aktywną aplikację i czas pracy w interwałach 5 s.
- Rozdziela aktywność na kategorie: produktywne, rozpraszające i neutralne.
- Pokazuje dzienny raport w formie „paragonu”.
- Buduje tygodniowe podsumowanie trendu.
- Działa lokalnie, bez konta i bez synchronizacji do chmury.

## Wymagania i kompatybilność

- macOS `10.15+`
- Architektura: `Intel (x86_64)` i `Apple Silicon (arm64)`
- Ventura (`13.x`) jest wspierana

## Szybki start dla użytkownika

1. Pobierz `Fugit.zip` z przycisku powyżej.
2. Rozpakuj archiwum.
3. Przenieś `Fugit.app` do `/Applications`.
4. Uruchom aplikację.
5. Przy pierwszym starcie nadaj wymagane uprawnienia (Accessibility / System Events).

## Prywatność

Fugit zapisuje dane tylko lokalnie, domyślnie w:

`~/Library/Application Support/com.jannawrot.fugit/`

Przykładowe pliki:

- `settings.json`
- `YYYY-MM-DD.json` (statystyki dzienne)
- `rest_days.json`

## Troubleshooting macOS (Gatekeeper)

Jeśli macOS zablokuje aplikację po pobraniu z internetu:

1. Spróbuj uruchomić ponownie z Finder: PPM na `Fugit.app` → `Open`.
2. Jeśli dalej blokuje, użyj: System Settings → Privacy & Security → `Open Anyway`.
3. Wersja produkcyjna bez ostrzeżeń dla większości użytkowników wymaga podpisu Developer ID i notarization Apple.

## Uruchomienie lokalne (deweloperskie)

### Wymagania

- Node.js `18+`
- npm `9+`
- Rust (rustup)

Instalacja zależności i start:

```bash
npm install
npm run tauri dev
```

## Buildy i paczki

### Build aplikacji

```bash
npm run tauri build
```

### ZIP (dystrybucja szybka)

```bash
# universal (Intel + Apple Silicon)
npm run build:zip

# natywny dla hosta
npm run build:zip:native
```

Skrypt ZIP:

- buduje `.app`,
- podpisuje ad-hoc,
- czyści atrybuty `xattr` na `.app`,
- pakuje do `downloads/Fugit.zip`.

### DMG release (podpis + notarization Apple)

To ścieżka produkcyjna do publicznej dystrybucji.

```bash
export APPLE_SIGN_IDENTITY="Developer ID Application: Twoje Imie (TEAMID)"
export APPLE_NOTARY_PROFILE="fugit-notary"
npm run build:dmg
```

Alternatywnie do notaryzacji można użyć:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Po udanym release skrypt kopiuje plik do `downloads/Fugit.dmg`.

## Struktura repo

```text
time_recipt/
├── src/                 # frontend React + TypeScript
├── src-tauri/           # backend Rust + konfiguracja Tauri
├── downloads/           # artefakty publikowane na GitHub
├── scripts/             # skrypty build/release
└── README.md
```

## Stack

- React 19
- TypeScript
- Vite
- Rust
- Tauri 2

## Licencja

MIT
