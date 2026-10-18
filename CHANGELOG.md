# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [v2.261017.3]

### MD Markup Format
#### Call Roster / Feed Roster

- New Settings -> "Columns" tab in each roster: every column in one place, in the roster's column order
  - Change any column's color (Callsign, Grid, DXCC, State, Spotter, DE DXCC, Freq, Age, ...), with "Reset Colors" to return to the defaults
  - Drag a column onto another to move it, like the column headers; tick it to show or hide it
  - "Reset Column Order" moved here from the General tab
  - The Call Roster and Feed Roster keep their own colors; the hunting colors (Callsign, Grid, DXCC, State, County, Cont, POTA, CQz, ITUz, PX, DXM, Calling) also color a wanted entry's background
  - Band and Mode keep using the band and mode colors from the main window: click Band to open Settings -> Colors there


#### Feed Roster

- New Settings -> Features -> Online -> "SOTA Chasing" (shown while DX Feeds is on): Summits on the Air activators from DX Feeds spots
  - A "SOTA" column, right of POTA, shows the summit named in the spot; its hover gives the summit's name, height and points
  - A "SOTA" Wanted highlights summits you haven't chased today (from SOTA_REF in your logs), also in Settings -> Audio Alerts -> Feed Roster ("Wanted Feed Summit" / "Many Feed Summits")
  - SOTA's summit list is downloaded while SOTA Chasing is on, and checked for a new one at startup and every 24 hours
  - A spot on a summit is placed there: its grid becomes the summit's (Feed Roster, distance, and a logged QSO's GRIDSQUARE)
  - On the map, on their own layer with a new SOTA button in the button panel (shown while SOTA Chasing is on): one snow-capped double-peak marker per summit, black with an orange outline, or orange, for the same three states as the DX Feeds markers; its tooltip lists every spot on it
  - Like POTA Hunting, it turns on the GT backup log, and a QSO logged with a spotted activator gets the summit's SOTA_REF
- New "Auto Band" and "Auto Mode" exceptions (in the Feed Roster and Settings -> Audio Alerts -> Feed Roster): only spots on a band / in a mode one of your rigs is on (WSJT-X, JTDX or AC Log); with both, a rig on the spot's band and mode
  - With no rig connected they show everything
- The roster's Feeds settings tab (Modes, Bands, "Allow Alert Script", "Allow Notifications") moved to the main window's Settings -> Feeds, under Feed Spots Max Age and Clear All Feeds
  - The map's DX Feeds and SOTA markers now follow the same Modes and Bands as the Feed Roster
- Logbook choices say "Spots" instead of "Live" (e.g. "Spots Band & Mode"), in the Feed Roster and Settings -> Audio Alerts -> Feed Roster
- "DE DXCC" and "DE Cont" columns are now shown by default
- Clicking a callsign works the spot from the right place
  - A rig already on the spot's band and mode (WSJT-X, JTDX or AC Log) gets it, as before
  - Otherwise a connected AC Log gets it, on any band and mode: its entry tab is cleared and filled with the spot's frequency, band, mode (data modes as phone), call (tabbed out, so AC Log looks it up) and grid (6 characters when known)
  - With "Enable Rig Control" (Settings -> Logging -> N3FJP Loggers), AC Log tunes the rig to the spot's frequency and mode instead (SSB on the band's sideband, data modes on USB)
  - Without AC Log, it goes to Gen Msgs on the active WSJT-X / JTDX
- The ▲ before a callsign now only marks spots on the band and mode one of your rigs is on
- A callsign in a rig's DX Call (WSJT-X, JTDX, or AC Log's entry tab) is highlighted green, like in the Call Roster
- "Hide Self-Spotters" is now "Hide Self-Spot"
- Faster with the Feed Roster on screen: it's rebuilt less than half as often (rig status updates no longer rebuild it, and new spots are gathered for a second)

#### Map / UI

- Overlapping POTA, SOTA and DX Feeds markers in the same DXCC entity are grouped into one marker, at their average position
  - A grouped tooltip is a compact table ("POTA Spot × 3", "SOTA Spot × 2") with the park / summit reference after the grid
