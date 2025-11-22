<template>
 <div v-if="opts && (!opts.readOnly || validValue && val || opts.uiHidden === false)" class="genericAttr" :class="'oneAttr-' + name" 
      v-on-visible="opts.onVisible && (elt => opts.onVisible(v, elt))">

  <DateAttr v-model="val as Date" :name="name" v-if="uiType === 'date'"
    :ldap_value="ldap_value as Date"
    :opts="opts">
  </DateAttr>

  <DateThreeInputsAttr v-model="val as Date" v-else-if="uiType === 'dateThreeInputs'"
    :opts="opts">
  </DateThreeInputsAttr>

  <DateTimeAttr v-model="val" :name="name" v-else-if="uiType === 'datetime'"
    :ldap_value="ldap_value"
    :opts="opts">
  </DateTimeAttr>

  <ReadOnlyObjectItems :v_array="val" v-else-if="opts.items && opts.items.properties" 
    :opts="opts" />

  <ArrayAttr v-model="val as string | string[]" :name="name" v-else-if="uiType === 'array'"
    :ldap_value="ldap_value as string"
    :stepName="stepName" :v="v"
    :opts="opts">
  </ArrayAttr>

  <AddressAttr v-model="val as string" v-else-if="uiType === 'postalAddress'"
    :ldap_value="ldap_value as string"
    :opts="opts">
  </AddressAttr>

  <cameraSnapshotAttr v-model="val as string" v-else-if="uiType === 'cameraSnapshot'"
     :opts="opts">
  </cameraSnapshotAttr>

  <PhotoUploadAttr v-model="val" :name="name" v-else-if="uiType === 'photoUpload'"
     :opts="opts">
  </PhotoUploadAttr>

  <FileUploadAttr v-model="val" :name="name" v-else-if="uiType === 'fileUpload'"
     :opts="opts">
  </FileUploadAttr>

  <PasswordAttr v-model="val" v-else-if="uiType === 'newPassword'"
     :opts="opts">
  </PasswordAttr>

  <AutocompleteAttr v-model="val as string" :name="name" :real_name="real_name" :v="v" v-else-if="uiType === 'autocomplete'"
     :ldap_value="ldap_value as string"
     :stepName="stepName"
     @array_action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions"
     :opts="opts">
  </AutocompleteAttr>

  <iframe :src="val as string" v-else-if="uiType === 'iframe'" v-iframe-auto-height>
  </iframe>

  <my-bootstrap-form-group :name="name" 
    :opts="opts"
    :no_html_label="uiType === 'radio' || uiType === 'checkbox'"
    :validity="uiType !== 'span' && validity" v-else-if="opts">

    <div v-if="uiType === 'radio'">
      <radio-with-validity :name="name" v-model="val"
          :values="choicesMap" v-if="choicesMap"
          :texts_are_html="uiOptions.texts_are_html"
          :long_lines="uiOptions.long_lines"
          :disabled="opts.readOnly" :required="!opts.optional" v-model:validity="validity[name]">
      </radio-with-validity>
      <span class="attr-description" v-html="opts.description"></span>
    </div>

    <div v-else-if="uiType === 'textarea' && uiOptions.autocomplete && !opts.readOnly">
      <history-textarea-with-validity :name="name" v-model="val"
        :rows="uiOptions.rows" :required="!opts.optional" v-model:validity="validity[name]">
      </history-textarea-with-validity>
      <span class="attr-description" v-html="opts.description"></span>
    </div>

    <div v-else-if="uiType === 'textarea'">
      <textarea-with-validity :name="name" v-model="val"
        class="form-control"
        :rows="uiOptions.rows || (opts.readOnly ? (modelValue as string||'').split('\n').length : undefined)" 
        :disabled="opts.readOnly" :required="!opts.optional" v-model:validity="validity[name]">
      </textarea-with-validity>
      <span class="attr-description" v-html="opts.description"></span>
    </div>

    <div v-else-if="uiType === 'select'">
     <div :class="{ 'input-group': array_allowed_actions.any }">
        <!-- wait until oneOf is computed. <select-with-validity> can NOT handle "value" is in computed "oneOf" -->
      <select-with-validity :name="name" v-model="val" v-if="oneOf"
        :disabled="opts.readOnly"
        :choices="oneOf" :required="!opts.optional" v-model:validity="validity[name]">
      </select-with-validity>
      <array-actions @action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions" />
     </div>
      <component :is="vue_component_description" :v="v" v-if="vue_component_description"></component>
      <span class="attr-description" v-html="opts.description" v-else></span>
    </div>

    <div class="checkbox" v-else-if="uiType === 'checkbox'">
      <label>
        <checkbox-with-validity :name="name" v-model="val"
            :disabled="opts.readOnly"
            :required="!opts.optional" v-model:validity="validity[name]">
        </checkbox-with-validity>
        <span class="attr-description" v-html="opts.description"></span>
      </label>
    </div>

    <div class="uiType-span" v-else-if="uiType === 'span'">
        <span class="instead_of_disabled_input">{{formattedValue}}</span>
        <span class="attr-description" v-html="opts.description"></span>
    </div>

   <div v-else>
    <div :class="{ 'input-group': array_allowed_actions.any }">
    <input-with-validity :name="name" v-model="val" 
        v-bind="input_attrs"
        :disabled="opts.readOnly"
        :placeholder="opts.uiPlaceholder" :inputmode="uiOptions.inputmode"
        :autocomplete="uiOptions.autofill_detail_tokens"
        :type="type" :realType="realType" :required="!opts.optional" :pattern="opts.pattern" :allowedChars="opts.allowedChars" :validator="opts.validator"
        :min="opts.min" :max="opts.max" :minlength="opts.minlength" :maxlength="opts.maxlength" :step="uiType === 'number' && 'any'"
        :onFocusOut="opts.onFocusOut && (() => opts.onFocusOut(v))"
        :title="opts.labels && opts.labels.tooltip" v-model:validity="validity[name]">
    </input-with-validity>
    <array-actions @action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions" />
    </div>
    <component :is="vue_component_description" :v="v" v-if="vue_component_description"></component>
    <span class="attr-description" :class="{ 'attr-readOnly-description': opts.readOnly }" v-html="opts.description" v-else></span>
   </div>

    <CurrentLdapValue :modelValue="initial_value as string" :ldap_value="ldap_value" :opts="opts" @update:modelValue="v => val = v"></CurrentLdapValue>

  </my-bootstrap-form-group>
 </div>
