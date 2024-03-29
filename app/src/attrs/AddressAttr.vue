<template>
<div v-if="opts.readOnly">
   <my-bootstrap-form-group name="address_lines" :opts="opts">
      <textarea :rows="(value||'').split('\n').length" :value="value" class="form-control" disabled></textarea>
   </my-bootstrap-form-group>
</div>
<div v-else>
  <my-bootstrap-form-group name="country" :opts="opts" :validity="validity">
     <typeahead id="country" name="country" v-model="country" :options="conf.countries" v-magic-aria placeholder="Pays" :pattern="conf.pattern.country" :validity.sync="validity.country" :required="!opts.optional"></typeahead>
     <CurrentLdapValue v-model="country" :ldap_value="ldap_val.country"></CurrentLdapValue>
     <validation-errors name="country" :validity="validity" :custom_message="conf.error_msg.country"></validation-errors>
  </my-bootstrap-form-group>
    
 <div v-if="country === 'FRANCE'">
  <my-bootstrap-form-group name="address_lines" :validity="validity">
    <input-with-validity name="address_lines" v-model="lines" v-magic-aria placeholder="Numéro, rue" :validity.sync="validity.address_lines" :required="!opts.optional"></input-with-validity>
    <CurrentLdapValue v-model="lines" :ldap_value="ldap_val.lines"></CurrentLdapValue>
  </my-bootstrap-form-group>
  <my-bootstrap-form-group name="address_line2">
    <input-with-validity name="address_line2" v-model="line2" v-magic-aria placeholder="complément d'adresse"></input-with-validity>
  </my-bootstrap-form-group>
  <my-bootstrap-form-group name="postalCode">
   <div class="row">
    <div class="col-xs-3" :class="{'my-has-error': !validity.postalCode.valid}">
      <div>
        <input-with-validity name="postalCode" v-model="postalCode" pattern="[0-9]{5}" v-magic-aria placeholder="Code postal" :required="!opts.optional" :validity.sync="validity.postalCode"></input-with-validity>
        <CurrentLdapValue v-model="postalCode" :ldap_value="ldap_val.postalCode"></CurrentLdapValue>
        <validation-errors name="postalCode" :validity="validity" :custom_message="conf.error_msg.frenchPostalCode"></validation-errors>
      </div>
    </div>
    <div class="col-xs-9" :class="{'my-has-error': !validity.town.valid}">
      <div>
        <typeahead name="town" v-model="town" :options="towns" placeholder="Ville" :editable="true" :required="!opts.optional" :validity.sync="validity.town"></typeahead>
        <CurrentLdapValue v-model="town" :ldap_value="ldap_val.town"></CurrentLdapValue>
        <validation-errors name="town" :validity="validity"></validation-errors>
      </div>
    </div>
   </div>
  </my-bootstrap-form-group>
 </div>
 <div v-else>
   <my-bootstrap-form-group name="address_lines" :validity="validity">
     <textarea-with-validity rows="5" v-model="lines" class="form-control" :required="!opts.optional" :validity.sync="validity.address_lines"></textarea-with-validity>
   </my-bootstrap-form-group>
 </div>
</div>
</template>

<script lang="ts">
import Vue from "vue";
import * as Helpers from '../services/helpers';
import * as Address from '../../../shared/address';
import CurrentLdapValue from './CurrentLdapValue.vue';

export default Vue.extend({
    props: ['value', 'ldap_value', 'opts'],
    components: { CurrentLdapValue },
    data() {
        return {
            validity: { country: {} as ValidityState, address_lines: {} as ValidityState, postalCode: {} as ValidityState, town: {} as ValidityState },
            ...Address.fromString(this.value),
            ldap_val: this.ldap_value && Address.fromString(this.ldap_value) || {} as Address.PostalAddress,
            postalCode_modified: false,

            towns: undefined as string[], // cf asyncComputed
        };
    },
    watch: {
        value(val) {
            if (val && val !== this.currentValue) Helpers.assign(this, Address.fromString(val));
        },
        currentValue(val) {
            this.$emit('input', val);
        },
        postalCode() {
            this.postalCode_modified = true
        },
        towns(l) {
            if (l && l.length === 1 && this.postalCode_modified) {
                this.town = l[0];
            }
        },
    },
    asyncComputed: {
        async towns() {
            const code = this.postalCode;
            return code?.match('^[0-9]{5}$') ? await Helpers.frenchPostalCodeToTowns(code) : [];
        },
    },
    computed: {
        currentValue() {
            return Address.toString(this);
        },
    },
});
</script>
