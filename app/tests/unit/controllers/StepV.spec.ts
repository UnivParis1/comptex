import { assert, describe, it } from 'vitest'
import * as _ from 'lodash'
import { mount, createLocalVue } from '@vue/test-utils'
import { mocha_axios_mock, flushPromises } from '../test_utils';
import VueRouter from 'vue-router'
import StepV from '@/controllers/StepV.vue';



const mountStepV = ({ attrs, v, v_pre = {}, initialStep = false }) => {
    const localVue = createLocalVue()
    localVue.use(VueRouter)
    return mount(StepV, {
        propsData: {
            step: { labels: { title: "Title1<>", description: "Desc1-{{v_pre.attr1}}-{{v.attr1}}" } },
            attrs, all_attrs_flat: _.clone(attrs),
            v: _.clone(v), v_pre,
            stepName: 'foo',
            wanted_id: initialStep ? null : 'xxx',
        }, 
        localVue, 
        router: new VueRouter(),
        stubs: { MyModalP: true, attrsForm: true, Homonyms: true }
    })

}

describe('minimal', () => {
    it('renders', () => {
        const params = {
            attrs: {}, 
            v: { attr1: 'val1' }, 
            v_pre: { attr1: 'pre1' },
        }
        const wrapper = mountStepV(params)
        //
        const html = wrapper.html()
        assert.match(html, /<h2.*>Title1&lt;&gt;<\/h2>/, 'title')
        assert.include(html, '<div>Desc1-pre1-val1</div>', 'description')
    })
})

