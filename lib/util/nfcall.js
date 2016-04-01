'use strict';

function nfcall(fn) {
    const args = Array.prototype.slice.call(arguments, 1);

    return new Promise((resolve, reject) => {
        args.push((err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });

        fn.apply(null, args);
    });
}

module.exports = nfcall;
