<template>
  <my-bootstrap-form-group :name="name" :opts="opts" :validity="validity">
    <input-with-validity :name="name" v-model="val" type="datetime-local"
        :disabled="opts.readOnly"
        :min="min" :max="max" :required="!opts.optional" v-model:validity="validity[name]"></input-with-validity>
    <CurrentLdapValue :modelValue="initial_val" :ldap_value="ldap_val" @update:modelValue="v => val = v as any"></CurrentLdapValue>
    <span class="attr-description" v-html="opts.description"></span>
  </my-bootstrap-form-group>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { formatDate, to_absolute_date } from "../services/helpers";
import CurrentLdapValue from './CurrentLdapValue.vue';

const init = (d: Date) => formatDate(d, 'yyyy-MM-ddTHH:mm');

export default defineComponent({
    props: ['name', 'modelValue', 'ldap_value', 'opts'],
    emits: ['update:modelValue'],
    components: { CurrentLdapValue },
    data() {
        const val = init(this.modelValue);
        const ldap_val = init(this.ldap_value);
        return {
            validity: { [this.name]: {} },
            val,
            ldap_val,
            initial_val: val, 
        };
    },
    watch: {
        modelValue(datetime) {
            if (datetime && datetime !== this.datetime) this.val = init(datetime);
        },
        datetime(datetime) {
            this.$emit('update:modelValue', datetime);
        },
    },
    computed: {
        datetime() {
            return this.val && new Date(this.val) || undefined;
        },
        min() {
            return init(to_absolute_date(this.opts.minDate));
        },
        max() {
            return init(to_absolute_date(this.opts.maxDate));
        },
    },
});
</script>
