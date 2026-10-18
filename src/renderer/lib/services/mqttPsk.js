const mqtt = window.require('mqtt');

GT.pskMqttClient = null;
GT.pskMqttUrl = "mqtt://mqtt.pskreporter.info:1883";
GT.pskCloseTimer = null;
// The topics subscribed to: one per callsign of ours whose reports are followed (pskMqttCallsigns)
GT.pskMqttTopics = new Set();

// Set once any instance has reported its callsign (wsjtx.js handleInstanceStatus)
GT.pskInstanceSeen = false;

// Every callsign of ours: each instance's own (WSJT-X, JTDX, AC Log, Log4OM; a closed instance's goes with it),
// Settings -> General -> Station Callsign, and until an instance has reported a callsign, the current one (read from
// WSJT-X's settings). Unique, "/" as PSK Reporter's "."
function pskMqttCallsigns()
{
    const calls = new Set();
    const add = (call) =>
    {
        call = String(call || "").trim().toUpperCase();
        if (call.length > 2 && call != "NOCALL") calls.add(call.replaceAll("/", "."));
    };
    for (const instance of Object.values(GT.instances))
    {
        if (instance.status) add(instance.status.DEcall);
    }
    add(GT.settings.app.stationCallsign);
    if (!GT.pskInstanceSeen) add(GT.settings.app.myCall);
    return calls;
}

function pskMqttTopic(dottedCallsign)
{
    return `pskr/filter/v2/+/+/${dottedCallsign}/#`;
}

function pskMqttSubscribe(topics)
{
    if (topics.length == 0) return;
    GT.pskMqttClient.subscribe(topics, (err) => {
        if (err) console.error("PSKReporter MQTT Subscribe Error:", err);
    });
}

// Called whenever a callsign of ours may have changed (an instance's status or closing, the Station Callsign) and when
// RX Spots are switched or the map goes on- or offline
function openPskMqtt()
{
    if (GT.pskCloseTimer != null)
    {
        nodeTimers.clearTimeout(GT.pskCloseTimer);
        GT.pskCloseTimer = null;
    }

    // Offline, RX Spots off or spotting disabled: the connection closes a minute later (a quick switch back keeps it)
    if (GT.settings.map.offlineMode == true || GT.spotView == 0 || GT.settings.app.spottingEnable == false)
    {
        GT.pskCloseTimer = nodeTimers.setTimeout(closePskMqtt, 60000);
        return;
    }

    const calls = pskMqttCallsigns();
    const topics = new Set([...calls].map(pskMqttTopic));

    // Already connected: the subscriptions follow the callsigns
    if (GT.pskMqttClient != null)
    {
        const gone = [...GT.pskMqttTopics].filter((topic) => !topics.has(topic));
        const added = [...topics].filter((topic) => !GT.pskMqttTopics.has(topic));
        if (GT.pskMqttClient.connected)
        {
            if (gone.length) GT.pskMqttClient.unsubscribe(gone);
            pskMqttSubscribe(added);
        }
        GT.pskMqttTopics = topics;
        return;
    }

    if (calls.size == 0) return;

    const clientId = `GT2_${[...calls][0]}_${GT.settings.app.myGrid}_${Math.random().toString(16).slice(3)}`;
    GT.pskMqttTopics = topics;

    GT.pskMqttClient = mqtt.connect(GT.pskMqttUrl, {
        clientId,
        clean: true,
        connectTimeout: 30000,
        reconnectPeriod: 90000,
    });

    // On every (re)connect: the topics of the callsigns followed now
    GT.pskMqttClient.on('connect', () => {
        pskMqttSubscribe([...GT.pskMqttTopics]);
    });

    GT.pskMqttClient.on('message', (topic, payload) => {
          try {
            const spotData = JSON.parse(payload.toString());
            addNewMqttPskSpot(spotData);
        } catch (err) {
            console.error("Failed to parse PSKReporter MQTT payload:", err);
        }
    });


    GT.pskMqttClient.on('error', (err) => {
        console.error("PSKReporter MQTT Error:", err.message);
    });
}

function closePskMqtt()
{
    if (GT.pskCloseTimer != null)
    {
        nodeTimers.clearTimeout(GT.pskCloseTimer);
        GT.pskCloseTimer = null;
    }

    if (GT.pskMqttClient != null)
    {
        GT.pskMqttClient.end();
        GT.pskMqttClient = null;
    }
    GT.pskMqttTopics = new Set();
}
