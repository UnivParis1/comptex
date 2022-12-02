<template>
    <modal v-if="active" @cancel="cancel">
        <h3 slot="header">
            <button type="button" class="close" @click="cancel" title="Annuler">&times;</button>
            <span class="glyphicon glyphicon-warning-sign" aria-hidden="true"></span> {{title}}
        </h3>
        <div slot="body">
            <p class="text-warning" v-html="msg"></p>
        </div>
        <div slot="footer">
            <button type="button" class="btn btn-default" @click="cancel">{{"Annuler"}}</button>
            <button type="button" class="btn btn-primary" @click="ok">{{"Confirmer"}}</button>
        </div>
    </modal>
</template>

<script lang="ts">
import Vue from "vue";
import { ref, Ref } from 'vue';
import * as Helpers from '../services/helpers';

import Modal from '../directives/Modal.vue';

export default Vue.extend({
    components: { Modal },
    setup() {
        const active: Ref<Helpers.promise_defer<null>> = ref(undefined)
        const msg = ref("")
        const title = ref("")
        return {    
            open(labels) {
                msg.value = labels.msg
                title.value = labels.title || "Attention"
                active.value = Helpers.promise_defer()
                return active.value.promise
            },
            active, msg, title,
            cancel() {
                active.value.reject("cancel")
                active.value = undefined
            },
            ok() {
                active.value.resolve(null)
                active.value = undefined
            },
        }
    },
})
</script>

<style scoped>
h3 {
    font-size: 18px;
    margin: 0;
}

.text-warning {
    line-height: 1.8em;
    color: #333;
}  

.btn {
    line-height: 1.8;
    
    width: 35%;
    min-width: 120px;
}
</style>