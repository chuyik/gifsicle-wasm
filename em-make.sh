#!/usr/bin/env bash
sudo docker run --rm -v $(pwd):/src trzeci/emscripten emmake make
sudo docker run --rm -v $(pwd):/src trzeci/emscripten emcc \
    src/clp.o \
    src/fmalloc.o \
    src/giffunc.o \
    src/gifread.o \
     src/gifunopt.o \
	src/merge.o \
	src/optimize.o \
	src/quantize.o \
	src/support.o \
	src/xform.o \
    src/gifsicle.o \
    src/gifwrite.o \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -o gifsicle-react/src/gifsicle.html


