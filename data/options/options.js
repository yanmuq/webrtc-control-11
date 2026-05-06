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
  "saveBlacklist": function () {
    background.send("blacklist", {"blacklist": config.blacklist});
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
        if (value) {
          config.blacklist[index] = value;
        } else {
          config.blacklist.splice(index, 1);
        }
        config.saveBlacklist();
        config.renderBlacklist();
      });
      remove.addEventListener("click", function () {
        config.blacklist.splice(index, 1);
        config.saveBlacklist();
        config.renderBlacklist();
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
    /*  */
    test.addEventListener("click", function () {background.send("test")});
    support.addEventListener("click", function () {background.send("support")});
    donation.addEventListener("click", function () {background.send("donation")});
    select.addEventListener("change", function (e) {background.send("webrtc", {"webrtc": e.target.value})});
    inject.addEventListener("change", function (e) {background.send("inject", {"inject": e.target.checked})});
    devices.addEventListener("change", function (e) {background.send("devices", {"devices": e.target.checked})});
    additional.addEventListener("change", function (e) {background.send("additional", {"additional": e.target.checked})});
    blacklistAdd.addEventListener("click", function () {
      const value = config.normalize(blacklistInput.value);
      if (value && config.blacklist.indexOf(value) === -1) {
        config.blacklist.push(value);
        config.saveBlacklist();
        config.renderBlacklist();
      }
      blacklistInput.value = '';
      blacklistInput.focus();
    });
    blacklistInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        blacklistAdd.click();
      }
    });
    /*  */
    background.send("load");
    window.removeEventListener("load", config.load, false);
  }
};

background.receive("storage", config.render);

window.addEventListener("load", config.load, false);
