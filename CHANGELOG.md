# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [v2.261201.0]

### MD Markup Format
#### Map / UI

- Five new base maps: Topographical by OpenTopoMap, Satellite (no labels), Topographical and Satellite Topo by USGS (best coverage in the US), and Satellite Firefly by Esri
- New Santa Tracker: a new button in the button panel will appear on Dec 12th that follows Santa and his reindeer around the world, using amateur radio tracking technology
  - Move the mouse over a stop to see its DXCC entity, and state or province

#### App

- Chinese (cn) is now the default interface language on a fresh install
- Band filter labels show in Chinese (80米, 70厘米, …) instead of 80m, 70cm, …
- The Print Hotkeys window title is Chinese, and the main window title / Last Traffic panel read 网格助手
- China province data: 35 BY-* entries (北京, 河北, 广东, 香港, …) so grids inside China show the province name
- New offline base map 离线地图 (world, zoom 2-4) built from bundled Chinese tiles
- PSK Reporter watch: follow a call sign from either end - who hears it, or what it hears - drawn on the main map
- Live reports come from the PSK Reporter MQTT feed and are back filled from the PSK Reporter retrieve API (15 minutes up to 24 hours)
- The docked panel lists time, sender, receiver, band, mode, SNR and frequency; the tool bar button opens it, right click toggles just the map overlay
- Offline mode never connects or fetches history, and the watch keeps a day of reports in memory
- Clicking a pin on the map shows that report as a card: calls, grids, band, mode, SNR, time and frequency, drawn as a pskreporter style teardrop pin in a muted band colour
- The report table starts folded; its header unfolds it and the choice is remembered
- Interface titles can now have their own translation key (data-i18n-title), so a tooltip no longer has to reuse the label text
- Call sign lookup window translated end to end: row labels (type, class, timezone, distance, azimuth, grid, …), Yes/No and the Clear / Generate Messages buttons
- Around 30 more interface strings translated: every window title (Band Activity, Quick Stats, Callsign Lookup, Statistics, Alerts, and the roster title with its report counts), the POTA / SOTA / CQ Zones / ITU Zones / DX Marathon tooltips and the tropo legend
- CQ zone names and continent / country names follow the interface language, as 简体 and 繁體 overlays on top of the shipped map data
- The Current Conditions window gained a glossary line: hovering a solar abbreviation (SFI, K, Bz, …) explains it in the interface language
- tools/audit_english.js takes a proper noun allow list (tools/english_allowlist.txt) and now reports zero unexplained English strings

### HTML List

```html
<h4>Map / UI</h4>
<ul>
  <li>Five new base maps: Topographical by OpenTopoMap, Satellite (no labels), Topographical and Satellite Topo by USGS (best coverage in the US), and Satellite Firefly by Esri</li>
  <li>New Santa Tracker: a new button in the button panel will appear on Dec 12th that follows Santa and his reindeer around the world, using amateur radio tracking technology
    <ul>
      <li>Move the mouse over a stop to see its DXCC entity, and state or province</li>
    </ul>
  </li>
</ul>
<h4>App</h4>
<ul>
  <li>Chinese (cn) is now the default interface language on a fresh install</li>
  <li>Band filter labels show in Chinese (80米, 70厘米, …) instead of 80m, 70cm, …</li>
  <li>The Print Hotkeys window title is Chinese, and the main window title / Last Traffic panel read 网格助手</li>
  <li>China province data: 35 BY-* entries (北京, 河北, 广东, 香港, …) so grids inside China show the province name</li>
  <li>New offline base map 离线地图 (world, zoom 2-4) built from bundled Chinese tiles</li>
  <li>PSK Reporter watch: follow a call sign from either end - who hears it, or what it hears - drawn on the main map</li>
  <li>Live reports come from the PSK Reporter MQTT feed and are back filled from the PSK Reporter retrieve API (15 minutes up to 24 hours)</li>
  <li>The docked panel lists time, sender, receiver, band, mode, SNR and frequency; the tool bar button opens it, right click toggles just the map overlay</li>
  <li>Offline mode never connects or fetches history, and the watch keeps a day of reports in memory</li>
  <li>Clicking a pin on the map shows that report as a card: calls, grids, band, mode, SNR, time and frequency, drawn as a pskreporter style teardrop pin in a muted band colour</li>
  <li>The report table starts folded; its header unfolds it and the choice is remembered</li>
  <li>Interface titles can now have their own translation key (data-i18n-title), so a tooltip no longer has to reuse the label text</li>
  <li>Call sign lookup window translated end to end: row labels (type, class, timezone, distance, azimuth, grid, …), Yes/No and the Clear / Generate Messages buttons</li>
  <li>Around 30 more interface strings translated: every window title (Band Activity, Quick Stats, Callsign Lookup, Statistics, Alerts, and the roster title with its report counts), the POTA / SOTA / CQ Zones / ITU Zones / DX Marathon tooltips and the tropo legend</li>
  <li>CQ zone names and continent / country names follow the interface language, as 简体 and 繁體 overlays on top of the shipped map data</li>
  <li>The Current Conditions window gained a glossary line: hovering a solar abbreviation (SFI, K, Bz, …) explains it in the interface language</li>
  <li>tools/audit_english.js takes a proper noun allow list (tools/english_allowlist.txt) and now reports zero unexplained English strings</li>
</ul>
```
