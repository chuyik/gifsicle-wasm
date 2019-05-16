/* eslint-disable */
import React, {Component} from 'react';
import {Subject} from 'rxjs';
import {buffer, filter} from 'rxjs/operators';
import './App.css';
import Gifsicle from './gifsicle.js';

const stdOut$ = new Subject();
const stdErr$ = new Subject();
const stdOutFinished$ = stdOut$.pipe(filter(a => a === 10));
const stdErrFinished$ = stdErr$.pipe(filter(a => a === 10));
const bufferedStdOut$ = stdOut$.pipe(buffer(stdOutFinished$));
const bufferedStdErr$ = stdErr$.pipe(buffer(stdErrFinished$));

bufferedStdOut$.subscribe(v => console.log(v.map(String.fromCharCode).join('')));
bufferedStdErr$.subscribe(v => console.warn(v.map(String.fromCharCode).join('')));

let wasmInstance;
const stdin = function writeToStdIn(buf) {
    return function () {
        if (!buf.length) {
            return null;
        }
        const c = buf[buf.length - 1];
        console.log(buf.length);
        buf = buf.slice(0, -1);
        console.log(buf.length);
        return c;
    }
};

function sleep(n) {
    return new Promise(resolve => {
        setTimeout(resolve, n)
    })
}

const inFilename = 'input.data';
const outfilename = 'output.data';
const e = new TextEncoder();

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inputImage: '',
            outputImage: '',
            errorMessages: [new Uint8Array([])],
            command: '',
        };
    }

    bytesToBase64(b) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", function () {
                const base64gif = reader.result; // your gif in base64 here
                resolve(base64gif);
            }, false);
            // It's weird how I have to have an array of arrays of bytes,
            // but the parameter is blobParts so I guess its accounting for parts not the whole
            const blob = new Blob([b], {type: "image/gif"});
            reader.readAsDataURL(blob);
        });
    }

    processImageBytes(bytes) {
        return new Promise((resolve, reject) => {
            const Module = {};
            Module.stderr = v => stdErr$.next(v);
            Module.stdin = stdin(e.encode(`-i ${inFilename} --rotate-90 > ${outfilename}`));
            Module.MEMFS = [{name: inFilename, data: bytes}];
            Module.arguments = ["-i", inFilename, '--resize', ' 150x_', "-o", outfilename];
            Module.callback = o => {
                const b = o.MEMFS[0] && o.MEMFS[0].data;
                this.bytesToBase64(b).then(resolve);
            };
            wasmInstance = Gifsicle(Module);
        });
    }

    componentDidMount() {
        (async () => {
            bufferedStdErr$.subscribe(errorMessage => this.setState({errorMessages: this.state.errorMessages.concat([errorMessage])}));
            const r = await (await fetch('/An_example_animation_made_with_Pivot.gif')).arrayBuffer();
            const inputBase64 = await this.bytesToBase64(new Uint8Array(r));
            this.setState({
                inputImage: inputBase64
            });
            const resultBase64 = await this.processImageBytes(r);
            this.setState({
                outputImage: resultBase64
            })
        })();
    }

    render() {
        return (
            <div className="App">
                <div>{
                    this.state.errorMessages.map(arr => String.fromCharCode.apply(String, arr))
                        .join('\n')
                }
                </div>
                <div style={{display: 'flex', flexFlow: 'row nowrap'}}>
                    <div>
                        <div>Input</div>
                        <img src={this.state.inputImage}/>
                    </div>
                    <div>
                        <div>Output</div>
                        <img src={this.state.outputImage}/>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
