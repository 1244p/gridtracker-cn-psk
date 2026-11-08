
function readLocaleFile(locale)
{
  if (locale in GT.languages)
  {
    try
    {
      GT.i18n = requireJson(GT.languages[locale]);
    }
    catch (e)
    {
      console.error("Failed to load: " + GT.languages[locale]);
      GT.i18n = {};
    }
  }
}

function loadI18n()
{
  readLocaleFile(GT.settings.app.locale);
  refreshI18NStrings();
}

// A title that has its own key (data-i18n-title), so text and tooltip can be translated separately
function renderI18nTitle(element)
{
  const key = element.getAttribute("data-i18n-title");
  if (!key) return;

  if (key in GT.i18n)
  {
    element.title = GT.i18n[key];
  }
  else
  {
    console.error("Missing Body I18N Title Key: ", key);
  }
}

function renderI18n()
{
  const elements = document.querySelectorAll("[data-i18n]");
  for (let x = 0; x < elements.length; x++)
  {
    const key = elements[x].getAttribute("data-i18n");
    if (key in GT.i18n)
    {
      if (key.endsWith(".hover"))
      {
        elements[x].title = GT.i18n[key];
      }
      else
      {
        elements[x].innerHTML = GT.i18n[key];
        if (key.endsWith(".label"))
        {
          let hover = key.replace(".label", ".hover");
          if (hover in GT.i18n)
          {
            elements[x].title = GT.i18n[hover];
          }
        }
      }
    }
    else
    {
      console.error("Missing Body I18N Key: ", key);
    }

    renderI18nTitle(elements[x]);
  }

  const titled = document.querySelectorAll("[data-i18n-title]");
  for (let x = 0; x < titled.length; x++)
  {
    renderI18nTitle(titled[x]);
  }
}

function I18N(key)
{
  if (key in GT.i18n)
  {
    return GT.i18n[key];
  }
  else
  {
    console.error("Missing Direct I18N Key: ", key);
    return key;
  }
}

// Switches an element to another translation key and shows it (renderI18n then keeps using that key);
// before the translations are loaded, renderI18n shows it once they are
function setI18nText(element, key)
{
  element.setAttribute("data-i18n", key);
  if (GT.i18n && key in GT.i18n)
  {
    element.innerHTML = GT.i18n[key];
  }
}

// Logbook reference options that say "Live" (the rig's band / mode): the Feed Roster says "Spots" (the spot's)
const LOGBOOK_LIVE_OPTION_KEYS = { 0: "liveBandMode", 1: "liveBandMixMode", 2: "liveBandDigiMode", 3: "mixBandLiveMode" };
const LOGBOOK_SPOTS_OPTION_KEYS = { 0: "spotsBandMode", 1: "spotsBandMixMode", 2: "spotsBandDigiMode", 3: "mixBandSpotsMode" };

function setLogbookOptionLabels(select, feed)
{
  const keys = feed ? LOGBOOK_SPOTS_OPTION_KEYS : LOGBOOK_LIVE_OPTION_KEYS;
  for (const value in keys)
  {
    const option = select.querySelector(`option[value="${value}"]`);
    if (option) setI18nText(option, "roster.controls.logbook." + keys[value]);
  }
  // Phone / CW choices are the Feed Roster's only
  for (const option of select.querySelectorAll("option.feedLogbookOption"))
  {
    option.hidden = !feed;
  }
}

function changeLocale()
{
  GT.settings.app.locale = languageLocale.value;
  renderI18n(GT.settings.app.locale);
  saveAndCloseApp(true);
}

function loadChildWindowI18n()
{
  renderI18n();
}

function loadRosterI18n()
{
  renderI18n();
  addControls();
}

function renderLocale()
{
  renderI18n();
}
