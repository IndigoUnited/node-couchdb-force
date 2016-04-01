'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const betray = require('betray');
const omit = require('lodash/omit');
const couchdbForce = require('../../');

module.exports = (couchdbAddr, couchdb) => {
    describe('bulkPatch()', () => {
        let betrayed;

        beforeEach(() => { betrayed = betray.record(); });
        afterEach(() => betrayed.restoreAll());

        it('should force patch document', () => {
            return Promise.resolve()
            // Test create docs
            .then(() => couchdbForce.bulkPatch(couchdbAddr, [
                { _id: 'bulk-patch-basic-1', foo: 'bar' },
                { _id: 'bulk-patch-basic-2', fooo: 'barr' },
            ]))
            .then((docs) => {
                expect(docs).to.have.length(2);
                expect(docs[0]._rev).to.be.a('string');
                expect(docs[1]._rev).to.be.a('string');
                expect(omit(docs[0], '_rev')).to.eql({ _id: 'bulk-patch-basic-1', foo: 'bar' });
                expect(omit(docs[1], '_rev')).to.eql({ _id: 'bulk-patch-basic-2', fooo: 'barr' });

                return couchdb.getAsync('bulk-patch-basic-1')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-patch-basic-1', foo: 'bar' }))
                .then(() => couchdb.getAsync('bulk-patch-basic-2'))
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-patch-basic-2', fooo: 'barr' }));
            })
            // Test patch docs
            .then(() => couchdbForce.bulkPatch(couchdbAddr, [
                { _id: 'bulk-patch-basic-1', foo: 'baz', fooo: 'barr' },
                { _id: 'bulk-patch-basic-2', fooo: 'bazz', foooo: 'barrr' },
            ]))
            .then(() => {
                return couchdb.getAsync('bulk-patch-basic-1')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-patch-basic-1', foo: 'baz', fooo: 'barr' }))
                .then(() => couchdb.getAsync('bulk-patch-basic-2'))
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'bulk-patch-basic-2', fooo: 'bazz', foooo: 'barrr' }));
            });
        });

        it('should fail if patches contains _rev', () => {
            return couchdbForce.bulkPatch(couchdbAddr, [{ _id: 'bulk-patch-rev', _rev: 'not-allowed', foo: 'bar' }])
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/rev/i);
            });
        });

        it('should not create document if options.create is false', () => {
            return couchdbForce.bulkPatch(couchdbAddr, [{ _id: 'bulk-patch-create', foo: 'bar' }], { create: false })
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/failed.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);
                expect(err.errors['bulk-patch-create'].error).to.equal('not_found');
            });
        });

        it('should use options.docs to avoid having to fetch the documents', () => {
            // Insert doc & fetch it
            return couchdb.insertAsync({ _id: 'bulk-patch-docs-1', foo: 'bar' })
            .then(() => couchdb.getAsync('bulk-patch-docs-1'))
            // Patch it, passing the doc and test if get was called
            .then((doc) => {
                const betrayFetch = betrayed(couchdb, 'fetch');

                return couchdbForce.bulkPatch(couchdb, [
                    { _id: 'bulk-patch-docs-1', fooo: 'barr' },
                    { _id: 'bulk-patch-docs-2', fooo: 'barr' },
                ], { docs: [doc, null] })
                .then(() => Promise.all([
                    couchdb.getAsync('bulk-patch-docs-1'),
                    couchdb.getAsync('bulk-patch-docs-2'),
                ]))
                .then((docs) => {
                    expect(docs[0]).to.have.keys('_id', '_rev', 'foo', 'fooo');
                    expect(omit(docs[0], '_rev')).to.eql({ _id: 'bulk-patch-docs-1', foo: 'bar', fooo: 'barr' });
                    expect(docs[1]).to.have.keys('_id', '_rev', 'fooo');
                    expect(omit(docs[1], '_rev')).to.eql({ _id: 'bulk-patch-docs-2', fooo: 'barr' });

                    expect(betrayFetch.invoked).to.equal(1);
                    expect(betrayFetch.invocations[0][0]).to.eql({ keys: ['bulk-patch-docs-2'] });
                });
            });
        });

        it('should work if options.docs contains a wrong rev', () => {
            return couchdb.insertAsync({ _id: 'bulk-patch-doc-wrong-rev', foo: 'bar' })
            .then(() => couchdbForce.bulkPatch(couchdb, [{ _id: 'bulk-patch-doc-wrong-rev', fooo: 'barr' }], {
                docs: [{ _id: 'bulk-patch-doc-wrong-rev', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' }],
            }))
            .then((docs) => {
                expect(docs).to.have.length(1);
                expect(omit(docs[0], '_rev')).to.eql({ _id: 'bulk-patch-doc-wrong-rev', foo: 'bar', fooo: 'barr' });
            });
        });

        it('should use custom options.patcher', () => {
            return couchdbForce.bulkPatch(couchdbAddr, [{ _id: 'bulk-patch-patcher', foo: 'bar' }], {
                patcher: (doc, patch) => {
                    expect(doc).to.eql({ _id: 'bulk-patch-patcher' });
                    expect(patch).to.eql({ _id: 'bulk-patch-patcher', foo: 'bar' });

                    return { _id: 'bulk-patch-patcher', fooo: 'barr' };
                },
            })
            .then(() => {
                return couchdb.getAsync('bulk-patch-patcher')
                .then((doc) => {
                    expect(doc).to.have.keys('_id', '_rev', 'fooo');
                    expect(doc.fooo).to.equal('barr');
                });
            });
        });

        it('should respect custom options.retries', () => {
            const doc = { _id: 'bulk-patch-retries', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' };

            return couchdb.insertAsync({ _id: 'bulk-patch-retries' })
            // Test retries as number
            .then(() => couchdbForce.bulkPatch(couchdbAddr, [{ _id: 'bulk-patch-retries' }], { retries: 0, docs: [doc] }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/failed.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);

                const docError = err.errors['bulk-patch-retries'];

                expect(docError.message).to.contain('update conflict');
                expect(docError.error).to.equal('conflict');
                expect(docError.reason).to.contain('update conflict');
            })
            // Test retries as object
            .then(() => couchdbForce.bulkPatch(couchdbAddr, [{ _id: 'bulk-patch-retries' }], { retries: { retries: 0 }, docs: [doc] }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/failed.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);

                const docError = err.errors['bulk-patch-retries'];

                expect(docError.message).to.contain('update conflict');
                expect(docError.error).to.equal('conflict');
                expect(docError.reason).to.contain('update conflict');
            });
        });

        it('should use nano instance', () => {
            return couchdbForce.bulkPatch(couchdb, [{ _id: 'bulk-patch-nano-instance', foo: 'bar' }])
            .then(() => {
                return couchdb.getAsync('bulk-patch-nano-instance')
                .then((doc) => expect(doc.foo).to.equal('bar'));
            });
        });

        it('should fail if couchdb does not point to a db', () => {
            return couchdbForce.bulkPatch('http://localhost:5984', [{ _id: 'bulk-patch-no-db' }])
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(err.message).to.match(/failed.+1/i);
                expect(Object.keys(err.errors)).to.have.length(1);
                expect(err.errors['bulk-patch-no-db'].message).to.match(/no database is selected/i);
            });
        });

        it('should maintain the input order', () => {
            return couchdb.insertAsync({ _id: 'bulk-patch-input-order-2' })
            .then(() => couchdbForce.bulkPatch(couchdbAddr, [
                { _id: 'bulk-patch-input-order-1' },
                { _id: 'bulk-patch-input-order-2' },
            ], { docs: [
                null,
                { _id: 'bulk-patch-input-order-2', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' },
            ] }))
            .then((docs) => {
                expect(docs).to.have.length(2);
                expect(docs.map((doc) => doc._id)).to.eql(['bulk-patch-input-order-1', 'bulk-patch-input-order-2']);
            });
        });
    });
};
