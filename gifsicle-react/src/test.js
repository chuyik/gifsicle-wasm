const f  = () => {
    return new Promise((resolve, reject) => {
        console.log('this runs as async');
        resolve();
    })
}
await f();