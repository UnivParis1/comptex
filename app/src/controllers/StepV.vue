<template>
<div class="normalContent">
 <div v-if="resp && resp.component" class="response">
    <component :is="resp.component" :resp="resp" :v_pre="v_pre" :v="v"></component>
 </div>
 <div v-else-if="v">
  <h2 style="margin-top: 2em" v-html="step.labels.title" v-if="step.labels.title"></h2>

  <div v-if="additional_public_info">
      <div v-html="additional_public_info.description"></div>
      <br>
  </div>

  <div class="step_description" v-if="step_description">
    <component :is="step_description" :id="id" :v_pre="v_pre" :v="v" :v_display="v_display" :potential_homonyms="potential_homonyms"></component>
  </div>
  <div v-if="noInteraction">
    Veuillez patienter
  </div>

  <div v-if="v_ldap && v_ldap.global_main_profile && !(v.global_main_profile && v.global_main_profile.description === v_ldap.global_main_profile.description) && !merged_homonyms.some(h => h.uid === v_ldap.uid)" class="alert alert-info">
        La demande concerne le compte existant « {{v_ldap.uid}} »
        ({{v_ldap.givenName}} {{v_ldap.sn}} <span v-html="v_ldap.global_main_profile.description"></span>)
  </div>

  <div v-if="imported">
    <ImportResult :imported="imported" :ordered_fields="to_import.fields" @done="imported = to_import = undefined"></ImportResult>
  </div>

  <div v-else>

   <div v-if="check_homonyms && !all_potential_homonyms">
       Recherche des homonymes, veuillez patienter...
   </div>
   <div v-else-if="potential_homonyms.length">
      <Homonyms :v="v" :l="potential_homonyms" @merge="merge">
      </Homonyms>
   </div>
   <div v-else>

    <div v-if="merged_homonyms.length">
        <p style="height: 2em"></p>
            <div class="alert alert-danger" v-for="h in merged_homonyms">
                Le compte sera fusionné avec le compte existant {{h.merged_ids_values}}.
                <p/>
                {{h.givenName}} {{h.sn}} <span v-html="h.global_main_profile.description"></span>
            </div>
    </div>

    <div v-if="step.allow_many">
        <ImportFile :attrs="attrs" @change="val => to_import = val" :forced_headers="step.allow_many.forced_headers"></ImportFile>
        <div v-if="to_import && Object.keys(other_attrs).length" style="margin: 2em 0 1em">
            Les champs ci-dessous n'ont pas été fournis par le fichier importé. Vous pouvez choisir des valeurs qui s'appliqueront à tous.
        </div>
    </div>
             
    <MyModalP ref="MyModalP"></MyModalP>

    <attrsForm
        :class="{ display_fieldIsRequired_hint: display_fieldIsRequired_hint }"
        :v="v" :v_ldap="v_ldap" :attrs="other_attrs" :step_labels="step.labels" :stepName="stepName"
        :disableOkButton="disableOkButton"
        @submit="submit" @reject="reject"></attrsForm>

    <div class="display_fieldIsRequired_hint" v-if="display_fieldIsRequired_hint">
        <hr style="margin-top: 4rem">
        <p><span class="required_field"></span> Champs obligatoires</p>
    </div>

    <div v-if="step_post_scriptum">
        <hr style="margin-top: 2rem">
        <component :is="step_post_scriptum" :id="id" :v_pre="v_pre" :v="v"/>
    </div>

   </div> <!-- !homonyms -->
  </div> <!-- imported -->
 </div> <!-- v -->
</div>
</template>

<script lang="ts">
import Vue from "vue";
import conf from '../conf';
import * as Helpers from '../services/helpers';
import * as Ws from '../services/ws';
import { router } from '../router';
import * as _ from 'lodash'
import { defaults, isEqual, isEmpty } from 'lodash';
import { StepAttrsOption } from '../services/ws';
import { compute_mppp_and_handle_default_values } from '../../../shared/mppp_and_defaults';

import ImportFile from '../import/ImportFile.vue';
import ImportResult from '../import/ImportResult.vue';
import Homonyms from '../controllers/Homonyms.vue';
import attrsForm from '../attrs/attrsForm';
import MyModalP from './MyModalP.vue';
import { filterAttrs, formatValue } from "../../../shared/v_utils";


