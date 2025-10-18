import axios from 'axios';
import MockAdapter from "axios-mock-adapter"
import { setTimeoutPromise } from '../../../shared/helpers';
import { assert, afterAll, afterEach, beforeAll } from 'vitest';
import { GlobalMountOptions } from '@vue/test-utils/dist/types';
import { App } from 'vue';

export const should_throw = (p, validateException) => (
    p.then(_ => assert.fail("should have failed"), (e) => validateException(e))
)

export const flushPromises = async () => {
    await setTimeoutPromise(0)
}

export const mocha_axios_mock = () => {
    let o = { adapter: undefined as MockAdapter }
    beforeAll(() => { o.adapter = new MockAdapter(axios) })
    afterEach(() => o.adapter.reset())
    afterAll(() => o.adapter.restore())
    return o
}

export const collect_globals = (global: GlobalMountOptions) => ({
    directive(name, def) {
        (global.directives ??= {})[name] = def
    },
    component(name, def) {
        (global.components ??= {})[name] = def
    },
} as App)