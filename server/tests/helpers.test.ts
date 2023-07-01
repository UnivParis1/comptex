'use strict';

import { assert } from './test_utils';
import * as helpers from '../helpers';

describe('nextDate', () => {
        it ("should work", () => {
            assert.equal(helpers.nextDate("XXXX-07-01", new Date('2017-06-30T23:59:59.000Z')).toISOString(), '2017-07-01T00:00:00.000Z');
            assert.equal(helpers.nextDate("XXXX-07-01", new Date('2017-07-01T00:00:00.000Z')).toISOString(), '2017-07-01T00:00:00.000Z');
            assert.equal(helpers.nextDate("XXXX-07-01", new Date('2017-07-01T00:00:01.000Z')).toISOString(), '2018-07-01T00:00:00.000Z');
        });
        it ("should chain", () => {
            assert.equal(helpers.nextDate("XXXX-10-31", helpers.nextDate("XXXX-07-01", new Date('2017-06-30T23:59:59.000Z'))).toISOString(), '2017-10-31T00:00:00.000Z');
            assert.equal(helpers.nextDate("XXXX-10-31", helpers.nextDate("XXXX-07-01", new Date('2017-07-01T00:00:00.000Z'))).toISOString(), '2017-10-31T00:00:00.000Z');
            assert.equal(helpers.nextDate("XXXX-10-31", helpers.nextDate("XXXX-07-01", new Date('2017-07-01T00:00:01.000Z'))).toISOString(), '2018-10-31T00:00:00.000Z');
        });
});

describe('addDays', () => {
    it("should work", () => {
        const d = new Date("2017-01-31");
        const d2 = helpers.addDays(d, 1);
        assert.equal(d.toISOString(), '2017-01-31T00:00:00.000Z');
        assert.equal(d2.toISOString(), '2017-02-01T00:00:00.000Z');
    })
    it("should work with float", () => {
        const d = new Date("2017-01-31T23:00:00.000Z");
        const d2 = helpers.addDays(d, 0.9999);
        assert.equal(d2.toISOString().replace(/T.*/, ''), '2017-02-01');
    })
});

describe('anonymize_phoneNumber', () => {
    it("should work", () => {
        assert.equal(helpers.anonymize_phoneNumber("+33 6 23 45 67 89"), "062345****")
        assert.equal(helpers.anonymize_phoneNumber(undefined), undefined)
    })
})

describe('anonymize_email', () => {
    it("should work", () => {
        assert.equal(helpers.anonymize_email("foo@bar.com"), "****bar.com")
        assert.equal(helpers.anonymize_email("abcdefgh@bar.com"), "****efgh@bar.com")
    })
})

describe('is_valid_uai_code', () => {
    it("should detect valid UAIs", () => {
        assert.equal(helpers.is_valid_uai_code("0020743X"), true)
        assert.equal(helpers.is_valid_uai_code("0020743x"), true)
        assert.equal(helpers.is_valid_uai_code("0721586H"), true)
    })
    it("should detect invalid UAIs", () => {
        assert.equal(helpers.is_valid_uai_code("0020744x"), false)
    })
})

describe('split_terminator', () => {
    it("should work", () => {
        assert.deepEqual(helpers.split_terminator("a,", ","), ["a"])
        assert.deepEqual(helpers.split_terminator("a,,", ","), ["a", ""])
        assert.deepEqual(helpers.split_terminator(",a,,", ","), ["", "a", ""])
        assert.deepEqual(helpers.split_terminator("", ","), [])
    })
})

describe('replace_same_field_value_with_idem', () => {
    it("should work", () => {
        let l = [ { a: "aa" }, { a: "aa" }, { a: "bb" } ]
        helpers.replace_same_field_value_with_idem(l, 'a', "")
        assert.deepEqual(l, [ { a: "aa" }, { a: "" }, { a: "bb" } ])
    })
})

describe('invertByManyValues', () => {
    it("should work", () => {
        assert.deepEqual(
            helpers.invertByManyValues(
                { a: ["1"], c: ["3.1", "3.2"], c_: ["3.2"], d: [] }), 
                { '1': [ 'a' ], '3.1': [ 'c' ], '3.2': [ 'c', 'c_' ] },
        )
    })
})

describe('to_DD_MM_YYYY', () => {
    it("should work", () => {
        assert.equal(helpers.to_DD_MM_YYYY(new Date("1975-10-02")), "02/10/1975")
    })
})

describe('removePrefix', () => {
    it("should work", () => {
        assert.equal(helpers.removePrefix("aa", "a"), "a")
        assert.equal(helpers.removePrefix("aa", "aa"), "")
        assert.equal(helpers.removePrefix("ba", "a"), "ba")
        assert.equal(helpers.removePrefix("aa", null), "aa")
        assert.throws(() => helpers.removePrefix(null, "a"))
    })
})

describe('removePrefixOrNull', () => {
    it("should work", () => {
        assert.equal(helpers.removePrefixOrNull("aa", "a"), "a")
        assert.equal(helpers.removePrefixOrNull("aa", "aa"), "")
        assert.equal(helpers.removePrefixOrNull("ba", "a"), null)
        assert.equal(helpers.removePrefixOrNull("aa", null), null)
        assert.throws(() => helpers.removePrefixOrNull(null, "a"))
    })
})

describe('removeSuffixOrNull', () => {
    it("should work", () => {
        assert.equal(helpers.removeSuffixOrNull("ba", "a"), "b")
        assert.equal(helpers.removeSuffixOrNull("ba", "ba"), "")
        assert.equal(helpers.removeSuffixOrNull("ba", "b"), null)
        assert.equal(helpers.removeSuffixOrNull("aa", null), null)
        assert.throws(() => helpers.removeSuffixOrNull(null, "a"))
    })
})

describe('array_setAll', () => {
    const test = (init_values: string[], values: string[]) => {
        let a = init_values
        helpers.array_setAll(a, values)
        assert.deepEqual(a, values)
    }
    it("should work", () => {
        test(["foo"], [])
        test(["foo"], ["bar"])
        test(["foo", "bar"], ["boo"])
        assert.throws(() => test(null, []))
        assert.throws(() => test([], null))
    })
})

describe('run_if_not_running', () => {
    it("should run", async () => {
        let result
        const f = helpers.run_if_not_running(async (x: string) => {
            await helpers.setTimeoutPromise(1)
            result = x
        })
        // it must run
        await f("a"); assert.equal(result, "a")
        await f("b"); assert.equal(result, "b")

        let pc = f("c")
        f("d") // should be skipped
        await pc; assert.equal(result, "c")

        // back to being run
        await f("e"); assert.equal(result, "e")
    })
})