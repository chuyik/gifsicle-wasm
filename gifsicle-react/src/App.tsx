/* eslint-disable */
import React, {Component} from 'react';
import {BehaviorSubject, Subject, combineLatest} from 'rxjs';
import {buffer, debounceTime, filter, map} from 'rxjs/operators';
import './App.css';
import Gifsicle from './gifsicle.js';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';

const stdOut$ = new Subject();
const stdErr$ = new Subject();
const stdOutFinished$ = stdOut$.pipe(filter(a => a === 10));
const stdErrFinished$ = stdErr$.pipe(filter(a => a === 10));
const bufferedStdOut$ = stdOut$.pipe(buffer(stdOutFinished$));
const bufferedStdErr$ = stdErr$.pipe(buffer(stdErrFinished$));

// @ts-ignore
bufferedStdOut$.subscribe(v => console.log(v.map(String.fromCharCode).join('')));
// @ts-ignore
bufferedStdErr$.subscribe(v => console.warn(v.map(String.fromCharCode).join('')));

let wasmInstance;
// @ts-ignore
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

function sleep(n: number) {
    return new Promise(resolve => {
        setTimeout(resolve, n)
    })
}

const inFilename = 'input.data';
const outfilename = 'output.data';

interface KeyValPair {
    [key: string]: any
}

function makeObs(component: KeyValPair, obs$: KeyValPair): void {
    // Some observables will depend on others
    // @ts-ignore
    const deferredObs = [];
    component.state$ = {};
    // Make every property a BehaviorSubject so we can subscribe to it
    Object.entries(component.state).map(([k, v]) => {
        // @ts-ignore
        /*if (Object.isObject(v)) {
            // special case objects
                  if (v.obs_value) {
                    o.state$[k] = new BehaviorSubject(v.obs_value);
                    o.state$[k].subscribe(v => o.setState({
                      k: v.obs_value
                    }));
                  }
        }*/
        component.state$[k + '$'] = new BehaviorSubject(v);
        // @ts-ignore
        component.state$[k + '$'].subscribe(v => {
            component.setState({
                k: v
            });
        });
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
            // @ts-ignore
            o.subscribe(v => {
                component.setState({
                    // Remove the $ from the variable name
                    [k]: v
                });
            });
        }
    });
    // Initialize our dependant observables
    // @ts-ignore
    deferredObs.forEach(([k, f]) => {
        component.state$[k] = f(component.state$);
        // @ts-ignore
        component.state$[k].subscribe(v => {
            //  I think I'm consciously not using the wrapSetState here
            component.setState({
                k: v
            })
        })
    });
}

