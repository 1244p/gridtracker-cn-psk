# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [v2.261017.2]

### MD Markup Format
#### Call Roster / Feed Roster

- New Settings -> "Columns" tab in each roster: every column in one place, in the roster's column order
  - Change any column's color (Callsign, Grid, DXCC, State, Spotter, DE DXCC, Freq, Age, ...), with "Reset Colors" to return to the defaults
  - Drag a column onto another to move it, like the column headers; tick it to show or hide it
  - "Reset Column Order" moved here from the General tab
  - The Call Roster and Feed Roster keep their own colors; the hunting colors (Callsign, Grid, DXCC, State, County, Cont, POTA, CQz, ITUz, PX, DXM, Calling) also color a wanted entry's background
  - Band and Mode keep using the band and mode colors from the main window: click Band to open Settings -> Colors there
- Exceptions are in two even columns, however many of them are shown

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
- The "Feeds" settings tab is now called "Spots"
- Logbook choices say "Spots" instead of "Live" (e.g. "Spots Band & Mode"), in the Feed Roster and Settings -> Audio Alerts -> Feed Roster
- "DE DXCC" and "DE Cont" columns are now shown by default
- Clicking a callsign works the spot from the right place
  - A rig already on the spot's band and mode (WSJT-X, JTDX or AC Log) gets it, as before
  - Otherwise a connected AC Log gets it, on any band and mode: its entry tab is cleared and filled with the spot's frequency, band, mode (data modes as phone), call (tabbed out, so AC Log looks it up) and grid (6 characters when known)
  - With "Enable Rig Control" (Settings -> Logging -> N3FJP Loggers), AC Log tunes the rig to the spot's frequency and mode instead (SSB on the band's sideband, data modes on USB)
  - Without AC Log, it goes to Gen Msgs on the active WSJT-X / JTDX
  - A spot is only greyed out when nothing can take the click
- The ▲ before a callsign now only marks spots on the band and mode one of your rigs is on
- Settings -> Spots: the CW / Digital / Phone selector is gone; CW spots follow the Feed Roster's CW mode tick (unticked, they aren't requested from the feed)
- "Hide Self-Spotters" is now "Hide Self-Spot"
- Beacon spots are filtered by the feed server; GridTracker no longer checks for them
- Faster with the Feed Roster on screen: it's rebuilt less than half as often (rig status updates no longer rebuild it, and new spots are gathered for a second)

#### Map / UI

- Overlapping POTA, SOTA and DX Feeds markers in the same DXCC entity are grouped into one marker, at their average position
  - A grouped tooltip is a compact table ("POTA Spot × 3", "SOTA Spot × 2") with the park / summit reference after the grid
- Map tooltips show the grid in a column ("-" when a spot has none) instead of the header
- The POTA tooltip has a new header, like SOTA's: the park reference and name, its location, and distance / bearing
- Callsigns in a popped-out tooltip can be clicked to look them up
- Right-click a POTA park to pop out its tooltip
- POTA parks are drawn above DX Feeds spots, and SOTA summits above both
- A DX Feeds marker is hidden while the POTA or SOTA layer shows the same spot (call, band and mode)
- A DX Feeds marker for a park or summit sits exactly on it
- New POTA button: the tree and picnic table with "POTA" below, like the SOTA button

#### Logging / AC Log

- Settings -> Logging -> N3FJP Loggers: a green / red dot right of "Connect" shows whether AC Log is connected
- New "Enable Rig Control" under the N3FJP Loggers details (shown while Connect is on): clicking a Feed Roster callsign tunes the rig through AC Log
- AC Log's band and mode follow its entry tab when it has no rig frequency, and a rig frequency is shown in the main panel when it has one
- The call and grid in AC Log's entry tab show in GridTracker even before tabbing out of the call, and clear with the entry tab
- AC Log is asked for its band, mode and entry tab every 5 seconds, one request at a time

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
  <li>Exceptions are in two even columns, however many of them are shown</li>
</ul>
<h4>Feed Roster</h4>
<ul>
  <li>New Settings -&gt; Features -&gt; Online -&gt; "SOTA Chasing" (shown while DX Feeds is on): Summits on the Air activators from DX Feeds spots
    <ul>
      <li>A "SOTA" column, right of POTA, shows the summit named in the spot; its hover gives the summit's name, height and points</li>
      <li>A "SOTA" Wanted highlights summits you haven't chased today (from SOTA_REF in your logs), also in Settings -&gt; Audio Alerts -&gt; Feed Roster ("Wanted Feed Summit" / "Many Feed Summits")</li>
      <li>SOTA's summit list is downloaded while SOTA Chasing is on, and checked for a new one at startup and every 24 hours</li>
      <li>A spot on a summit is placed there: its grid becomes the summit's (Feed Roster, distance, and a logged QSO's GRIDSQUARE)</li>
      <li>On the map, on their own layer with a new SOTA button in the button panel (shown while SOTA Chasing is on): one snow-capped double-peak marker per summit, grey or orange for the same three states as the DX Feeds markers; its tooltip lists every spot on it</li>
      <li>Like POTA Hunting, it turns on the GT backup log, and a QSO logged with a spotted activator gets the summit's SOTA_REF</li>
    </ul>
  </li>
  <li>New "Auto Band" and "Auto Mode" exceptions (in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster): only spots on a band / in a mode one of your rigs is on (WSJT-X, JTDX or AC Log); with both, a rig on the spot's band and mode
    <ul>
      <li>With no rig connected they show everything</li>
    </ul>
  </li>
  <li>The "Feeds" settings tab is now called "Spots"</li>
  <li>Logbook choices say "Spots" instead of "Live" (e.g. "Spots Band &amp; Mode"), in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster</li>
  <li>"DE DXCC" and "DE Cont" columns are now shown by default</li>
</ul>
```
