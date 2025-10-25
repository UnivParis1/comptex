import { defineComponent } from "vue";

import { pickBy, findKey, find, isEmpty, uniq, some } from 'lodash';
import * as Helpers from '../services/helpers';
import genericAttr from './genericAttr.vue';

import template from './attrsForm.html?raw';

const firstInvalidFormElement = (subform) => (
    find(subform.elements, input => !(input.validity && input.validity.valid))
)

const ensureElementErrorIsVisible = (subform) => {
    let toShow
    for (const input of subform.elements) {
        if (!(input.validity && input.validity.valid)) {
            if (Helpers.isElementInViewport(input)) return;
            if (!toShow) toShow = input
        }
    }
    if (toShow) toShow.scrollIntoView({ behavior: "smooth" })
}


export default defineComponent({
    props: ['v', 'v_ldap', 'attrs', 'step_labels', 'stepName', 'disableOkButton'],
    data() {
        return {
            selectedTab: undefined,
            submitted: false,
        };
    },
    template,
    components: { genericAttr },

    computed: {
        selectedTab_() {
            return this.selectedTab || findKey(this.tabs, (_opts, name) => this.v[name]) || Object.keys(this.tabs)[0];
        },
        tabs() {
            return this.attrs ? pickBy(this.attrs, opts => opts.properties) : {};
        },
        attrs_outside_tabs() {
            return pickBy(this.attrs, (opts, _) => opts.uiType !== 'homonym' && opts.uiType !== 'tab');
        },
        browser_validate() {
            // when you set the date part of a datetime, the input is not valid, but we can't know it with Vue
            // => we force default browser validation, which is quite ok (but will not handle our tabs)
            return some(this.attrs, (opts, _) => opts.uiType === 'datetime');
        },
    },
    methods: {
      submit(event) {
          // NB: returns a promise which blocks submitting until promise is finished
          console.log("submit");
          this.submitted = true;
          if (!event.target.checkValidity()) {
              this.ensureElementErrorIsVisible()
              return Promise.resolve();
          }
          
          let deferred =  Helpers.promise_defer()
          this.$emit('submit', this.v, deferred);
          return deferred.promise.catch(error => {
              if (error.attrName) {
                  this.ensureAttrIsVisible(error.attrName)
              }
          })
      },
      ensureAttrIsVisible(attrName) {
          if (isEmpty(this.tabs)) return
          const tabName = uniq([ this.selectedTab_, ...Object.keys(this.tabs) ]).find(name => this.tabs[name].properties[attrName])
          if (tabName && tabName !== this.selectedTab_) {
              this.selectedTab = tabName
              console.log("forcing tab", this.selectedTab)
          }
      },
      ensureElementErrorIsVisible() {
          if (isEmpty(this.tabs)) {
              ensureElementErrorIsVisible(this.$el) // root element is the <form>
          } else {
              for (const tabName of uniq([ this.selectedTab_, ...Object.keys(this.tabs) ])) {
                  const subform = document.getElementById('panel_' + tabName)
                  if (firstInvalidFormElement(subform)) {
                      if (tabName !== this.selectedTab_) {
                        this.selectedTab = tabName
                        console.log("forcing tab", this.selectedTab, "which contains errors")
                      }
                      // if we forced a tab, we must wait for element to be visible
                      Vue.nextTick(() => ensureElementErrorIsVisible(subform))
                      break
                  }
              }
          }
      },

      formatIdpId(s) {
          s = s.replace(/^https?:\/\//, '');
          s = s.replace(/.*\.(.*\..*)/, '$1');
          return s;
      },

      reject() {
          this.$emit('reject', this.v);
      }
    },
});

