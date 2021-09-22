<template>

<div class="ArrayAttr">
    <template v-for="(item, i) in val">
        <genericAttr :real_name="name" :name="name + (i ? '-' + i : '')" :opts="i ? item_opts : first_item_opts" :value="item" @input="v => set_item(i, v)" @array_action="name => array_action(name, i)"
                :stepName="stepName"
                :array_allowed_actions_="{ remove: !opts.readOnly && uiOptions.removable !== false && (opts.optional || i > 0), 
                        move_up: uiOptions.orderable && i > 0, 
                        move_down: uiOptions.orderable && i+1 < val.length }">
        </genericAttr>
    </template>
    <my-bootstrap-form-group :opts="opts" v-if="val.length === 0 || !opts.readOnly">
        <div class="row" v-if="!opts.readOnly && uiOptions.addable !== false">
          <div class="col-sm-offset-10 col-sm-2">
            <button class="btn btn-info ArrayAttr-add" style="width: 100%" type="button" @click="val.push('')" aria-label="Ajouter une valeur">
                <i class="glyphicon glyphicon-plus"></i>
            </button>
          </div>
        </div>
    </my-bootstrap-form-group>

    <my-bootstrap-form-group :class="{ hideIt: !currentLdapValue_shown }">
        <CurrentLdapValue :value="initial_val.join(' ')" :ldap_value="ldap_val.join(' ')" @input="val = [...ldap_val]" @shown="val => currentLdapValue_shown = val"></CurrentLdapValue>
    </my-bootstrap-form-group>
</div>
</template>

<script lang="ts">
import Vue from "vue";
import CurrentLdapValue from './CurrentLdapValue.vue';
import * as _ from 'lodash';

function init(val) {
    return val instanceof Array ? val : val ? [val] : [];
}

function array_move_elt(array, index: number, direction: -1 | 1) {
    array.splice(index + direction, 0, array.splice(index, 1)[0]);
}

export default Vue.extend({
    props: ['name', 'value', 'ldap_value', 'opts', 'stepName'],
    components: { CurrentLdapValue },
    data() {
        let val = init(this.value);
        if (val.length === 0 && !this.opts.optional) val.push('');
        return {
            validity: { [this.name]: {} },
            val,
            ldap_val: init(this.ldap_value),
            initial_val: [...val],
            currentLdapValue_shown: false,
        };
    },
    computed: {
        first_item_opts() { 
            return { ..._.pick(this.opts, 'title', 'labels', 'uiOptions', 'optional', 'readOnly', 'oneOf_async'), ...this.opts.items };
        },
        item_opts() {
            return { ...this.first_item_opts, optional: true };
        },
        uiOptions() {
            return this.opts.uiOptions || {}
        },
    },
    watch: {
        value(val) {
            this.val = init(val);
        },
    },
    methods: {
        tellParent() {
            this.$emit('input', this.val);
        },
        set_item(i, v) {
            this.$set(this.val, i, v);
            this.tellParent();
        },
        array_action(name, i) {
                 if (name === "remove_item") this.val.splice(i, 1);
            else if (name === "move_up") array_move_elt(this.val, i, -1);
            else if (name === "move_down") array_move_elt(this.val, i, 1);
            else console.error("internal error: unknown array_action", name)
            this.tellParent();
        }
    
    },
});
</script>
