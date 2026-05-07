var background = (function () {
  let tmp = {};
  /*  */
  chrome.runtime.onMessage.addListener(function (request) {
    for (let id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "background-to-page") {
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
        "path": "page-to-background"
      }, function () {
        return chrome.runtime.lastError;
      });
    }
  }
})();

var config = {
  "injected": {
    "devices": false,
    "support": false,
    "additional": false
  },
  "script": function (key, path) {
    if (config.injected[key]) return;
    /*  */
    const root = document.documentElement || document.head || document.body;
    if (!root) return;
    /*  */
    config.injected[key] = true;
    /*  */
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.onload = function () {script.remove()};
    script.src = chrome.runtime.getURL(path);
    /*  */
    root.appendChild(script);
  },
  "update": function (e) {
    if (e.state === "enabled") {
      /*  */
      if (e.devices) {
        config.script("devices", "data/content_script/page_context/media_devices.js");
      }
      /*  */
      if (e.inject) {
        config.script("support", "data/content_script/page_context/support_detection.js");
      }
      /*  */
      if (e.additional) {
        config.script("additional", "data/content_script/page_context/additional_objects.js");
      }
    }
  }
};

background.send("load");
background.receive("storage", config.update);
