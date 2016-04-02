'use strict';

const promiseRetry = require('promise-retry');
const forEachRight = require('lodash.foreachright');
const getCouchDb = require('./util/getCouchDb');
const nfcall = require('./util/nfcall');
const retries = require('./util/defaultRetries');
const couchdbError = require('./util/couchdbError');

function bulkInsert(couchdbAddr, docs, options) {
    // Short-circuit if there are no docs
    if (!docs.length) {
        return Promise.resolve(docs);
    }

    docs = docs.map((doc) => Object.assign({}, doc));  // We will be mutating the docs, so shallow clone them
    options = Object.assign({
        retries,
        nano: null,
    }, options);

    const remainingDocs = docs.concat([]);
    const errorsHash = {};

    return Promise.resolve()
    .then(() => getCouchDb(couchdbAddr, options))
    .then((couchdb) => promiseRetry((retry) => {
        // Insert the documents in bulk, retrying on conflict
        return nfcall(couchdb.bulk, { docs: remainingDocs })
        .then((results) => {
            forEachRight(results, (result, index) => {
                const doc = remainingDocs[index];

                if (!result.error) {
                    delete errorsHash[doc._id];

                    doc._rev = result.rev;
                    remainingDocs.splice(index, 1);
                } else {
                    errorsHash[doc._id] = couchdbError(result);

                    if (result.error === 'conflict') {
                        doc._rev = undefined;  // Remove the rev so that it is retrieved when retrying
                    } else {
                        remainingDocs.splice(index, 1);
                    }
                }
            });
        })
        // Retry if there are still docs to be inserted but first retrieve their revs
        .then(() => {
            if (!remainingDocs.length) {
                return;
            }

            const docsWithoutRev = remainingDocs.filter((doc) => !doc._rev);
            const keysWithoutRev = docsWithoutRev.map((doc) => doc._id);

            return nfcall(couchdb.fetchRevs, { keys: keysWithoutRev })
            .then((response) => {
                response.rows.forEach((row, index) => {
                    docsWithoutRev[index]._rev = row.value && row.value.rev;
                });

                retry(new Error('There\'s still documents to insert'));
            });
        });
    }, typeof options.retries === 'number' ? { retries: options.retries } : options.retries))
    // If a network error or other kind of error occurred, fill the results with that error
    .catch((err) => {
        docs.forEach((doc) => {
            if (!errorsHash[doc._id]) {
                errorsHash[doc._id] = err;
            }
        });
    })
    // Finally build the results array
    .then(() => {
        const failedCount = Object.keys(errorsHash).length;

        if (failedCount) {
            throw Object.assign(new Error(`Failed to bulk insert ${failedCount} documents`), { errors: errorsHash });
        }

        return docs;
    });
}

module.exports = bulkInsert;
