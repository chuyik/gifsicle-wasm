/* eslint-disable */
import React, {Component} from 'react';
import {BehaviorSubject, Subject, combineLatest} from 'rxjs';
import {buffer, debounceTime, filter, map} from 'rxjs/operators';
import './App.css';
import Gifsicle from './gifsicle.js';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import {MenuItem, Select} from "@material-ui/core";

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

function makeObs(component: KeyValPair, obs$: KeyValPair): AppState$ {
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
                [k]: v
            });
        });
    });
    // Add add some state properties
    Object.entries(obs$).map(([k, o]) => {
        if (!k.endsWith('$')) {
            throw new Error("Please make your observables end in $!")
        }
        component.state[k] = null;
        if (typeof o === "function") {
            deferredObs.push([k, o]);
        } else {
            // I think this lines makes it so that this function can only run the constructor before the state has a strict set of properties
            //  I think I'm consciously not using the wrapSetState here
            // @ts-ignore
            component.state$[k] = o;
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
                [k]: v
            })
        })
    });
    return component.state$;
}

class SeqBehaviorSubject<T> extends BehaviorSubject<T> {
    constructor(initVal: T, public seq: Array<T>) {
        super(initVal);
    }
}

function enumerable<T>(seq: Array<T>, sub: BehaviorSubject<T>): SeqBehaviorSubject<T> {
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
    sub.seq = seq;
    // @ts-ignore
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
    cropX: number;
    cropY: number;
    size: Point;
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
    command: any;
    rotate$: any;
    reflect$: any;
    commandInterface$: any;
}

class AppState$ {
    rotate$ = enumerable<string>(['', '--rotate-90', '--rotate-180', '--rotate-270'], new BehaviorSubject('')); // 0 or 90 or 180
    // @ts-ignore
    rotateAppendFrameSet$ = (obs$: KeyValPair) =>
        obs$.rotate$.pipe(map(v => v ? [v, '#0-'] : ['']));
    reflect$ = enumerable<string>(['', '--flip-horizontal', '--flip-vertical'], new BehaviorSubject('')); // reflectOrNo
    reflectAppendFrameSet$ = (obs$: KeyValPair) =>
        obs$.reflect$.pipe(map(v => v ? [v, '#0-'] : ['']));
    autoRecompute$ = new BehaviorSubject(true);
    requestCropRecompute$ = new BehaviorSubject([null, null, null, null]);
    // @ts-ignore
    cropCommand$ = (obs$: KeyValPair) => obs$.requestCropRecompute$.pipe(debounceTime(500), map(([xLeft, xRight, yTop, yBottom]) => {
        if (!xLeft) return '';
        const start = {x: getElPos(xLeft).x, y: getElPos(yTop).y};
        const end = {x: getElPos(xRight).x, y: getElPos(yBottom).y};
        const relativeEnd = {x: end.x - start.x, y: end.y - start.y};
        return `--crop ${start.x},${start.y}-${relativeEnd.x},${relativeEnd.y} #0-`
    }));
    commandInterface$ = (obs$: KeyValPair) => combineLatest(obs$.rotateAppendFrameSet$, obs$.cropCommand$, obs$.reflectAppendFrameSet$);
    debouncedCommand$ = (obs$: KeyValPair) =>
        combineLatest(obs$.commandPrefix$, obs$.commandInterface$, obs$.commandText$, obs$.commandPostfix$).pipe(debounceTime(500))
            .pipe(map(([prefix, commandInterface, command, postfix]) => {
                // @ts-ignore
                const v = prefix.concat(...commandInterface, command.split(' '), postfix);
                return v;
            }))
}

interface Point {
    x: number;
    y: number;
}

function getImageDimensions(base64: string): Promise<Point> {
    return new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => {
            resolve({x: i.naturalWidth, y: i.naturalHeight})
        };
        i.src = base64;
    });
}

function getPxInt(str: string | null): number {
    const l = (str || '0').replace('px', '');
    return parseInt(l, 10);
}

