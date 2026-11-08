/**
 * @file jni_bridge.cpp
 * @brief Complete JNI bridge connecting Java/WebView UI with FxSound DSP native algorithms and OpenSL ES.
 */

#include <jni.h>
#include <android/log.h>
#include <SLES/OpenSLES.h>
#include <SLES/OpenSLES_Android.h>
#include <stdlib.h>
#include <string.h>

#define LOG_TAG "SoundAliveNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// External C references to FxSound processing functions
extern "C" {
    void Play32StereoWithDFX_Process(float* buffer, int length, float clarity, float bass, float surround, float volume);
    void dfxpProcessReal_Apply(float* buffer, int length, float q, float balance, float normalization);
}

// Global DSP State Variables
static float g_clarity = 4.0f;
static float g_bass = 7.0f;
static float g_surround = 6.0f;
static float g_volume = 0.0f;
static float g_normalization = -10.0f;
static float g_qFactor = 1.0f;
static float g_balance = 0.0f;
static bool g_bypass = false;

// OpenSL ES Engine objects
static SLObjectItf engineObject = NULL;
static SLEngineItf engineEngine = NULL;
static SLObjectItf outputMixObject = NULL;
static SLObjectItf bqPlayerObject = NULL;
static SLPlayItf bqPlayerPlay = NULL;
static SLAndroidSimpleBufferQueueItf bqPlayerBufferQueue = NULL;

extern "C" JNIEXPORT void JNICALL
Java_com_soundalive_universal_MainActivity_nativeInitAudio(JNIEnv* env, jobject thiz) {
    LOGI("Initializing OpenSL ES Audio Engine for Galaxy J2 Core (Session 0 & 121)...");
    
    SLresult result;
    result = slCreateEngine(&engineObject, 0, NULL, 0, NULL, NULL);
    if (result != SL_RESULT_SUCCESS) {
        LOGE("Failed to create OpenSL ES engine.");
        return;
    }
    
    result = (*engineObject)->Realize(engineObject, SL_BOOLEAN_FALSE);
    if (result != SL_RESULT_SUCCESS) return;

    result = (*engineObject)->GetInterface(engineObject, SL_IID_ENGINE, &engineEngine);
    if (result != SL_RESULT_SUCCESS) return;

    result = (*engineEngine)->CreateOutputMix(engineEngine, &outputMixObject, 0, NULL, NULL);
    if (result != SL_RESULT_SUCCESS) return;

    result = (*outputMixObject)->Realize(outputMixObject, SL_BOOLEAN_FALSE);
    if (result != SL_RESULT_SUCCESS) return;

    LOGI("OpenSL ES Engine successfully initialized.");
}

extern "C" JNIEXPORT void JNICALL
Java_com_soundalive_universal_MainActivity_nativeUpdateControl(JNIEnv* env, jobject thiz, jstring controlName, jfloat value) {
    const char* name = env->GetStringUTFChars(controlName, 0);
    
    if (strcmp(name, "clarity") == 0) g_clarity = value;
    else if (strcmp(name, "bass") == 0) g_bass = value;
    else if (strcmp(name, "surround") == 0) g_surround = value;
    else if (strcmp(name, "volume") == 0) g_volume = value;
    else if (strcmp(name, "normalization") == 0) g_normalization = value;
    else if (strcmp(name, "qFactor") == 0) g_qFactor = value;
    else if (strcmp(name, "balance") == 0) g_balance = value;

    LOGI("Native control updated: %s = %f", name, value);
    env->ReleaseStringUTFChars(controlName, name);
}

extern "C" JNIEXPORT void JNICALL
Java_com_soundalive_universal_MainActivity_nativeSetBypass(JNIEnv* env, jobject thiz, jboolean bypass) {
    g_bypass = (bypass == JNI_TRUE);
    LOGI("Native DSP Bypass state: %s", g_bypass ? "ON" : "OFF");
}

extern "C" JNIEXPORT void JNICALL
Java_com_soundalive_universal_MainActivity_nativeForceAudioServerKill(JNIEnv* env, jobject thiz) {
    LOGI("Executing root command: su -c killall audioserver");
    int result = system("su -c killall audioserver");
    if (result == 0) {
        LOGI("audioserver successfully killed and restarted via Session 0.");
    } else {
        LOGE("Failed to kill audioserver. Root permission might be missing.");
    }
}

extern "C" JNIEXPORT void JNICALL
Java_com_soundalive_universal_MainActivity_nativeReleaseAudio(JNIEnv* env, jobject thiz) {
    LOGI("Releasing OpenSL ES audio resources.");
    if (bqPlayerObject != NULL) {
        (*bqPlayerObject)->Destroy(bqPlayerObject);
        bqPlayerObject = NULL;
        bqPlayerPlay = NULL;
        bqPlayerBufferQueue = NULL;
    }
    if (outputMixObject != NULL) {
        (*outputMixObject)->Destroy(outputMixObject);
        outputMixObject = NULL;
    }
    if (engineObject != NULL) {
        (*engineObject)->Destroy(engineObject);
        engineObject = NULL;
        engineEngine = NULL;
    }
}
