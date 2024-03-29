<template>
 <div v-if="opts && (!opts.readOnly || validValue && val || opts.uiHidden === false)" class="genericAttr" :class="'oneAttr-' + name" 
      v-on-visible="opts.onVisible && (elt => opts.onVisible(v, elt))">

  <DateAttr v-model="val" :name="name" v-if="uiType === 'date'"
    :ldap_value="ldap_value"
    :opts="opts">
  </DateAttr>

  <DateThreeInputsAttr v-model="val" v-else-if="uiType === 'dateThreeInputs'"
    :opts="opts">
  </DateThreeInputsAttr>

  <DateTimeAttr v-model="val" :name="name" v-else-if="uiType === 'datetime'"
    :ldap_value="ldap_value"
    :opts="opts">
  </DateTimeAttr>

  <ReadOnlyObjectItems :v_array="val" v-else-if="opts.items && opts.items.properties" 
    :opts="opts" />

  <ArrayAttr v-model="val" :name="name" v-else-if="uiType === 'array'"
    :ldap_value="ldap_value"
    :stepName="stepName" :v="v"
    :opts="opts">
  </ArrayAttr>

  <AddressAttr v-model="val" v-else-if="uiType === 'postalAddress'"
    :ldap_value="ldap_value"
    :opts="opts">
  </AddressAttr>

  <cameraSnapshotAttr v-model="val" v-else-if="uiType === 'cameraSnapshot'"
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

  <AutocompleteAttr v-model="val" :name="name" :real_name="real_name" :v="v" v-else-if="uiType === 'autocomplete'"
     :stepName="stepName"
     @array_action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions"
     :opts="opts">
  </AutocompleteAttr>

  <iframe :src="val" v-else-if="uiType === 'iframe'" v-iframe-auto-height>
  </iframe>

  <my-bootstrap-form-group :name="name" 
    :opts="opts"
    :no_html_label="uiType === 'radio' || uiType === 'checkbox'"
    :validity="uiType !== 'span' && validity" v-else-if="opts">

    <div v-if="uiType === 'radio'">
      <radio-with-validity :name="name" v-model="val"
          :values="choicesMap" v-if="choicesMap"
          :texts_are_html="uiOptions.texts_are_html"
          :disabled="opts.readOnly" :required="!opts.optional" :validity.sync="validity[name]">
      </radio-with-validity>
      <span class="attr-description" v-html="opts.description"></span>
    </div>

    <div v-else-if="uiType === 'textarea' && uiOptions.autocomplete && !opts.readOnly">
      <history-textarea-with-validity :name="name" v-model="val"
        :rows="uiOptions.rows" :required="!opts.optional" :validity.sync="validity[name]">
      </history-textarea-with-validity>
      <span class="attr-description" v-html="opts.description"></span>
    </div>

    <div v-else-if="uiType === 'textarea'">
      <textarea-with-validity :name="name" v-model="val"
        class="form-control"
        :rows="uiOptions.rows || (opts.readOnly ? (value||'').split('\n').length : undefined)" 
        :disabled="opts.readOnly" :required="!opts.optional" :validity.sync="validity[name]">
      </textarea-with-validity>
      <span class="attr-description" v-html="opts.description"></span>
    </div>

    <div v-else-if="uiType === 'select'">
     <div :class="{ 'input-group': array_allowed_actions.any }">
        <!-- wait until oneOf is computed. <select-with-validity> can NOT handle "value" is in computed "oneOf" -->
      <select-with-validity :name="name" v-model="val" v-if="oneOf"
        :disabled="opts.readOnly"
        :choices="oneOf" :required="!opts.optional" :validity.sync="validity[name]">
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
            :required="!opts.optional" :validity.sync="validity[name]">
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
        :type="type" :realType="realType" :required="!opts.optional" :pattern="opts.pattern" :allowedChars="opts.allowedChars" :validator="opts.validator"
        :min="opts.min" :max="opts.max" :minlength="opts.minlength" :maxlength="opts.maxlength" :step="uiType === 'number' && 'any'"
        :onFocusOut="opts.onFocusOut && (() => opts.onFocusOut(v))"
        :title="opts.labels && opts.labels.tooltip" :validity.sync="validity[name]">
    </input-with-validity>
    <array-actions @action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions" />
    </div>
    <span class="attr-description" :class="{ 'attr-readOnly-description': opts.readOnly }" v-html="opts.description"></span>
   </div>

    <CurrentLdapValue v-model="initial_value" :ldap_value="ldap_value" :opts="opts" @input="v => val = v"></CurrentLdapValue>

  </my-bootstrap-form-group>
 </div>
