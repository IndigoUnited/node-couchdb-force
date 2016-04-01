'use strict';

function defaultPatcher(doc, patch) {
    return Object.assign({}, doc, patch);
}

module.exports = defaultPatcher;
