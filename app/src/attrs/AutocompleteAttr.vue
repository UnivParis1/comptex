<template>
  <my-bootstrap-form-group :name="name" :opts="opts" :validity="validity">
    <div v-if="opts.readOnly">
      <component v-if="opts.uiOptions && opts.uiOptions.texts_are_vue_template"
            :is="formatting_vue(val)" :v="v"></component>
      <input v-else :disabled="true" class="form-control" :value="val ? val.title : ''">
    </div>
    <div class="Autocomplete" :class="{ 'input-group': array_allowed_actions.any }" v-else>
      <typeahead :id="name" :name="name" v-model="val" :options="search" :minChars="minChars" :limit="displayLimit"
            :formatting="formatting" :formatting_html="formatting_html"
            :required="!opts.optional || array_allowed_actions.remove"
            :placeholder="opts.uiPlaceholder"
            :editable="false" v-model:validity="validity[name]"></typeahead>
      <array-actions @action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions" />
    </div>

    <CurrentLdapValue :modelValue="modelValue" :ldap_value="ldap_valueS?.const" :formatted_ldap_value="ldap_valueS?.title" :readOnly="opts.readOnly" @update:modelValue="set_ldap_value"></CurrentLdapValue>

  </my-bootstrap-form-group>
</template>

<script setup lang="ts">
import { computed, defineComponent, reactive, watch } from 'vue';
import * as Ws from '../services/ws.ts';
import { V } from '../services/ws.ts'
import CurrentLdapValue from './CurrentLdapValue.vue';
import { asyncComputed_, toRwRef } from "@/services/helpers"


const props = defineProps<{
    modelValue: string | undefined,
    name: string,
    real_name: string | undefined,
    opts?: SharedStepAttrOption & CommonStepAttrOptionT<{}> & ClientSideOnlyStepAttrOption,
    v: V,
    ldap_value: string | undefined,
    stepName: string,
    array_allowed_actions: { move_up?: boolean, move_down?: boolean, remove?: boolean, any: boolean },
}>()
const emit = defineEmits<{
    'update:modelValue': [const_: string],
    array_action: [field_name: string],
}>();

// NB: this will be recomputed often because of "compute_mppp_and_handle_default_values". But the string oneOf_async.value will be unmodified. Needed to avoid too many const_to_choice calls.
const oneOf_async = computed(() => props.opts.oneOf_async)
const const_to_choice = async (const_) => {
    if (const_) {
        const l = await Ws.search(props.stepName, props.real_name || props.name, oneOf_async.value, const_, 1)
        return l[0]
    } else {
        return undefined
    }
}

const minChars = computed(() => props.opts.oneOf_async_options?.minChars ?? 3)
const displayLimit = computed(() => props.opts.oneOf_async_options?.displayLimit ?? 10)
const validity = reactive(!props.opts.readOnly && { [props.name]: {} })
const valueS = asyncComputed_(() => const_to_choice(props.modelValue))
const ldap_valueS = asyncComputed_(() => const_to_choice(props.ldap_value))

const val = toRwRef(() => valueS.value)
watch(val, (val) => {
    console.log("val changed", {...val});
    if (val) {
        emit('update:modelValue', val.const);
        if (props.opts.onChange) props.opts.onChange(props.v, val.const, val);
    }
})
const search = (token) => (
    Ws.search(props.stepName, props.real_name || props.name, oneOf_async.value, token, displayLimit.value + 1) /* NB: searching one more item to detect "moreResults" case*/
)
const formatting = (e) => (
    props.opts.formatting ? props.opts.formatting(e) : e && e.title
)
const formatting_html = (e) => (
    props.opts.formatting_html ? props.opts.formatting_html(e) : formatting(e)
)
const formatting_vue = (e) => (
    e?.title && defineComponent({ props: ['v'], template: "<div>" + e.title + "</div>" })
)
const set_ldap_value = () => {
    val.value = ldap_valueS.value || { const: props.ldap_value, title: props.ldap_value }
}
</script>
