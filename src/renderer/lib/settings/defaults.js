const validSettings = [
  "N1MM",
  "acLog",
  "adifLog",
  "app",
  "appLogs",
  "audio",
  "awardTracker",
  "bandActivity",
  "ByBandMode",
  "ignoredCQ",
  "ignoredCalls",
  "ignoredGrid",
  "ignoredDxcc",
  "ignoredCQz",
  "ignoredITUz",
  "ignoredSpotters",
  "callsignLookups",
  "audioAlerts",
  "currentVersion",
  "dxkLog",
  "log4OM",
  "mapMemory",
  "map",
  "msg",
  "reception",
  "roster",
  "feedRoster",
  "feedAudioAlerts",
  "customAlerts",
  "startupLogs",
  "trustedQsl",
  "legendColors",
  "bandColors",
  "pstrotator",
  "HRDLogbookLog",
  "defaultsApplied"
];

// The Gridsquare Colors (Settings -> Grids); the "legend" name is kept to match the saved settings key
const def_legendColors = {
  QSO: "#EEEE00",
  QSL: "#EE0000",
  QSX: "#1111EE",
  CQ: "#00FF00",
  CQDX: "#00FFFF",
  QRZ: "#FFFF00",
  QTH: "#FFA600"
};

const def_maps = {
  mapIndex: "Street by Esri (English)",
  offlineMapIndex: "Satellite by MapTiler (No Labels)(Offline)",
  nightMapIndex: "Dark Gray by Esri (English)",
  offlineNightMapIndex: "Toner by Stamen (No Labels)(Offline)"
};

const k_valid_projections = [ "EPSG:3857", "AEQD" ];

const k_max_aeqd_grid_in_miles = 11500.0;

// Roster column colors (6-digit hex, no "#"), edited in each roster window's Settings -> Colors; each table lists
// exactly the columns that roster has (Band and Mode use the band and mode colors instead). The hunting colors
// (Callsign, Calling, Grid, POTA, DXCC, DXM, State, County, Cont, CQz, ITUz, PX) also tint a wanted entry's background.
const k_callRosterColumnColors = {
  Callsign: "FFFF00", Calling: "90EE90", Rig: "EEEEEE", Wanted: "EEEEEE", Grid: "00FFFF", Msg: "EEEEEE", POTA: "FBB6FC", SOTA: "40FFD8",
  DXCC: "FFA500", DXM: "7398FF", State: "90EE90", County: "CCDD00", Cont: "00DDDD",
  dB: "CCCCCC", Freq: "00FF00", DT: "5CAEFF", Dist: "00FFFF", Azim: "FFFF00",
  CQz: "DDDDDD", ITUz: "DDDDDD", PX: "FFFF00",
  LoTW: "00FF00", eQSL: "00FF00", OQRS: "00FF00",
  Life: "EEEEEE", Spot: "EEEEEE", Age: "EEEEEE", UTC: "EEEEEE"
};

// The Feed Roster swaps the Call Roster's callsign (yellow) and grid (cyan) colors, like its window colors
const k_feedRosterColumnColors = {
  Callsign: "00FFFF", Spotter: "5CAEFF", CQ: "00FF00", Wanted: "EEEEEE", Grid: "FFFF00", Msg: "EEEEEE", POTA: "FBB6FC", SOTA: "40FFD8",
  DXCC: "FFA500", DEDXCCv2: "80FFB0", DXM: "7398FF", State: "90EE90", County: "CCDD00", Cont: "00DDDD", DEContv2: "FF8080",
  Freq: "00FF00", Dist: "00FFFF", Azim: "FFFF00",
  CQz: "DDDDDD", ITUz: "DDDDDD", PX: "FFFF00",
  LoTW: "00FF00", eQSL: "00FF00", OQRS: "00FF00",
  Life: "EEEEEE", Age: "EEEEEE", UTC: "EEEEEE"
};

