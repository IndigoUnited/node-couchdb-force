# couchdb-force

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

[npm-url]:https://npmjs.org/package/couchdb-force
[downloads-image]:http://img.shields.io/npm/dm/couchdb-force.svg
[npm-image]:http://img.shields.io/npm/v/couchdb-force.svg
[travis-url]:https://travis-ci.org/IndigoUnited/node-couchdb-force
[travis-image]:http://img.shields.io/travis/IndigoUnited/node-couchdb-force/master.svg
[coveralls-url]:https://coveralls.io/r/IndigoUnited/node-couchdb-force
[coveralls-image]:https://img.shields.io/coveralls/IndigoUnited/node-couchdb-force/master.svg
[david-dm-url]:https://david-dm.org/IndigoUnited/node-couchdb-force
[david-dm-image]:https://img.shields.io/david/IndigoUnited/node-couchdb-force.svg
[david-dm-dev-url]:https://david-dm.org/IndigoUnited/node-couchdb-force#info=devDependencies
[david-dm-dev-image]:https://img.shields.io/david/dev/IndigoUnited/node-couchdb-force.svg

Update documents in CouchDB without having to fetch them.

One cannot update CouchDB documents blindly, you always have to fetch their revision first.
But even if we do so, conflict errors might occur and you have to retry the operation until it succeeds.

But sometimes you just want to update the documents, without having to worry with the obstacles mentioned above.


## Installation

`$ npm install couchdb-force`


## Usage

### .insert(couchdbAddr, doc, [options])

Forces the insertion of `doc` into the database referenced by `couchdbAddr`.

This operation tries to insert `doc`, retrying on conflict by re-fetching its revision.

```js
const couchdbForce = require('couchdb-force');

couchdbForce.insert('http://localhost:5984/my-db', {
    _id: 'user-1',
    name: 'André Cruz',
})
.then((doc) => {
    console.log('Insertion successful', doc);
}, (err) => {
    // `err` is a standard `nano` error that might contain the well known
    // `err.statusCode`, `err.error` and `err.reason` properties
    console.log('Insertion failed', err);
});
```

The `couchdbAddr` argument must be a connection string with protocol, host, port and database path (e.g.: http://localhost:5984/my-db) or a [nano](https://www.npmjs.com/package/nano) instance.

Available options:

- `retries`: The number of retries or a [retry](https://www.npmjs.org/package/retry) options object, defaults to `{ retries: 5, minTimeout: 200 }`
- `nano`: Custom options to be used when creating the [nano]((https://www.npmjs.com/package/nano)) instance, defaults to `null`.


### .patch(couchdbAddr, patch, [options])

Patches the document referenced `patch` by mixing the stored document with `patch`.

This operation fetches the document, applies the patch and tries to insert it, retrying the whole operation on conflict.

```js
const couchdbForce = require('couchdb-force');

couchdbForce.patch('http://localhost:5984/my-db', {
    _id: 'user-1',
    country: 'pt',
})
.then((doc) => {
    console.log('Patch successful', doc);
}, (err) => {
    // `err` is a standard `nano` error that might contain the well known
    // `err.statusCode`, `err.error` and `err.reason` properties
    console.log('Patch failed', err);
});
```

The `couchdbAddr` argument must be a connection string with protocol, host, port and database path (e.g.: http://localhost:5984/my-db) or a [nano](https://www.npmjs.com/package/nano) instance.

Available options:

- `retries`: The number of retries or a [retry](https://www.npmjs.org/package/retry) options object, defaults to `{ retries: 5, minTimeout: 200 }`
- `patcher`: A custom patch function (defaults to `(doc, patch) => Object.assign({}, doc, patch)`); note that you shouldn't mutate `doc` or `patch` in this function.
- `create`: Create the document in case it doesn't yet exists (defaults to `true`).
- `doc`: If you already have the document, you may pass it to avoid having to fetch it in the first try (defaults to `null`)
- `nano`: Custom options to be used when creating the [nano]((https://www.npmjs.com/package/nano)) instance, defaults to `null`.


### .bulkInsert(couchdbAddr, [docs], [options])

Forces the insertion of multiple `docs` into the database referenced by `couchdbAddr`.

This operation tries to [bulk](https://wiki.apache.org/couchdb/HTTP_Bulk_Document_API) insert `docs`, retrying the ones that failed with conflict by re-fetching their revisions.

```js
const couchdbForce = require('couchdb-force');

couchdbForce.bulkInsert('http://localhost:5984/my-db', [
    { _id: 'user-1', name: 'André Cruz' },
    { _id: 'user-2', name: 'Marco Oliveira' },
])
.then((docs) => {
    console.log('Bulk insertion successful', docs);
}, (err) => {
    console.log('Bulk insertion failed', err);

    // Because this is a multi operation, errors will be available in `err.errors`
    // which is an object with keys and respective errors
    Object.keys(err.errors).forEach((id) => {
        console.log(`Error inserting ${id}`, err.errors[id]);
    });
});
```

The `couchdbAddr` argument must be a connection string with protocol, host, port and database path (e.g.: http://localhost:5984/my-db) or a [nano](https://www.npmjs.com/package/nano) instance.

Available options:

- `retries`: The number of retries or a [retry](https://www.npmjs.org/package/retry) options object, defaults to `{ retries: 5, minTimeout: 200 }`
- `nano`: Custom options to be used when creating the [nano]((https://www.npmjs.com/package/nano)) instance, defaults to `null`.


### .bulkPatch(couchdbAddr, patches, [options])

Patches the documents referenced `patches` by mixing the store documents with `patches`.

This operation [bulk](https://wiki.apache.org/couchdb/HTTP_Bulk_Document_API) fetches the documents, applies the patches and tries to [bulk](https://wiki.apache.org/couchdb/HTTP_Bulk_Document_API) insert them, retrying the ones that failed with conflict by re-fetching their revisions.


```js
const couchdbForce = require('couchdb-force');

couchdbForce.bulkPatch('http://localhost:5984/my-db', [
    { _id: 'user-1', country: 'pt' },
    { _id: 'user-2', country: 'pt' },
])
}, (err) => {
    console.log('Bulk patch failed', err);

    // Because this is a multi operation, errors will be available in `err.errors`
    // which is an object with keys and respective errors
    Object.keys(err.errors).forEach((id) => {
        console.log(`Error patching ${id}`, err.errors[id]);
    });
});
```

The `couchdbAddr` argument must be a connection string with protocol, host, port and database path (e.g.: http://localhost:5984/my-db) or a [nano](https://www.npmjs.com/package/nano) instance.

Available options:

- `retries`: The number of retries or a [retry](https://www.npmjs.org/package/retry) options object, defaults to `{ retries: 5, minTimeout: 200 }`
- `patcher`: A custom patch function (defaults to `(doc, patch) => Object.assign({}, doc, patch)`); note that you shouldn't mutate `doc` or `patch` in this function.
- `create`: Create the document in case it doesn't yet exists (defaults to `true`).
- `docs`: If you already have the documents, you may pass them to avoid having to fetch them in the first try (defaults to `[]`); the order must be the same as `patches`.
- `nano`: Custom options to be used when creating the [nano]((https://www.npmjs.com/package/nano)) instance, defaults to `null`.


## Tests

`$ npm test`   
`$ npm test-cov` to get coverage report

The tests expect a running CouchDB in `http://localhost:5984` and will create and destroy `couchdb-force-tests` database. You may specify a different address with `COUCHDB`, e.g.: `$ COUCHDB=http://admin:admin@localhost:5984/my-custom-database-for-tests npm test`.


## License

Released under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