- Map tooltips show the grid in a column ("-" when a spot has none) instead of the header
- The POTA tooltip has a new header, like SOTA's: the park reference and name, its location, and distance / bearing
- Callsigns in a popped-out tooltip can be clicked to look them up
- Right-click a POTA park to pop out its tooltip
- POTA parks are drawn above DX Feeds spots, and SOTA summits above both
- Left-click a POTA, SOTA or DX Feeds marker to work the spot, like a Feed Roster callsign: a rig on its band and mode, else a connected AC Log (and its rig, with "Enable Rig Control")
  - A marker for several spots works the first one its tooltip lists
  - Where markers are stacked, only the top one is worked
- A POTA, SOTA or DX Feeds marker of a callsign in a rig's [DX Call] is ringed

#### Logging / AC Log

- Settings -> Logging -> N3FJP Loggers: a green / red dot right of "Connect" shows whether AC Log is connected
- New "Enable Rig Control" under the N3FJP Loggers details (shown while Connect is on): clicking a Feed Roster callsign tunes the rig through AC Log
- AC Log's band and mode follow its entry tab when it has no rig frequency, and a rig frequency is shown in the main panel when it has one
- The call and grid in AC Log's entry tab show in GridTracker even before tabbing out of the call, and clear with the entry tab
- AC Log is polled for its band, mode and entry tab every 5 seconds
- The status bar shows "CONNECTED" instead of "RECEIVE" while AC Log is the active rig
- Clicking a spot also fills AC Log's Other fields titled POTA_REF / SOTA_REF with the spot's park / summit (the titles are read from AC Log; versions without that request skip it)
- QSOs logged in AC Log reach GridTracker more reliably: several logged in quick succession all come over, and a failed download is retried

### HTML List

