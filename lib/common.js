var core = {
  "session": {
    "allowlisted": false,
    "policy": ''
  },
  "blacklist": {
    "normalize": function (entry) {
      entry = (entry || '').trim().toLowerCase();
      if (!entry) return '';
      try {
        if (/^https?:\/\//.test(entry)) {
          entry = new URL(entry).hostname;
        }
      } catch (e) {}
      return entry.replace(/^\*\./, ".").replace(/^www\./, "");
    },
    "hostname": function (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.hostname.toLowerCase().replace(/^www\./, "");
        }
      } catch (e) {}
      return '';
    },
    "match": function (url) {
      const hostname = core.blacklist.hostname(url);
      const list = config.addon.blacklist;
      if (!hostname || !Array.isArray(list)) return false;
      /*  */
      return list.some(function (entry) {
        entry = core.blacklist.normalize(entry);
        if (!entry) return false;
        if (entry.charAt(0) === ".") {
          entry = entry.slice(1);
        }
        return hostname === entry || hostname.endsWith("." + entry);
      });
    }
  },
  "start": function () {
    core.load();
  },
  "install": function () {
    core.load();
  },
  "load": function () {
    core.tab.active();
    /*  */
    app.contextmenu.create({
      "contexts": ["action"],
      "title": "Test WebRTC Leak",  
      "id": "webrtc-control-contextmenu-id"
    }, app.error);
  },
  "action": {
    "storage": function (changes, namespace) {
      core.tab.active();
    },
    "contextmenu": function () {
      app.tab.open(config.webrtc.test.page);
    },
    "button": function () {
      const state = config.addon.state;
      config.addon.state = state === "disabled" ? "enabled" : "disabled";
      config.addon.state = config.addon.webrtc === "default" ? "disabled" : config.addon.state;
      /*  */
      core.action.update();
    },
    "page": {
      "load": function (e) {
        const blocked = core.blacklist.match(e ? (e.top || '') : '');
        app.page.send("storage", {
          "state": blocked ? "disabled" : config.addon.state,
          "blocked": blocked,
          "inject": blocked ? false : config.addon.inject,
          "devices": blocked ? false : config.addon.devices,
          "additional": blocked ? false : config.addon.additional
        }, e ? e.tabId : '', e ? e.frameId : '');
      }
    },
    "update": function () {
      const state = core.session.allowlisted ? "disabled" : config.addon.state;
      app.button.icon(null, state);
      app.button.title(null, core.session.allowlisted ? "WebRTC leak protection is OFF on this site" : "WebRTC leak protection is " + (state === "enabled" ? "ON" : "OFF"));
      /*  */
      const options = {};
      options.beta = {"scope": "regular", "value": state === "disabled"};
      options.alpha = state === "enabled" ? {"value": config.addon.webrtc} : {"value": "default"};
      /*  */
      if (core.session.policy === options.alpha.value + "::" + options.beta.value) {
        return;
      }
      /*  */
      core.session.policy = options.alpha.value + "::" + options.beta.value;
      /*  */
      app.privacy.network.webrtc.set(options, function (e) {
        if (config.log) {
          console.error("WebRTC Policy:", e.value);
        }
      });
    },
    "options": {
      "inject": function (e) {
        config.addon.inject = e.inject;
        /*  */
        core.action.update();
      },
      "devices": function (e) {
        config.addon.devices = e.devices;
        /*  */
        core.action.update();
      },
      "additional": function (e) {
        config.addon.additional = e.additional;
        /*  */
        core.action.update();
      },
      "blacklist": function (e) {
        config.addon.blacklist = Array.isArray(e.blacklist) ? e.blacklist : [];
        /*  */
        core.tab.active();
      },
      "webrtc": function (e) {
        config.addon.webrtc = e.webrtc;
        config.addon.state = config.addon.webrtc === "default" ? "disabled" : "enabled";
        /*  */
        core.action.update();
      },
      "load": function () {
        app.options.send("storage", {
          "webrtc": config.addon.webrtc,
          "inject": config.addon.inject,
          "devices": config.addon.devices,
          "additional": config.addon.additional,
          "blacklist": config.addon.blacklist
        });
      }
    }
  },
  "tab": {
    "update": function (tab) {
      core.session.allowlisted = tab && tab.url ? core.blacklist.match(tab.url) : false;
      core.action.update();
    },
    "active": function () {
      if (!chrome.tabs) {
        core.session.allowlisted = false;
        core.action.update();
        return;
      }
      chrome.tabs.query({"active": true, "currentWindow": true}, function (tabs) {
        const tmp = chrome.runtime.lastError;
        core.tab.update(tabs && tabs.length ? tabs[0] : null);
      });
    }
  }
};

app.page.receive("load", core.action.page.load);

app.button.on.clicked(core.action.button);
app.contextmenu.on.clicked(core.action.contextmenu);

app.options.receive("load", core.action.options.load);
app.options.receive("inject", core.action.options.inject);
app.options.receive("webrtc", core.action.options.webrtc);
app.options.receive("devices", core.action.options.devices);
app.options.receive("blacklist", core.action.options.blacklist);
app.options.receive("additional", core.action.options.additional);
app.options.receive("support", function () {app.tab.open(app.homepage())});
app.options.receive("test", function () {app.tab.open(config.webrtc.test.page)});
app.options.receive("donation", function () {app.tab.open(app.homepage() + "?reason=support")});

app.on.startup(core.start);
app.on.installed(core.install);
app.on.storage(core.action.storage);

if (chrome.tabs) {
  chrome.tabs.onActivated.addListener(function () {
    app.storage.load(core.tab.active);
  });
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.url || changeInfo.status === "loading") {
      chrome.tabs.query({"active": true, "currentWindow": true}, function (tabs) {
        const tmp = chrome.runtime.lastError;
        if (tabs && tabs.length && tabs[0].id === tabId) {
          app.storage.load(function () {core.tab.update(tab)});
        }
      });
    }
  });
}