</template>

<script lang="ts">
import { computed, defineAsyncComponent, defineComponent, reactive, ref, watch } from "vue";
import { includes, find, isNil, keyBy, mapValues } from 'lodash-es';
import { asyncComputed_, isDateInputSupported, toRwRef } from '../services/helpers.ts';
import { formatValue } from '../../../shared/v_utils.ts'
import * as Ws from '../services/ws.ts';

import DateAttr from './DateAttr.vue';
import DateTimeAttr from './DateTimeAttr.vue';
import DateThreeInputsAttr from './DateThreeInputsAttr.vue';
import AddressAttr from './AddressAttr.vue';
import ArrayAttr from './ArrayAttr.vue';
import ReadOnlyObjectItems from './ReadOnlyObjectItems.vue';
import cameraSnapshotAttr from './cameraSnapshotAttr.vue';
import PasswordAttr from './PasswordAttr.vue';
import AutocompleteAttr from './AutocompleteAttr.vue';
import CurrentLdapValue from './CurrentLdapValue.vue';
import FileUploadAttr from './FileUploadAttr.vue';

function add_to_oneOf_if_missing(choices: Ws.StepAttrOptionChoices[], to_have) {
    if (!isNil(to_have) && choices && !choices.some(choice => choice.const === to_have)) {
        choices.push({ const: to_have, title: to_have })
    }
    return choices
}
</script>

<script setup lang="ts">

