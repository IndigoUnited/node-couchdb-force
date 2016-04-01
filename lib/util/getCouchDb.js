'use strict';

const nano = require('nano');

function getCouchDb(couchdbAddr, options) {
    const couchdb = typeof couchdbAddr === 'string' ? nano(couchdbAddr, options.nano) : couchdbAddr;

    if (!couchdb.config.db) {
        throw new Error('No database is selected, did you pass a database in the couchdb address?');
    }

    return couchdb;
}

module.exports = getCouchDb;
