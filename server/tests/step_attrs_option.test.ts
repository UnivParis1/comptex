import { assert } from './test_utils';
import { merge_v, exportAttrs, export_v, selectUserProfile } from '../step_attrs_option';

describe('exportAttrs', () => {
    it("should work", () => {
        assert.deepEqual(exportAttrs({ sn: {} }), { sn: {} });
        assert.deepEqual(exportAttrs({ sn: { readonly: true, max: 11 } }), { sn: { readonly: true, max: 11 } });
    });
    it("should handle hidden", () => {
        assert.deepEqual(exportAttrs({ sn: { hidden: true } }), {});
    });
    it("should handle toUserOnly", () => {
        assert.deepEqual(exportAttrs({ sn: { toUserOnly: true } }), { sn: { optional: true, readonly: true }});
        assert.deepEqual(exportAttrs({ sn: { toUserOnly: true, max: 22 } }), { sn: { optional: true, readonly: true, max: 22 }});
    });
});

describe('export_v', () => {
    function test(attrs, v, wanted_v) {
        assert.deepEqual(export_v(attrs, v), wanted_v);
    }
    const v = { sn: "new" } as any;

    it("should export wanted attrs", () => {
        test({ sn: {} }, v, v);
        test({ sn: { toUserOnly: true } }, v, v);
        test({ sn: { readonly: true } }, v, v);
    });
    it("should hide attrs", () => {
        test({ sn: { hidden: true } }, v, {});
        test({}, v, {});
    });
    it("should handle sub", () => {
        const attrs = { duration: { choices: [
            { key: "1", sub: { sn: {} } }, 
            { key: "2" },
        ] } }
        test(attrs, { duration: "2", sn: "Rigaux" }, { duration: "2", sn: "Rigaux" });
        test(attrs, { duration: "1", sn: "Rigaux" }, { duration: "1", sn: "Rigaux" });
    });
});

describe('merge_v', () => {
    function test(attrs, prev, v, wanted_v) {
        let v_ = merge_v(attrs, prev, v);
        delete v_.various;
        assert.deepEqual(v_, wanted_v);
    }
    
    function test_fail(attrs, prev, v, wanted_err) {
        try {
            merge_v(attrs, prev, v);
            assert.fail("should raise error");
        } catch (err) {
            assert.equal(err, wanted_err);
        }
    }
    const prev = { sn: "old" } as any;
    const v = { sn: "new" } as any;
    it("should merge from v", () => {
        test({ sn: { optional: true } }, prev, v, v);
    });
    it("should skip not wanted attrs", () => {
        test({}, prev, v, {});
        test({ sn: { optional: true, toUserOnly: true } }, prev, v, {});
    });
    it("should merge from prev", () => {
        test({ sn: { optional: true, hidden: true } }, prev, v, prev);
        test({ sn: { optional: true, readonly: true } }, prev, v, prev);
    });
    it ("should not validate toUserOnly", () => {
        test({ sn: { toUserOnly: true } }, {}, {}, {});
    });
    it ("should not validate prev", () => {
        test({ sn: { readonly: true } }, {}, {}, {});
        test({ sn: { hidden: true } }, {}, {}, {});
    });
    it ("should validate required", () => {
        test_fail({ sn: {} }, {}, {}, "constraint !sn.optional failed for undefined");
        test_fail({ sn: {} }, {}, { sn: '' }, "constraint !sn.optional failed for ");
        test_fail({ sn: {} }, prev, {}, "constraint !sn.optional failed for undefined");
        test_fail({ sn: {} }, {}, { sn: null }, "constraint !sn.optional failed for null");
        test({ sn: {} }, prev, v, v);
        test({ sn: {} }, {}, { sn: new Date('2017-01-31') }, { sn: new Date('2017-01-31') });
    });
    it ("should check pattern", () => {
        test({ sn: { pattern: "x" } }, {}, { sn: 'x' }, { sn: 'x' });
        test_fail({ sn: { pattern: "x" } }, {}, { sn: 'X' }, "constraint sn.pattern x failed for X");
    });
    it ("should not check pattern if optional and value is empty", () => {
        test({ sn: { optional: true, pattern: "x" } }, {}, {}, {});
        test({ sn: { optional: true, pattern: "x" } }, {}, { sn: '' }, { sn: '' });
    });
    it ("should check array", () => {
        test_fail({ altGivenName: { items: {} } }, {}, {}, 'constraint !altGivenName.optional failed for undefined');
        test_fail({ altGivenName: { items: {} } }, {}, { altGivenName: 'x' }, 'constraint altGivenName is array failed for x');
        test_fail({ altGivenName: { items: {}, optional: true } }, {}, { altGivenName: 'x' }, 'constraint altGivenName is array failed for x');
        test_fail({ altGivenName: { items: {} } }, {}, { altGivenName: [] }, 'constraint !altGivenName.optional failed for ');
        test({ altGivenName: { items: {}, optional: true } }, {}, {}, {});
        test({ altGivenName: { items: {}, optional: true } }, {}, { altGivenName: [] }, { altGivenName: [] });
        test({ altGivenName: { items: {} } }, {}, { altGivenName: ["x"] }, { altGivenName: ["x"] });
    });
    it ("should check choices", () => {
        const attrs = { duration: { choices: [ { key: "1" } ] } };
        test(attrs, {}, { duration: "1" }, { duration: "1" });
        test_fail(attrs, {}, { duration: "2" }, "constraint duration.choices 1 failed for 2");
    });
    it ("should handle sub", () => {
        const attrs = { duration: { choices: [ 
            { key: "1", sub: { sn: {} } }, 
            { key: "2" },
        ] } };
        test(attrs, {}, { sn: 'x', duration: "1" }, { duration: "1", sn: 'x' });
        test(attrs, {}, { sn: 'x', duration: "2" }, { duration: "2" }); // sn not allowed, it is removed
        test_fail(attrs, {}, { duration: '1' }, "constraint !sn.optional failed for undefined");
    });
});

