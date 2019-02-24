<template>

<div>
    <label v-if="val.length === 0" class="col-md-3 control-label">{{opts.title}}</label>
    <div v-for="(item, i) in val">
        <genericAttr :name="name + (i ? '-' + i : '')" :opts="i ? item_opts : first_item_opts" :value="item" @input="v => set_item(i, v)" @remove="_ => remove_item(i)"
                :allow_remove="opts.optional || i > 0" :submitted="submitted">
        </genericAttr>
    </div>
    <div :class="'col-sm-offset-' + (val.length ? 10 : 7)" class="col-sm-2" style="padding: 0 0 2rem 0">
        <button class="btn btn-info" style="width: 100%" type="button" @click="val.push('')"><i class="glyphicon glyphicon-plus"></i></button>
    </div>
    <my-bootstrap-form-group>
        <CurrentLdapValue :value="initial_val.join(' ')" :ldap_value="ldap_val.join(' ')" @input="val = [...ldap_val]"></CurrentLdapValue>
    </my-bootstrap-form-group>
</div>
</template>

<script lang="ts">
import Vue from "vue";
import CurrentLdapValue from './CurrentLdapValue.vue';

function init(val) {
    return val instanceof Array ? val : val ? [val] : [];
}

export default Vue.extend({
    props: ['name', 'value', 'ldap_value', 'opts', 'submitted'],
    components: { CurrentLdapValue },
    data() {
        let val = init(this.value);
        if (val.length === 0 && !this.opts.optional) val.push('');
        return {
            validity: { [this.name]: {}, submitted: false },
            val,
            ldap_val: init(this.ldap_value),
            initial_val: [...val],
        };
    },
    computed: {
        first_item_opts() { 
            return { title: this.opts.title, optional: this.opts.optional, ...this.opts.items };
        },
        item_opts() {
            return { optional: true };
        },
    },
    watch: {
        value(val) {
            this.val = init(val);
        },
        submitted(b) {
            this.validity.submitted = b;
        },
    },
    methods: {
        tellParent() {
            this.$emit('input', this.val);
        },
        set_item(i, v) {
            this.val[i] = v;
            this.tellParent();
        },
        remove_item(i) {
            this.val.splice(i, 1);
            this.tellParent();
        }
    
    },
});
</script>