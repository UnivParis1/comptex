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

    describe('withEtiquetteAndMaybeNote', () => {
        it("toLdap should work", () => {
            const { aaa, aaa_note } = ldap_convert.withEtiquetteAndMaybeNote({ attr: "aaa", attr2: "aaa_note", etiquette: "https://univ.fr/aaa=", separator: "/note=" })
            const aaa_action = aaa.convert.toLdap("foo") as ldap_modify            
            assert.equal(typeof aaa_action.action, "function")
            if (typeof aaa_action.action === "function") {
                assert.equal(aaa_action.late, undefined)
                assert.deepEqual(aaa_action.action([]), ["https://univ.fr/aaa=foo"])
                assert.deepEqual(aaa_action.action(['https://univ.fr/aaa=bar']), ["https://univ.fr/aaa=foo"])
                assert.deepEqual(aaa_action.action(['https://univ.fr/bbb=foo']), ['https://univ.fr/bbb=foo', "https://univ.fr/aaa=foo"])
            }

            const aaa_note_action = aaa_note.convert.toLdap("Note") as ldap_modify            
            assert.equal(typeof aaa_note_action.action, "function")
            if (typeof aaa_note_action.action === "function") {
                assert.equal(aaa_note_action.late, true)
                assert.deepEqual(aaa_note_action.action([]), [])
                assert.deepEqual(aaa_note_action.action(['https://univ.fr/bbb=foo']), ['https://univ.fr/bbb=foo'])
                assert.deepEqual(aaa_note_action.action(['https://univ.fr/aaa=foo']), ["https://univ.fr/aaa=foo/note=Note"])
            }
        });

        it("toLdap should handle encoding", () => {
            const { aaa, aaa_note } = ldap_convert.withEtiquetteAndMaybeNote({ attr: "aaa", attr2: "aaa_note", etiquette: "https://univ.fr/aaa=", separator: "/note=", encoding: 'urlencoding' })
            const aaa_action = aaa.convert.toLdap("foo bar") as ldap_modify            
            assert.equal(typeof aaa_action.action, "function")
            if (typeof aaa_action.action === "function") {
                assert.deepEqual(aaa_action.action([]), ["https://univ.fr/aaa=foo%20bar"])
            }

            const aaa_note_action = aaa_note.convert.toLdap("Note foo") as ldap_modify            
            assert.equal(typeof aaa_note_action.action, "function")
            if (typeof aaa_note_action.action === "function") {
                assert.deepEqual(aaa_note_action.action(['https://univ.fr/aaa=foo']), ["https://univ.fr/aaa=foo/note=Note%20foo"])
            }
        });

        it("fromLdap should work", () => {
            const { aaa, aaa_note } = ldap_convert.withEtiquetteAndMaybeNote({ attr: "aaa", attr2: "aaa_note", etiquette: "https://univ.fr/aaa=", separator: "/note=", encoding: 'urlencoding' })
            assert.equal(aaa.convert.fromLdapMulti(["https://univ.fr/aaa=foo"]), "foo")
            assert.equal(aaa.convert.fromLdapMulti(["https://univ.fr/aaa=foo/note=Note"]), "foo")
            assert.equal(aaa.convert.fromLdapMulti(["https://univ.fr/aaa=foo%20bar/note=Note"]), "foo bar")
            assert.equal(aaa_note.convert.fromLdapMulti(["https://univ.fr/aaa=foo"]), undefined)
            assert.equal(aaa_note.convert.fromLdapMulti(["https://univ.fr/aaa=foo/note=Note"]), "Note")
            assert.equal(aaa_note.convert.fromLdapMulti(["https://univ.fr/aaa=foo/note=Note%20foo"]), "Note foo")
        });
    })

    describe('withNoteOnSpecialEtiquette', () => {
        it("toLdap should work", () => {
            const { aaa, aaa_note } = ldap_convert.withNoteOnSpecialEtiquette({ attr: "aaa", attr2: "aaa_note", etiquette: "{AUTRE}" })
            assert.equal(aaa.convert.toLdap("{FOO}bar"), "{FOO}bar")
            assert.equal(aaa.convert.toLdap("{AUTRE}"), "{AUTRE}")

            const aaa_note_action = aaa_note.convert.toLdap("Note") as ldap_modify            
            assert.equal(typeof aaa_note_action.action, "function")
            if (typeof aaa_note_action.action === "function") {
                assert.equal(aaa_note_action.late, true)
                assert.deepEqual(aaa_note_action.action([]), [])
                assert.deepEqual(aaa_note_action.action(['{FOO}bar']), ["{FOO}bar"])
                assert.deepEqual(aaa_note_action.action(['{AUTRE}']), ['{AUTRE}Note'])
                assert.deepEqual(aaa_note_action.action(['{AUTRE}', '{FOO}bar']), ['{AUTRE}Note', '{FOO}bar'])
            }
        });

        it("fromLdap should work", () => {
            const { aaa, aaa_note } = ldap_convert.withNoteOnSpecialEtiquette({ attr: "aaa", attr2: "aaa_note", etiquette: "{AUTRE}" })
            assert.equal(aaa.convert.fromLdap("{FOO}bar"), "{FOO}bar")
            assert.equal(aaa.convert.fromLdap("{AUTRE}Note"), "{AUTRE}") 
            assert.equal(aaa_note.convert.fromLdap("{FOO}bar"), undefined)
            assert.equal(aaa_note.convert.fromLdap("{AUTRE}Note"), "Note")
        });
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