describe('compute_diff', () => {
    function test(attrs, prev, current, wanted_diff) {
        let v_ = merge_v(attrs, prev, current);
        assert.deepEqual(v_.various.diff, wanted_diff);
    }

    const attrs_sn = { sn: { optional: true }};

    it("should handle no change", () => {
        test(attrs_sn, { sn: "Rigaux" }, { sn: "Rigaux" }, {});
    });
    it("should handle simple change", () => {
        test(attrs_sn, { sn: "Rigaud" }, { sn: "Rigaux" }, { sn: { prev: "Rigaud", current: "Rigaux" }});
    });
    it("should handle simple creation", () => {
        test(attrs_sn, {}, { sn: "Rigaux" }, { sn: { prev: '', current: "Rigaux" }});
    });
    it("should handle simple removal", () => {
        test(attrs_sn, { sn: "Rigaux" }, { sn: '' }, { sn: { prev: "Rigaux", current: '' }});
    });
    it("should handle array", () => {
        test(attrs_sn, { sn: ["Rigaux"] }, { sn: ["Rigaux"] }, {});
        test(attrs_sn, {}, { sn: ["Rigaux"] }, { sn: { prev: '', current: 'Rigaux' } });
    });

    it("should ignore non required attrs", () => {
        test({}, { sn: "Rigaux" }, {}, {});
        test({}, {}, { sn: "Rigaux" }, {});
    });
    
});

describe('selectUserProfile', () => {
    const profileA = { profilename: "A", sn: "Foo" };
    const profileB = { profilename: "B", sn: "Bar", givenName: "Boo", supannRoleEntite: ["role1"] };
    it("should handle simple up1Profile", () => {
        const v = { up1Profile: [ profileA ] } as v;
        assert.deepEqual(selectUserProfile(v, 'A'), { ...profileA, ...v });
    });

    it("should handle choose in up1Profile", () => {
        const v = { up1Profile: [ profileA, profileB ] } as v;
        assert.deepEqual(selectUserProfile(v, 'A'), { ...profileA, ...v });
        assert.deepEqual(selectUserProfile(v, 'B'), { ...profileB, ...v });
    });

    it("should merge with non-profiled", () => {
        const v = { pager: "060102030405", up1Profile: [ profileA, profileB ] } as v;
        assert.deepEqual(selectUserProfile(v, 'A'), { ...profileA, ...v });
    });

    it("should not keep other profiled attrs from other profiles", () => {
        const v = { up1Profile: [ profileA, profileB ] } as v;
        assert.deepEqual(selectUserProfile({ ...v, givenName: "Boo" }, 'A'), { ...profileA, ...v });
        assert.deepEqual(selectUserProfile({ ...v, givenName: "Zoo" }, 'A'), { ...profileA, ...v, givenName: "Zoo" });
        assert.deepEqual(selectUserProfile({ ...v, supannRoleEntite: ["role1"] }, 'A'), { ...profileA, ...v, supannRoleEntite: [] });
        assert.deepEqual(selectUserProfile({ ...v, supannRoleEntite: ["role1", "role2"] }, 'A'), { ...profileA, ...v, supannRoleEntite: ["role2"] });
    });
})