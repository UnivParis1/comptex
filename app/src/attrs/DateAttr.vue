<template>
  <my-bootstrap-form-group :name="name" :opts="opts" :validity="validity">
    <span :class="{ inputWithButton: todayButton }">
      <input-with-validity :name="name" v-model="val" type="date"
         :disabled="opts.readOnly"
         :min="min" :max="max" :required="!opts.optional" :validity.sync="validity[name]"></input-with-validity>
      <button v-if="todayButton" class="btn btn-primary" type="button" @click="set_today">{{todayButton}}</button>
    </span>
    <CurrentLdapValue :value="initial_val" :ldap_value="ldap_val" @input="v => val = v"></CurrentLdapValue>
    <span class="attr-description" v-html="opts.description"></span>
  </my-bootstrap-form-group>
</template>

<script lang="ts">
import Vue from "vue";
import { toYYYY_MM_DD, to_absolute_date } from "../services/helpers";
import CurrentLdapValue from './CurrentLdapValue.vue';

const init = toYYYY_MM_DD;

export default Vue.extend({
    props: ['name', 'value', 'ldap_value', 'opts'],
    components: { CurrentLdapValue },
    data() {
        const val = init(this.value);
        const ldap_val = init(this.ldap_value);
        return {
            validity: { [this.name]: {} },
            val,
            ldap_val,
            initial_val: val, 
        };
    },
    watch: {
        value(date) {
            if (date && date !== this.date) this.val = init(date);
        },
        date(date) {
            this.$emit('input', date);
        },
    },
    computed: {
        date() {
            return this.val && new Date(this.val) || undefined;
        },
        min() {
            return toYYYY_MM_DD(to_absolute_date(this.opts.minDate));
        },
        max() {
            return toYYYY_MM_DD(to_absolute_date(this.opts.maxDate));
        },
        todayButton() {
            return this.opts?.uiOptions?.date_todayButton
        },
    },
    methods: {
        set_today() {
            this.val = toYYYY_MM_DD(new Date())
        },
    }
});
</script>
