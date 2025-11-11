import { assert } from '../test_utils.ts'
import { handle_attrs_cond_overrides } from '../../steps/attrs_override.ts'
import type { MoreAttrOption_cond_overrides } from '../../steps/attrs_override.ts'

type StepAttrOption_ = StepAttrOptionT<MoreAttrOption_cond_overrides>
export type StepAttrsOption_ = Dictionary<StepAttrOption_>

type one_test = { 
    conds: Dictionary<(v: v) => boolean>, 
    with_conds: StepAttrsOption_, 
    expected_without_conds: StepAttrsOption, 
    v: v, 
    expected_overrides: StepAttrsOption,
}

describe('handle_attrs_cond_overrides', () => {

    const test = async ({ conds, with_conds, expected_without_conds, v, expected_overrides } : one_test) => {
        const { attrs, attrs_override } = await handle_attrs_cond_overrides(conds)(with_conds)
        assert.deepEqual(attrs, expected_without_conds);
        assert.deepEqual(await attrs_override(undefined, { step: undefined, v, history: [] }), expected_overrides)
    }

    const conds: Dictionary<(v: v) => boolean> = { 
        foo: (v) => !!v.givenName,
    }

    it("should work", async () => {
        const test1: one_test = {
            conds, 
            with_conds: { 
                sn: { 
                    title: "SN",
                    cond_overrides: { foo: (null as any) },
                },
            }, 
            expected_without_conds: { 
                sn: { title: "SN" }
            },
            v: { givenName: "Pascal" } as v, 
            expected_overrides: { sn: (null as any) },
        }
        await test(test1)
        await test({ 
            ...test1,
            v: {} as v,
            expected_overrides: {},
        })
    });

    it("should handle computed override", async () => {
        const test1: one_test = {
            conds, 
            with_conds: { 
                sn: { 
                    title: "SN",
                    cond_overrides: { foo: (v) => ({ title: `Hello ${v.givenName}` }) },
                },
            }, 
            expected_without_conds: { 
                sn: { title: "SN" }
            },
            v: { givenName: "Pascal" } as v, 
            expected_overrides: { sn: { title: `Hello Pascal` } },
        }
        await test(test1)
        await test({ 
            ...test1,
            v: {} as v,
            expected_overrides: {},
        })
    });

    it("should handle if_then", async () => {
        const test1: one_test = {
            conds, 
            with_conds: { 
                pager: { 
                    title: "PAGER",
                    if: 'falsy',
                    then: {
                        merge_patch_parent_properties: {
                            sn: { 
                                title: "SN",                                      
                                cond_overrides: { foo: (null as any) },
                            }
                        },
                    },
                },
            }, 
            expected_without_conds: { 
                pager: { 
                    title: "PAGER",
                    if: 'falsy',
                    then: { merge_patch_parent_properties: { sn: { title: "SN" } } },
                },
            },
            v: { givenName: "Pascal" } as v, 
            expected_overrides: { 
                pager: { then: { merge_patch_parent_properties: { sn: (null as any) } } },
            },
        }
        await test(test1)
    });

})