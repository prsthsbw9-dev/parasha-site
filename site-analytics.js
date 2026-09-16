(function () {
  "use strict";

  if (window.__pardesSiteAnalyticsLoaded) return;
  window.__pardesSiteAnalyticsLoaded = true;

  var measurementId = "G-2MGXGC1KB8";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
    document.head.appendChild(tag);
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
  }

  function cleanText(value, maxLength) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 100);
  }

  function pageData() {
    return {
      page_path: window.location.pathname,
      page_title: document.title
    };
  }

  function sendEvent(name, parameters) {
    window.gtag("event", name, Object.assign({}, pageData(), parameters || {}));
  }

  function destinationData(element) {
    var href = element && element.getAttribute ? element.getAttribute("href") : "";
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return {};

    try {
      var destination = new URL(href, window.location.href);
      return {
        link_domain: destination.hostname,
        link_path: destination.pathname,
        link_external: destination.origin !== window.location.origin
      };
    } catch (_error) {
      return {};
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest("a, button, [role='button']")
      : null;

    if (!target || target.hasAttribute("data-no-analytics")) return;

    var label = cleanText(
      target.getAttribute("data-analytics-label") ||
      target.getAttribute("aria-label") ||
      target.textContent,
      100
    );

    sendEvent("site_click", Object.assign({
      click_id: cleanText(target.id, 80),
      click_label: label || "unlabeled",
      element_type: target.tagName.toLowerCase()
    }, destinationData(target)));
  }, true);

  var videoStates = new WeakMap();

  function shouldTrackVideo(video) {
    return !(video.autoplay && video.muted && video.loop && !video.controls);
  }

  function videoData(video) {
    var source = video.currentSrc || video.getAttribute("src") || "";
    var sourceName = "";

    try {
      sourceName = decodeURIComponent(new URL(source, window.location.href).pathname.split("/").pop() || "");
    } catch (_error) {
      sourceName = source.split("/").pop() || "";
    }

    return {
      video_id: cleanText(video.id, 80),
      video_title: cleanText(video.getAttribute("aria-label") || video.getAttribute("title") || sourceName || "html5_video", 100),
      video_file: cleanText(sourceName, 100)
    };
  }

  function videoState(video) {
    var source = video.currentSrc || video.getAttribute("src") || "";
    var state = videoStates.get(video);

    if (!state || state.source !== source) {
      state = { source: source, started: false, milestones: {} };
      videoStates.set(video, state);
    }

    return state;
  }

  document.addEventListener("play", function (event) {
    var video = event.target;
    if (!(video instanceof HTMLVideoElement) || !shouldTrackVideo(video)) return;

    var state = videoState(video);
    if (!state.started) {
      state.started = true;
      sendEvent("video_start", videoData(video));
    }
    videoStates.set(video, state);
  }, true);

  document.addEventListener("timeupdate", function (event) {
    var video = event.target;
    if (!(video instanceof HTMLVideoElement) || !shouldTrackVideo(video) || !video.duration) return;

    var state = videoState(video);
    var percent = Math.floor((video.currentTime / video.duration) * 100);

    [25, 50, 75].forEach(function (milestone) {
      if (percent >= milestone && !state.milestones[milestone]) {
        state.milestones[milestone] = true;
        sendEvent("video_progress", Object.assign(videoData(video), {
          video_percent: milestone
        }));
      }
    });

    videoStates.set(video, state);
  }, true);

  document.addEventListener("ended", function (event) {
    var video = event.target;
    if (!(video instanceof HTMLVideoElement) || !shouldTrackVideo(video)) return;
    sendEvent("video_complete", videoData(video));
  }, true);
})();
