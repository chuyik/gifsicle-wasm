/* eslint-disable */
import React, {Component} from 'react';
import {BehaviorSubject, Subject} from 'rxjs';
import {buffer, debounceTime, filter} from 'rxjs/operators';
import './App.css';
import Gifsicle from './gifsicle.js';
import Paper from '@material-ui/core/Paper';
import {debounce} from 'lodash';
import Button from '@material-ui/core/Button';

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

function makeObs(o, obs$) {
    // Some observables will depend on others
    const deferredObs = [];
    o.state$ = {};
    // Make every property a BehaviorSubject so we can subscribe to it
    Object.entries(o.state).map(([k, v]) => {
        if (Object.isObject(v)) {
            // special case objects
            if (v.obs_value) {
                o.state$[k] = new BehaviorSubject(v.obs_value);
                o.state$[k].subscribe(v => o.setState({
                    k: v.obs_value
                }));
            }
        }
        o.state$[k] = new BehaviorSubject(v);
        o.state$[k].subscribe(v => o.setState({
            k: v
        }));
    });
    // Add add some state properties
    Object.entries(obs$).map(([k, o]) => {
        if (!k.endsWith('$')) {
            throw new Error("Please make your observables end in $!")
        }
        if (typeof o === "function") {
            deferredObs.push([k, o]);
        } else {
            //  I think I'm consciously not using the wrapSetState here
            o.subscribe(v => o.setState({
                // Remove the $ from the variable name
                [k]: v
            }));
        }
    });
    // Initialize our dependant observables
    deferredObs.forEach(([k, f]) => {
        o.state$[k] = f(o.state$);
        o.state$[k].subscribe(v => {
            //  I think I'm consciously not using the wrapSetState here
            o.setScale({
                k: v
            })
        })
    });
}

function enumerable(seq) {
    return function(target, key) {
        target[key].nextEnum = () => {
            let i = seq.indexOf(target[key].getValue());
            if (i >= seq.length - 1) {
                i = 0;
            } else {
                i++;
            }
            this.next(seq[i]);
            return seq[i];
        };
        target[key].enum = seq;

/*        Reflect.deleteProperty(target, key);
        Reflect.defineProperty(target, key, {
            // This is a flag to let the observable wrapper know that it should get this value
            obs_value$: new BehaviorSubject(seq[0]),
            get value() {
                return this.obs_value$.getValue();
            },
            set value(v) {
                if (!seq.contains(v)) {
                    throw new Error("Sequence does not contain value in enumerable!");
                }
                this.obs_value.next(v);
            },
            next: function() {
            },
            previous: '',
            setValue: ''
        });*/
    }
}

class AppState {
    inputImages = [''];
    outputImages = [''];
    errorMessages = [new Uint8Array([])];
    commandText = '';
    debug = '';
    commandPrefix= [];
    commandPostfix= [];
    frames= [];
}
class AppState$ {
    @enumerable(['', '--rotate-90','--rotate-180','--rotate-270'])
    rotate$ = new BehaviorSubject(''); // 0 or 90 or 180
    @enumerable(['', '--flip-horizontal','--flip-vertical'])
    reflect$ = new BehaviorSubject(''); // reflectOrNo
    autoRecompute$ = new BehaviorSubject(true);
    debouncedCommand$ = (obs$) =>
        combineLatest(obs$.commandPrefix$, obs.commandText$, obs.commandPostfix$).pipe(debounceTime(500))
        // prefix and postfix will be arrays, but commandText will be a string
            .map(([prefix, command, postfix]) => {
                return prefix.concat(command.split(' ')).concat(postfix)
            });
}
class App extends Component {
    state = new AppState();

    constructor(props) {
        super(props);

        makeObs(this, new AppState$());

        this.handleCommandChange = s =>
            this.wrapSetState({
                commandText: s
            })
    }

