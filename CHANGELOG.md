# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [v2.261014.0]

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

- New "Auto Band" and "Auto Mode" exceptions (in the Feed Roster and Settings -> Audio Alerts -> Feed Roster): only spots on a band / in a mode one of your rigs is on (WSJT-X, JTDX or AC Log); with both, a rig on the spot's band and mode
  - With no rig connected they show everything
- The "Feeds" settings tab is now called "Spots"
  - Its CW mode tick box is kept in step with Settings -> Feeds -> CW, both ways: unticking either stops CW spots being sent at all, saving bandwidth
- Logbook choices say "Spots" instead of "Live" (e.g. "Spots Band & Mode"), in the Feed Roster and Settings -> Audio Alerts -> Feed Roster
- "DE DXCC" and "DE Cont" columns are now shown by default

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
  <li>New "Auto Band" and "Auto Mode" exceptions (in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster): only spots on a band / in a mode one of your rigs is on (WSJT-X, JTDX or AC Log); with both, a rig on the spot's band and mode
    <ul>
      <li>With no rig connected they show everything</li>
    </ul>
  </li>
  <li>The "Feeds" settings tab is now called "Spots"
    <ul>
      <li>Its CW mode tick box is kept in step with Settings -&gt; Feeds -&gt; CW, both ways: unticking either stops CW spots being sent at all, saving bandwidth</li>
    </ul>
  </li>
  <li>Logbook choices say "Spots" instead of "Live" (e.g. "Spots Band &amp; Mode"), in the Feed Roster and Settings -&gt; Audio Alerts -&gt; Feed Roster</li>
  <li>"DE DXCC" and "DE Cont" columns are now shown by default</li>
</ul>
```
