'use strict';

const promiseRetry = require('promise-retry');
const forEachRight = require('lodash.foreachright');
const fromPairs = require('lodash.frompairs');
const getCouchDb = require('./util/getCouchDb');
const nfcall = require('./util/nfcall');
const retries = require('./util/defaultRetries');
const patcher = require('./util/defaultPatcher');
const couchdbError = require('./util/couchdbError');

function bulkPatch(couchdbAddr, patches, options) {
    // Short-circuit if there are no patches
    if (!patches.length) {
        return Promise.resolve(patches);
    }

    // Check if any of the patches has _rev
    const hasRevs = patches.some((patch) => patch._rev !== undefined);

    if (hasRevs) {
        return Promise.reject(new Error('The patch objects must not contain _rev'));
    }

    options = Object.assign({
        docs: null,
        create: true,
        retries,
        patcher,
        nano: null,
    }, options);

    const remainingPatches = patches.concat([]);
    const docsHash = fromPairs((options.docs || []).filter((doc) => doc).map((doc) => [doc._id, doc]));
    const errorsHash = {};

    return Promise.resolve()
    .then(() => getCouchDb(couchdbAddr, options))
    .then((couchdb) => promiseRetry((retry) => {
        // Fetch the docs if necessary
        const patchesWithoutDocs = remainingPatches.filter((patch) => !docsHash[patch._id]);
        const keysWithoutDocs = patchesWithoutDocs.map((patch) => patch._id);

        return nfcall(couchdb.fetch, { keys: keysWithoutDocs })
        .then((response) => {
            response.rows.forEach((row) => {
                if (row.error) {
                    if (row.error === 'not_found' && options.create) {
                        docsHash[row.key] = { _id: row.key };
                    } else {
                        errorsHash[row.key] = couchdbError(row);
                        remainingPatches.splice(remainingPatches.findIndex((patch) => patch._id === row.key), 1);
                    }
                } else {
                    docsHash[row.id] = row.doc;
                }
            });
        })
        // Apply patches
        .then(() => remainingPatches.map((patch) => options.patcher(docsHash[patch._id], patch)))
        // Insert the documents in bulk, retrying on conflict
        .then((docs) => {
            return nfcall(couchdb.bulk, { docs })
            .then((results) => {
                forEachRight(results, (result, index) => {
                    const doc = docs[index];

                    if (!result.error) {
                        delete errorsHash[doc._id];

                        doc._rev = result.rev;
                        docsHash[doc._id] = doc;
                        remainingPatches.splice(index, 1);
                    } else {
                        errorsHash[doc._id] = couchdbError(result);

                        if (result.error === 'conflict') {
                            docsHash[doc._id] = null;  // Remove the doc so that it is retrieved when retrying
                        } else {
                            remainingPatches.splice(index, 1);
                        }
                    }
                });

                // Retry if there are still docs to be patched
                if (remainingPatches.length) {
                    retry(new Error('There\'s still documents to patch'));
                }

                return docs;
            });
        });
    }, typeof options.retries === 'number' ? { retries: options.retries } : options.retries))
    // If a network error or other kind of error occurred, fill the results with that error
    .catch((err) => {
        patches.forEach((patch) => {
            if (!errorsHash[patch._id]) {
                errorsHash[patch._id] = err;
            }
        });
    })
    // Finally build the results array
    .then(() => {
        const failedCount = Object.keys(errorsHash).length;

        if (failedCount) {
            throw Object.assign(new Error(`Failed to bulk insert ${failedCount} documents`), { errors: errorsHash });
        }

        return patches.map((patch) => docsHash[patch._id]);
    });
}

module.exports = bulkPatch;