function getElPos(el: HTMLElement): Point {
    const x = getPxInt(el.style.left) - getPxInt(el.style.right);
    const y = getPxInt(el.style.top) - getPxInt(el.style.bottom);
    return {x, y}
}

function addToPix(px: string | null, i: number): string {
    const n = getPxInt(px);
    return n + i + 'px'
}

class App extends Component {
    state = new AppState();
    state$: AppState$;

    dragging: HTMLDivElement | undefined;
    private readonly cropXLeft: React.RefObject<HTMLDivElement>;
    private readonly cropXRight: React.RefObject<HTMLDivElement>;
    private readonly cropYTop: React.RefObject<HTMLDivElement>;
    private readonly cropYBottom: React.RefObject<HTMLDivElement>;

    constructor(props: KeyValPair) {
        super(props);

        this.state$ = makeObs(this, new AppState$());

        this.cropXLeft = React.createRef();
        this.cropXRight = React.createRef();
        this.cropYTop = React.createRef();
        this.cropYBottom = React.createRef();

        // @ts-ignore
        this.handleCommandChange = s => this.wrapSetState({commandText: s});

        // @ts-ignore
        this.state$.debouncedCommand$.subscribe(commands => this.go(commands.filter(v => v)));

        document.onmousedown = e => {
            // @ts-ignore
            const t: HTMLDivElement = e.target;
            if (t.classList.contains('crop-slider')) {
                this.dragging = t;
            }
        };
        document.onmouseup = e => {
            debugger;
            console.log();
            this.dragging = undefined;
            if (this.dragging) {
                this.dragging = undefined;
            }
        };
        document.onmousemove = e => {
            const xTransform = e.movementX;
            const yTransform = e.movementY;

            if (this.dragging) {
                e.preventDefault();
                // @ts-ignore
                this.state$.requestCropRecompute$.next([this.cropXLeft, this.cropXRight, this.cropYTop, this.cropYBottom]);
                switch (this.dragging) {
                    case this.cropXLeft.current:
                        if (!this.cropXLeft.current) break;
                        this.cropXLeft.current.style.left = addToPix(this.cropXLeft.current.style.left, xTransform);
                        break;
                    case this.cropXRight.current:
                        if (!this.cropXRight.current) break;
                        this.cropXRight.current.style.left = addToPix(this.cropXRight.current.style.left, xTransform);
                        break;
                    case this.cropYTop.current:
                        if (!this.cropYTop.current) break;
                        this.cropYTop.current.style.top = addToPix(this.cropYTop.current.style.top, yTransform);
                        break;
                    case this.cropYBottom.current:
                        if (!this.cropYBottom.current) break;
                        this.cropYBottom.current.style.top = addToPix(this.cropYBottom.current.style.top, yTransform);
                        break;
                    default:
                        debugger;
                        console.log();

                }
/*                if (this.dragging.classList.contains('x')) {
                    const leftS = (this.dragging.style.left || '0').replace('px', '');
                    const leftN = parseInt(leftS, 10);
                    // Am I allowed to do this?
                    const pos = leftN + xTransform;
                    this.dragging.style.left = pos + 'px';
                } else if (this.dragging.classList.contains('y')) {
                    const topS = (this.dragging.style.top || '0').replace('px', '');
                    const topN = parseInt(topS, 10);
                    // Am I allowed to do this?
                    const pos = topN + yTransform;
                    this.dragging.style.top = pos + 'px';
                } else {
                    debugger;
                    console.log();
                }*/
            }
        }
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

    bytesToBase64(b: Uint8Array): Promise<string> {
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
                    finishedFile.size = await getImageDimensions(finishedFile.base64Data);
                }
                resolve(finishedFiles);
            };
            wasmInstance = Gifsicle(Module);
        });
    }

    componentDidMount() {
        // @ts-ignore
        function addListener(k, e) {
            //   e.
        }

        // this.cropXLeft.current.
        (async () => {
            // @ts-ignore
            bufferedStdErr$.subscribe(errorMessage => this.wrapSetState({errorMessages: this.state.errorMessages.concat([errorMessage])}));
            const resp = await fetch('/An_example_animation_made_with_Pivot.gif');
            const r = await resp.arrayBuffer();
            const inputBase64 = await this.bytesToBase64(new Uint8Array(r));
            const name = 'An_example_animation_made_with_Pivot.gif';
            this.wrapSetState({
                inputImages: [{
                    name,
                    data: new Uint8Array(r),
                    base64Data: inputBase64,
                    size: await getImageDimensions(inputBase64)
                }],
                commandPrefix: ['-i', name],
                commandPostfix: ['-o', 'o_' + name]
            });
            await sleep(1000);

            // Falsey arguments will give you a bad time
            // @ts-ignore
            this.go(this.state.debouncedCommand$.filter(v => v));
        })();
    }

    // @ts-ignore
    async go(c) {
        const outputFiles = await this.execGifsicle(this.state.inputImages, c);
        this.wrapSetState({
            outputImages: outputFiles
        })
    }

    // @ts-ignore
    readFile(file): Promise<Uint8Array> {
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
        return (
            <div className="App">
                <div>
                    <Select
                        value={this.state.reflect$}
                        onChange={v => this.state$.reflect$.next(v.target.value)}
                        inputProps={{
                            name: 'reflect',
                            id: 'reflect',
                        }}
                    >
                        {this.state$.reflect$.seq.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                    <Select
                        value={this.state.rotate$}
                        onChange={v => this.state$.rotate$.next(v.target.value)}
                        inputProps={{
                            name: 'rotate',
                            id: 'rotate',
                        }}
                    >
                        {this.state$.rotate$.seq.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                </div>
                <div>{this.state.debug}</div>
                <div>{this.state.errorMessages.length && this.state.errorMessages.slice(-1).map(arr =>
                    <div>{String.fromCharCode.apply(String, Array.from(arr))}</div>)}
                </div>
                <div className={"commands"}>
                    <input value={this.state.commandPrefix.join(' ')} readOnly={true}/>
                    <input onChange={e => this.handleCommandChange(e.target.value)}
                           value={this.state.commandText}/>
                    <input value={this.state.commandInterface$ && this.state.commandInterface$.join(' ')}>

                    </input>
                    <input value={this.state.commandPostfix.join(' ')} readOnly={true}/>
                </div>
                <div style={{display: 'flex'}}>
                    <div>
                        {this.state.inputImages.map(i => <Paper className={"image-box"} key={i.name}>
                            <div style={{position: 'relative'}}>
                                <div> {i.size.x}px, {i.size.y}px</div>
                                <div style={{
                                    position: 'absolute',
                                    minHeight: '100%',
                                    width: '5px',
                                    backgroundColor: 'black'
                                }} className={'crop-slider x'}
                                     ref={this.cropXLeft}
                                >
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    minHeight: '100%',
                                    width: '5px',
                                    backgroundColor: 'black'
                                }} className={'crop-slider x'} ref={this.cropXRight}>
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    minWidth: '100%',
                                    height: '5px',
                                    backgroundColor: 'black'
                                }} className={'crop-slider y'} ref={this.cropYTop}>
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    minWidth: '100%',
                                    height: '5px',
                                    backgroundColor: 'black',
                                    bottom: '0px'
                                }} className={'crop-slider y'} ref={this.cropYBottom}>
                                </div>
                                <img
                                    src={i.base64Data}
                                />
                            </div>
                        </Paper>)}
                        <Paper>
                            <div style={{minHeight: '50px'}}>Drop</div>
                        </Paper>
                    </div>
                    <div>
                        {this.state.outputImages.map(i => <Paper className={"image-box"} key={i.name}>
                            <div> {i.size.x}px, {i.size.y}px</div>
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

