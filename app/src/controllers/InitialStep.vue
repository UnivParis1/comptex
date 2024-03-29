<template>
<div class="InitialStep" v-if="title_in_list">
    <div v-if="allow_reuse">
        <h2 v-html="title_in_list"></h2>

        <form novalidate v-if="step.ldap_filter || step.attrs.profilename_to_modify" class="form-horizontal">
            <my-bootstrap-form-group :name="searchUser_inputName" label="Choisir un utilisateur">
                <typeahead :minChars="3" :editable="false" :name="searchUser_inputName"
                            @input="withUser"
                    :options="people_search"
                    :formatting="e => e && (e.givenName + ' ' + e.sn)"></typeahead>
                <div v-if="profiles" style="padding-top: 1rem">
                    <span v-if="profiles.oneOf.length">
                        {{user.givenName}} {{user.sn}} a plusieurs profiles. Veuillez choisir le profil à modifier.
                    </span>
                    <span v-else>
                        Ce compte n'a pas de profil géré par cette application.
                    </span>
                </div>
            </my-bootstrap-form-group>
            <genericAttr :name="searchUser_inputName + '-profile'" :opts="profiles" v-model="profile" :submitted="false" 
                    v-if="profiles && profiles.oneOf.length">
            </genericAttr>
        </form>

        <div v-else>
            <autocomplete-user class="form-control" placeholder="Rechercher une personne" @select="withUser"></autocomplete-user>
        </div>

        <div v-html="labels.description_in_list"></div>
    </div>
    <div v-else>
        <h2 v-if="title_in_list !== ' '">
            <router-link :to="'/' + step.id" v-html="title_in_list"></router-link>
        </h2>
        <div v-html="labels.description_in_list"></div>
    </div>
</div>
</template>

<script lang="ts">
import { includes } from 'lodash';
import Vue from "vue";
import * as Ws from '../services/ws';
import { router } from '../router';
import genericAttr from '../attrs/genericAttr.vue';

export default Vue.extend({
   props: ['step'],
   components: { genericAttr },
   data() { 
       return {
            user: undefined,
            profile: undefined,
            profiles: undefined,
       };
   },
   computed: {
     allow_reuse() {
         return this.step.attrs.uid?.uiType === 'queryParamForActionPre';
     },
     title_in_list() {
         return "title_in_list" in this.labels ? this.labels.title_in_list : this.labels.title;
     },
     labels() {
         return this.step.step.labels || {}
     },
     searchUser_inputName() {
         return "step-" + this.step.id;
     },
   },
   watch: {
     profile(p) {
         this.gotoStep(this.user, p);
     },
   },
   methods: {
     people_search(token) {
         return Ws.people_search(this.step.id, token);
     },
     withUser(u) {
         const need_profile : Ws.StepAttrOption = this.step.attrs.profilename_to_modify;
         if (need_profile) {
             const oneOf = need_profile.oneOf.filter(function (choice) {
                 return includes(u.global_profilename, choice.const);
             });
             if (need_profile.optional) {
                 oneOf.unshift({ const: '', title: 'Créer un nouveau profil' })
             }
             if (oneOf.length === 1) {
                 this.gotoStep(u, oneOf[0].const);
             } else {
                 this.profiles = { ...need_profile, oneOf };
                 this.user = u;
             }
         } else {
             this.gotoStep(u);
         }
     },
     gotoStep(u, profilename = undefined) {
        router.push(`/${this.step.id}?uid=${u.uid}` + (profilename ? `&profilename_to_modify=${profilename}` : ''));
     },
  },  
});
</script>
