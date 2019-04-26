#!/usr/bin/env bash
HTML=stackoverflow/src/stackoverflow.html
JS=stackoverflow/src/stackoverflow.js
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
    -s MODULARIZE=1 \
    -s EXPORT_NAME=Stackoverflow \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -o ${HTML} \
    # -o gifsicle-react/src/gifsicle.html \

sed -i.old '1s;^;\/* eslint-disable *\/;' ${JS}