    wrapSetState(o) {
        Object.entries(o).map(([k, v]) => {
            if (this.state[k] !== v) {
                this.state$[k + '$'].next(v)
            }
        });
        this.setState(o);
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

    execGifsicle(files, cmd) {
        return new Promise((resolve) => {
            const Module = {};
            Module.stderr = v => stdErr$.next(v);
            // Module.stdin = stdin(e.encode(`-i ${inFilename} --rotate-90 > ${outfilename}`));
            Module.MEMFS = files;
            Module.arguments = cmd; // ["-i", inFilename, /*'--resize', '300x300',*/ "-o", outfilename];
            Module.callback = async o => {
                const finishedFiles = o.MEMFS;
                for (let i = 0; i < finishedFiles.length; i++) {
                    const finishedFile = finishedFiles[i];
                    finishedFile.base64Data = await this.bytesToBase64(finishedFile.data);
                }
                resolve(finishedFiles);
            };
            wasmInstance = Gifsicle(Module);
        });
    }

    componentDidMount() {
        (async () => {
            bufferedStdErr$.subscribe(errorMessage => this.wrapSetState({errorMessages: this.state.errorMessages.concat([errorMessage])}));
            const r = await (await fetch('/An_example_animation_made_with_Pivot.gif')).arrayBuffer();
            const inputBase64 = await this.bytesToBase64(new Uint8Array(r));
            const name = 'An_example_animation_made_with_Pivot.gif';
            this.wrapSetState({
                inputImages: [{name, data: r, base64Data: inputBase64}],
                commandPrefix: ['-i', name],
                commandPostfix: ['-o', 'o_' + name]

            });
            await sleep(1000);

            this.go(this.state$.debouncedCommand$);
        })();
    }

    async go(c) {
        const outputFiles = await this.execGifsicle(this.state.inputImages,
            c
        );
        this.wrapSetState({
            outputImages: outputFiles
        })
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => {
                resolve(e.target.result)
            };
            r.readAsArrayBuffer(file);
        });
    }

    async loadFileFromFileInterface(file) {
        const base64 = await this.bytesToBase64(await this.readFile(file));
        const newImages = this.state.inputImages.concat({name: file.name, data: base64});
        this.wrapSetState({
            inputImages: newImages,
            commandPrefix: ['-i', ...newImages.map(i => i.name)],
            commandPostfix: ['-o', ...newImages.map(i => 'o_' + i.name)]
        });
    }
    /**
     *
     * @param e {DragEvent}
     */
    async handleDrop(e) {
        e.preventDefault();
        if (!e.dataTransfer || !e.dataTransfer.files) {
            return;
        }
        const files = e.dataTransfer.files;
        const l = files.length;
        for (let i = 0; i < l; i++) {
            const file = files[i];
            await this.loadFileFromFileInterface(file);
        }
    }

    /**
     * If we dont prevent default here the browser will handle the event
     * @param e {DragEvent}
     */
    handleDragOver(e) {
        e.preventDefault();
        return;
    }

    render() {
        return (
            <div className="App">
                <div>
                    <Button>
                        {this.state.rotate$}
                    </Button>
                    <Button>
                        {this.state.reflect$}
                    </Button>
                </div>
                <div>
                    {this.state.debug}
                </div>
                <div>{
                    this.state.errorMessages.map(arr => <div>{String.fromCharCode.apply(String, arr)}</div>)
                }
                </div>
                <div className={"commands"}>
                    <input value={this.state.commandPrefix.join(' ')} readOnly={true}/>
                    <input onChange={e => this.handleCommandChange(e.target.value)} value={this.state.command.join(' ')}/>
                    <input value={this.state.commandPostfix.join(' ')} readOnly={true}/>
                </div>
                <div style={{display: 'flex'}}>
                    <div>
                        <div>Input</div>
                        {this.state.inputImages.map(i => <Paper className={"image-box"} key={i.name}>
                            <img src={i.base64Data}/>
                        </Paper>)}
                        <Paper><div style={{minHeight: '50px'}} onDrop={e => this.handleDrop(e)} onDragOver={e => this.handleDragOver(e)}>Drop</div></Paper>
                    </div>
                    <div >
                        <div>Output</div>
                        {this.state.outputImages.map(i => <Paper className={"image-box"} key={i.name}>
                            <img src={i.base64Data}/>
                        </Paper>)}
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
