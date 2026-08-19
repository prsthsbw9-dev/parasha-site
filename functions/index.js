from pathlib import Path

main_src = Path("/mnt/data/index-main-tiktok-gate-designed.html")
support_src = Path("/mnt/data/support-payment-top-navigation.html")

main = main_src.read_text(encoding="utf-8")
support = support_src.read_text(encoding="utf-8")

# ---------- MAIN PAGE ----------
old_save = '''    function savePardesVideoReturnForPayment(provider){
      if(!currentOpenLayer) return;

      const player = document.getElementById("pardesVideoPlayer");
      const nativeTime = Number(player?.currentTime);
      const videoTime =
        player?.currentSrc && Number.isFinite(nativeTime)
          ? nativeTime
          : lastPardesYouTubeTime;

      try{
        sessionStorage.setItem(
          PARDES_PAYMENT_RETURN_KEY,
          JSON.stringify({
            parasha:currentParasha,
            aliyah:currentAliyah,
            layer:currentOpenLayer,
            time:Number.isFinite(videoTime) ? videoTime : 0,
            provider:String(provider || ""),
            savedAt:Date.now()
          })
        );
      }catch(error){}
    }

    window.savePardesVideoReturnForPayment =
      savePardesVideoReturnForPayment;
'''

new_save = '''    function getPardesVideoReturnState(provider){
      if(!currentOpenLayer) return null;

      const player = document.getElementById("pardesVideoPlayer");
      const nativeTime = Number(player?.currentTime);
      const videoTime =
        player?.currentSrc && Number.isFinite(nativeTime)
          ? nativeTime
          : lastPardesYouTubeTime;

      return {
        parasha:currentParasha,
        aliyah:currentAliyah,
        layer:currentOpenLayer,
        time:Number.isFinite(videoTime) ? videoTime : 0,
        provider:String(provider || ""),
        savedAt:Date.now()
      };
    }

    function buildPardesEmailReturnUrl(provider){
      const state = getPardesVideoReturnState(provider);
      if(!state) return "";

      const returnUrl = new URL(
        window.location.pathname,
        window.location.origin
      );

      if(state.parasha){
        returnUrl.searchParams.set(
          "returnParasha",
          state.parasha
        );
      }

      if(state.aliyah){
        returnUrl.searchParams.set(
          "returnAliyah",
          state.aliyah
        );
      }

      returnUrl.searchParams.set(
        "openLayer",
        state.layer
      );

      returnUrl.searchParams.set(
        "resume",
        String(Math.max(0,Math.floor(Number(state.time) || 0)))
      );

      returnUrl.searchParams.set(
        "from",
        "support-email"
      );

      return returnUrl.href;
    }

    function savePardesVideoReturnForPayment(provider){
      const state = getPardesVideoReturnState(provider);
      if(!state) return "";

      try{
        sessionStorage.setItem(
          PARDES_PAYMENT_RETURN_KEY,
          JSON.stringify(state)
        );
      }catch(error){}

      return buildPardesEmailReturnUrl(provider);
    }

    window.getPardesEmailReturnUrl =
      buildPardesEmailReturnUrl;

    window.savePardesVideoReturnForPayment =
      savePardesVideoReturnForPayment;
'''

if old_save not in main:
    raise RuntimeError("Main: save function block not found")
main = main.replace(old_save, new_save, 1)

# Insert email URL restore function after session restore function.
marker = '''    window.addEventListener("message", (event) => {
'''
email_restore = '''    async function restorePardesVideoFromEmailUrl(){
      const params =
        new URLSearchParams(window.location.search);

      const requestedLayer =
        params.get("openLayer");

      const requestedParasha =
        params.get("returnParasha");

      const requestedAliyah =
        params.get("returnAliyah");

      const requestedResumeTime =
        Math.max(0,Number(params.get("resume")) || 0);

      const allowedLayers = [
        "main",
        "pshat",
        "remez",
        "drash",
        "sod"
      ];

      if(
        params.get("from") !== "support-email" ||
        !allowedLayers.includes(requestedLayer)
      ){
        return false;
      }

      if(requestedParasha && requestedAliyah){
        try{
          await loadSpecificAliyah(
            requestedParasha,
            requestedAliyah,
            { saveLocal:false }
          );
        }catch(error){
          console.error(
            "לא ניתן היה לטעון את העלייה מקישור החזרה:",
            error
          );
        }
      }

      pendingPardesRestoreTime =
        requestedResumeTime;

      const cleanUrl = new URL(window.location.href);
      [
        "returnParasha",
        "returnAliyah",
        "openLayer",
        "resume",
        "from"
      ].forEach((name) => {
        cleanUrl.searchParams.delete(name);
      });

      window.history.replaceState(
        {},
        "",
        cleanUrl.pathname +
          cleanUrl.search +
          cleanUrl.hash
      );

      window.setTimeout(() => {
        openLayer(requestedLayer);
      },250);

      return true;
    }

'''
if marker not in main:
    raise RuntimeError("Main: message marker not found")
main = main.replace(marker, email_restore + marker, 1)

old_startup = '''    loadInitialAliyah()
      .then(async () => {
        if(await restorePardesVideoAfterPayment()){
          return;
        }

        const requestedLayer =
          new URLSearchParams(window.location.search)
            .get("openLayer");
'''

new_startup = '''    loadInitialAliyah()
      .then(async () => {
        if(await restorePardesVideoFromEmailUrl()){
          return;
        }

        if(await restorePardesVideoAfterPayment()){
          return;
        }

        const requestedLayer =
          new URLSearchParams(window.location.search)
            .get("openLayer");
'''
if old_startup not in main:
    raise RuntimeError("Main: startup block not found")
main = main.replace(old_startup, new_startup, 1)

# ---------- SUPPORT PAGE ----------
# Add helper before buildSupportNotificationPayload
marker2 = '''      function buildSupportNotificationPayload(provider){
'''
helper = '''      function getSupportEmailReturnUrl(provider){
        try{
          if(
            window.parent &&
            window.parent !== window &&
            typeof window.parent.getPardesEmailReturnUrl ===
              "function"
          ){
            return String(
              window.parent.getPardesEmailReturnUrl(provider) ||
              ""
            );
          }
        }catch(error){}

        return "";
      }

'''
if marker2 not in support:
    raise RuntimeError("Support: payload marker not found")
support = support.replace(marker2, helper + marker2, 1)

old_payload_tail = '''          provider,
          wantsPublicThanks,
          publicName,
          pageUrl: window.location.href,
'''
new_payload_tail = '''          provider,
          wantsPublicThanks,
          publicName,
          returnUrl:getSupportEmailReturnUrl(provider),
          pageUrl: window.location.href,
'''
if old_payload_tail not in support:
    raise RuntimeError("Support: payload fields not found")
support = support.replace(old_payload_tail, new_payload_tail, 1)

main_out = Path("/mnt/data/index-main-with-email-video-return.html")
support_out = Path("/mnt/data/support-with-email-video-return.html")
main_out.write_text(main, encoding="utf-8")
support_out.write_text(support, encoding="utf-8")

print("נוצרו בהצלחה:")
print(main_out)
print(support_out)
print("Main getter:", "window.getPardesEmailReturnUrl" in main)
print("Main email restore:", "restorePardesVideoFromEmailUrl" in main)
print("Support returnUrl payload:", "returnUrl:getSupportEmailReturnUrl(provider)" in support)
