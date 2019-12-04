import React, {Component} from 'react';
import './App.css';
import {BehaviorSubject, combineLatest, Observable} from "rxjs";
import {concatMap, debounceTime, map, scan} from "rxjs/operators";
import {CommandText} from "./lib/command-text";
import {TextOutput} from "./lib/text-output";
import {Images} from "./lib/images";
import 'terminal.css'

/* eslint import/no-webpack-loader-syntax:0 */

// import {bufferedStdErr$, bufferedStdOut$, bytesToBase64, getImageDimensions, gImage, run} from './lib/gifsicle-wrapper'
// @ts-ignore
import MyWorker from 'worker-loader?name=dist/[name].js!./lib/gifsicle-wrapper'
import {bufferedStdOut$, bufferedStdErr$, gImage, bytesToBase64, getImageDimensions} from './lib/things';

// import MyWorker = require("worker-loader?name=dist/[name].js!./worker");


class ObservableClass {
    editableText$ = new BehaviorSubject('');
    stdOutLines$ = bufferedStdOut$.pipe(scan<string, string[]>((oldLines: string[], newLine: string) => {
        return oldLines.concat(newLine);
    }, []));
    stdErrLines$ = bufferedStdErr$.pipe(scan<string, string[]>((oldLines: string[], newLine: string) => {
        return oldLines.concat(newLine);
    }, []));

    // @ts-ignore
    inputImages$: BehaviorSubject<gImage[]> = new BehaviorSubject([]);
    // I should change this to a
    outputImages$: Observable<gImage[]>;
    inputCommand$: Observable<string[]>;
    defaultOutputCommand$: Observable<string[]>;
    // @ts-ignore
    debouncedCommandArray$: Observable<string[]>;
    inputText$: Observable<string>;

    constructor() {
        // @ts-ignore
        const worker = new MyWorker();
        // @ts-ignore
        worker.onmessage = e => { console.log('i got something back?'); };
        // @ts-ignore
        worker.postMessage('yeet?');

        this.inputCommand$ = this.inputImages$.pipe(map(images => {
            const commands: string[] = [];
            images.forEach(i => {
                commands.push('-i', i.name);
            });
            return commands
        }));
        this.inputText$ = this.inputCommand$.pipe(map(t => t.join(' ')));
        this.defaultOutputCommand$ = this.inputImages$.pipe(map(images => {
            const commands: string[] = [];
            images.forEach(i => {
                commands.push('-o', "o_" + i.name);
            });
            return commands
        }));
        // I probably don't need this
        this.debouncedCommandArray$ = combineLatest(this.inputCommand$, this.editableText$, this.defaultOutputCommand$/*, this.outputText$*/)
            .pipe(
                debounceTime(500),
                map(([inputCommands, commandText, defaultOutputCommand]) => {
                    const v = inputCommands.concat(commandText.split(' '), defaultOutputCommand);
                    return v;
                }));
        // TODO fix
        // @ts-ignore
        this.outputImages$ = combineLatest(this.inputImages$, this.debouncedCommandArray$).pipe(
                debounceTime(500),
                concatMap(async ([inputImages, commands]) => {
                    if (!inputImages.length || !commands.join('')) {
                        return [];
                    }
                    // TODO Fix
                    // return await this.worker.postMessage({inputImages, commands});
                })
            );

        /*        this.stdOutLines$.subscribe(v => console.log('stdOutLines'));
                this.stdErrLines$.subscribe(v => console.log('stdErrLines'));*/
    }
}

class StateClass {
    editableText$: string = '';
    inputText$: string = '';
    debouncedCommand$: string[] = [];
    stdOutLines$: string[] = [];
    stdErrLines$: string[] = [];
    inputImages$: gImage[] = [];
    outputImages$: gImage[] = [];
    debouncedCommandArray$: string[] = [];
}

class RxComponent extends Component {
    state$: ObservableClass = new ObservableClass();
    state: StateClass = new StateClass();

    constructor(props: Readonly<{}>) {
        super(props);
        this.connect();
    }

    connect() {
        Object.entries(this.state$)
            .map(([key, obs$]) => {
                console.log(key);

                obs$.subscribe((v: any) => {
                    /*                    if (key == 'stdErrLines$') {
                                            debugger;console.log();
                                        }*/
                    this.setState({[key]: v});
                });
            });
    }
}

class App extends RxComponent {

    constructor(props: Readonly<{}>) {
        super(props);
    }

    componentDidMount() {
        // this.cropXLeft.current.
        (async () => {
            const resp = await fetch('/doom.gif');
            const r = await resp.arrayBuffer();
            this.state$.editableText$.next('--optimize --rotate-90 #0- --colors 2');
            this.pushFile(new Uint8Array(r), 'doom.gif');
        })();
    }


/*    async loadFileFromFileInterface(file) {
        const bytes = await ReadDroppedFile(file);
        await this.pushFile(bytes, file.name);
    }*/

    private async pushFile(bytes: Uint8Array, name: string) {
        const base64 = await bytesToBase64(bytes);
        this.state$.inputImages$.next( this.state$.inputImages$.getValue() .concat({ name: name, data: bytes, base64, size: await getImageDimensions(base64) }));
    }



    render() {
        return (
            <div>
                <CommandText
                    readOnlyText={this.state.debouncedCommandArray$.join(' ')}
                    editableText={this.state.editableText$}
                    onTextChange={s => this.state$.editableText$.next(s)}
                />
                <TextOutput
                    stdOutLines={this.state.stdOutLines$}
                    stdErrLines={this.state.stdErrLines$}
                />
                <Images
                    inputImages={this.state.inputImages$}
                    outputImages={this.state.outputImages$}
                    imageClose={(i: any) => {
                        this.state$.inputImages$.next(
                            this.state$.inputImages$.getValue().filter(e => i != e)
                        )
                    }}
                    imageOpen={(i: any) => {
                        this.state$.inputImages$.next([i]);
                    }}
                />
                }
            </div>
            /*            <div className="App">
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
                                    {this.state$.rotate$.seq.map(v => v ? <MenuItem key={v} value={v}>{v}</MenuItem> :
                                        <MenuItem value="">
                                            <em>None</em>
                                        </MenuItem>)}
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
                                            <div style={{position: 'absolute', top: '-20px'}}> {i.size.x}px, {i.size.y}px</div>
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
                                                left: i.size.x + 'px',
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
                                                top: i.size.y + 'px'
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
                        </div>*/
        );
    }

    private handleCommandChange(value: string) {
        return undefined;
    }
}

export default App;
