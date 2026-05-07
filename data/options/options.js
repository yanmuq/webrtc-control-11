var background = (function () {
  let tmp = {};
  chrome.runtime.onMessage.addListener(function (request) {
    for (let id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "background-to-options") {
          if (request.method === id) {
            tmp[id](request.data);
          }
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {
      tmp[id] = callback;
    },
    "send": function (id, data) {
      chrome.runtime.sendMessage({
        "method": id, 
        "data": data,
        "path": "options-to-background"
      }, function () {
        return chrome.runtime.lastError;
      });
    }
  }
})();

var config = {
  "blacklist": [],
  "normalize": function (entry) {
    entry = (entry || '').trim().toLowerCase();
    if (!entry) return '';
    try {
      if (/^https?:\/\//.test(entry)) {
        entry = new URL(entry).hostname;
      }
    } catch (e) {}
    return entry.replace(/^www\./, "");
  },
  "saveBlacklist": function (list, callback) {
    chrome.storage.local.set({"blacklist": list}, function () {
      const error = chrome.runtime.lastError;
      if (callback) callback(!error, error);
    });
  },
  "renderBlacklist": function () {
    const list = document.querySelector("#blacklist-list");
    list.textContent = '';
    /*  */
    config.blacklist.forEach(function (entry, index) {
      const row = document.createElement("div");
      const input = document.createElement("input");
      const remove = document.createElement("input");
      /*  */
      row.className = "blacklist-row";
      input.type = "text";
      input.value = entry;
      remove.type = "button";
      remove.value = "Remove";
      /*  */
      input.addEventListener("change", function (e) {
        const value = config.normalize(e.target.value);
        const next = config.blacklist.slice();
        if (value) {
          next[index] = value;
        } else {
          next.splice(index, 1);
        }
        config.saveBlacklist(next, function (ok, error) {
          if (!ok) {
            blacklistUI.status("Save failed. " + (error ? error.message : "Please try again."), true);
            input.value = entry;
            return;
          }
          config.blacklist = next;
          config.renderBlacklist();
          blacklistUI.status("Blacklist updated.");
        });
      });
      remove.addEventListener("click", function () {
        const next = config.blacklist.slice();
        next.splice(index, 1);
        config.saveBlacklist(next, function (ok, error) {
          if (!ok) {
            blacklistUI.status("Save failed. " + (error ? error.message : "Please try again."), true);
            return;
          }
          config.blacklist = next;
          config.renderBlacklist();
          blacklistUI.status("Blacklist updated.");
        });
      });
      /*  */
      row.appendChild(input);
      row.appendChild(remove);
      list.appendChild(row);
    });
  },
  "render": function (e) {
    const select = document.querySelector("#method");
    const inject = document.querySelector("#inject");
    const devices = document.querySelector("#devices");
    const additional = document.querySelector("#additional");
    /*  */
    if (e.webrtc) select.value = e.webrtc;
    if (e.inject !== undefined) inject.checked = e.inject;
    if (e.devices !== undefined) devices.checked = e.devices;
    if (e.additional !== undefined) additional.checked = e.additional;
    config.blacklist = Array.isArray(e.blacklist) ? e.blacklist : [];
    config.renderBlacklist();
  },
  "load": function () {
    const test = document.querySelector("#test");
    const inject = document.querySelector("#inject");
    const select = document.querySelector("#method");
    const support = document.querySelector("#support");
    const devices = document.querySelector("#devices");
    const donation = document.querySelector("#donation");
    const additional = document.querySelector("#additional");
    const blacklistAdd = document.querySelector("#blacklist-add");
    const blacklistInput = document.querySelector("#blacklist-input");
    const blacklistImport = document.querySelector("#blacklist-import");
    const blacklistExport = document.querySelector("#blacklist-export");
    const blacklistFile = document.querySelector("#blacklist-file");
    /*  */
    test.addEventListener("click", function () {background.send("test")});
    support.addEventListener("click", function () {background.send("support")});
    donation.addEventListener("click", function () {background.send("donation")});
    select.addEventListener("change", function (e) {background.send("webrtc", {"webrtc": e.target.value})});
    inject.addEventListener("change", function (e) {background.send("inject", {"inject": e.target.checked})});
    devices.addEventListener("change", function (e) {background.send("devices", {"devices": e.target.checked})});
    additional.addEventListener("change", function (e) {background.send("additional", {"additional": e.target.checked})});
    blacklistAdd.addEventListener("click", function () {
      blacklistUI.add(blacklistInput.value, "Added", function () {
        blacklistInput.value = '';
      });
      blacklistInput.focus();
    });
    blacklistInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        blacklistAdd.click();
      }
    });
    blacklistImport.addEventListener("click", function () {
      blacklistFile.value = '';
      blacklistFile.click();
    });
    blacklistFile.addEventListener("change", function (e) {
      blacklistUI.import(e.target.files && e.target.files.length ? e.target.files[0] : null);
    });
    blacklistExport.addEventListener("click", blacklistUI.export);
    /*  */
    background.send("load");
    window.removeEventListener("load", config.load, false);
  }
};

