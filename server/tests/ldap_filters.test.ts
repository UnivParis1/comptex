import { assert } from './test_utils';
import { filters } from '../ldap';

describe('ldap filters', () => {
    describe('eq', () => {
        it("should escape", () => {
            assert.equal(filters.eq("a", "* b"), "(a=\\2a b)");
            assert.equal(filters.eq("a", "(b=c)"), "(a=\\28b=c\\29)");

            // https://www.owasp.org/index.php/Testing_for_LDAP_Injection_(OTG-INPVAL-006)
            const user = '*)(uid=*))(|(uid=*';
            const base64 = 'xxx';
            assert.equal(filters.and([ filters.eq("uid", user), filters.eq('userPassword', "{MD5}" + base64) ]),
                         "(&(uid=\\2a\\29\\28uid=\\2a\\29\\29\\28|\\28uid=\\2a)(userPassword={MD5}xxx))");
        });

    });

    describe('alike_same_accents', () => {
        it("should not escape *", () => {
            assert.equal(filters.alike_same_accents("a", "*b"), "(a=*b)");
        });
        it("should not need escape", () => {
            assert.equal(filters.alike_same_accents("a", "(b=c)\\"), "(a=*b*c*)");
        });
    });

});