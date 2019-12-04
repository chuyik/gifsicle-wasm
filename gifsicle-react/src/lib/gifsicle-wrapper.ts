import Gifsicle from '../gifsicle.js';
import {gImage, bytesToBase64, getImageDimensions} from './things.js';
/* eslint no-restricted-globals:0 */


// @ts-ignore
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.onmessage = (ev) => {
    let message: string = ev.data;
    // message = message.replace(/fuck/gi, "****");
    ctx.postMessage(message);
};



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



export function hello() {
    return false;
}