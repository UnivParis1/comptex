<template>
<div v-if="opts.readOnly">
   <my-bootstrap-form-group name="address_lines" :opts="opts">
      <textarea :rows="(modelValue||'').split('\n').length" :value="modelValue" class="form-control" disabled></textarea>
   </my-bootstrap-form-group>
</div>
<div v-else>
  <my-bootstrap-form-group name="country" :opts="opts" :validity="validity">
     <typeahead id="country" name="country" autocomplete="country-name" v-model="a.country" :options="conf.countries" v-magic-aria placeholder="Pays" :pattern="conf.pattern.country" v-model:validity="validity.country" :required="!opts.optional"></typeahead>
     <CurrentLdapValue v-model="a.country" :ldap_value="ldap_val.country"></CurrentLdapValue>
     <validation-errors name="country" :validity="validity" :custom_message="conf.error_msg.country"></validation-errors>
  </my-bootstrap-form-group>
    
 <div v-if="a.country.toUpperCase() === 'FRANCE'">
  <my-bootstrap-form-group name="address_lines" :validity="validity">
    <input-with-validity name="address_lines" autocomplete="address-line1" v-model="a.lines" v-magic-aria placeholder="Numéro, rue" v-model:validity="validity.address_lines" :required="!opts.optional"></input-with-validity>
    <CurrentLdapValue v-model="a.lines" :ldap_value="ldap_val.lines"></CurrentLdapValue>
  </my-bootstrap-form-group>
  <my-bootstrap-form-group name="address_line2">
    <input-with-validity name="address_line2" autocomplete="address-line2" v-model="a.line2" v-magic-aria placeholder="complément d'adresse"></input-with-validity>
  </my-bootstrap-form-group>
  <my-bootstrap-form-group name="postalCode">
   <div class="row">
    <div class="col-xs-3" :class="{'my-has-error': !validity.postalCode.valid}">
      <div>
        <input-with-validity name="postalCode" autocomplete="postal-code" v-model="a.postalCode" pattern="[0-9]{5}" v-magic-aria placeholder="Code postal" :required="!opts.optional" v-model:validity="validity.postalCode"></input-with-validity>
        <CurrentLdapValue v-model="a.postalCode" :ldap_value="ldap_val.postalCode"></CurrentLdapValue>
        <validation-errors name="postalCode" :validity="validity" :custom_message="conf.error_msg.frenchPostalCode"></validation-errors>
      </div>
    </div>
    <div class="col-xs-9" :class="{'my-has-error': !validity.town.valid}">
      <div>
        <typeahead name="town" autocomplete="address-level2" v-model="a.town" :options="towns" placeholder="Ville" :editable="true" :required="!opts.optional" v-model:validity="validity.town"></typeahead>
        <CurrentLdapValue v-model="a.town" :ldap_value="ldap_val.town"></CurrentLdapValue>
        <validation-errors name="town" :validity="validity"></validation-errors>
      </div>
    </div>
   </div>
  </my-bootstrap-form-group>
 </div>
 <div v-else>
   <my-bootstrap-form-group name="address_lines" :validity="validity">
     <textarea-with-validity autocomplete="street-address" rows="5" v-model="a.lines" class="form-control" 
        :required="!opts.optional" v-model:validity="validity.address_lines"
        placeholder="Adresse postale
(sans le nom de pays)"
     ></textarea-with-validity>
   </my-bootstrap-form-group>
 </div>
</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import * as Helpers from '../services/helpers.ts';
import * as Address from '../../../shared/address.ts';
import CurrentLdapValue from './CurrentLdapValue.vue';
import { asyncComputed_, object_replace } from "@/services/helpers"

const props = defineProps<{
    modelValue: string | undefined,
    ldap_value: string | undefined,
    opts: SharedStepAttrOption & CommonStepAttrOptionT<{}>,
}>()

const emit = defineEmits<{
    'update:modelValue': [val: string],
}>();

const validity = reactive({ country: {} as ValidityState, address_lines: {} as ValidityState, postalCode: {} as ValidityState, town: {} as ValidityState })

const a = reactive(Address.fromString(props.modelValue))
watch(() => props.modelValue, (val) => {
    if (val && val !== currentValue.value) {
        object_replace(a, Address.fromString(val))
    }
})

const ldap_val = computed(() => props.ldap_value && Address.fromString(props.ldap_value) || {} as Address.PostalAddress)

const postalCode_modified = ref(false)
watch(() => a.postalCode, () => {
    postalCode_modified.value = true
})

const currentValue = computed(() => Address.toString(a))
watch(currentValue, (val) => {
    emit('update:modelValue', val);
})

const towns = asyncComputed_(async function () {
    const code = a.postalCode;
    return code?.match('^[0-9]{5}$') ? await Helpers.frenchPostalCodeToTowns(code) : [];
})
watch(() => towns.value, (l) => {
    if (l && l.length === 1 && postalCode_modified.value) {
        a.town = l[0];
    }
})

// help typechecking tests, needed because of https://github.com/vuejs/language-tools/issues/3808
defineExpose({ currentValue, a, validity })

</script>
