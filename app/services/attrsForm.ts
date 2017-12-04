import Vue from "vue";
import conf from '../conf';
import * as Helpers from '../services/helpers';
import * as Ws from '../services/ws';
import { router } from '../router';
import { defaults } from 'lodash';
import { V, StepAttrsOption } from '../services/ws';
import ImportFile from '../import/ImportFile.vue';
import ImportResult from '../import/ImportResult.vue';
import Homonyms from '../controllers/Homonyms.vue';
import template from '../templates/create.html';
import template_awaiting_moderation from '../templates/awaiting-moderation.html';
import template_awaiting_email_validation from '../templates/awaiting-email-validation.html';
import template_auto_created from '../templates/auto-created.html';

function AttrsForm_data() {
    return {
      label: conf.attr_labels,
      step: undefined,
      attrs: <StepAttrsOption> undefined,
      v: <V> undefined,
      v_orig: <V> undefined,
      errorMessages: {},
      submitted: false,
      resp: undefined,

      to_import: undefined,
      imported: <any[]> undefined,
    };    
}

export const AttrsForm = Vue.extend({
    mounted() {
        this.init();
    },
    template,
    props: [ 'wanted_id', 'stepName' ],
    data: AttrsForm_data,
    components: { ImportFile, ImportResult, Homonyms },

    watch: {
        '$route': function() {
            Helpers.assign(this, AttrsForm_data());
            this.init();
        },
    },
    computed: {
        id() {
            return this.wanted_id || "new";
        },
        initialStep() {
            return !this.wanted_id && this.stepName;
        },
        check_homonyms() {
            return !this.initialStep && this.attrs && this.attrs.uid;
        },
        noInteraction() {
            return this.v.noInteraction || Object.keys(this.attrs).length === 0;
        },
        other_attrs(): StepAttrsOption {
            if (this.to_import && this.attrs) {
                return Helpers.filter(this.attrs, (_, k) => !this.to_import.fields.includes(k));
            } else {
                return this.attrs;
            }
        },
    
        // for reuse steps:
        isMember() { 
            let aff = this.v.eduPersonAffiliation;
            return aff && aff.indexOf('member') >= 0;
        },
        anneeInscription() {
            let annees = this.v.supannEtuAnneeInscription;
            return annees && Math.max(...annees);
        },
    },

    methods: {
        init() {
            Ws.getInScope(this, this.id, this.$route.query, this.stepName).then(() => {
                if (this.noInteraction) this.send();
            });    
        },
      submit(event) {
          console.log("submit");
          this.submitted = true;
          if (!event.target.checkValidity()) return;
          if (this.to_import) {
            this.send_new_many();
          } else {
            this.send();
          }
      },
      nextStep(resp) {
        console.log("nextStep");
        if (resp.login && !resp.step) {
            // user created
            if (this.v.supannAliasLogin &&
                this.v.supannAliasLogin !== resp.login) {
                alert("L'utilisateur a été créé, mais avec l'identifiant « " + resp.login + "». Il faut prévenir l'utilisateur");
                this.go_back();
            }
            if (conf.printCardUrl && this.attrs.barcode && !this.v.barcode) {
                document.location.href = conf.printCardUrl(resp.login);
            } else if (this.initialStep) {
                this.templated_response(resp, template_auto_created);
            } else {
                router.push('/steps');            
            }
        } else if (this.step && this.step.labels && this.step.labels.accepted) {
            this.templated_response(resp, "<div>" + this.step.labels.accepted + "</div>");
        } else if (resp.step === 'validate_email') {
            this.templated_response(resp, template_awaiting_email_validation);
        } else if (resp.login) {
            this.templated_response(resp, template_awaiting_moderation);
        } else {
            this.go_back();
        }
      },
      templated_response(resp, template: string) {
        this.resp = resp;
        this.resp.component = Vue.extend({ 
            props: ['resp'], 
            template,
        });
      },
      go_back() {
        if (this.initialStep) {
            // TODO: to test
            document.location.href = conf.base_pathname;
        } else {
            router.push('/steps');            
        }          
      },
      send() {
          Ws.set(this.id, this.stepName, this.v).then(resp => {
              if (resp.error === "no_moderators") {
                  alert(conf.error_msg.noModerators(this.v.structureParrainS.name));
                  this.v.structureParrainS = undefined;
              } else {
                return this.nextStep(resp);
              }
          });
      },
      send_new_many() {
            this.to_import.lines.forEach(v => defaults(v, this.v));

            return Ws.new_many(this.stepName, this.to_import.lines).then(resp => {
                this.imported = resp;
                this.imported.forEach((resp, i) => {
                    resp.v = this.to_import.lines[i];
                });
                //this.to_import = undefined;
                console.log(this.imported);
            });          
      },        
      merge(homonyme) {
          // especially for "uid" attr, but also "mifare", "barcode"
          Helpers.eachObject(homonyme, (attr, val) => {
            if (attr === "score") return;
            if (val && !this.v[attr]) { 
                console.log("adding " + attr + " = " + val); 
                this.v[attr] = val;
                this.v_orig[attr] = val;
            }
          });
          this.v_orig = Helpers.copy(this.v_orig); // make it clear for Vuejs that v_orig has been updated
        },
      reject() {
        Ws.remove(this.id, this.stepName).then(this.nextStep);
      }
    },
});

