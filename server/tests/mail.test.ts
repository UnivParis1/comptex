import { assert } from './test_utils';
import { for_unit_tests } from '../mail';

describe('parse_header_and_body', () => {
    const { parse_header_and_body } = for_unit_tests

    it("should handle Subject", () => {
        assert.deepEqual(parse_header_and_body(`Subject: xx\n\nBODY`), { subject: 'xx', cc: undefined, body: 'BODY' })
        assert.deepEqual(parse_header_and_body(`Foo: xx\n\nBODY`), null)
    })

    it("should handle Cc", () => {
        assert.deepEqual(parse_header_and_body(`Subject: xx\nCc: foo@bar.com\n\nBODY`), { subject: 'xx', cc: 'foo@bar.com', body: 'BODY' })
    })
})
