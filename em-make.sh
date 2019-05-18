#!/usr/bin/env bash
HTML=gifsicle-react/src/gifsicle.html
JS=gifsicle-react/src/gifsicle.js
WASM=gifsicle-react/src/gifsicle.wasm
WASM_PUBLIC=gifsicle-react/public/gifsicle.wasm
WASM_FILENAME=gifsicle.wasm
WASM_LOOKUP='wasmBinaryFile = locateFile'
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
    --pre-js ./pre.js \
    -s MODULARIZE=1 \
    -s EXPORT_NAME=Gifsicle \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -o ${HTML} \

cp ${WASM} ${WASM_PUBLIC}
gsed -i.old '1s;^;\/* eslint-disable */\n&;' ${JS}
gsed -i.old '2s;^;\// @ts-ignore;' ${JS}
gsed -i.old "s|$WASM_FILENAME|/$WASM_FILENAME|" ${JS}
gsed -i.old "s|$WASM_LOOKUP|// $WASM_LOOKUP|" ${JS}


