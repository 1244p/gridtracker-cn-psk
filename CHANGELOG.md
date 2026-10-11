# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [v2.261011.2]

### MD Markup Format
#### Off-Air Services

- New DX Feeds (Settings -> Features -> Online -> Off-Air Services -> "DX Feeds", off by default)
  - Beacon spots (BEACON / NCDXF) are ignored
  - New Settings -> Feeds tab (shown while DX Feeds is on):
    - CW, Digital and Phone: which spots to receive, for the Feed Roster and the map (all on by default)
    - Feed Spots Max Age: how long feed spots stay on the map, 1 to 60 minutes (default 5 minutes)
    - Clear All Feeds: clears all feed data received (Feed Roster and map); new spots keep arriving
  - Feed spots are kept for an hour after they were last spotted; the map shows them per Feed Spots Max Age, the Feed Roster per its own Roster Max Age (up to 1 hour, default 2 minutes)

#### Call Roster

- New "Call Roster | Feed Roster" tabs at the top of the roster window (shown when DX Feeds is on)
  - The Call Roster shows WSJT-X/JTDX decodes only; feed spots are in the Feed Roster
  - The settings pane is titled "Call Roster Settings" or "Feed Roster Settings", and opens below the tabs: click a tab to switch rosters without closing settings
  - New "Reset Columns To Default" in each roster's Settings -> General: resets that roster's columns and order only
  - The Feed Roster swaps the Call Roster's yellow and cyan (callsigns, grids, active tabs, Settings button) to tell them apart
- Settings -> Audio Alerts: new "Call Roster | Feed Roster" sub-tabs (shown when DX Feeds is on)
  - Each roster has its own alert choices, sounds and speech (Type, On Single, On Multiple), Reference and Exceptions, kept in step with that roster's own controls; Rules are Call Roster only
  - The bell next to a roster's Wanted choices opens its own Audio Alerts sub-tab
- Sliders in the roster window now show "(Use Arrow Keys For Smaller Increments)" on hover, like the main window; translated in both
- DXCC column: click to center the map on the entity and highlight (dazzle) its outline, like clicking a Grid
- Fixed dragging the Band or Mode column when it is shown for multiple bands or modes but not enabled
  - Hidden columns now keep their place when other columns are dragged

#### New Feed Roster (DX Cluster / CW Skimmer / Spothole spots)

- Its own Logbook, Hunting, Wanted, Exceptions, Watchers, columns, sorting, compact mode and Roster Max Age
  - One set of settings for all bands and modes (Band/Mode Memory applies to the Call Roster only)
  - Its own Ignores (Callsign, DX DXCC, DE DXCC, DE Cont, Grid, CQ Zone, ITU Zone and Spotter), separate from the Call Roster's
    - DE DXCC drops spots reported by spotters in that entity, DE Cont by spotters on that continent; right-click a DX DXCC, DE DXCC or DE Cont entry to ignore it
- Triangle before the callsign: a rig is on the spot's band and mode, left-click sets the DX call and grid on that rig
- Otherwise the spot is read-only, hover shows how to work it
- "Gen Msgs" works on any feed spot, using a rig on the spot's band and mode, otherwise the active rig
- Freq column shows the spot's frequency
- "CQ" column: ✔ when the spot's comment starts with CQ (any case), except "CQ Contest"
- US feed spots get the same state and county lookups as decodes
- POTA: feed spots get the activator's park from a park reference in the spot's comment, otherwise like decodes (current POTA spot or scheduled activation), or "?-????" for a "CQ POTA" spot; works with Wanted POTA and the POTA column
  - The park sticks: a later spot without one doesn't erase it, and newer information (a spot naming another park, or a newer POTA spot) replaces it, so an activator who moves parks is picked up
- "Feeds" tab in the Feed Roster's Settings:
  - Allow Alert Script for feed spots (audio alerts are set in Settings -> Audio Alerts -> Feed Roster)
  - Allow Notifications (Pushover, Simplepush) for feed spots
  - Feed spots never trigger Custom Alerts
  - Modes: one tick box per mode seen in feed spots; untick a mode to hide its spots in the Feed Roster (every mode seen is remembered, ticked or not)
  - Bands: choose which bands' feed spots appear, based on a US or non-US band plan (all bands on by default)