const def_settings = {
  defaultsApplied: true,
  app: {
    mapRight: false,
    clearOnCQ: false,
    crScript: 0,
    wantedByBandMode: false,
    includeExceptions: true,
    includeCustomAlerts: false,
    distanceUnit: "MI",
    graylineImgSrc: 0,
    gridViewMode: 3,
    gridsquareDecayTime: 300,
    gtBandFilter: "",
    gtFlagImgSrc: 0,
    gtModeFilter: "",
    gtPropFilter: "mixed",

    offAirServicesEnable: true,
    spottingEnable: true,
    // DX Feeds (DX Cluster / CW Skimmer / Spothole spots): Digital and Phone always, CW while Settings -> Feeds ->
    // Modes -> CW is ticked (feeds.modes.CW)
    dxFeeds: false,
    // Seconds a feed spot is kept (shown on the map) after it was last spotted
    feedMaxAge: 300,
    // Settings -> Feeds: which feed spots the Feed Roster and the map (DX Feeds and SOTA markers) show, and what the
    // Feed Roster may alert through. Was feedRoster.feeds (the Feed Roster's Spots tab) until v2.261017, moved at startup
    feeds: {
      // Feed Roster audio alerts come from Settings -> Audio Alerts -> Feed Roster; these cover the script and push
      alertScript: false,
      notifications: false,
      // Bands the user unticked; anything not listed is shown
      hiddenBands: {},
      // Every mode seen in feed spots (mode: shown); false = unticked. Starts with the ones the feed is known to send
      // and only grows. CW unticked also stops the server sending CW (gtChatSendFeeds)
      modes: {
        CW: true, FT4: true, FT8: true, SSB: true,
        AM: true, DATA: true, DIGVOICE: true, FM: true, FSK: true, HELL: true, JS8: true, JS8CALL: true,
        PHONE: true, PSK: true, PSK31: true, PSK63: true, RTTY: true, SSTV: true, WSPR: true
      }
    },
    loadAdifAtStartup: false,
    locale: "en",
    lookupLoginCq: "",
    lookupLoginQrz: "",
    lookupLoginQth: "",
    lookupOnTx: false,
    lookupCloseLog: false,
    lookupMerge: true,
    lookupMissingGrid: false,
    lookupPasswordCq: "",
    lookupPasswordQrz: "",
    lookupPasswordQth: "",
    lookupService: "CALLOOK",
    moonTrack: 0,
    mouseTracking: true,
    multicast: false,
    myBand: "OOB",
    myGrid: "",
    myCall: "NOCALL",
    myMode: "",
    myRawCall: "NOCALL",
    myRawFreq: "",
    myRawGrid: "",
    // Settings -> General -> Station Callsign: used while no connected instance gives a callsign (applyStationCallsign)
    stationCallsign: "",
    oamsBandActivity: true,
    oamsBandActivityNeighbors: false,
    pathWidthWeight: 1.0,
    potaFeatureEnabled: true,
    // SOTA Chasing (Settings -> Features -> Online): SOTA activators from DX Feeds spots in the Feed Roster
    sotaFeatureEnabled: false,
    // Logbook -> Export SOTA Chaser Log: where the last export ended (seconds), and the station of its newest QSO, so
    // the next export starts there without sending that QSO twice
    sotaLastChaserExport: 0,
    sotaLastChaserExportCall: "",
    potaMapEnabled: false,
    pushPinMode: false,
    qrzPathWidthWeight: 1.2,
    sixWideMode: 0,
    soundCard: "default",
    soundCardName: null,
    soundcards: null,
    warnOnSoundcardsChange: false,
    spotView: 0,
    windowTheme: "dark",
    useLocalTime: 0,
    wsjtForwardUdpEnable: false,
    wsjtForwardUdpIp: "127.0.0.1",
    wsjtForwardUdpPort: 2238,
    wsjtIP: "",
    wsjtUdpPort: 0,

    adifBroadcastEnable: false,
    adifBroadcastPort: 2333,
    adifBroadcastIP: "",
    adifBroadcastMulticast: false,

    workingCallsignEnable: false,
    workingCallsigns: {},
    workingGridEnable: false,
    workingGrids: {},
    workingDateEnable: false,
    workingDate: 0,
    // No longer used: the Logbook scrolls its whole list (kept so saved settings don't change)
    qsoItemsPerPage: 100,
    qslAuthority: "L",
    collapsedMapViewFilters: false,
    logEventMedia: "Ping-coin.mp3",
    buttonPanelOrder: []
  },
  appLogs: [],
  map: {
    allGridOpacity: 1,
    animate: true,
    // Flight path animation steps per second, 1 to 30 (was animateSpeed, screen frames per step: converted at startup)
    animateFps: 15,
    CQhilite: true,
    predMode: 0,
    predOpacity: 0.4,
    predLegend: true,
    spotLegend: true,
    fitQRZ: false,
    focusRig: true,
    gridAlpha: 136,
    // POTA, SOTA and DX Feeds markers that would overlap are drawn as one (groupOverlappingFeatures)
    groupSpots: true,
    haltAllOnTx: true,
    longitude: 0.0,
    latitude: 0.0,
    mapOpacity: 1,
    mapIndex: "Street by Esri (English)",
    terminatorDegreeIndex: 1,
    offlineMapIndex: "Satellite by MapTiler (No Labels)(Offline)",
    mergeOverlay: false,
    mouseOver: true,
    nightMapOpacity: 0.8,
    nightMapEnable: false,
    nightMapIndex: "Dark Gray by Esri (English)",
    offlineNightMapIndex: "Toner by Stamen (No Labels)(Offline)",
    nightPathColor: 361,
    nightQrzPathColor: 1,
    offlineMode: false,
    pathColor: 0,
    qrzDxccFallback: false,
    qrzPathColor: 1,
    graylineOpacity: 0.1,
    splitQSL: true,
    showRangeRings: false,
    rangeRingDistance: 2500,
    rangeRingColor: 0,
    equator: false,
    equatorColor: 0,
    dxcwFeed: false,
    // Button panel SOTA button (shown while SOTA Chasing runs): summits with activators on the map
    sotaMap: true,
    trafficDecode: true,
    usRadar: false,
    timezonesEnable: 0,
    showAllGrids: false,
    trophyOverlay: 0,
    zoom: 4,
    mapTrans: 0.5,
    apiKeys: {},
    projection: "EPSG:3857",
    backgroundColor: {
      "Bathymetric Oceans by GEBCO (No Labels)": "#396ca7",
      "City Lights by NASA (No Labels)": "#000000",
      "Dark Gray by Esri (English)": "#232227",
      "Dark Matter by Carto (English)": "#262626",
      "Dark Matter by Carto (No Labels)": "#262626",
      "HamGames by N0TTL (Intl)(Offline)": "#000000",
      "Humanitarian by OpenStreetMap (Intl)": "#90cccb",
      "Light Gray by Esri (English)": "#d0ced2",
      "Mapnik by OpenStreetMap (Deutsch)": "#aad3df",
      "Mapnik by OpenStreetMap (français)": "#b4d0d0",
      "National Geographic by Esri (English)": "#80b3de",
      "Oceans by Esri (No Labels)": "#94b9e5",
      "Physical by Esri (No Labels)": "#76abcb",
      "Positron by Carto (English)": "#d4dadc",
      "Positron by Carto (No Labels)": "#d4dadc",
      "Satellite by Esri (No Labels)": "#002f45",
      "Satellite by MapTiler (No Labels)(Offline)": "#0e2034",
      "Shaded Relief by Esri (No Labels)": "#9ebcd8",
      "Street by Esri (English)": "#99d9f2",
      "Terrain by Esri (No Labels)": "#63d7db",
      "Toner by Stamen (No Labels)(Offline)": "#000000",
      "Topographical by Esri (English)": "#b8e6fe",
      "Voyager by Carto (English)": "#d5e8eb",
      "Voyager by Carto (No Labels)": "#d5e8eb",
      "天地图 卫星 (Chinese)": "#000000",
      "天地图 地形 (Chinese)": "#000000",
      "天地图 矢量 (Chinese)": "#000000"
    }
  },
  adifLog: {
    menu: {
      buttonAdifCheckBox: false,
      buttonClubCheckBox: false,
      buttonLOTWCheckBox: false,
      buttonQRZCheckBox: false,
      buttonPsk24CheckBox: false
    },
    startup: {
      loadGTCheckBox: true,
      loadAdifCheckBox: false,
      loadPsk24CheckBox: false,
      loadQRZCheckBox: false,
      loadLOTWCheckBox: false,
      loadClubCheckBox: false
    },
    qsolog: {
      logQRZqsoCheckBox: false,
      logGTqsoCheckBox: true,
      logLOTWqsoCheckBox: false,
      logHRDLOGqsoCheckBox: false,
      logClubqsoCheckBox: false,
      logCloudlogQSOCheckBox: false,
      logeQSLQSOCheckBox: false,
      logHamCQqsoCheckBox: false
    },
    nickname: {
      nicknameeQSLCheckBox: false
    },
    text: {
      lotwLogin: "",
      clubCall: "",
      clubEmail: "",
      clubPassword: "",
      lotwPassword: "",
      lotwTrusted: "",
      lotwStation: "",
      qrzApiKey: "",
      HRDLOGCallsign: "",
      HRDLOGUploadCode: "",
      CloudlogURL: "http://127.0.0.1",
      CloudlogAPI: "",
      CloudlogStationProfileID: "1",
      eQSLUser: "",
      eQSLPassword: "",
      eQSLNickname: "",
      HamCQApiKey: ""
    },
    lastFetch: {
      lotw_qsl: 0
    }
  },
  msg: {
    msgSimplepush: false,
    msgSimplepushApiKey: "",
    msgSimplepushNotifyOnly: false,
    msgSimplepushDailySchedule: false,
    msgSimplepushScheduleStart: 0,
    msgSimplepushScheduleEnd: 0,
    msgPushover: false,
    msgPushoverUserKey: "",
    msgPushoverToken: "",
    msgPushoverDailySchedule: false,
    msgPushoverScheduleStart: 0,
    msgPushoverScheduleEnd: 0,

  },
  reception: {
    viewHistoryTimeSec: 900,
    pathColor: -1,
    pathNightColor: 361,
    spotWidth: 0.8,
    mergeSpots: true
  },
  N1MM: {
    enable: false,
    port: 2333,
    ip: "127.0.0.1"
  },
  log4OM: {
    enable: false,
    port: 2236,
    ip: "127.0.0.1",
    // Remote control (log4om.js): Connect, Enable Rig Control, Log4OM's remote-control port and its data-output port
    // (where its Radio Status goes; Log4OM's own defaults)
    connect: false,
    rigControl: false,
    rcPort: 2241,
    rcOutputPort: 2242
  },
  dxkLog: {
    enable: false,
    port: 52000,
    ip: "127.0.0.1"
  },
  HRDLogbookLog: {
    enable: false,
    port: 7826,
    ip: "127.0.0.1"
  },
  acLog: {
    enable: false,
    port: 1100,
    ip: "127.0.0.1",
    menu: false,
    startup: false,
    qsl: "A",
    connect: false,
    rigControl: false
  },
  trustedQsl: {
    stationFile: "",
    stationFileValid: false,
    binaryFile: "",
    binaryFileValid: false
  },
  callsignLookups: {
    lotwUseEnable: true,
    lotwWeeklyEnable: true,
    lotwLastUpdate: 0,
    eqslUseEnable: true,
    eqslWeeklyEnable: true,
    eqslLastUpdate: 0,
    ulsUseEnable: true,
    ulsWeeklyEnable: true,
    ulsLastUpdate: 0,
    cacUseEnable: true,
    cacWeeklyEnable: true,
    cacLastUpdate: 0,
    oqrsUseEnable: false,
    oqrsWeeklyEnable: false,
    oqrsLastUpdate: 0
  },
  bandActivity: {
    lastUpdate: {},
    lines: {}
  },
  // The Gridsquare Colors; saved under this name in existing settings files, so it is not renamed
  legendColors: {
    QSO: "#EEEE00",
    QSL: "#EE0000",
    QSX: "#1111EE",
    CQ: "#00FF00",
    CQDX: "#00FFFF",
    QRZ: "#FFFF00",
    QTH: "#FFA600"
  },
  pstrotator: {
    enable: false,
    port: 12000,
    ip: "127.0.0.1"
  },
  audio: {
    alertMute: 0,
    speechRate: 1,
    speechPitch: 1,
    speechVolume: 1,
    speechVoice: 0,
    speechPhonetics: true,
    volume: 1
  },
  audioAlerts: {
    rules: {
      everyDecode: false
    },
    wanted: {
      huntCallsign: false,
      huntGrid: false,
      huntDXCC: false,
      huntCQz: false,
      huntDXM: false,
      huntITUz: false,
      huntState: false,
      huntCounty: false,
      huntCont: false,
      huntPX: false,
      huntPOTA: false,
      // Feed Roster only (SOTA Chasing); listed here so Settings -> Audio Alerts builds its row
      huntSOTA: false,
      huntWatcher: false,
      huntAward: false,
      huntMultiple: false,
    },
    media: {
      huntCallsignType: "tts",
      huntGridType: "tts",
      huntDXCCType: "tts",
      huntCQzType: "tts",
      huntDXMType: "tts",
      huntITUzType: "tts",
      huntStateType: "tts",
      huntCountyType: "tts",
      huntContType: "tts",
      huntPXType: "tts",
      huntPOTAType: "tts",
      huntSOTAType: "tts",
      huntWatcherType: "tts",
      huntAwardType: "tts",
      huntMultipleType: "tts",

      huntCallsignFileSingle: "none",
      huntGridFileSingle: "none",
      huntDXCCFileSingle: "none",
      huntCQzFileSingle: "none",
      huntDXMSingle: "none",
      huntITUzFileSingle: "none",
      huntStateFileSingle: "none",
      huntCountyFileSingle: "none",
      huntContFileSingle: "none",
      huntPXFileSingle: "none",
      huntPOTAFileSingle: "none",
      huntSOTAFileSingle: "none",

      huntWatcherFileSingle: "none",
      huntAwardFileSingle: "none",
      huntMultipleFileSingle: "none",

      huntCallsignFileMulti: "none",
      huntGridFileMulti: "none",
      huntDXCCFileMulti: "none",
      huntCQzFileMulti: "none",
      huntDXMMulti: "none",
      huntITUzFileMulti: "none",
      huntStateFileMulti: "none",
      huntCountyFileMulti: "none",
      huntContFileMulti: "none",
      huntPXFileMulti: "none",
      huntPOTAFileMulti: "none",
      huntSOTAFileMulti: "none",

      huntWatcherFileMulti: "none",
      huntAwardFileMulti: "none",
      huntMultipleFileMulti: "none",

      huntCallsignSpeechSingle: "Wanted Callsign",
      huntGridSpeechSingle: "Wanted Grid",
      huntDXCCSpeechSingle: "Wanted DXCC",
      huntCQzSpeechSingle: "Wanted CQ zone",
      huntDXMSpeechSingle: "Wanted DX Marathon",
      huntITUzSpeechSingle: "Wanted I-T-U zone",
      huntStateSpeechSingle: "Wanted State",
      huntCountySpeechSingle: "Wanted County",
      huntContSpeechSingle: "Wanted Continent",
      huntPXSpeechSingle: "Wanted Prefix",
      huntPOTASpeechSingle: "Wanted Park",
      huntSOTASpeechSingle: "Wanted Summit",

      huntWatcherSpeechSingle: "Wanted Watcher",
      huntAwardSpeechSingle: "Wanted Award",
      huntMultipleSpeechSingle: "not visible",

      huntCallsignSpeechMulti: "Many Callsigns",
      huntGridSpeechMulti: "Many Grids",
      huntDXCCSpeechMulti: "Many DXCCs",
      huntCQzSpeechMulti: "Many CQ zones",
      huntDXMSpeechMulti: "Many DX Marathon",
      huntITUzSpeechMulti: "Many I-T-U zones",
      huntStateSpeechMulti: "Many States",
      huntCountySpeechMulti: "Many Counties",
      huntContSpeechMulti: "Many Continents",
      huntPXSpeechMulti: "Many Prefixes",
      huntPOTASpeechMulti: "Many Parks",
      huntSOTASpeechMulti: "Many Summits",

      huntWatcherSpeechMulti: "Many Watchers",
      huntAwardSpeechMulti: "Many Awards",
      huntMultipleSpeechMulti: "Many Wanted Entities",

      // On ATNO: said / played in place of On Single / On Multiple when one of the alerting stations is an ATNO (DXCC
      // never worked, park never hunted, summit never chased); Multiple's when that comes with other wanted types.
      // Empty text or no file: the usual alert
      huntDXCCFileAtno: "Phazzz-3.mp3",
      huntPOTAFileAtno: "Phazzz-2.mp3",
      huntSOTAFileAtno: "Phazzz-1.mp3",
      huntMultipleFileAtno: "Longlaser1.mp3",

      huntDXCCSpeechAtno: "ATNO DXCC",
      huntPOTASpeechAtno: "ATNO Park",
      huntSOTASpeechAtno: "ATNO Summit",
      huntMultipleSpeechAtno: "Many ATNO",
    }
  },
  customAlerts: {},
  mapMemory: [],
  startupLogs: [],
  awardTracker: {},
  ignoredCQ: {},
  ignoredCalls: {},
  ignoredGrid: {},
  ignoredDxcc: {},
  ignoredCQz: {},
  ignoredITUz: {},
  // Band colors the user changed (band -> 6-digit hex); bands not listed use the built-in GT.bandColors table
  bandColors: {},
  // Feed Roster: DX Cluster / CW Skimmer spotters (base callsign) whose spots are dropped
  ignoredSpotters: {},
  roster: {
    exceptions: {
      onlyHits: false,
      requireGrid: false,
      wantMaxDT: false,
      wantMinDB: false,
      wantMinFreq: false,
      wantMaxFreq: false,
      wantRRCQ: false,
      maxDT: 0.5,
      minDb: -25,
      minFreq: 0,
      maxFreq: 3500,
      noMyDxcc: false,
      onlyMyDxcc: false,
      cqOnly: false,
      usesLoTW: false,
      maxLoTW: 27,
      useseQSL: false,
      usesOQRS: false,
      onlySpot: false,
      allOnlyNew: false,
    },
    logbook: {
      huntNeed: "confirmed",
      referenceNeed: "0",
    },
    wanted: {
      huntCallsign: false,
      huntGrid: true,
      huntDXCC: true,
      huntCQz: false,
      huntITUz: false,
      huntState: true,
      huntCounty: false,
      huntCont: false,
      huntPX: false,
      huntPOTA: false,
      huntSOTA: false,
      huntWatcher: false,
      huntDXM: false,
    },
    columns: {
      Callsign: true,
      Band: false,
      Mode: false,
      Calling: true,
      Rig: false,
      Wanted: false,
      Grid: true,
      Msg: false,
      DXCC: true,
      Flag: true,
      State: true,
      County: false,
      POTA: false,
      // Shown while SOTA Chasing runs: decoded activators DX Feeds spots on a summit
      SOTA: false,
      Cont: false,
      dB: true,
      Freq: false,
      DT: false,
      Dist: false,
      Azim: false,
      DXM: false,
      CQz: false,
      ITUz: false,
      PX: false,
      LoTW: false,
      eQSL: false,
      OQRS: false,
      Spot: false,
      Life: false,
      Age: true,
      UTC: false
    },
    columnOrder: [
      "Callsign", "Band", "Mode", "Calling", "Grid", "DXCC", "Flag", "State", "County",
      "POTA", "SOTA", "DXM", "Cont", "Msg",
      "dB", "Freq", "DT", "Dist", "Azim",
      "CQz", "ITUz", "PX",
      "Rig", "Wanted", "LoTW", "eQSL", "OQRS",
      "Life", "Spot", "Age", "UTC"
    ],
    // Column colors, edited in the Call Roster's Settings -> Colors (column -> 6-digit hex)
    colors: { ...k_callRosterColumnColors },
    // Window-wide (both roster tabs): displayFilters, realtime, controls, controlsExtended,
    // clearRosterOnBandChange, rosterAlwaysOnTop, rosterDelayOnFocus, rosterDelayTime, activeTab
    activeTab: "call",
    displayFilters: {
      brightness: 100,
      contrast: 100,
      saturate: 100,
      invert: 0,
      sepia: 0,
      huerotate: 0
    },
    realtime: true,
    controls: true,
    controlsExtended: true,
    compact: false,
    sortColumn: "Age",
    sortReverse: true,
    watcherSortColumn: "name",
    watcherSortReverse: false,
    clearRosterOnBandChange: true,
    rosterAlwaysOnTop: false,
    rosterDelayOnFocus: false,
    rosterDelayTime: 1500,
    rosterTime: 120,
    compactEntity: "DXCC",
    watchers: {}
  },
  // Feed Roster (DX Cluster / CW Skimmer spots): its own copy of the Call Roster's per-roster settings,
  // one fixed profile (no Band/Mode Memory). Window-wide settings stay in roster
  feedRoster: {
    exceptions: {
      onlyHits: false,
      requireGrid: false,
      wantMaxDT: false,
      wantMinDB: false,
      wantMinFreq: false,
      wantMaxFreq: false,
      wantRRCQ: false,
      maxDT: 0.5,
      minDb: -25,
      minFreq: 0,
      maxFreq: 3500,
      // DX DXCC (the spotted station's)
      noMyDxcc: false,
      onlyMyDxcc: false,
      // Spots where the station spotted itself
      hideSelfSpots: false,
      // Only spots on a band / in a mode one of the connected rigs (WSJT-X, JTDX, AC Log) is on
      autoBand: false,
      autoMode: false,
      cqOnly: false,
      usesLoTW: false,
      maxLoTW: 27,
      useseQSL: false,
      usesOQRS: false,
      onlySpot: false,
      allOnlyNew: false,
    },
    logbook: {
      huntNeed: "confirmed",
      referenceNeed: "0",
    },
    wanted: {
      huntCallsign: false,
      huntGrid: true,
      huntDXCC: true,
      huntCQz: false,
      huntITUz: false,
      huntState: true,
      huntCounty: false,
      huntCont: false,
      huntPX: false,
      huntPOTA: false,
      huntSOTA: false,
      huntWatcher: false,
      huntDXM: false,
    },
    columns: {
      Callsign: true,
      Band: true,
      Mode: true,
      CQ: true,
      Spotter: true,
      Wanted: false,
      Grid: true,
      Msg: false,
      DXCC: true,
      DEDXCCv2: true,
      Flag: true,
      State: true,
      County: false,
      POTA: false,
      SOTA: false,
      Cont: false,
      DEContv2: true,
      Freq: true,
      Dist: false,
      Azim: false,
      DXM: false,
      CQz: false,
      ITUz: false,
      PX: false,
      LoTW: false,
      eQSL: false,
      OQRS: false,
      Life: false,
      Age: true,
      UTC: false
    },
    columnOrder: [
      "Callsign", "Band", "Mode", "Spotter", "CQ", "Grid", "DXCC", "Flag", "State", "County", "Wanted", "Msg",
      "POTA", "SOTA", "DEDXCCv2", "DXM", "Cont", "DEContv2",
      "Freq", "Dist", "Azim",
      "CQz", "ITUz", "PX",
      "LoTW", "eQSL", "OQRS",
      "Life", "Age", "UTC"
    ],
    // Column colors, edited in the Feed Roster's Settings -> Colors, independent of the Call Roster's
    colors: { ...k_feedRosterColumnColors },
    compact: false,
    compactEntity: "DXCC",
    sortColumn: "Age",
    sortReverse: true,
    watcherSortColumn: "name",
    watcherSortReverse: false,
    // Feed Roster Max Age: 2 minutes (the map's Feed Spots Max Age is app.feedMaxAge)
    rosterTime: 120,
    watchers: {},
    // (Its Spots settings, feeds, moved to app.feeds: Settings -> Feeds)
    // Feed Roster ignores, independent of the Call Roster's (the top-level ignored* keys), no CQ ignores;
    // spotter ignores are feed-only already and stay in the top-level ignoredSpotters
    ignoredCalls: {},
    ignoredGrid: {},
    ignoredDxcc: {},
    // DE DXCC: spots from spotters in these DXCC entities
    ignoredDeDxcc: {},
    // DE Cont: spots from spotters on these continents
    ignoredDeCont: {},
    ignoredCQz: {},
    ignoredITUz: {}
  },
  // Feed Roster audio alerts: which wanted types alert, and their own sounds and speech
  // (media defaults to the same as audioAlerts.media, set below)
  feedAudioAlerts: {
    wanted: {
      huntCallsign: false,
      huntGrid: false,
      huntDXCC: false,
      huntCQz: false,
      huntDXM: false,
      huntITUz: false,
      huntState: false,
      huntCounty: false,
      huntCont: false,
      huntPX: false,
      huntPOTA: false,
      huntSOTA: false,
      huntWatcher: false,
      huntAward: false,
      huntMultiple: false,
    }
  },
  ByBandMode: {
    roster: {},
    exceptions: {},
    audioAlerts: {},
    customAlerts: {}
  },
};

