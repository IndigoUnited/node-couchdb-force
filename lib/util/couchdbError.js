'use strict';

function couchdbError(result) {
    return Object.assign(new Error(result.reason || result.reason || 'Unknown error'),
        { error: result.error, reason: result.reason });
}

module.exports = couchdbError;
