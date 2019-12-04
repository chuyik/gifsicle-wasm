import {buffer, filter, map} from "rxjs/operators";
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
bufferedStdOut$.subscribe(v => console.log(v));
bufferedStdErr$.subscribe(v => console.warn(v));
