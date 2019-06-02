import Gifsicle from '../gifsicle.js';
import {buffer, filter, map, reduce, scan} from "rxjs/operators";
import {Subject} from "rxjs";

const stdOut$: Subject<number> = new Subject();
const stdErr$: Subject<number> = new Subject();
const stdOutFinished$ = stdOut$.pipe(filter(a => a === 10));
const stdErrFinished$ = stdErr$.pipe(filter(a => a === 10));
export const bufferedStdOut$ = stdOut$.pipe(buffer(stdOutFinished$), map(byteArray => {
    const v = byteArray.map(c => String.fromCharCode(c)).join('');
    return v;
}));
export const bufferedStdErr$ = stdErr$.pipe(buffer(stdErrFinished$), map(byteArray => {
    const v = byteArray.map(c => String.fromCharCode(c)).join('');
    return v;
}));

bufferedStdOut$.subscribe(v => console.log(v));
bufferedStdErr$.subscribe(v => console.warn(v));

export interface Point {
    x: number;
    y: number;
}

export interface gImage {
    name: string;
    size: Point;
    base64: string;
    data: Uint8Array;
}

// @ts-ignore

/*export const allStdOut$ = bufferedStdOut$.pipe(
    // @ts-ignore
    map(v => v.map(String.fromCharCode).join('')),
    // @ts-ignore
    scan((acc: string[], val: string) => acc.concat(val), [])
);
export const allStdErr$ = bufferedStdErr$.pipe(
    // @ts-ignore
    map(v => v.map(String.fromCharCode).join('')),
    // @ts-ignore
    scan((acc: string[], val: string) => acc.concat(val), [])
);*/

export function getImageDimensions(base64: string): Promise<Point> {
    return new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => {
            resolve({x: i.naturalWidth, y: i.naturalHeight})
        };
        i.src = base64;
    });
}

export function bytesToBase64(b: Uint8Array): Promise<string> {
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

export function run(files: gImage[], cmd: string[]): Promise<gImage[]> {
    let wasmInstance;
    return new Promise(((resolve, reject) => {
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
                finishedFile.base64 = await bytesToBase64(finishedFile.data);
                finishedFile.size = await getImageDimensions(finishedFile.base64);
            }
            resolve(finishedFiles);
        };
        wasmInstance = Gifsicle(Module);
    }))
}


