'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const betray = require('betray');
const omit = require('lodash/omit');
const couchdbForce = require('../../');

module.exports = (couchdbAddr, couchdb) => {
    describe('insert()', () => {
        let betrayed;

        beforeEach(() => { betrayed = betray.record(); });
        afterEach(() => betrayed.restoreAll());

        it('should force insert document', () => {
            return Promise.resolve()
            // Test create doc
            .then(() => couchdbForce.insert(couchdbAddr, { _id: 'insert-basic', foo: 'bar' }))
            .then((doc) => {
                expect(doc._rev).to.be.a('string');
                expect(omit(doc, '_rev')).to.eql({ _id: 'insert-basic', foo: 'bar' });

                return couchdb.getAsync('insert-basic')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'insert-basic', foo: 'bar' }));
            })
            // Test update doc
            .then(() => couchdbForce.insert(couchdbAddr, { _id: 'insert-basic', fooo: 'barr' }))
            .then(() => {
                return couchdb.getAsync('insert-basic')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'insert-basic', fooo: 'barr' }));
            })
            // Test update doc, passing wrong rev
            .then(() => couchdbForce.insert(couchdbAddr, {
                _id: 'insert-basic',
                _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e',
                foooo: 'barrr',
            }))
            .then(() => {
                return couchdb.getAsync('insert-basic')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'insert-basic', foooo: 'barrr' }));
            });
        });

        it('should respect custom options.retries', () => {
            const doc = { _id: 'insert-retries', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' };

            return couchdb.insertAsync({ _id: 'insert-retries' })
            // Test retries as number
            .then(() => couchdbForce.insert(couchdbAddr, doc, { retries: 0 }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.contain('update conflict');
                expect(err.error).to.equal('conflict');
                expect(err.reason).to.contain('update conflict');
            })
            // Test retries as object
            .then(() => couchdbForce.insert(couchdbAddr, doc, { retries: { retries: 0 } }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.contain('update conflict');
                expect(err.error).to.equal('conflict');
                expect(err.reason).to.contain('update conflict');
            });
        });

        it('should use nano instance', () => {
            return couchdbForce.insert(couchdb, { _id: 'insert-nano-instance', foo: 'bar' })
            .then(() => {
                return couchdb.getAsync('insert-nano-instance')
                .then((doc) => expect(doc.foo).to.equal('bar'));
            });
        });

        it('should not mutate doc', () => {
            const doc = { _id: 'insert-mutate', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' };

            return couchdb.insertAsync({ _id: 'insert-mutate' })
            .then(() => couchdbForce.insert(couchdbAddr, doc))
            .then(() => {
                expect(doc._rev).to.equal('53-2557b713d3eaede8d3b4c1cd8417f76e');
            });
        });

        it('should fail if couchdb does not point to a db', () => {
            return couchdbForce.insert('http://localhost:5984', { _id: 'insert-no-db' })
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(err.message).to.match(/no database is selected/i);
            });
        });

        it('should fail if couchdb fails when retrieving the doc', () => {
            betrayed(couchdb, 'get', (key, callback) => callback(new Error('foo')));

            return couchdb.insertAsync({ _id: 'insert-get-error' })
            .then(() => couchdbForce.insert(couchdb, { _id: 'insert-get-error' }))
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(err.message).to.equal('foo');
            });
        });

        it('should NOT fail if couchdb fails with `not_found` when retrieving the doc', () => {
            let rev;

            betrayed(couchdb, 'get', (key, callback) => {
                return couchdb.destroyAsync(key, rev)
                .then(() => callback(Object.assign(new Error('missing'), { error: 'not_found', reason: 'missing' })), callback);
            });

            return couchdb.insertAsync({ _id: 'insert-get-not-found' })
            .then((result) => { rev = result.rev; })
            .then(() => couchdbForce.insert(couchdb, { _id: 'insert-get-not-found' }));
        });

        it('should fail if couchdb fails when inserting the doc', () => {
            betrayed(couchdb, 'insert', (key, callback) => callback(new Error('foo')));

            return couchdbForce.insert(couchdb, { _id: 'insert-insert-error' })
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(err.message).to.equal('foo');
            });
        });
    });
};
