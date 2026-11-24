# -*- mode: java -*-
# Capacitor resolves plugins by reflection from capacitor.plugins.json, so R8
# must not rename or strip them, and @CapacitorPlugin / @PluginMethod are read
# at runtime. Without these, a minified release APK loads with no plugins and
# the splash never hides.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# The bridge host activity and anything the manifest names.
-keep class com.navereat.app.** { *; }

# Optional integrations Capacitor references but this app does not ship.
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**
-dontwarn androidx.webkit.**
# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
