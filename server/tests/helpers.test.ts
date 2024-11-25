'use strict';

import { assert } from './test_utils';
import * as helpers from '../helpers';

process.env.TZ = 'Etc/GMT-3'

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
    it("should work to add an hour", () => {
        const d = new Date("2017-01-31T00:00:00.000Z");
        const d2 = helpers.addDays(d, 1 /*hour*/ / 24);
        assert.equal(d2.toISOString(), '2017-01-31T01:00:00.000Z');
    })
    it("should work with float", () => {
        const d = new Date("2017-01-31T23:00:00.000Z");
        const d2 = helpers.addDays(d, 0.9999);
        assert.equal(helpers.toYYYY_MM_DD(d2), '2017-02-01');
    })
});

describe('maybeFormatPhone', () => {
    it("should work", () => {
        assert.equal(helpers.maybeFormatPhone("+33 ")("+33 6 23 45 67 89"), "+33 6 23 45 67 89")
        assert.equal(helpers.maybeFormatPhone("+33 ")("0623456789"), "+33 6 23 45 67 89")
        assert.equal(helpers.maybeFormatPhone("0")("0623456789"), "06 23 45 67 89")
    })

    it("should handle french_outre_mer", () => {
        assert.equal(helpers.maybeFormatPhone("xx")("+33 6 90 45 67 89"), "+590 6 90 45 67 89")
        assert.equal(helpers.maybeFormatPhone("xx")(   "06 90 45 67 89"), "+590 6 90 45 67 89")
        assert.equal(helpers.maybeFormatPhone("xx")("+33 6 92 00 12 34"), "+262 6 92 00 12 34")
    })
})

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

describe('formatDate', () => {
    it ("should work", () => {
        assert.deepEqual(helpers.formatDate(new Date("1975-10-02T12:59:00Z"), 'dd/MM/yyyy à HH:mm'), "02/10/1975 à 15:59");
    })
})

describe('milliseconds_to_DaysHoursMinutes', () => {
    it ("should work", () => {
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(1000), { days: 0, hours: 0, minutes: 0 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(59 * 1000), { days: 0, hours: 0, minutes: 1 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(60 * 1000), { days: 0, hours: 0, minutes: 1 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(61 * 1000), { days: 0, hours: 0, minutes: 1 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(91 * 1000), { days: 0, hours: 0, minutes: 2 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(3599 * 1000), { days: 0, hours: 1, minutes: 0 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(3600 * 1000), { days: 0, hours: 1, minutes: 0 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(3660 * 1000), { days: 0, hours: 1, minutes: 1 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(24 * 3600 * 1000), { days: 1, hours: 0, minutes: 0 });
        assert.deepEqual(helpers.milliseconds_to_DaysHoursMinutes(999 * 24 * 3600 * 1000), { days: 999, hours: 0, minutes: 0 });
    });
});

describe('milliseconds_to_french_text', () => {
    it ("should work", () => {
        assert.deepEqual(helpers.milliseconds_to_french_text(1000), '');
        assert.deepEqual(helpers.milliseconds_to_french_text(60 * 1000), '1 minute');
        assert.deepEqual(helpers.milliseconds_to_french_text(3600 * 1000), '1 heure');
        assert.deepEqual(helpers.milliseconds_to_french_text(3660 * 1000), '1 heure et 1 minute');
        assert.deepEqual(helpers.milliseconds_to_french_text(24 * 3600 * 1000), '1 jour');
        assert.deepEqual(helpers.milliseconds_to_french_text(2 * 24 * 3600 * 1000), '2 jours');
    })
    it ("should not work display minutes if days", () => {
        assert.deepEqual(helpers.milliseconds_to_french_text(((2 * 24 + 4) * 3600 + 23 * 60) * 1000), '2 jours et 4 heures');
    });
    it ("should not work display hours if many days", () => {
        assert.deepEqual(helpers.milliseconds_to_french_text(((7 * 24 + 4) * 3600 + 23 * 60) * 1000), '7 jours');
    });
    it ("should not work display minutes if many hours", () => {
        assert.deepEqual(helpers.milliseconds_to_french_text((10 * 3600 + 23 * 60) * 1000), '10 heures');
    });
});

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

describe('findMap', () => {
    it("should work", () => {
        assert.equal(helpers.findMap([1, 2], nb => nb === 2 ? 4 : null), 4)
        assert.equal(helpers.findMap([1, 2], nb => nb === 1 ? 4 : null), 4)
        assert.equal(helpers.findMap([1, 2], _ => (null as any)), null)
        assert.equal(helpers.findMap([1, 2], _ => (undefined as any)), null)
        assert.equal(helpers.findMap(["aaa", "bbb"], s => helpers.removePrefixOrNull(s, "a")), "aa")
        assert.equal(helpers.findMap(["aaa", "bbb"], s => helpers.removePrefixOrNull(s, "b")), "bb")
        assert.equal(helpers.findMap(["aaa", "bbb"], s => helpers.removePrefixOrNull(s, "c")), null)
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
describe('keyByMulti', () => {
    it("should work", () => {
        assert.deepEqual(helpers.keyByMulti(
            [ 
                { foo: ["a"], bar: "BAR" }, 
                { foo: ["b", "c"] },
            ], 'foo'), 
            { 
                a: { foo: [ 'a' ], bar: "BAR" },
                b: { foo: [ 'b', 'c' ] },
                c: { foo: [ 'b', 'c' ] },
            },
        )
        assert.deepEqual(helpers.keyByMulti( [ {} ], 'foo'), {})
        assert.deepEqual(helpers.keyByMulti( [ { foo: [] } ], 'foo'), {})
    })
})