const props = defineProps<{
    modelValue: string | string[] | Date | undefined,
    real_name?: string,
    name: string,
    opts?: SharedStepAttrOption & CommonStepAttrOptionT<{}> & ClientSideOnlyStepAttrOption,
    v?: Ws.V,
    ldap_value?: string | string[] | Date,
    stepName?: string,
    array_allowed_actions_?: { move_up?: boolean, move_down?: boolean, remove?: boolean },
}>()
const emit = defineEmits<{
    'update:modelValue': [const_: string | string[] | Date],
    array_action: [field_name: string],
}>();

const PhotoUploadAttr = defineAsyncComponent(() => import('./PhotoUploadAttr.vue'))
const validity = reactive({ [props.name as string]: {} })

// explicit ref() to workaround « Invalid assignment target in v-model data binding with type assertion » with esbuild, cf https://github.com/unjs/unimport/issues/409
const val = ref(toRwRef(() => props.modelValue))

const initial_value = props.modelValue
const array_allowed_actions = computed(() => {
    const allowed = props.array_allowed_actions_ || {}
    return { ...allowed, any: allowed.remove || allowed.move_up || allowed.move_down }
})
const uiOptions  = computed(() => props.opts.uiOptions || {})
const uiType = computed(() => {
            if (uiOptions.value.readOnly__avoid_disabled_input && props.opts.readOnly || props.opts.computeValue) {
                return 'span';
            }
            if (props.opts.uiType === 'date' && !isDateInputSupported()) {
                return 'dateThreeInputs';
            }
            return props.opts.uiType || 
                props.opts.items && 'array' ||
                props.opts.oneOf && (props.opts.oneOf.length <= 2 ? 'radio' : 'select') ||
                props.opts.oneOf_async && 'autocomplete';
})
const type = computed(() => (
    includes(['phone', 'frenchMobilePhone'], props.opts.uiType) ? 'tel' : // "tel" implies inputmode "tel" which is great on mobiles
        realType.value || !props.opts.uiType ? 'text' :
        props.opts.uiType === 'integer' ? 'number' :
        props.opts.uiType)
)
const realType = computed(() => (
    includes(['phone', 'frenchMobilePhone', 'frenchPostalCode', 'siret'], props.opts.uiType) ? props.opts.uiType : undefined)
)
const choicesMap = computed(() => (
    oneOf.value && mapValues(keyBy(oneOf.value, 'const'), choice => choice['title']))
)
const oneOf = computed(() => {
    const l = add_to_oneOf_if_missing(oneOf_.value, props.opts.allowUnchangedValue)
    return props.opts.max ? l?.filter(choice => +choice.const <= props.opts.max) : l
})
const validValue = computed(() => {
            return uiType.value === 'select' ? (
                oneOf.value && find(oneOf.value, choice => (
                    // (allow equality if value is number and choice.const is string)
                    choice.const == props.modelValue // tslint:disable-line
                )) 
            ) : val.value;
        })
const computedValue = computed(() => (
    // @ts-expect-error (args already passed, cf handleAttrsValidators_and_computeValue_and_allowUnchangedValue)
    props.opts.computeValue?.()
))
const formattedValue = computed(() => (
    formatValue(props.opts.computeValue ? computedValue.value : val.value))
)
const input_attrs = computed(() => (
    type.value === 'password' ? { autocomplete: 'current_password' } : {})
)
const vue_component_description = computed(() => {
            if (!uiOptions.value.texts_are_vue_template) return undefined;
            const text = props.opts.description;
            return text && defineComponent({ props: ['v'], template: "<div>" + text + "</div>" });
})
const oneOf_ = asyncComputed_(async function () {
            const opts = props.opts || {};
            if (opts.oneOf) {
                return opts.oneOf;
            } else if (opts.oneOf_async && ['select', 'radio'].includes(uiType.value)) {
                return await Ws.search(props.stepName, props.real_name || props.name, '');
            } else {
                return undefined;
            }
})
watch(val, (val_) => {
    if (props.opts.normalize) {
        const val__ = props.opts.normalize(val_ as string);
        if (val__ !== val_) { val.value = val_ = val__ }
    }
    emit('update:modelValue', val_);
})
</script>