var blacklistUI = {
  "maxFileSize": 1024 * 1024,
  "maxEntries": 5000,
  "status": function (message, error) {
    const status = document.querySelector("#blacklist-status");
    if (!status) return;
    status.textContent = message || '';
    status.className = error ? "error" : '';
  },
  "splitLines": function (text) {
    text = (text || '').replace(/^\uFEFF/, '');
    return text.split(/\r?\n/).map(function (entry) {
      return entry.trim();
    }).filter(function (entry) {
      return entry;
    });
  },
  "merge": function (entries) {
    const seen = {};
    const next = [];
    const stats = {"added": 0, "duplicates": 0, "invalid": 0};
    /*  */
    config.blacklist.forEach(function (entry) {
      const value = config.normalize(entry);
      if (value && !seen[value]) {
        seen[value] = true;
        next.push(value);
      }
    });
    /*  */
    entries.forEach(function (entry) {
      if (typeof entry !== "string") {
        stats.invalid += 1;
        return;
      }
      const value = config.normalize(entry);
      if (!value) {
        stats.invalid += 1;
        return;
      }
      if (seen[value]) {
        stats.duplicates += 1;
        return;
      }
      seen[value] = true;
      next.push(value);
      stats.added += 1;
    });
    /*  */
    return {"list": next, "stats": stats};
  },
  "summary": function (verb, stats) {
    return verb + " " + stats.added + " sites. Skipped " + stats.duplicates + " duplicates and " + stats.invalid + " invalid entries.";
  },
  "saveMerged": function (entries, verb, success) {
    if (!entries.length) {
      blacklistUI.status(blacklistUI.summary(verb, {"added": 0, "duplicates": 0, "invalid": 0}));
      return;
    }
    if (entries.length > blacklistUI.maxEntries) {
      blacklistUI.status("Import failed. Please use 5000 or fewer entries at a time.", true);
      return;
    }
    const merged = blacklistUI.merge(entries);
    config.saveBlacklist(merged.list, function (ok, error) {
      if (!ok) {
        blacklistUI.status("Save failed. " + (error ? error.message : "Please try again."), true);
        return;
      }
      config.blacklist = merged.list;
      config.renderBlacklist();
      blacklistUI.status(blacklistUI.summary(verb, merged.stats));
      if (success) success();
    });
  },
  "add": function (text, verb, success) {
    blacklistUI.saveMerged(blacklistUI.splitLines(text), verb, success);
  },
  "import": function (file) {
    if (!file) return;
    if (file.size > blacklistUI.maxFileSize) {
      blacklistUI.status("Import failed. Please choose a file smaller than 1 MB.", true);
      return;
    }
    const reader = new FileReader();
    reader.onerror = function () {
      blacklistUI.status("Import failed. Please choose a valid JSON or TXT blacklist file.", true);
    };
    reader.onload = function () {
      let entries = [];
      const text = (reader.result || '').replace(/^\uFEFF/, '');
      const name = (file.name || '').toLowerCase();
      try {
        if (name.endsWith(".json")) {
          const data = JSON.parse(text);
          if (!data || !Array.isArray(data.blacklist)) {
            throw new Error("Missing blacklist array");
          }
          entries = data.blacklist;
        } else {
          entries = blacklistUI.splitLines(text);
        }
      } catch (e) {
        blacklistUI.status("Import failed. Please choose a valid JSON or TXT blacklist file.", true);
        return;
      }
      blacklistUI.saveMerged(entries, "Imported");
    };
    reader.readAsText(file);
  },
  "export": function () {
    const now = new Date();
    const date = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");
    const data = JSON.stringify({
      "version": 1,
      "blacklist": config.blacklist
    }, null, 2);
    const blob = new Blob([data], {"type": "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "webrtc-control-blacklist-" + date + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    blacklistUI.status("Exported " + config.blacklist.length + " sites.");
  }
};

background.receive("storage", config.render);

window.addEventListener("load", config.load, false);
