'use strict';

const nano = require('nano');
const Promise = require('bluebird');

const couchdb = nano(`${process.env.COUCHDB || 'http://localhost:5984/couchdb-force-tests'}`);
const couchdbAddr = `${couchdb.config.url}/${couchdb.config.db}`;
const couch = nano(couchdb.config.url);

Promise.promisifyAll(couch.db);
Promise.promisifyAll(couchdb);

// Uncomment to improve debugging
global.Promise = Promise;
Promise.config({ longStackTraces: true });

// Destroy & create db before any test
before(() => {
    return couch.db.destroyAsync(couchdb.config.db)
    .catch({ error: 'not_found' }, () => {})
    .then(() => couch.db.createAsync(couchdb.config.db));
});

// Destroy db afterwards
after(() => couch.db.destroyAsync(couchdb.config.db));

// Include tests
require('./spec/insert')(couchdbAddr, couchdb);
require('./spec/patch')(couchdbAddr, couchdb);
require('./spec/bulkInsert')(couchdbAddr, couchdb);
require('./spec/bulkPatch')(couchdbAddr, couchdb);
