#!/usr/bin/env bash
sudo docker run --rm -v $(pwd):/src trzeci/emscripten emconfigure ./configure --disable-gifview
