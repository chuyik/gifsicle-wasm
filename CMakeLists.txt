cmake_minimum_required(VERSION 3.13)
project(gifsicle C)

set(CMAKE_C_STANDARD 11)

include_directories(include)
include_directories(include/lcdf)
include_directories(include/lcdfgif)
include_directories(src)
include_directories(.)

add_executable(gifsicle
        include/lcdf/clp.h
        include/lcdf/inttypes.h
        include/lcdfgif/gif.h
        include/lcdfgif/gifx.h
        src/clp.c
        src/fmalloc.c
        src/gifdiff.c
        src/giffunc.c
        src/gifread.c
        src/gifsicle.c
        src/gifsicle.h
        src/giftoc.c
        src/gifunopt.c
        src/gifview.c
        src/gifwrite.c
        src/gifx.c
        src/kcolor.h
        src/merge.c
        src/optimize.c
        src/opttemplate.c
        src/quantize.c
        src/strerror.c
        src/support.c
        src/ungifwrt.c
        src/win32cfg.h
        src/xform.c)
