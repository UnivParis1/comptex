import { assert, describe, it } from 'vitest';
import * as _ from 'lodash'
import { DOMWrapper, mount } from '@vue/test-utils'
import { setTimeoutPromise } from '@/services/helpers';
import { collect_globals, flushPromises } from '../test_utils';
import genericAttr from '@/attrs/genericAttr.vue';
import AddressAttr from '@/attrs/AddressAttr.vue';
import DateAttr from '@/attrs/DateAttr.vue';

import validators from '@/directives/validators'
import { GlobalMountOptions } from '@vue/test-utils/dist/types';
import GlobalMixin from '@/GlobalMixin';
import typeahead from '@/directives/typeahead';

const inputAttrs = (eltWrapper: DOMWrapper<Element>) => _.omit(eltWrapper.attributes(), 'validity', 'class')
const inputChecked = (inputWrapper: DOMWrapper<HTMLInputElement>) => inputWrapper.element.checked

const mount_test = ({ name, opts, v } : { name: string, opts: StepAttrOptionM<unknown>, v: CommonV }) => {
    let global: GlobalMountOptions = {
        stubs: {},
        mixins: [ GlobalMixin ],
    }
    validators(collect_globals(global))
    collect_globals(global).component('typeahead', typeahead)
    return mount(genericAttr, {
        props: {
            modelValue: v[name], real_name: name, name, opts, v, stepName: 'foo',
        },
        global,
    })

}

describe('minimal', async () => {
    it('renders simple input', () => {
        const wrapper = mount_test({ name: "attr1", opts: {}, v: { attr1: "a" } })
        const inputWrapper = wrapper.find('input')
        assert.deepEqual(inputAttrs(inputWrapper), { name: "attr1", required: "", type: "text", value: "a" })
        assert.equal(inputWrapper.element.value, "a")
    })

    it('renders radio', async () => {
        const opts = { oneOf: [ { const: "a", title: "A" }, { const: "b", title: "B" } ] }
        const wrapper = mount_test({ name: "attr1", opts, v: { attr1: undefined } })
        await flushPromises()
        //
        const inputs = wrapper.findAll("input")
        assert.deepEqual(inputs.map(inputAttrs), [
            { name: "attr1", required: "", type: "radio", value: "a" },
            { name: "attr1", required: "", type: "radio", value: "b" },
        ])
        // nothing selected by default
        assert.deepEqual(inputs.map(inputChecked), [false, false])

        // selecting 2nd
        await inputs[1].setValue(true)
        assert.deepEqual(inputs.map(inputChecked), [false, true])
    })

    it('renders select', async () => {
        const opts: StepAttrOptionM<unknown> = { uiType: 'select', oneOf: [ { const: "a", title: "A" }, { const: "b", title: "B" } ] }
        const wrapper = mount_test({ name: "attr1", opts, v: { attr1: "a" } })
        await flushPromises()
        //
        const selectWrapper = wrapper.find('select')
        assert.deepEqual(inputAttrs(selectWrapper), { name: "attr1", required: "", value: "a" })
        const options = wrapper.findAll("select option")
        assert.deepEqual(options.map(inputAttrs), [ { value: "a" }, { value: "b" } ])
        // nothing selected by default
        assert.equal(selectWrapper.element.value, 'a')

        await options[1].setValue('selected')
        assert.equal(selectWrapper.element.value, 'b')
    })

    it('renders select with invalid choice', async () => {
        const opts: StepAttrOptionM<unknown> = { uiType: 'select', oneOf: [ { const: "a", title: "A" }, { const: "b", title: "B" } ] }
        const wrapper = mount_test({ name: "attr1", opts, v: { attr1: undefined } })
        await flushPromises()
        //
        const selectWrapper = wrapper.find('select')
        assert.deepEqual(inputAttrs(selectWrapper), { name: "attr1", required: "" })
        const options = wrapper.findAll("select option")
        assert.deepEqual(options.map(inputAttrs), [ { disabled: "", hidden: "" },{ value: "a" }, { value: "b" } ])
        // nothing selected by default
        assert.equal(selectWrapper.element.value, '')

        await options[2].setValue('selected')
        assert.equal(selectWrapper.element.value, 'b')
    })

    it('renders select with optional value', async () => {
        const opts: StepAttrOptionM<unknown> = { optional: true, uiType: 'select', oneOf: [ { const: "a", title: "A" }, { const: "b", title: "B" } ] }
        const wrapper = mount_test({ name: "attr1", opts, v: { attr1: undefined } })
        await flushPromises()
        //
        const selectWrapper = wrapper.find('select')
        assert.deepEqual(inputAttrs(selectWrapper), { name: "attr1" })
        const options = wrapper.findAll("select option")
        assert.deepEqual(options.map(inputAttrs), [ { value: "" }, { value: "a" }, { value: "b" } ])
        // nothing selected by default
        assert.equal(selectWrapper.element.value, '')

        await options[2].setValue('selected')
        assert.equal(selectWrapper.element.value, 'b')
    })

    it('limits oneOf to opts.max', async () => {
        const opts: StepAttrOptionM<unknown> = { max: 2, uiType: 'select', oneOf: [ { const: "1", title: "A" }, { const: "2", title: "B" }, { const: "3", title: "C" } ] }
        const wrapper = mount_test({ name: "attr1", opts, v: { attr1: undefined } })
        await flushPromises()
        const vm = wrapper.vm as any // workaround https://github.com/vuejs/language-tools/issues/3808
        //
        assert.deepEqual(vm.oneOf, [ { const: "1", title: "A" }, { const: "2", title: "B" } ])
        // if max changes, choices change:
        vm.opts.max = 1
        assert.deepEqual(vm.oneOf, [ { const: "1", title: "A" } ])
    })
    
})

