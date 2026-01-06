'use strict';

import { assert } from './test_utils.ts';
import * as ldap_convert from '../ldap_convert.ts';

describe('ldap_convert', () => {
    describe('dn convert', () => {
        it ("should work", () => {
            let conv = ldap_convert.dn("ou", "dc=fr")
            assert.equal(conv.toLdap("foo"), "ou=foo,dc=fr");
            assert.equal(conv.fromLdapMulti([ "ou=foo,dc=fr" ]), "foo");
            assert.equal(conv.fromLdapMulti([ "ou=foo," ]), undefined);
            assert.equal(conv.fromLdapMulti([ "ou=foo,dc=fr," ]), undefined);
        });
    });

    const barcode123_valide   = "[type=personnel][source=unicampus@p1ps.fr][domaine=barcode.p1ps.fr][id=123][valide=vrai]"
    const barcode123_invalide = "[type=personnel][source=unicampus@p1ps.fr][domaine=barcode.p1ps.fr][id=123][valide=faux]"
    const barcode124_valide   = "[domaine=barcode.p1ps.fr][id=124][valide=vrai]"
    const barcode124_invalide = "[domaine=barcode.p1ps.fr][id=124][valide=faux]"
    const barcode_autre = "[domaine=foo][id=124][valide=vrai]"
    describe('composite_by_key convert', () => {
        it("should work", () => {
            let conv = ldap_convert.composite_by_key("id", ["[domaine=barcode.p1ps.fr]", "[valide=vrai]"])
            assert.equal(conv.fromLdapMulti([ barcode123_valide ]), "123");
            assert.equal(conv.fromLdapMulti([ barcode_autre, barcode123_valide, barcode124_valide ]), "123");
            assert.equal(conv.fromLdapMulti([ barcode123_invalide ]), null);
            assert.equal(conv.fromLdapMulti([]), null);
        })
    })

    describe('composites_by_key convert', () => {
        it("should work", () => {
            let conv = ldap_convert.composites_by_key("id", ["[domaine=barcode.p1ps.fr]", "[valide=faux]"])
            assert.deepEqual(conv.fromLdapMulti([ barcode123_valide ]), []);
            assert.deepEqual(conv.fromLdapMulti([ barcode123_invalide ]), ["123"]);
            assert.deepEqual(conv.fromLdapMulti([ barcode_autre, barcode123_invalide, barcode124_invalide ]), ["123", "124"]);
            assert.deepEqual(conv.fromLdapMulti([]), []);
        })
    })
});

describe('parse_composite', () => {
    it ("should work", () => {
        let check = (in_: string, wanted: Dictionary<string>) => assert.deepEqual(ldap_convert.parse_composite(in_), wanted);
        check("[foo=bar]", { foo: "bar" });
        check("[role={SUPANN}D30][type={SUPANN}S230][code=DGH]", { role: '{SUPANN}D30', type: '{SUPANN}S230', code: 'DGH' })
    });        
});

const up1Profile_tests = [
    { s: '[a=aaa][b=b1;b2]', parsed: { a: [ 'aaa' ], b: [ 'b1', 'b2' ] } },
    { s: '[a=aaa][b=b1#3bb2]', parsed: { a: [ 'aaa' ], b: [ 'b1;b2' ] } },
    { s: '[a=aaa][b=b1][b=b2]', parsed: { a: [ 'aaa' ], b: [ 'b1', 'b2' ] } },
    { s: '[a#3Ba=aaa]', parsed: { "a;a": [ 'aaa' ] } },
    { s: '[a=#09#09aaa]', parsed: { "a": [ '\t\taaa' ] } },
];

describe('parse_up1Profile', () => {
    it('should work', () => {
        up1Profile_tests.forEach(test => (
            assert.deepEqual(ldap_convert.up1Profile.fromLdapMulti([test.s]), [test.parsed])
        ));
    });
    it('should work with up1Profile_field', () => {
        assert.deepEqual(ldap_convert.up1Profile_field('a').fromLdapMulti(['[a=aaa]']), ['aaa'])
    });
});