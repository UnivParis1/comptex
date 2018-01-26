'use strict';

import { require_fresh, assert } from './test_utils';
import * as test_ldap from './test_ldap';
import * as acl_checker from '../acl_checker';

// get module types:
import * as __acl__ from '../steps/acl';
type acl = typeof __acl__;

let acl: acl;

before(() => (
    test_ldap.create().then(() => {
        acl = require_fresh('../steps/acl');
    })
));

describe('moderators', () => {
    it('should work', () => (
        acl_checker.moderators([ acl.user_id("arigaux") ], undefined).then(l => assert.deepEqual(l, [ 'ayme.rigaux@univ-paris1.fr' ]))
    ))
    it('should work on empty case', () => (
        acl_checker.moderators([], undefined).then(l => assert.deepEqual(l, []))
    ))
    it('should work on multiple users', () => (
        acl_checker.moderators([ acl.user_id("arigaux"), acl.user_id("prigaux"), acl.user_id("arigaux") ], undefined).then(l => assert.deepEqual(l, [ 'ayme.rigaux@univ-paris1.fr', 'ayme.rigaux@univ-paris1.fr' ]))
    ))
});

describe('step_acls_allowed_ssubvs', () => {
    let steps;
    before(() => steps = { 
        "xxx": { acls: [ acl.user_id("arigaux") ], labels: undefined },
    });

    it('should work', () => (
        acl_checker.allowed_ssubvs({ mail: "ayme.rigaux@univ-paris1.fr" } as v, steps).then(ssubvs => assert.deepEqual(ssubvs, [ 
            { step: 'xxx', subvs: [{}] },
        ]))
    ))
    it('should deny', () => (
        acl_checker.allowed_ssubvs({ mail: "pascal.rigaux@univ-paris1.fr" } as v, steps).then(ssubvs => assert.deepEqual(ssubvs, []))
    ))
});

describe('mongo_query', () => {
    it('should work', () => {
        const allowed_ssubvs = [ { step: "import", subvs: [{"structureParrain":"DGH"}]}];
        assert.deepEqual(acl_checker.mongo_query(allowed_ssubvs), { step: 'import', "v.structureParrain":"DGH" } );
    });
    it('should handle choices', () => {
        const allowed_ssubvs = [ 
            {step: "extern", subvs: [{}]}, 
            {step: "import", subvs: [{"structureParrain":"DGHA"},{"structureParrain":"DGH"}]},
        ];
        assert.deepEqual(acl_checker.mongo_query(allowed_ssubvs), { '$or': [ { step: 'extern' }, { step: 'import', '$or': [{"v.structureParrain":"DGHA"},{"v.structureParrain":"DGH"}] } ] });
    });
    it('should query multiple vals', () => {
        const allowed_ssubvs = [ { step: "import", subvs: [{"structureParrain":"DGH", "profilename": "xx"}]}];
        assert.deepEqual(acl_checker.mongo_query(allowed_ssubvs), { step: 'import', "v.structureParrain":"DGH", "v.profilename": "xx" } );
    });
});