</template>

<script lang="ts">
import Vue from "vue";
import { includes, find, isNil, keyBy, mapValues } from 'lodash';
import { isDateInputSupported } from '../services/helpers';
import { formatValue } from '../../../shared/v_utils'
import * as Ws from '../services/ws';

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

export default Vue.extend({
    props: ['value', 'real_name', 'name', 'opts', 'v', 'ldap_value', 'stepName', 'array_allowed_actions_'],
    components: { 
        DateAttr, DateTimeAttr, DateThreeInputsAttr, ArrayAttr, ReadOnlyObjectItems, AddressAttr, cameraSnapshotAttr, PasswordAttr, AutocompleteAttr, CurrentLdapValue, FileUploadAttr,
        PhotoUploadAttr: () => import('./PhotoUploadAttr.vue'),
    },
    data() {
        return {
            validity: { [this.name]: {} },
            val: this.value,
            initial_value: this.value,
        };
    },
    computed: {
        array_allowed_actions() {
            const allowed = this.array_allowed_actions_ || {}
            return { ...allowed, any: allowed.remove || allowed.move_up || allowed.move_down }
        },
        uiType() {
            if (this.uiOptions.readOnly__avoid_disabled_input && this.opts.readOnly || this.opts.computeValue) {
                return 'span';
            }
            if (this.opts.uiType === 'date' && !isDateInputSupported()) {
                return 'dateThreeInputs';
            }
            return this.opts.uiType || 
                this.opts.items && 'array' ||
                this.opts.oneOf && (this.opts.oneOf.length <= 2 ? 'radio' : 'select') ||
                this.opts.oneOf_async && 'autocomplete';
        },
        uiOptions() {
            return this.opts.uiOptions || {};
        },
        type() {
            return includes(['phone', 'frenchMobilePhone'], this.opts.uiType) ? 'tel' : // "tel" implies inputmode "tel" which is great on mobiles
               this.realType || !this.opts.uiType ? 'text' : 
               this.opts.uiType === 'integer' ? 'number' :
               this.opts.uiType;
        },
        realType() { 
            return includes(['phone', 'frenchMobilePhone', 'frenchPostalCode', 'siret'], this.opts.uiType) ? this.opts.uiType : undefined;
        },
        choicesMap() {
            return this.oneOf && mapValues(keyBy(this.oneOf, 'const'), choice => choice['title']);
        },
        oneOf() {
            const l = add_to_oneOf_if_missing(this.oneOf_, this.opts.allowUnchangedValue)
            return this.opts.max ? l?.filter(choice => choice.const <= this.opts.max) : l
        },
        validValue() {
            return this.uiType === 'select' ? (
                this.oneOf && find(this.oneOf, choice => (
                    // (allow equality if value is number and choice.const is string)
                    choice.const == this.value // tslint:disable-line
                )) 
            ) : this.val;
        },
        computedValue() {
            return this.opts.computeValue?.()
        },
        formattedValue() {
            return formatValue(this.opts.computeValue ? this.computedValue : this.val)
        },
        input_attrs() {
            return this.type === 'password' ? { autocomplete: 'current_password' } : {}
        },
        vue_component_description() {
            if (!this.uiOptions.texts_are_vue_template) return undefined;
            const text = this.opts.description;
            return text && Vue.extend({ props: ['v'], template: "<div>" + text + "</div>" });
        },
    },
    asyncComputed: {
        async oneOf_() {
            const opts = this.opts || {};
            if (opts.oneOf) {
                return opts.oneOf;
            } else if (opts.oneOf_async && ['select', 'radio'].includes(this.uiType)) {
                return await Ws.search(this.stepName, this.real_name || this.name, '');
            } else {
                return undefined;
            }
        },
    },
    watch: {
        value(val) {
            this.val = val;
        },
        val(val) {
            if (this.opts.normalize) {
                const val_ = this.opts.normalize(val);
                if (val_ !== val) { this.val = val = val_ }
            }
            this.$emit('input', val);
        },
    },
});
</script>