- "Spotter" column: the station that reported a feed spot
  - Right-click a spotter for Lookup, Add Watcher (a Spotter watcher), Copy, Ignore Spotter or Edit Ignores
- "DX DXCC" column (the Call Roster's DXCC column) and new "DE DXCC" column: the spotter's DXCC entity
- "DX Cont" column (the Call Roster's Cont column) and new "DE Cont" column: the spotter's continent
- Exceptions (in the Feed Roster and Settings -> Audio Alerts -> Feed Roster): "Not My DX DXCC" and "Only My DX DXCC" for the spotted station
  - New "Hide Self-Spotters": hides spots where the station spotted itself (W1AW-#, W1AW/P and VE/W1AW count as W1AW)
  - "..." opens the Feed Roster's Exceptions settings tab, which has Uses LoTW (with its last-upload age)
- Settings -> Watcher: New "Spotter" type, with or without Regex, highlighted in the Spotter column
  - A plain Spotter watcher also covers the spotter's skimmer suffixes (W3LPL also covers W3LPL-# and W3LPL-2)
- "Spotter" category in the Feed Roster's Settings -> Ignores, for spotters sending false or too many questionable spots
  - An ignored spotter's spots are dropped from the Feed Roster and the map (W3LPL also covers W3LPL-# and W3LPL-2)

#### Map / UI

- New "DX Feed Spots" button in the main button panel (shown when DX Feeds is on) shows feed spots on the map
  - Green target: a rig is on the spot's band and mode
  - Teal triangle: a rig is on the spot's band, in a different mode
  - Grey triangle: no rig is on the spot's band
  - Shows all bands, following only the map's Band / Mode filters
  - A spot without a grid is placed at the center of its DXCC entity (its grid stays empty, e.g. in the Feed Roster)
  - Hover (or right-click) shows the spot's call, spotter, age, DXCC, grid, frequency, mode, distance, azimuth, time and message
  - Left-click sets the DX call and grid on a rig on the spot's band and mode, otherwise the active rig
- New Main App -> Settings -> "Colors" tab: change any band's color, with "Reset Colors" to return to the defaults
  - Gridsquare Colors moved here from the Grids tab, above the Band Colors
  - Applies to the Call Roster, map spots, grids and pins, Stats and Lookup
- Map pins are now drawn in the band colors instead of images
  - Worked: plain pin, Confirmed: black V cap, Live/heard: diamond head
  - MH4 pin mode with Mixed bands: logbook pins use the Gridsquare Colors Worked/Confirmed colors instead of a red dot
  - MH4 pin mode with Auto or a single band: logbook pins use the band colors
  - The confirmed V cap is used with band colors, not with the Mixed bands Gridsquare Colors
- Fixed a logbook pin staying "worked" after its grid was confirmed, until the next map redraw
- Fixed flight paths in the AEQD projection skirting around the poles instead of crossing them

#### App

- All new text translated for every supported language
- About 230 more tooltips, labels and status messages are now translated (main window buttons and settings, Call Roster settings, logging and test results, Lookup details); GridTracker feature names such as Call Roster stay in English
- Fixed the Democratic Republic of the Congo (DRC) and Republic of the Congo flags being swapped
- Fixed the Band Activity popout window not opening on macOS

### HTML List

```html
<h4>Off-Air Services</h4>
<ul>
  <li>New DX Feeds (Settings -&gt; Features -&gt; Online -&gt; Off-Air Services -&gt; "DX Feeds", off by default)
    <ul>
      <li>Beacon spots (BEACON / NCDXF) are ignored</li>
      <li>New Settings -&gt; Feeds tab (shown while DX Feeds is on):
        <ul>
          <li>CW, Digital and Phone: which spots to receive, for the Feed Roster and the map (all on by default)</li>
          <li>Feed Spots Max Age: how long feed spots stay on the map, 1 to 60 minutes (default 5 minutes)</li>
          <li>Clear All Feeds: clears all feed data received (Feed Roster and map); new spots keep arriving</li>
        </ul>
      </li>
      <li>Feed spots are kept for an hour after they were last spotted; the map shows them per Feed Spots Max Age, the Feed Roster per its own Roster Max Age (up to 1 hour, default 2 minutes)</li>
    </ul>
  </li>
</ul>
<h4>Call Roster</h4>
<ul>
  <li>New "Call Roster | Feed Roster" tabs at the top of the roster window (shown when DX Feeds is on)
    <ul>
      <li>The Call Roster shows WSJT-X/JTDX decodes only; feed spots are in the Feed Roster</li>
      <li>The settings pane is titled "Call Roster Settings" or "Feed Roster Settings", and opens below the tabs: click a tab to switch rosters without closing settings</li>
      <li>New "Reset Columns To Default" in each roster's Settings -&gt; General: resets that roster's columns and order only</li>
      <li>The Feed Roster swaps the Call Roster's yellow and cyan (callsigns, grids, active tabs, Settings button) to tell them apart</li>
    </ul>
  </li>
  <li>Settings -&gt; Audio Alerts: new "Call Roster | Feed Roster" sub-tabs (shown when DX Feeds is on)
    <ul>
      <li>Each roster has its own alert choices, sounds and speech (Type, On Single, On Multiple), Reference and Exceptions, kept in step with that roster's own controls; Rules are Call Roster only</li>
      <li>The bell next to a roster's Wanted choices opens its own Audio Alerts sub-tab</li>
    </ul>
  </li>
  <li>Sliders in the roster window now show "(Use Arrow Keys For Smaller Increments)" on hover, like the main window; translated in both</li>
  <li>DXCC column: click to center the map on the entity and highlight (dazzle) its outline, like clicking a Grid</li>
  <li>Fixed dragging the Band or Mode column when it is shown for multiple bands or modes but not enabled
    <ul>
      <li>Hidden columns now keep their place when other columns are dragged</li>
    </ul>
  </li>
</ul>
<h4>New Feed Roster (DX Cluster / CW Skimmer / Spothole spots)</h4>
<ul>
  <li>Its own Logbook, Hunting, Wanted, Exceptions, Watchers, columns, sorting, compact mode and Roster Max Age
    <ul>
      <li>One set of settings for all bands and modes (Band/Mode Memory applies to the Call Roster only)</li>
      <li>Its own Ignores (Callsign, DX DXCC, DE DXCC, DE Cont, Grid, CQ Zone, ITU Zone and Spotter), separate from the Call Roster's
        <ul>
          <li>DE DXCC drops spots reported by spotters in that entity, DE Cont by spotters on that continent; right-click a DX DXCC, DE DXCC or DE Cont entry to ignore it</li>
        </ul>
      </li>
    </ul>
  </li>
  <li>Triangle before the callsign: a rig is on the spot's band and mode, left-click sets the DX call and grid on that rig</li>
  <li>Otherwise the spot is read-only, hover shows how to work it</li>
  <li>"Gen Msgs" works on any feed spot, using a rig on the spot's band and mode, otherwise the active rig</li>
  <li>Freq column shows the spot's frequency</li>
  <li>"CQ" column: ✔ when the spot's comment starts with CQ (any case), except "CQ Contest"</li>
  <li>US feed spots get the same state and county lookups as decodes</li>
  <li>POTA: feed spots get the activator's park from a park reference in the spot's comment, otherwise like decodes (current POTA spot or scheduled activation), or "?-????" for a "CQ POTA" spot; works with Wanted POTA and the POTA column
    <ul>
      <li>The park sticks: a later spot without one doesn't erase it, and newer information (a spot naming another park, or a newer POTA spot) replaces it, so an activator who moves parks is picked up</li>
    </ul>
  </li>
  <li>"Feeds" tab in the Feed Roster's Settings:
    <ul>
      <li>Allow Alert Script for feed spots (audio alerts are set in Settings -&gt; Audio Alerts -&gt; Feed Roster)</li>
      <li>Allow Notifications (Pushover, Simplepush) for feed spots</li>
      <li>Feed spots never trigger Custom Alerts</li>
      <li>Modes: one tick box per mode seen in feed spots; untick a mode to hide its spots in the Feed Roster (every mode seen is remembered, ticked or not)</li>
      <li>Bands: choose which bands' feed spots appear, based on a US or non-US band plan (all bands on by default)</li>
    </ul>
  </li>
  <li>"Spotter" column: the station that reported a feed spot
    <ul>
      <li>Right-click a spotter for Lookup, Add Watcher (a Spotter watcher), Copy, Ignore Spotter or Edit Ignores</li>
    </ul>
  </li>
  <li>"DX DXCC" column (the Call Roster's DXCC column) and new "DE DXCC" column: the spotter's DXCC entity</li>
  <li>"DX Cont" column (the Call Roster's Cont column) and new "DE Cont" column: the spotter's continent</li>
  <li>Exceptions (in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster): "Not My DX DXCC" and "Only My DX DXCC" for the spotted station
    <ul>
      <li>New "Hide Self-Spotters": hides spots where the station spotted itself (W1AW-#, W1AW/P and VE/W1AW count as W1AW)</li>
      <li>"..." opens the Feed Roster's Exceptions settings tab, which has Uses LoTW (with its last-upload age)</li>
    </ul>
  </li>
  <li>Settings -&gt; Watcher: New "Spotter" type, with or without Regex, highlighted in the Spotter column
    <ul>
      <li>A plain Spotter watcher also covers the spotter's skimmer suffixes (W3LPL also covers W3LPL-# and W3LPL-2)</li>
    </ul>
  </li>
  <li>"Spotter" category in the Feed Roster's Settings -&gt; Ignores, for spotters sending false or too many questionable spots
    <ul>
      <li>An ignored spotter's spots are dropped from the Feed Roster and the map (W3LPL also covers W3LPL-# and W3LPL-2)</li>
    </ul>
  </li>
</ul>
<h4>Map / UI</h4>
<ul>
  <li>New "DX Feed Spots" button in the main button panel (shown when DX Feeds is on) shows feed spots on the map
    <ul>
      <li>Green target: a rig is on the spot's band and mode</li>
      <li>Teal triangle: a rig is on the spot's band, in a different mode</li>
      <li>Grey triangle: no rig is on the spot's band</li>
      <li>Shows all bands, following only the map's Band / Mode filters</li>
      <li>A spot without a grid is placed at the center of its DXCC entity (its grid stays empty, e.g. in the Feed Roster)</li>
      <li>Hover (or right-click) shows the spot's call, spotter, age, DXCC, grid, frequency, mode, distance, azimuth, time and message</li>
      <li>Left-click sets the DX call and grid on a rig on the spot's band and mode, otherwise the active rig</li>
    </ul>
  </li>
  <li>New Main App -&gt; Settings -&gt; "Colors" tab: change any band's color, with "Reset Colors" to return to the defaults
    <ul>
      <li>Gridsquare Colors moved here from the Grids tab, above the Band Colors</li>
      <li>Applies to the Call Roster, map spots, grids and pins, Stats and Lookup</li>
    </ul>
  </li>
  <li>Map pins are now drawn in the band colors instead of images
    <ul>
      <li>Worked: plain pin, Confirmed: black V cap, Live/heard: diamond head</li>
      <li>MH4 pin mode with Mixed bands: logbook pins use the Gridsquare Colors Worked/Confirmed colors instead of a red dot</li>
      <li>MH4 pin mode with Auto or a single band: logbook pins use the band colors</li>
      <li>The confirmed V cap is used with band colors, not with the Mixed bands Gridsquare Colors</li>
    </ul>
  </li>
  <li>Fixed a logbook pin staying "worked" after its grid was confirmed, until the next map redraw</li>
  <li>Fixed flight paths in the AEQD projection skirting around the poles instead of crossing them</li>
</ul>
<h4>App</h4>
<ul>
  <li>All new text translated for every supported language</li>
  <li>About 230 more tooltips, labels and status messages are now translated (main window buttons and settings, Call Roster settings, logging and test results, Lookup details); GridTracker feature names such as Call Roster stay in English</li>
  <li>Fixed the Democratic Republic of the Congo (DRC) and Republic of the Congo flags being swapped</li>
  <li>Fixed the Band Activity popout window not opening on macOS</li>
</ul>
```

### Discord Messages

Message 1 of 6 (743 characters):

```md
## GridTracker2 v2.261011.2

### Off-Air Services
- New DX Feeds (Settings -> Features -> Online -> Off-Air Services -> "DX Feeds", off by default)
  - Beacon spots (BEACON / NCDXF) are ignored
  - New Settings -> Feeds tab (shown while DX Feeds is on):
    - CW, Digital and Phone: which spots to receive, for the Feed Roster and the map (all on by default)
    - Feed Spots Max Age: how long feed spots stay on the map, 1 to 60 minutes (default 5 minutes)
    - Clear All Feeds: clears all feed data received (Feed Roster and map); new spots keep arriving
  - Feed spots are kept for an hour after they were last spotted; the map shows them per Feed Spots Max Age, the Feed Roster per its own Roster Max Age (up to 1 hour, default 2 minutes)
```

Message 2 of 6 (1397 characters):

```md
### Call Roster
- New "Call Roster \| Feed Roster" tabs at the top of the roster window (shown when DX Feeds is on)
  - The Call Roster shows WSJT-X/JTDX decodes only; feed spots are in the Feed Roster
  - The settings pane is titled "Call Roster Settings" or "Feed Roster Settings", and opens below the tabs: click a tab to switch rosters without closing settings
  - New "Reset Columns To Default" in each roster's Settings -> General: resets that roster's columns and order only
  - The Feed Roster swaps the Call Roster's yellow and cyan (callsigns, grids, active tabs, Settings button) to tell them apart
- Settings -> Audio Alerts: new "Call Roster \| Feed Roster" sub-tabs (shown when DX Feeds is on)
  - Each roster has its own alert choices, sounds and speech (Type, On Single, On Multiple), Reference and Exceptions, kept in step with that roster's own controls; Rules are Call Roster only
  - The bell next to a roster's Wanted choices opens its own Audio Alerts sub-tab
- Sliders in the roster window now show "(Use Arrow Keys For Smaller Increments)" on hover, like the main window; translated in both
- DXCC column: click to center the map on the entity and highlight (dazzle) its outline, like clicking a Grid
- Fixed dragging the Band or Mode column when it is shown for multiple bands or modes but not enabled
  - Hidden columns now keep their place when other columns are dragged
```

Message 3 of 6 (1982 characters):

```md
### New Feed Roster (DX Cluster / CW Skimmer / Spothole spots)
- Its own Logbook, Hunting, Wanted, Exceptions, Watchers, columns, sorting, compact mode and Roster Max Age
  - One set of settings for all bands and modes (Band/Mode Memory applies to the Call Roster only)
  - Its own Ignores (Callsign, DX DXCC, DE DXCC, DE Cont, Grid, CQ Zone, ITU Zone and Spotter), separate from the Call Roster's
    - DE DXCC drops spots reported by spotters in that entity, DE Cont by spotters on that continent; right-click a DX DXCC, DE DXCC or DE Cont entry to ignore it
- Triangle before the callsign: a rig is on the spot's band and mode, left-click sets the DX call and grid on that rig
- Otherwise the spot is read-only, hover shows how to work it
- "Gen Msgs" works on any feed spot, using a rig on the spot's band and mode, otherwise the active rig
- Freq column shows the spot's frequency
- "CQ" column: ✔ when the spot's comment starts with CQ (any case), except "CQ Contest"
- US feed spots get the same state and county lookups as decodes
- POTA: feed spots get the activator's park from a park reference in the spot's comment, otherwise like decodes (current POTA spot or scheduled activation), or "?-????" for a "CQ POTA" spot; works with Wanted POTA and the POTA column
  - The park sticks: a later spot without one doesn't erase it, and newer information (a spot naming another park, or a newer POTA spot) replaces it, so an activator who moves parks is picked up
- "Feeds" tab in the Feed Roster's Settings:
  - Allow Alert Script for feed spots (audio alerts are set in Settings -> Audio Alerts -> Feed Roster)
  - Allow Notifications (Pushover, Simplepush) for feed spots
  - Feed spots never trigger Custom Alerts
  - Modes: one tick box per mode seen in feed spots; untick a mode to hide its spots in the Feed Roster (every mode seen is remembered, ticked or not)
  - Bands: choose which bands' feed spots appear, based on a US or non-US band plan (all bands on by default)
```

Message 4 of 6 (1254 characters):

```md
### New Feed Roster (DX Cluster / CW Skimmer / Spothole spots) (cont.)
- "Spotter" column: the station that reported a feed spot
  - Right-click a spotter for Lookup, Add Watcher (a Spotter watcher), Copy, Ignore Spotter or Edit Ignores
- "DX DXCC" column (the Call Roster's DXCC column) and new "DE DXCC" column: the spotter's DXCC entity
- "DX Cont" column (the Call Roster's Cont column) and new "DE Cont" column: the spotter's continent
- Exceptions (in the Feed Roster and Settings -> Audio Alerts -> Feed Roster): "Not My DX DXCC" and "Only My DX DXCC" for the spotted station
  - New "Hide Self-Spotters": hides spots where the station spotted itself (W1AW-#, W1AW/P and VE/W1AW count as W1AW)
  - "..." opens the Feed Roster's Exceptions settings tab, which has Uses LoTW (with its last-upload age)
- Settings -> Watcher: New "Spotter" type, with or without Regex, highlighted in the Spotter column
  - A plain Spotter watcher also covers the spotter's skimmer suffixes (W3LPL also covers W3LPL-# and W3LPL-2)
- "Spotter" category in the Feed Roster's Settings -> Ignores, for spotters sending false or too many questionable spots
  - An ignored spotter's spots are dropped from the Feed Roster and the map (W3LPL also covers W3LPL-# and W3LPL-2)
```

Message 5 of 6 (1589 characters):

```md
### Map / UI
- New "DX Feed Spots" button in the main button panel (shown when DX Feeds is on) shows feed spots on the map
  - Green target: a rig is on the spot's band and mode
  - Teal triangle: a rig is on the spot's band, in a different mode
  - Grey triangle: no rig is on the spot's band
  - Shows all bands, following only the map's Band / Mode filters
  - A spot without a grid is placed at the center of its DXCC entity (its grid stays empty, e.g. in the Feed Roster)
  - Hover (or right-click) shows the spot's call, spotter, age, DXCC, grid, frequency, mode, distance, azimuth, time and message
  - Left-click sets the DX call and grid on a rig on the spot's band and mode, otherwise the active rig
- New Main App -> Settings -> "Colors" tab: change any band's color, with "Reset Colors" to return to the defaults
  - Gridsquare Colors moved here from the Grids tab, above the Band Colors
  - Applies to the Call Roster, map spots, grids and pins, Stats and Lookup
- Map pins are now drawn in the band colors instead of images
  - Worked: plain pin, Confirmed: black V cap, Live/heard: diamond head
  - MH4 pin mode with Mixed bands: logbook pins use the Gridsquare Colors Worked/Confirmed colors instead of a red dot
  - MH4 pin mode with Auto or a single band: logbook pins use the band colors
  - The confirmed V cap is used with band colors, not with the Mixed bands Gridsquare Colors
- Fixed a logbook pin staying "worked" after its grid was confirmed, until the next map redraw
- Fixed flight paths in the AEQD projection skirting around the poles instead of crossing them
```

Message 6 of 6 (455 characters):

```md
### App
- All new text translated for every supported language
- About 230 more tooltips, labels and status messages are now translated (main window buttons and settings, Call Roster settings, logging and test results, Lookup details); GridTracker feature names such as Call Roster stay in English
- Fixed the Democratic Republic of the Congo (DRC) and Republic of the Congo flags being swapped
- Fixed the Band Activity popout window not opening on macOS
```