function enumerable(seq: Array<string>, sub: BehaviorSubject<any>) {
    // @ts-ignore
    sub.nextEnum = () => {
        let i = seq.indexOf(sub.getValue());
        if (i >= seq.length - 1) {
            i = 0;
        } else {
            i++;
        }
        sub.next(seq[i]);
        return seq[i];
    };
    // @ts-ignore
    sub.enum = seq;
    return sub;

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

interface gImage {
    name: string;
    data: Uint8Array;
    base64Data: string;
}

class AppState {
    inputImages: gImage[] = [];
    outputImages: gImage[] = [];
    errorMessages = [new Uint8Array([])];
    commandText = '';
    debug = '';
    commandPrefix = [];
    commandPostfix = [];
    frames = [];
    rotate$: any;
    reflect$: any;
    command: any;
}

class AppState$ {
    // @ts-ignore
    rotate$ = enumerable(['', '--rotate-90', '--rotate-180', '--rotate-270'], new BehaviorSubject('')); // 0 or 90 or 180
    // @ts-ignore
    reflect$ = enumerable(['', '--flip-horizontal', '--flip-vertical'], new BehaviorSubject('')); // reflectOrNo
    autoRecompute$ = new BehaviorSubject(true);
    debouncedCommand$ = (obs$: KeyValPair) =>
        combineLatest(obs$.commandPrefix$, obs$.commandText$, obs$.commandPostfix$).pipe(debounceTime(500))
            .pipe(map(([prefix, command, postfix]) => {
                // @ts-ignore
                return prefix.concat(command.split(' ')).concat(postfix)
            }))
}

class App extends Component {
    state = new AppState();

    constructor(props: KeyValPair) {
        super(props);

        makeObs(this, new AppState$());

        // @ts-ignore
        this.handleCommandChange = s => this.wrapSetState({commandText: s})
    }

    // @ts-ignore
    wrapSetState(o) {
        Object.entries(o).map(([k, v]) => {
            // @ts-ignore
            if (this.state[k] !== v) {
                // @ts-ignore
                this.state$[k + '$'].next(v)
            }
        });
        this.setState(o);
    }

    // @ts-ignore
    bytesToBase64(b) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", function () {
                const base64gif = reader.result; // your gif in base64 here
                // @ts-ignore
                resolve(base64gif);
            }, false);
            // It's weird how I have to have an array of arrays of bytes,
            // but the parameter is blobParts so I guess its accounting for parts not the whole
            const blob = new Blob([b], {type: "image/gif"});
            reader.readAsDataURL(blob);
        });
    }

    // @ts-ignore
    execGifsicle(files, cmd) {
        return new Promise((resolve) => {
            const Module = {};
            // @ts-ignore
            Module.stderr = v => stdErr$.next(v);
            // Module.stdin = stdin(e.encode(`-i ${inFilename} --rotate-90 > ${outfilename}`));
            // @ts-ignore
            Module.MEMFS = files;
            // @ts-ignore
            Module.arguments = cmd; // ["-i", inFilename, /*'--resize', '300x300',*/ "-o", outfilename];
            // @ts-ignore
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
            // @ts-ignore
            bufferedStdErr$.subscribe(errorMessage => this.wrapSetState({errorMessages: this.state.errorMessages.concat([errorMessage])}));
            const r = await (await fetch('/An_example_animation_made_with_Pivot.gif')).arrayBuffer();
            debugger;
            const inputBase64 = await this.bytesToBase64(new Uint8Array(r));
            const name = 'An_example_animation_made_with_Pivot.gif';
            debugger;
            this.wrapSetState({
                inputImages: [{name, data: new Uint8Array(r), base64Data: inputBase64}],
                commandPrefix: ['-i', name],
                commandPostfix: ['-o', 'o_' + name]

            });
            await sleep(1000);

            // @ts-ignore
            this.go(this.state$.debouncedCommand$);
        })();
    }

    // @ts-ignore
    async go(c) {
        const outputFiles = await this.execGifsicle(this.state.inputImages,
            c
        );
        this.wrapSetState({
            outputImages: outputFiles
        })
    }

    // @ts-ignore
    readFile(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => {
                // @ts-ignore
                resolve(e.target.result)
            };
            r.readAsArrayBuffer(file);
        });
    }

    // @ts-ignore
    async loadFileFromFileInterface(file) {
        const base64 = await this.bytesToBase64(await this.readFile(file));
        // @ts-ignore
        const newImages = this.state.inputImages.concat({name: file.name, data: base64});
        this.wrapSetState({
            inputImages: newImages,
            // @ts-ignore
            commandPrefix: ['-i', ...newImages.map(i => i.name)],
            // @ts-ignore
            commandPostfix: ['-o', ...newImages.map(i => 'o_' + i.name)]
        });
    }

    /**
     *
     * @param e {DragEvent}
     */
    // @ts-ignore
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
    // @ts-ignore
    handleDragOver(e) {
        e.preventDefault();
        return;
    }

    render() {
        // @ts-ignore
        // @ts-ignore
        return (
            <div className="App">
                <div>
                    <Button>
                        <div>{this.state.rotate$}</div>
                    </Button>
                    <Button>
                        <div>{this.state.reflect$}</div>
                    </Button>
                </div>
                <div>
                    {this.state.debug}
                </div>
                <div>{
                    // @ts-ignore
                    this.state.errorMessages.map(arr => <div>{String.fromCharCode.apply(String, arr)}</div>)
                }
                </div>
                <div className={"commands"}>
                    <input value={this.state.commandPrefix.join(' ')} readOnly={true}/>
                    <input onChange={e => this.handleCommandChange(e.target.value)}
                           value={this.state.commandText}/>
                    <input value={this.state.commandPostfix.join(' ')} readOnly={true}/>
                </div>
                <div style={{display: 'flex'}}>
                    <div>
                        <div>Input</div>
                        {this.state.inputImages.map(i => <Paper className={"image-box"} key={i.name}>
                            <img src={i.base64Data}/>
                        </Paper>)}
                        <Paper>
                            <div style={{minHeight: '50px'}} onDrop={e => this.handleDrop(e)}
                                 onDragOver={e => this.handleDragOver(e)}>Drop
                            </div>
                        </Paper>
                    </div>
                    <div>
                        <div>Output</div>
                        {this.state.outputImages.map(i => <Paper className={"image-box"} key={i.name}>
                            <img src={i.base64Data}/>
                        </Paper>)}
                    </div>
                </div>
            </div>
        );
    }

    private handleCommandChange(value: string) {
        return undefined;
    }
}

export default App;