def_settings.feedAudioAlerts.media = { ...def_settings.audioAlerts.media };
// Feed Roster speech says "Feed", to tell it from the Call Roster's: "Wanted Feed Grid", "Many Feed Grids"
for (const key in def_settings.feedAudioAlerts.media)
{
  if (/Speech(Single|Multi)$/.test(key))
  {
    def_settings.feedAudioAlerts.media[key] = def_settings.feedAudioAlerts.media[key].replace(/^(Wanted|Many) /, "$1 Feed ");
  }
}
// ... and "Feed ATNO DXCC", "Many Feed ATNO" (On ATNO)
for (const key of ["huntDXCCSpeechAtno", "huntPOTASpeechAtno", "huntSOTASpeechAtno"])
{
  def_settings.feedAudioAlerts.media[key] = "Feed " + def_settings.feedAudioAlerts.media[key];
}
def_settings.feedAudioAlerts.media.huntMultipleSpeechAtno = "Many Feed ATNO";

// Each roster's default columns, copied before anything can change them (new users' settings start as
// these very objects): for the roster windows' "Reset Columns to Default"
const def_rosterColumns = JSON.parse(JSON.stringify({
  call: { columns: def_settings.roster.columns, columnOrder: def_settings.roster.columnOrder },
  feed: { columns: def_settings.feedRoster.columns, columnOrder: def_settings.feedRoster.columnOrder }
}));

// Likewise each roster's default column colors, for "Reset Colors"
const def_rosterColors = JSON.parse(JSON.stringify({
  call: def_settings.roster.colors,
  feed: def_settings.feedRoster.colors
}));

const def_mapMemory = {
  zoom: -1,
  LoLa: [0, 0],
  bearing: 0
};

