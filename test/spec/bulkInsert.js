'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const betray = require('betray');
const omit = require('lodash/omit');
const couchdbForce = require('../../');

module.exports = (couchdbAddr, couchdb) => {
    describe('bulkInsert()', () => {
        let betrayed;

        beforeEach(() => { betrayed = betray.record(); });
        afterEach(() => betrayed.restoreAll());

        it('should force insert documents', () => {
            return Promise.resolve()
            // Test create docs
            .then(() => couchdbForce.bulkInsert(couchdbAddr, [
                { _id: 'bulk-insert-basic-1', foo: 'bar' },
                { _id: 'bulk-insert-basic-2', fooo: 'barr' },
            ]))
            .then((docs) => {
                expect(docs).to.have.length(2);
                expect(docs[0]._rev).to.be.a('string');
                expect(docs[1]._rev).to.be.a('string');
                expect(omit(docs[0], '_rev')).to.eql({ _id: 'bulk-insert-basic-1', foo: 'bar' });
                expect(omit(docs[1], '_rev')).to.eql({ _id: 'bulk-insert-basic-2', fooo: 'barr' });

                return couchdb.getAsync('bulk-insert-basic-1')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-insert-basic-1', foo: 'bar' }))
                .then(() => couchdb.getAsync('bulk-insert-basic-2'))
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-insert-basic-2', fooo: 'barr' }));
            })
            // Test update docs
            .then(() => couchdbForce.bulkInsert(couchdbAddr, [
                { _id: 'bulk-insert-basic-1', fooo: 'barr' },
                { _id: 'bulk-insert-basic-2', foooo: 'barrr' },
            ]))
            .then(() => {
                return couchdb.getAsync('bulk-insert-basic-1')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-insert-basic-1', fooo: 'barr' }))
                .then(() => couchdb.getAsync('bulk-insert-basic-2'))
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-insert-basic-2', foooo: 'barrr' }));
            })
            // Test update doc, passing wrong rev
            .then(() => couchdbForce.bulkInsert(couchdbAddr, [
                { _id: 'bulk-insert-basic-1', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e', foooo: 'barrr' },
                { _id: 'bulk-insert-basic-2', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e', fooooo: 'barrrr' },
            ]))
            .then(() => {
                return couchdb.getAsync('bulk-insert-basic-1')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-insert-basic-1', foooo: 'barrr' }))
                .then(() => couchdb.getAsync('bulk-insert-basic-2'))
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-insert-basic-2', fooooo: 'barrrr' }));
            });
        });

        it('should respect custom options.retries', () => {
            const doc = { _id: 'bulk-insert-retries', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' };

            return couchdb.insertAsync({ _id: 'bulk-insert-retries' })
            // Test retries as number
            .then(() => couchdbForce.bulkInsert(couchdbAddr, [doc], { retries: 0 }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/failed to bulk.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);

                const docError = err.errors['bulk-insert-retries'];

                expect(docError.message).to.contain('update conflict');
                expect(docError.error).to.equal('conflict');
                expect(docError.reason).to.contain('update conflict');
            })
            // Test retries as object
            .then(() => couchdbForce.bulkInsert(couchdbAddr, [doc], { retries: { retries: 0 } }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/failed to bulk.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);

                const docError = err.errors['bulk-insert-retries'];

                expect(docError.message).to.contain('update conflict');
                expect(docError.error).to.equal('conflict');
                expect(docError.reason).to.contain('update conflict');
            });
        });

        it('should use nano instance', () => {
            return couchdbForce.bulkInsert(couchdb, [{ _id: 'bulk-insert-nano-instance', foo: 'bar' }])
            .then(() => {
                return couchdb.getAsync('insert-nano-instance')
                .then((doc) => expect(doc.foo).to.equal('bar'));
            });
        });

        it('should not mutate docs', () => {
            const docs = [{ _id: 'insert-mutate', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' }];

            return couchdb.insertAsync({ _id: 'bulk-insert-mutate' })
            .then(() => couchdbForce.bulkInsert(couchdbAddr, docs))
            .then(() => {
                expect(docs).to.have.length(1);
                expect(docs[0]._rev).to.equal('53-2557b713d3eaede8d3b4c1cd8417f76e');
            });
        });

        it('should fail if couchdb does not point to a db', () => {
            return couchdbForce.bulkInsert('http://localhost:5984', [{ _id: 'bulk-insert-no-db' }])
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(err.message).to.match(/failed.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);
                expect(err.errors['bulk-insert-no-db'].message).to.match(/no database is selected/i);
            });
        });

        it('should fail if couchdb fails when inserting the doc (non-conflict)', () => {
            const betrayBulk = betrayed(couchdb, 'bulk', (key, callback) => callback(null, [
                { id: 'bulk-insert-insert-error', error: 'foo', reason: 'bar' },
            ]));

            return couchdbForce.bulkInsert(couchdb, [{ _id: 'bulk-insert-insert-error' }])
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(betrayBulk.invoked).to.equal(1);
                expect(err.message).to.match(/failed.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);

                const docError = err.errors['bulk-insert-insert-error'];

                expect(docError.message).to.equal('bar');
                expect(docError.error).to.equal('foo');
                expect(docError.reason).to.equal('bar');
            });
        });

        it('should maintain the input order', () => {
            return couchdb.insertAsync({ _id: 'bulk-insert-input-order-2' })
            .then(() => couchdbForce.bulkInsert(couchdbAddr, [
                { _id: 'bulk-insert-input-order-1' },
                { _id: 'bulk-insert-input-order-2', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' },
            ]))
            .then((docs) => {
                expect(docs).to.have.length(2);
                expect(docs.map((doc) => doc._id)).to.eql(['bulk-insert-input-order-1', 'bulk-insert-input-order-2']);
            });
        });
    });
};