describe('homonyms', () => {
    const base_homonyme = { 
        supannCivilite: "M.", sn: "Rigaux", givenName: "Pascal", birthName: "Rigaux", birthDay: "1975-10-02T00:00:00.000Z", homePostalAddress: "6 Allée D'ANDREZIEUX\n75018 PARIS\nFrance", supannMailPerso: "pascal@rigaux.org",
    }
    const all_homonymes = [
        { score: 31110, uid: "prigaux", supannAliasLogin: "prigaux", homePhone: "+33 1 82 09 08 74", ...base_homonyme,
          global_main_profile: { source: "SIHAM", willNotExpireSoon: true, description: " est XXX" }, 
        },
        { score: 10, idFoo: "12345", foo: "bar12345", ...base_homonyme, 
           mergeAll: true,
          global_main_profile: { description: " est idFoo" },
        },
        { score: 10, uid: "prigaux2", supannAliasLogin: "prigaux2", idFoo: "5678", foo: "bar5678", ...base_homonyme, 
          mergeAll: true,
          global_main_profile: { description: " est idFoo et uid" }, 
        },
    ]

    const check_display_homonyms_stub = (wrapper) => {
        assert.equal(wrapper.findAll('homonyms-stub').length, 1, "display one homonym")
        assert.equal(wrapper.findAll('attrsform-stub').length, 0, "do not display form")
    }
    const check_display_attrsform = (wrapper) => {
        assert.equal(wrapper.findAll('homonyms-stub').length, 0, "do not display homonyms")
        assert.equal(wrapper.findAll('attrsform-stub').length, 1, "display form after merge")
    }
    const check_potential_homonyms = (vm, wanted) => {
        const current = vm.potential_homonyms.map(e => _.omit(e, 'ignore', 'merged_ids_values'))
        assert.deepEqual(current, wanted, 'potential_homonyms')
    }


    let mock = mocha_axios_mock()

    it("should handle one homonym attr: ignore", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { sn: 'Rigaux' },
        }
        const homonymes = all_homonymes.slice(0, 1)

        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(_ => [200, homonymes])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        check_potential_homonyms(vm, homonymes)
        check_display_homonyms_stub(wrapper)

        // merge homonyme
        await vm.merge(vm.potential_homonyms[0])
        check_potential_homonyms(vm, [])
        assert.deepEqual(vm.v, _.pick(homonymes[0], 'uid', 'sn', 'global_main_profile'))
        assert.include(wrapper.html(), homonymes[0].global_main_profile.description, 'display a message about the merged homonym')
        check_display_attrsform(wrapper)
    })

    it("should handle one homonym attr: merge", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { sn: 'Rigaux' },
        }
        const homonymes = all_homonymes.slice(0, 1)

        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(_ => [200, homonymes])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        check_potential_homonyms(vm, homonymes)
        check_display_homonyms_stub(wrapper)

        // ignore homonyme
        vm.potential_homonyms[0].ignore = true
        await flushPromises()
        check_potential_homonyms(vm, [])
        assert.deepEqual(vm.v, { sn: 'Rigaux' })
        check_display_attrsform(wrapper)
    })

    it("should handle two dependent homonym attr: merge", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, supannAliasLogin: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { sn: 'Rigaux', supannAliasLogin: 'must-be-overwritten' },
        }
        const homonymes = all_homonymes.slice(0, 1)

        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(_ => [200, homonymes])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        check_potential_homonyms(vm, homonymes)
        check_display_homonyms_stub(wrapper)

        // merge homonyme
        await vm.merge(vm.potential_homonyms[0])
        check_potential_homonyms(vm, [])
        assert.deepEqual(vm.v, _.pick(homonymes[0], 'uid', 'supannAliasLogin', 'sn', 'global_main_profile'))
        assert.include(wrapper.html(), homonymes[0].global_main_profile.description, 'display a message about the merged homonym')
        check_display_attrsform(wrapper)
    })

    it("should handle two homonym_attrs, two merges", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, idFoo: { uiType: 'homonym', optional: true } },
            v: { sn: 'Rigaux' },
        }
        const homonymes = all_homonymes

        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(_ => [200, homonymes])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        assert.deepEqual(vm.homonym_attrs, ["uid", "idFoo"], 'homonym_attrs')
        check_display_homonyms_stub(wrapper)
        check_potential_homonyms(vm, homonymes)

        // merge first
        await vm.merge(vm.potential_homonyms[0])
        check_display_homonyms_stub(wrapper)
        check_potential_homonyms(vm, homonymes.slice(1, 2))
        assert.deepEqual(vm.v, { ..._.pick(homonymes[0], 'uid', 'sn', 'global_main_profile') })

        // merge second (NB: is has "mergeAll")
        await vm.merge(vm.potential_homonyms[0])
        assert.deepEqual(vm.v, { ...homonymes[1], ..._.pick(homonymes[0], 'uid', 'global_main_profile') })
        assert.include(wrapper.html(), homonymes[0].global_main_profile.description, 'display a message about the first merged homonym')
        assert.include(wrapper.html(), homonymes[1].global_main_profile.description, 'display a message about the second merged homonym')
        check_display_attrsform(wrapper)
    })

    it("should handle two homonym_attrs, one merge", async () => {
        const params = { 
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, idFoo: { uiType: 'homonym', optional: true } },
            v: { sn: 'Rigaux' },
        }
        const homonymes = all_homonymes

        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(_ => [200, homonymes])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        check_display_homonyms_stub(wrapper)
        check_potential_homonyms(vm, homonymes)

        // merge third which has both homonym_attrs
        await vm.merge(vm.potential_homonyms[2])
        check_potential_homonyms(vm, [])
        assert.deepEqual(vm.v, homonymes[2])
        assert.include(wrapper.html(), homonymes[2].global_main_profile.description, 'display a message about the merged homonym (#3)')
        check_display_attrsform(wrapper)
    })

    it("should check homonym again before submit: no new homonym found", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { sn: 'Foo' },
        }

        let lastApiCall = null
        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(config => {
            lastApiCall = config
            return [200, []]
        })
        mock.adapter.onPut(/\/api\/comptes\//).reply(_ => [ 200, { labels: { added: "Foo" } } ])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        assert.deepEqual(lastApiCall?.data, JSON.stringify({}))
        check_display_attrsform(wrapper)

        // set values and submit
        vm.v.sn = "Rigaux"
        await vm.submit_()
        assert.deepEqual(lastApiCall?.data, JSON.stringify({sn: "Rigaux"}))
        check_potential_homonyms(vm, [])
        assert.equal(wrapper.find('.response').text(), 'Foo')
    })


    it("should check homonym again before submit: new homonym found", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { sn: 'Foo' },
        }
        let homonymes = all_homonymes.slice(0, 1)

        let lastApiCall = null
        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(config => {
            lastApiCall = config
            return [200, JSON.parse(config.data).sn === 'Rigaux' ? homonymes : []]
        })
        mock.adapter.onPut(/\/api\/comptes\//).reply(_ => [ 200, { labels: { added: "Foo" } } ])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        assert.deepEqual(lastApiCall?.data, JSON.stringify({}))
        check_display_attrsform(wrapper)

        // set values and submit
        vm.v.sn = "Rigaux"
        await vm.submit_()
        check_display_homonyms_stub(wrapper)
        check_potential_homonyms(vm, homonymes)

        // ignore homonyme
        vm.potential_homonyms[0].ignore = true
        await flushPromises()
        check_potential_homonyms(vm, [])
        check_display_attrsform(wrapper)
        assert.deepEqual(vm.v, {sn: 'Rigaux'})

        await vm.submit_()
        check_potential_homonyms(vm, [])
        assert.equal(wrapper.find('.response').text(), 'Foo')
    })


    it("should check homonym again before submit if needed", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { sn: 'Foo' },
        }
        const homonymes = all_homonymes.slice(0, 1)

        let lastApiCall = null
        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(config => {
            lastApiCall = config
            return [200, JSON.parse(config.data).sn === 'Rigaux' ? homonymes : []]
        })
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        assert.deepEqual(lastApiCall?.data, JSON.stringify({}))
        check_display_attrsform(wrapper)

        // set values and submit
        vm.v.sn = "Rigaux"
        await vm.submit_()
        assert.deepEqual(lastApiCall?.data, JSON.stringify({sn: "Rigaux"}))
        check_display_homonyms_stub(wrapper)
        check_potential_homonyms(vm, homonymes)

        // ignore homonyme
        vm.potential_homonyms[0].ignore = true
        await flushPromises()
        check_potential_homonyms(vm, [])
        check_display_attrsform(wrapper)
        assert.deepEqual(vm.v, {sn: 'Rigaux'})

    })

    it("should check homonym before submit (starting with empty form)", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: {},
            initialStep: true,
        }
        const homonymes = all_homonymes.slice(0, 1)

        let lastApiCall = null
        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(config => {
            lastApiCall = config
            return [200, homonymes]
        })
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        assert.equal(lastApiCall, null)
        check_display_attrsform(wrapper)

        // set values and submit
        vm.v.sn = "Rigaux"
        await vm.submit_()
        assert.deepEqual(lastApiCall?.data, JSON.stringify({sn: "Rigaux"}))
        check_display_homonyms_stub(wrapper)
        check_potential_homonyms(vm, homonymes)

        // ignore homonyme
        vm.potential_homonyms[0].ignore = true
        await flushPromises()
        check_potential_homonyms(vm, [])
        check_display_attrsform(wrapper)
        assert.deepEqual(vm.v, {sn: 'Rigaux'})

    })

    it("should not check homonyms if uid is given", async () => {
        const params = {
            attrs: { attr1: {}, uid: { uiType: 'homonym', optional: true }, sn: {} }, 
            v: { uid: 'prigaux' },
        }
        const homonymes = all_homonymes.slice(0, 1)

        mock.adapter.onPost(/\/api\/homonymes\/.*/).reply(_ => [200, homonymes])
        const wrapper = mountStepV(params)
        await flushPromises()
        const vm = wrapper.vm as any
        //
        check_potential_homonyms(vm, [])
        check_display_attrsform(wrapper)
    })


})
