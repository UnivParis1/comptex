import Vue from "vue";
import { uniq } from "lodash";
import conf from '../conf';
import * as Helpers from '../services/helpers';

const checkValidity = {
  methods: {
    onchange(event) {
        this.$emit("input", event.target.value);
        this.checkValidity();
        return false;
    },
    on_value_set(v) {
        if (v !== this.$el.value) {
            this.$el.value = v; // do it now to update validity. but do not do it if unchanged otherwise it breaks cursor position for some browsers
            this.checkValidity();
        }        
    },
    checkValidity() {
        this.checkValidityEl(this.$el);
    },
    checkValidityEl(el) {   
        let validity = Helpers.copy(el.validity, { allAttrs: true });        
        validity.message = el.validationMessage;
        this.emitValidityIfChanged(validity);
    },
    emitValidityIfChanged(validity) {
        let s = JSON.stringify(validity);
        if (s !== this.prevValidity) {
            this.prevValidity = s;
            this.$emit('update:validity', validity);
        }          
    },
  },
};

Vue.component('input-with-validity', {
  template: "<input :name='name' :value='value' :type='type'>",
  props: ['value', 'name', 'type', 'sameAs', 'allowedChars', 'realType', 'pattern', 'min', 'max'],
  mixins: [checkValidity],
  mounted() {
    let element = this.$el;

    element.setAttribute('id', this.name);
    element.classList.add("form-control");
    this._setPattern();

    element.addEventListener('input', checkValidity.methods.onchange.bind(this))
    this.checkValidity();
  },
  watch: {
    value: 'on_value_set',
    min(v) { this._attrUpdated('min', v) },
    max(v) { this._attrUpdated('max', v) },
    sameAs(v) { this._attrUpdated('pattern', Helpers.escapeRegexp(v)) },
  },
  methods: {
    tellParent() { 
        this.$emit("input", this.$el.value);
    },
    checkValidity() {
        if (this.allowedChars) this._checkAllowedChars();
        if (this.realType) this._checkRealType();
        checkValidity.methods.checkValidity.call(this);
    },
    _attrUpdated(name, v) {
        this.$el.setAttribute(name, v);
        this.checkValidity();
    },
    _setPattern() {
        for (const name of ['pattern', 'min', 'max']) {
            if (this[name]) this.$el.setAttribute(name, this[name]);
        }
        if (this.realType === 'phone') this.$el.setAttribute('pattern', conf.pattern.phone);
        if (this.realType === 'mobilePhone') this.$el.setAttribute('pattern', conf.pattern.frenchMobilePhone);
        if (this.realType === 'frenchPostalCode') this.$el.setAttribute('pattern', conf.pattern.frenchPostalCode);
    },
    _setCustomMsg(msg) {
        this.$el.setCustomValidity(msg);
    },
    _checkAllowedChars() {
        let errChars = (this.$el.value || '').replace(new RegExp(this.allowedChars, "g"), '');
        this._setCustomMsg(errChars !== '' ? conf.error_msg.forbiddenChars(errChars) : '');
    },
    _checkRealType() {
        let validity = this.$el.validity;
        let msg = '';
        switch (this.realType) {
            case 'phone' :
                if (validity.patternMismatch) msg = conf.error_msg.phone;
                break;
            case 'mobilePhone' :
                if (validity.patternMismatch) msg = conf.error_msg.mobilePhone;
                break;
            case 'frenchPostalCode':
                if (validity.patternMismatch) msg = conf.error_msg.frenchPostalCode;
                break;
            case 'siret':
                if (!Helpers.checkLuhn(this.$el.value, 14)) msg = conf.error_msg.siret;
                break;
        }
        this._setCustomMsg(msg);
    }
  },
});

Vue.component('radio-with-validity', {
  template: `
  <span>
    <label class="radio-inline" v-for="(descr, val) in values">
       <input type="radio" :name="name" :value="val" :checked="val == value" @change="onchange" :required="required">
       {{descr}}
    </label>
  </span>`,
  props: ['value', 'name', 'values', 'required'],
  mixins: [ checkValidity ],
  mounted() {
    this.checkValidity();
  },
  watch: {
      value: 'on_value_set',
  },
  methods: {
    on_value_set(v) {
        this.emitValidityIfChanged(v ? { valid: true } : { valueMissing: true, message: conf.error_msg.radio_required });
    },
    checkValidity() {
        const el = this.$el.querySelector('input'); // any <input> will do
        this.checkValidityEl(el);
    },
  },
});

Vue.component('select-with-validity', {
    template: `
    <select :name="name" :value="value" @change="onchange" class="form-control">
        <option v-for="option in choices" :value="option.const">
            {{option.title}}
        </option>
    </select>
    `,
    props: ['value', 'name', 'choices'],
    mixins: [ checkValidity ],
    mounted() {
      this.checkValidity();
    },
    watch: {
      value: 'on_value_set',
    },
});

// Emitted values: '' | true
Vue.component('checkbox-with-validity', {
    template: `<input type="checkbox" :name="name" :checked="value" @change="onchange">`,
    props: ['value', 'name'],
    mixins: [ checkValidity ],
    mounted() {
      this.checkValidity();
    },
    watch: {
      value: 'on_value_set',
    },
    methods: {
        onchange(event) {
            this.$emit("input", event.target.checked || '');
            this.checkValidity();
            return false;
        },    
    },
});
  
Vue.component('textarea-with-validity', {
  template: `<textarea :value="value" @input="onchange"></textarea>`,
  props: ['value'],
  mixins: [ checkValidity ],
  mounted() {
    this.checkValidity();
  },
  watch: {
    value: 'on_value_set',
  },
});

Vue.component('history-textarea-with-validity', {
  template: `<typeahead :name="name" :value="value" @input="onchange" :is_textarea="true" :rows="rows" :minChars="1" :options="history"></typeahead>`,
  props: ['name', 'value', 'rows'],
  data() {
    return { history: [] };
  },
  mixins: [ checkValidity ],
  computed: {
    localStorage_key() { return "comptex:history-textarea:" + this.name },
  },
  mounted() {
    try {
        this.history = JSON.parse(localStorage[this.localStorage_key]) || [];
    } catch (e) {}
    this.checkValidity();
  },
  beforeDestroy() {
    if (this.value) {
        localStorage[this.localStorage_key] = JSON.stringify(uniq([ this.value, ...this.history ]));
    }
  },
  watch: {
    value: 'on_value_set',
  },
  methods: {
        onchange(val) {
            this.$emit("input", val || '');
            this.checkValidity();
            return false;
        },    
  },
});