# Optimization & Code shrinking rules for SoundAlive Lite
-allowaccessmodification

# Keep WebAppInterface & JavascriptInterface annotations
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep our native audio effects and plugin classes
-keep class com.soundalive.universal.** { *; }

# Keep Capacitor Bridge classes
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
-dontwarn android.webkit.**
