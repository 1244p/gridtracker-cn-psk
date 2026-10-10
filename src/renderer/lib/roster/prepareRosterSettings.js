function prepareRosterSettings()
{
  let rosterSettings = {
    bands: {},
    modes: {},
    onlyHits: CR.activeExceptions.onlyHits,
    isAwardTracker: false,
    now: timeNowSec()
  }

  if (CR.activeRoster.logbook.referenceNeed == LOGBOOK_AWARD_TRACKER)
  {
    CR.activeExceptions.onlyHits = false;
    rosterSettings.isAwardTracker = true;
  }

  if (CR.activeRoster.logbook.huntNeed == "mixed")
  {
    rosterSettings.huntIndex = GT.tracker.confirmed;
    rosterSettings.workedIndex = GT.tracker.worked;
    rosterSettings.layeredMode = LAYERED_MODE_FOR[CR.activeRoster.logbook.referenceNeed];
  }
  else if (CR.activeRoster.logbook.huntNeed == "worked")
  {
    rosterSettings.huntIndex = GT.tracker.worked;
    rosterSettings.workedIndex = false;
    rosterSettings.layeredMode = false;
  }
  else if (CR.activeRoster.logbook.huntNeed == "confirmed")
  {
    rosterSettings.huntIndex = GT.tracker.confirmed;
    rosterSettings.workedIndex = GT.tracker.worked;
    rosterSettings.layeredMode = false;
  }
  else
  {
    console.log("Invalid/Unknown huntNeed");
    rosterSettings.huntIndex = false;
    rosterSettings.workedIndex = false;
    rosterSettings.layeredMode = false;
  }

  return rosterSettings;
}
