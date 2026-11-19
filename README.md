# expo-image Android repro

Minimal Android app (Expo SDK 58, expo-image 58.0.18) for two expo-image bugs:

- **Test 1:** `Image.prefetch(urls)` sometimes never resolves or rejects.
- **Test 2:** the first load of the same remote SVG in two view sizes at once sometimes fails
  with `onError` "Failed to load resource". The other size loads.

Pick a test on the start screen (touch or TV remote). Results show on screen. Test 2 stops at
the first failure and marks the failed view red, next to the other size of the same URL.
Each round uses fresh URLs (unique query string), so nothing is cached and no app-data reset
is needed. Images: [Tabler Icons](https://tabler.io/icons) (MIT) via jsDelivr.

## Run

```sh
npm install
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Keep the device awake while a test runs. Results are also logged:
`adb logcat -s ReactNativeJS:V | grep REPRO`