function AttrsForm_data() {
    return {
      v_orig: undefined,
      resp: undefined,
      to_import: undefined,
      imported: <any[]> undefined,
      all_potential_homonyms: undefined,
    };    
}

export let v_from_prevStep = {};

let detectIdle = Helpers.detectIdle()

export default Vue.extend({
    mounted() {
        this.init();

        if (this.step.logout_on_idle) {
            const detectIdle_action = () => {
                window.onbeforeunload = () => {} // do not block logout
                document.location = this.step.logout_on_idle.logoutUrl
            }
            detectIdle.install({
                ...this.step.logout_on_idle,
                softAction: async () => {
                    if (!this.$refs.MyModalP.active) {
                        console.log('detectIdle.softAction')
                        await this.$refs.MyModalP.open({ msg: 'Vous êtes inactif. Vous allez être rediriger vers la page de déconnexion' })
                        detectIdle_action()
                    }
                },
                action: detectIdle_action,
            })
        }

        window.onbeforeunload = (e) => {
            if (!isEqual(this.v, this.v_orig) && !this.resp) {
                e.preventDefault();
                // Google Chrome requires returnValue to be set.
                e.returnValue = '';
                // All supported browsers will show a localized message
            }
        }
    },
    props: [
        'wanted_id', 'stepName', 
        'id', 'v_pre',
        'step', 'attrs', 'all_attrs_flat', 'v', 'v_ldap',
        'additional_public_info',
    ],
    data: AttrsForm_data,
    components: { ImportFile, ImportResult, Homonyms, attrsForm, MyModalP },

    computed: {
        initialStep() {
            return !this.wanted_id && this.stepName;
        },
        check_homonyms() {
            return !_.every(this.homonym_attrs, attr => this.v[attr])
        },
        noInteraction() {
            return this.v.noInteraction;
        },
        attrs_() {
            return this.attrs && Helpers.filter(this.attrs, (opts) => !opts.uiHidden);
        },
        homonym_attrs() {
            return Object.keys(_.pickBy(this.attrs_ || {}, (opts) => opts.uiType === 'homonym'))
        },
        display_fieldIsRequired_hint() {
            if (!this.attrs) return false;
            const nb_optional = Object.keys(Helpers.filter(this.all_attrs_flat, (opts) => !opts.readOnly && opts.optional)).length
            const nb_required = Object.keys(Helpers.filter(this.all_attrs_flat, (opts) => !opts.readOnly && !opts.optional)).length
            return conf.may_display_fieldIsRequired_hint && nb_required && nb_optional
        },

        other_attrs(): StepAttrsOption {
            let { attrs, current_defaults } = compute_mppp_and_handle_default_values(this.attrs, this.prev_defaults, this.v);
            this.v_orig ??= Helpers.copy(this.v)
            this.prev_defaults = current_defaults;

            // no need to go through chosen oneOf, since "compute_mppp_and_handle_default_values" has already merged things
            attrs = filterAttrs(attrs, 'never', (opts, k) => (
                (opts.uiHidden === 'ifFalsy' ? this.v[k] : opts.uiHidden !== true) &&
                !(this.to_import && this.to_import.fields.includes(k)) &&
                !(this.$route.query && (k in this.$route.query)) // do not display things that have been forced in the url
            ));
            return attrs;
        },
        step_description() {
            const text = this.step?.labels?.description;
            return text && Vue.extend({ props: ['id', 'v_pre', 'v', 'v_display', 'potential_homonyms'], template: "<div>" + text + "</div>" });
        },
        step_post_scriptum() {
            const text = this.step?.labels?.post_scriptum;
            return text && Vue.extend({ props: ['id', 'v_pre', 'v'], template: "<div>" + text + "</div>" });
        },
        disableOkButton() {
            return this?.step?.if_no_modification === 'disable-okButton' && (isEqual(this.v, this.v_orig) && !this.v?.various?.extern_ask_confirmation)
        },
        potential_homonyms() {
            return (this.all_potential_homonyms || []).filter(h => !h.ignore);
        },
        merged_homonyms() {
            return (this.all_potential_homonyms || []).filter(h => h.merged_ids_values);
        },
    },

    methods: {
        init() {
            if (this.noInteraction) this.send();
            this.may_update_potential_homonyms({});
        },
        async may_update_potential_homonyms(v, v_orig = null) {
            if (this.check_homonyms && !isEqual(v, v_orig)) {
                await this.update_potential_homonyms(v);
            }
        },
        async update_potential_homonyms(v) {
            const l = !this.v.birthDay && !this.v.sn ? [] : await Ws.homonymes(this.id, v, this.all_attrs_flat, this.v_pre, this.stepName);
            l.forEach(h => h.ignore = h.merged_ids_values = false);
            const have_the_same_ids = (a, b) => _.every(this.homonym_attrs, attr => a[attr] === b[attr])
            this.all_potential_homonyms = _.unionWith(this.all_potential_homonyms || [], l, have_the_same_ids)
        },
        async submit_() {
            await this.may_update_potential_homonyms(this.v, this.v_orig);
            if (this.potential_homonyms.length) {
                // we cannot submit, we must display the new potential homonyms
            } else {
                await (this.to_import ? this.send_new_many() : this.send());
            }
        },
      submit(v, deferred) {
          // NB: must resolves "deferred" which blocks submitting until promise is finished
          this.v = v;
          let p = this.submit_();
          Helpers.promise_defer_pipe(p, deferred)
      },
      nextStep(resp) {
        this.resp = resp
        console.log("nextStep", resp);
        if (resp.forceBrowserExit) {
            Helpers.createCookie('forceBrowserExit', 'true', 0);
        }
        if (resp.nextBrowserStep) {
            this.nextBrowserStep(resp);
            return;
        }
        const template = resp.labels && resp.labels.added || this.step && this.step.labels && this.step.labels.accepted;
        if (template) {
            this.templated_response(resp, "<div>" + template + "</div>");
            return;
        }
        if (resp.login && !resp.step) {
            // user created
            if (this.v.supannAliasLogin &&
                this.v.supannAliasLogin !== resp.login) {
                alert("L'utilisateur a été créé, mais avec l'identifiant « " + resp.login + "». Il faut prévenir l'utilisateur");
            }
        }
        this.go_back();
      },
      nextBrowserStep(resp) {
        if (resp.v) Object.assign(this.v, resp.v)
        // passwords must NOT be passed as query, pass them in javascript memory
        // in that case, add "prev" parameter to correctly handle missing "v_from_prevStep" parameters
        let query;

        [ v_from_prevStep, query ] = Helpers.partitionObject(
            resp.v || _.omit(this.v, 'various'),
            (k, _) => (this.attrs[k] || {}).uiType === 'password'
        );

        query = Ws.toWs(query, this.all_attrs_flat);

        if (!isEmpty(v_from_prevStep)) {
            query.prev = this.$route.path.replace(/^\//, '');
        }
        const url = resp.nextBrowserStep.url
        if (url.match(/^https?:\/\//)) {
            document.location.href = url
        } else {
            const params = resp.nextBrowserStep.params || { mode: 'query', prefix: '' }
            if (params.prefix) {
                query = _.mapKeys(query, (_, k) => resp.nextBrowserStep.params.prefix + k)
            }
            let hash;
            [ hash, query ] = Helpers.partitionObject(query, (_, val) => val?.length > 1_000)
            
            if (params.none) {
                router.push({ path: url });
            } else if (params.mode === 'hash') {
                router.push({ path: url, hash: "" + new URLSearchParams(_.pickBy(query, (val) => val)) });
            } else if (hash) {
                router.push({ path: url, query, hash: "" + new URLSearchParams(_.mapKeys(hash, (_, k) => `set_${k}`)) });
            } else {
                router.push({ path: url, query });
            }
        }
      },
      templated_response(resp, template: string) {
        this.resp = {
            ...resp,
            component: Vue.extend({ props: ['resp', 'v_pre', 'v'], template }),
        };
      },
      v_display(attr: string) {
        return formatValue(this.v[attr], this.all_attrs_flat[attr])
      },
      go_back() {
        if (this.initialStep) {
            // TODO: to test
            document.location.href = conf.base_pathname;
        } else {
            router.push('/steps');            
        }          
      },
      async send() {
          const resp = await Ws.set(this.id, this.stepName, this.v, this.v_pre, this.all_attrs_flat)
          let extern_ask_confirmation = this.v.various?.extern_ask_confirmation
          if (resp.ask_confirmation) {
              // "action_post" returned object "ask_confirmation" => prompting user
              if (extern_ask_confirmation) {
                  // unused?
                  for (const p of Object.values(extern_ask_confirmation)) {
                      resp.ask_confirmation.msg += " " + p['msg']
                  }
              }
              await this.$refs.MyModalP.open(resp.ask_confirmation)
              this.v[resp.ask_confirmation.attr_to_save_confirmation] = true;
              await this.send();
          } else {
              if (extern_ask_confirmation) {
                  // This is a complex functionality, useful when hosting an iframe of another application:
                  // the "submit" callback can submit the form of this extern application (if hosted on same vhost)
                  for (const p of Object.values(extern_ask_confirmation)) {
                    await p['submit']()
                  }
                  delete this.v.various.extern_ask_confirmation
              }
              this.nextStep(resp);
          }
      },
      async send_new_many() {
            this.to_import.lines.forEach(v => defaults(v, this.v));
            const resp = await Ws.new_many(this.stepName, this.to_import.lines, this.all_attrs_flat)

            // adding each "v" to each success/error response
            let vrs = resp.map((r, i) => ({ ...r, v: this.to_import.lines[i] }));

            const to_ask_confirmation = vrs.filter(vr => vr.error?.ask_confirmation)
            if (to_ask_confirmation.length) {
                // what we need to do:
                // - ask all confirmations at once
                // - if ok, retry only the one that needed confirmation
                // - merge in those responses in the array of all responses
                let sub_resp
                try {
                    // first ask
                    const msg = to_ask_confirmation.map(vr => vr.error.ask_confirmation.msg).join("<br>")
                    await this.$refs.MyModalP.open({ msg })
                    // ok, we can retry those
                    for (const vr of to_ask_confirmation) {
                        vr.v[vr.error.ask_confirmation.attr_to_save_confirmation] = true;
                    }
                    sub_resp = await Ws.new_many(this.stepName, to_ask_confirmation.map(vr => vr.v), this.all_attrs_flat)
                } catch (e) {
                    sub_resp = to_ask_confirmation.map(_ => ({ error: "Refusé" }))
                }
                // overwrite "vrs" with "sub_resp" (NB: indexes are different)
                let subi = 0
                vrs = vrs.map(vr => vr.error?.ask_confirmation ? { v: vr.v, ...sub_resp[subi++] } : vr)
            }
            this.imported = vrs;
            console.log(this.imported);
      },        
      merge(homonyme) {
          Helpers.eachObject(homonyme, (attr, val) => {
            if (!val) return;
            const is_id_attr = this.homonym_attrs.includes(attr)
            if (homonyme.mergeAll || is_id_attr || attr.match(/^global_/)) {
                if (this.v[attr] && this.v[attr] === val) {
                    // nothing to do
                } else if (this.v[attr] && !is_id_attr) {
                    // no overriding
                } else {
                    // NB: we allow overriding v attr. Especially useful when "uid"+"supannAliasLogin" are uiType "homonym"
                    console.log(this.v[attr] ? "setting" : "adding", attr, "=", val); 
                    this.v[attr] = val;

                    // NB: in unit tests, v_orig may not be computed yet
                    if (this.v_orig) this.v_orig[attr] = val;
                }
            }
          });

          const merged_ids: string[] = this.homonym_attrs.filter(attr => homonyme[attr])
          // set the values for idA and/or idB for display in template
          homonyme.merged_ids_values = _.uniq(_.at(homonyme, merged_ids)).join('/')
          // if "homonym" has both idA & idB, mark as ignored all other homonymes with either idA or idB
          // if "homonym" has only idA, mark as ignored homonymes with either idA, but keeping those with only idB
          for (const h of this.all_potential_homonyms) {
              h.ignore ||= _.some(merged_ids, attr => h[attr])
          }
          // tell Vue.js
          this.all_potential_homonyms = [...this.all_potential_homonyms]

          if (homonyme.uid) {
            this.v_ldap = homonyme;
          }
          this.v_orig = Helpers.copy(this.v_orig); // make it clear for Vuejs that v_orig has been updated
        },
      reject(v) {
        this.v = v;
        Ws.remove(this.id, this.stepName).then(this.go_back);
      }
    },
});

</script>
