cmake_minimum_required(VERSION 3.10.2)
project("fxsound_android")

add_library(
    fxsound_android
    SHARED
    Play32.c
    Play32StereoWithDFX.c
    dfxpEq.cpp
    dfxpProcessReal.cpp
    FiltCalcBiqd.cpp
    jni_bridge.cpp
)

find_library(
    log-lib
    log
)

target_link_libraries(
    fxsound_android
    ${log-lib}
    android
    OpenSLES
)
