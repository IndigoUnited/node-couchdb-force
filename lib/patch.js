'use strict';

const promiseRetry = require('promise-retry');
const getCouchDb = require('./util/getCouchDb');
const nfcall = require('./util/nfcall');
const retries = require('./util/defaultRetries');
const patcher = require('./util/defaultPatcher');

function patch(couchdbAddr, patch, options) {
    if (patch._rev !== undefined) {
        return Promise.reject(new Error('The patch object must not contain _rev'));
    }

    options = Object.assign({
        doc: null,
        create: true,
        retries,
        patcher,
        nano: null,
    }, options);

    return Promise.resolve()
    .then(() => getCouchDb(couchdbAddr, options))
    .then((couchdb) => promiseRetry((retry) => {
        // Fetch doc if necessary
        return Promise.resolve(options.doc || nfcall(couchdb.get, patch._id))
        .catch((err) => {
            if (options.create && err.error === 'not_found') {
                return { _id: patch._id };
            }

            throw err;
        })
        // Apply patch
        .then((doc) => options.patcher(doc, patch))
        // Insert the document, retrying on conflict
        .then((doc) => {
            return nfcall(couchdb.insert, doc)
            .then((result) => {
                doc._rev = result.rev;
                return doc;
            })
            .catch((err) => {
                if (err.error === 'conflict') {
                    options.doc = null;  // Remove the passed doc so the it is retrieved when retrying
                    retry(err);
                }

                throw err;
            });
        });
    }, typeof options.retries === 'number' ? { retries: options.retries } : options.retries));
}

module.exports = patch;