```html
<h4>Call Roster / Feed Roster</h4>
<ul>
  <li>New Settings -&gt; "Columns" tab in each roster: every column in one place, in the roster's column order
    <ul>
      <li>Change any column's color (Callsign, Grid, DXCC, State, Spotter, DE DXCC, Freq, Age, ...), with "Reset Colors" to return to the defaults</li>
      <li>Drag a column onto another to move it, like the column headers; tick it to show or hide it</li>
      <li>"Reset Column Order" moved here from the General tab</li>
      <li>The Call Roster and Feed Roster keep their own colors; the hunting colors (Callsign, Grid, DXCC, State, County, Cont, POTA, CQz, ITUz, PX, DXM, Calling) also color a wanted entry's background</li>
      <li>Band and Mode keep using the band and mode colors from the main window: click Band to open Settings -&gt; Colors there</li>
    </ul>
  </li>
</ul>
<h4>Feed Roster</h4>
<ul>
  <li>New Settings -&gt; Features -&gt; Online -&gt; "SOTA Chasing" (shown while DX Feeds is on): Summits on the Air activators from DX Feeds spots
    <ul>
      <li>A "SOTA" column, right of POTA, shows the summit named in the spot; its hover gives the summit's name, height and points</li>
      <li>A "SOTA" Wanted highlights summits you haven't chased today (from SOTA_REF in your logs), also in Settings -&gt; Audio Alerts -&gt; Feed Roster ("Wanted Feed Summit" / "Many Feed Summits")</li>
      <li>SOTA's summit list is downloaded while SOTA Chasing is on, and checked for a new one at startup and every 24 hours</li>
      <li>A spot on a summit is placed there: its grid becomes the summit's (Feed Roster, distance, and a logged QSO's GRIDSQUARE)</li>
      <li>On the map, on their own layer with a new SOTA button in the button panel (shown while SOTA Chasing is on): one snow-capped double-peak marker per summit, black with an orange outline, or orange, for the same three states as the DX Feeds markers; its tooltip lists every spot on it</li>
      <li>Like POTA Hunting, it turns on the GT backup log, and a QSO logged with a spotted activator gets the summit's SOTA_REF</li>
    </ul>
  </li>
  <li>New "Auto Band" and "Auto Mode" exceptions (in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster): only spots on a band / in a mode one of your rigs is on (WSJT-X, JTDX or AC Log); with both, a rig on the spot's band and mode
    <ul>
      <li>With no rig connected they show everything</li>
    </ul>
  </li>
  <li>The roster's Feeds settings tab (Modes, Bands, "Allow Alert Script", "Allow Notifications") moved to the main window's Settings -&gt; Feeds, under Feed Spots Max Age and Clear All Feeds
    <ul>
      <li>The map's DX Feeds and SOTA markers now follow the same Modes and Bands as the Feed Roster</li>
    </ul>
  </li>
  <li>Logbook choices say "Spots" instead of "Live" (e.g. "Spots Band &amp; Mode"), in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster</li>
  <li>"DE DXCC" and "DE Cont" columns are now shown by default</li>
  <li>Clicking a callsign works the spot from the right place
    <ul>
      <li>A rig already on the spot's band and mode (WSJT-X, JTDX or AC Log) gets it, as before</li>
      <li>Otherwise a connected AC Log gets it, on any band and mode: its entry tab is cleared and filled with the spot's frequency, band, mode (data modes as phone), call (tabbed out, so AC Log looks it up) and grid (6 characters when known)</li>
      <li>With "Enable Rig Control" (Settings -&gt; Logging -&gt; N3FJP Loggers), AC Log tunes the rig to the spot's frequency and mode instead (SSB on the band's sideband, data modes on USB)</li>
      <li>Without AC Log, it goes to Gen Msgs on the active WSJT-X / JTDX</li>
    </ul>
  </li>
  <li>The ▲ before a callsign now only marks spots on the band and mode one of your rigs is on</li>
  <li>A callsign in a rig's DX Call (WSJT-X, JTDX, or AC Log's entry tab) is highlighted green, like in the Call Roster</li>
  <li>"Hide Self-Spotters" is now "Hide Self-Spot"</li>
  <li>Faster with the Feed Roster on screen: it's rebuilt less than half as often (rig status updates no longer rebuild it, and new spots are gathered for a second)</li>
</ul>
<h4>Map / UI</h4>
<ul>
  <li>Overlapping POTA, SOTA and DX Feeds markers in the same DXCC entity are grouped into one marker, at their average position
    <ul>
      <li>A grouped tooltip is a compact table ("POTA Spot × 3", "SOTA Spot × 2") with the park / summit reference after the grid</li>
    </ul>
  </li>
  <li>Map tooltips show the grid in a column ("-" when a spot has none) instead of the header</li>
  <li>The POTA tooltip has a new header, like SOTA's: the park reference and name, its location, and distance / bearing</li>
  <li>Callsigns in a popped-out tooltip can be clicked to look them up</li>
  <li>Right-click a POTA park to pop out its tooltip</li>
  <li>POTA parks are drawn above DX Feeds spots, and SOTA summits above both</li>
  <li>Left-click a POTA, SOTA or DX Feeds marker to work the spot, like a Feed Roster callsign: a rig on its band and mode, else a connected AC Log (and its rig, with "Enable Rig Control")
    <ul>
      <li>A marker for several spots works the first one its tooltip lists</li>
      <li>Where markers are stacked, only the top one is worked</li>
    </ul>
  </li>
  <li>A POTA, SOTA or DX Feeds marker of a callsign in a rig's [DX Call] is ringed</li>
</ul>
<h4>Logging / AC Log</h4>
<ul>
  <li>Settings -&gt; Logging -&gt; N3FJP Loggers: a green / red dot right of "Connect" shows whether AC Log is connected</li>
  <li>New "Enable Rig Control" under the N3FJP Loggers details (shown while Connect is on): clicking a Feed Roster callsign tunes the rig through AC Log</li>
  <li>AC Log's band and mode follow its entry tab when it has no rig frequency, and a rig frequency is shown in the main panel when it has one</li>
  <li>The call and grid in AC Log's entry tab show in GridTracker even before tabbing out of the call, and clear with the entry tab</li>
  <li>AC Log is polled for its band, mode and entry tab every 5 seconds</li>
  <li>The status bar shows "CONNECTED" instead of "RECEIVE" while AC Log is the active rig</li>
  <li>Clicking a spot also fills AC Log's Other fields titled POTA_REF / SOTA_REF with the spot's park / summit (the titles are read from AC Log; versions without that request skip it)</li>
  <li>QSOs logged in AC Log reach GridTracker more reliably: several logged in quick succession all come over, and a failed download is retried</li>
</ul>
```
