/* eslint global-require:0 */

'use strict';

module.exports = {
    insert: require('./lib/insert'),
    patch: require('./lib/patch'),
    bulkInsert: require('./lib/bulkInsert'),
    bulkPatch: require('./lib/bulkPatch'),
};
