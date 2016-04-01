'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const betray = require('betray');
const omit = require('lodash/omit');
const couchdbForce = require('../../');

module.exports = (couchdbAddr, couchdb) => {
    describe('patch()', () => {
        let betrayed;

        beforeEach(() => { betrayed = betray.record(); });
        afterEach(() => betrayed.restoreAll());

        it('should force patch document', () => {
            return Promise.resolve()
            // Test create doc
            .then(() => couchdbForce.patch(couchdbAddr, { _id: 'patch-basic', foo: 'bar' }))
            .then((doc) => {
                expect(doc._rev).to.be.a('string');
                expect(omit(doc, '_rev')).to.eql({ _id: 'patch-basic', foo: 'bar' });

                return couchdb.getAsync('patch-basic')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'patch-basic', foo: 'bar' }));
            })
            // Test patch doc
            .then(() => couchdbForce.patch(couchdbAddr, { _id: 'patch-basic', foo: 'baz', fooo: 'barr' }))
            .then(() => {
                return couchdb.getAsync('patch-basic')
                .then((doc) => expect(omit(doc, '_rev')).to.eql({ _id: 'patch-basic', foo: 'baz', fooo: 'barr' }));
            });
        });

        it('should fail if patch contains _rev', () => {
            return couchdbForce.patch(couchdbAddr, { _id: 'patch-rev', _rev: 'not-allowed', foo: 'bar' })
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/rev/i);
            });
        });

        it('should not create document if options.create is false', () => {
            return couchdbForce.patch(couchdbAddr, { _id: 'patch-create', foo: 'bar' }, { create: false })
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.match(/missing/i);
                expect(err.error).to.equal('not_found');
            });
        });

        it('should use options.doc to avoid having to fetch the document', () => {
            // Insert doc & fetch it
            return couchdb.insertAsync({ _id: 'patch-doc', foo: 'bar' })
            .then(() => couchdb.getAsync('patch-doc'))
            // Patch it, passing the doc and test if get was called
            .then((doc) => {
                const betrayGet = betrayed(couchdb, 'get');

                return couchdbForce.patch(couchdb, { _id: 'patch-doc', fooo: 'barr' }, { doc })
                .then(() => betrayGet.restore())
                .then(() => couchdb.getAsync('patch-doc'))
                .then((doc) => {
                    expect(doc).to.have.keys('_id', '_rev', 'foo', 'fooo');
                    expect(omit(doc, '_rev')).to.eql({ _id: 'patch-doc', foo: 'bar', fooo: 'barr' });
                    expect(betrayGet.invoked).to.equal(0);
                });
            });
        });

        it('should work if options.doc contain a wrong rev', () => {
            return couchdb.insertAsync({ _id: 'patch-doc-wrong-rev', foo: 'bar' })
            .then(() => couchdbForce.patch(couchdb, { _id: 'patch-doc-wrong-rev', fooo: 'barr' }, {
                doc: { _id: 'patch-doc-wrong-rev', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' },
            }))
            .then((doc) => {
                expect(omit(doc, '_rev')).to.eql({ _id: 'patch-doc-wrong-rev', foo: 'bar', fooo: 'barr' });
            });
        });

        it('should use custom options.patcher', () => {
            return couchdbForce.patch(couchdbAddr, { _id: 'patch-patcher', foo: 'bar' }, {
                patcher: (doc, patch) => {
                    expect(doc).to.eql({ _id: 'patch-patcher' });
                    expect(patch).to.eql({ _id: 'patch-patcher', foo: 'bar' });

                    return { _id: 'patch-patcher', fooo: 'barr' };
                },
            })
            .then(() => {
                return couchdb.getAsync('patch-patcher')
                .then((doc) => {
                    expect(doc).to.have.keys('_id', '_rev', 'fooo');
                    expect(doc.fooo).to.equal('barr');
                });
            });
        });

        it('should respect custom options.retries', () => {
            const doc = { _id: 'patch-retries', _rev: '53-2557b713d3eaede8d3b4c1cd8417f76e' };

            return couchdb.insertAsync({ _id: 'patch-retries' })
            // Test retries as number
            .then(() => couchdbForce.patch(couchdbAddr, { _id: 'patch-retries' }, { retries: 0, doc }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.contain('update conflict');
                expect(err.error).to.equal('conflict');
                expect(err.reason).to.contain('update conflict');
            })
            // Test retries as object
            .then(() => couchdbForce.patch(couchdbAddr, { _id: 'patch-retries' }, { retries: { retries: 0 }, doc }))
            .then(() => {
                throw new Error('Should have failed');
            }, (err) => {
                expect(err.message).to.contain('update conflict');
                expect(err.error).to.equal('conflict');
                expect(err.reason).to.contain('update conflict');
            });
        });

        it('should use nano instance', () => {
            return couchdbForce.insert(couchdb, { _id: 'patch-nano-instance', foo: 'bar' })
            .then(() => {
                return couchdb.getAsync('patch-nano-instance')
                .then((doc) => expect(doc.foo).to.equal('bar'));
            });
        });

        it('should fail if couchdb does not point to a db', () => {
            return couchdbForce.patch('http://localhost:5984', { _id: 'patch-no-db' })
            .then(() => {
                throw new Error('Expected to fail');
            }, (err) => {
                expect(err.message).to.match(/no database is selected/i);
            });
        });
    });
};
