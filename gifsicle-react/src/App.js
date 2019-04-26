import React, {Component} from 'react';
import logo from './An_example_animation_made_with_Pivot.gif';
import {Subject} from 'rxjs';
import {buffer, filter} from 'rxjs/operators';
import './App.css';

import image from './example-base64';

function _base64ToArrayBuffer(base64) {
    const spl = base64.split("base64,");
    if (spl.length > 1) {
        base64 = spl[1];
    }
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

let buf = _base64ToArrayBuffer(image);

var Module = {};
const stdOut$ = new Subject();
const stdErr$ = new Subject();
const stdOutFinished$ = stdOut$.pipe(filter(a => a === null));
const stdErrFinished$ = stdOut$.pipe(filter(a => a === null));
const bufferedStdOut$ = stdOut$.pipe(buffer(stdOutFinished$));
const bufferedStdErr$ = stdErr$.pipe(buffer(stdErrFinished$));
bufferedStdOut$.subscribe(v => console.log(v));

// First fetch the image we want to send to gifsicle
/*const imageResponse = await fetch(logo);
let buf = new Uint8Array(await imageResponse.arrayBuffer());*/

const stdin = function writeToStdIn() {
    if (!buf.length) {
        return null;
    }
    const c = buf[buf.length - 1];
    console.log(buf.length);
    buf = buf.slice(0, -1);
    console.log(buf.length);
    debugger;
    return c;
};
const stdout = function (char) {
    stdOut$.next(char);
};
const stderr = function (char) {
    stdErr$.next(char);
};

Module['stdin'] = stdin;
Module['stdout'] = stdout;
Module['stderr'] = stderr;
// Let's see if this works
/* eslint-disable-next-line */
import './gifsicle.js';


class App extends Component {
    componentDidMount() {
        (async () => {
        })();
    }

    render() {
        return (
            <div className="App">
                <header className="App-header">
                    <canvas className={"emscripten"} id="canvas" onContextMenu={(event) => event.preventDefault()}
                            tabIndex="-1"/>
                    <div className={"spinner"} id='spinner'/>
                    <div className={"emscripten"} id="status">Downloading...</div>
                    <progress value="0" max="100" id="progress" hidden="1"/>
                </header>
            </div>
        );
    }
}

export default App;
