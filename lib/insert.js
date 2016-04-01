'use strict';

const promiseRetry = require('promise-retry');
const getCouchDb = require('./util/getCouchDb');
const nfcall = require('./util/nfcall');
const retries = require('./util/defaultRetries');

function insert(couchdbAddr, doc, options) {
    doc = Object.assign({}, doc);  // We will be mutating the doc, so shallow clone it
    options = Object.assign({
        retries,
        nano: null,
    }, options);

    return Promise.resolve()
    .then(() => getCouchDb(couchdbAddr, options))
    .then((couchdb) => promiseRetry((retry) => {
        // Insert the document, retrying on conflict
        return nfcall(couchdb.insert, doc)
        .then((result) => {
            doc._rev = result.rev;
            return doc;
        })
        .catch((err) => {
            if (err.error !== 'conflict') {
                throw err;
            }

            // Fetch its rev and retry
            return nfcall(couchdb.get, doc._id)
            .then((_doc) => {
                doc._rev = _doc._rev;
                retry(err);
            }, (err) => {
                if (err.error !== 'not_found') {
                    throw err;
                }

                doc._rev = undefined;
                retry(err);
            });
        });
    }, typeof options.retries === 'number' ? { retries: options.retries } : options.retries));
}

module.exports = insert;