describe('validity', async () => {
    it('handles simple text input', async () => {
        const wrapper = mount_test({ name: "attr1", opts: {}, v: { attr1: "" } })
        const vm = wrapper.vm as any
        assert.isTrue(vm.validity.attr1.valueMissing)
        await wrapper.setProps({ modelValue: "A" })
        assert.isFalse(vm.validity.attr1.valueMissing)
        assert.isTrue(vm.validity.attr1.valid)
    })

    it('handles text input with pattern', async () => {
        const wrapper = mount_test({ name: "attr1", opts: { pattern: "Aa.*" }, v: { attr1: "A" } })
        const vm = wrapper.vm as any
        assert.isTrue(vm.validity.attr1.patternMismatch)
        assert.isFalse(vm.validity.attr1.valid)
        await wrapper.setProps({ modelValue: "Aaa" })
        assert.isTrue(vm.validity.attr1.valid)
        await wrapper.setProps({ modelValue: "Baaa" })
        assert.isFalse(vm.validity.attr1.valid)
    })

    it('handles date input (v change)', async () => {
        const wrapper = mount_test({ name: "attr1", opts: { uiType: 'date' }, v: { attr1: undefined } })

        // NB: genericAttr validity is not updated, but we don't care. What is important is DateAttr validity
        const dateAttr = wrapper.getComponent(DateAttr).vm
        assert.isTrue(dateAttr.validity.attr1.valueMissing)
        await wrapper.setProps({ modelValue: new Date("2001-01-31") })
        assert.isFalse(dateAttr.validity.attr1.valueMissing)
        assert.isTrue(dateAttr.validity.attr1.valid)
        assert.equal(wrapper.find('input').element.value, "2001-01-31")

    })

    it('handles date input (text input)', async () => {
        const wrapper = mount_test({ name: "attr1", opts: { uiType: 'date' }, v: { attr1: undefined } })

        // NB: genericAttr validity is not updated, but we don't care. What is important is DateAttr validity
        const dateAttr = wrapper.getComponent(DateAttr).vm
        assert.isTrue(dateAttr.validity.attr1.valueMissing)
        
        await wrapper.find('input').setValue('2001-01-31')
        await setTimeoutPromise(1 + 1) // cf quirk in validators checkValidity.methods.onchange
        assert.isFalse(dateAttr.validity.attr1.valueMissing)
        assert.isTrue(dateAttr.validity.attr1.valid)
    })

    it('handles postalAddress (init)', async () => {
        const address = '90 RUE DE TOLBIAC\n75013 PARIS\nFRANCE'
        const wrapper = mount_test({ name: "attr1", opts: { uiType: 'postalAddress' }, v: { attr1: address } })
        const addressAttr = wrapper.getComponent(AddressAttr).vm
        assert.equal(addressAttr.currentValue, address)
        assert.equal(addressAttr.a.country, 'FRANCE')
        assert.equal(addressAttr.a.town, 'PARIS')
        // NB: genericAttr validity is not updated, but we don't care. What is important is AddressAttr validity
        assert.isTrue(addressAttr.validity.country.valid)
        assert.isTrue(addressAttr.validity.town.valid)
    })

    it('handles postalAddress (v change)', async () => {
        const wrapper = mount_test({ name: "attr1", opts: { uiType: 'postalAddress' }, v: { attr1: undefined } })
        // NB: genericAttr validity is not updated, but we don't care. What is important is AddressAttr validity
        const addressAttr = wrapper.getComponent(AddressAttr).vm
        assert.equal(addressAttr.currentValue, undefined)
        assert.equal(addressAttr.a.country, 'FRANCE')
        assert.isTrue(addressAttr.validity.country.valid)
        assert.isTrue(addressAttr.validity.town.valueMissing)
    })

})