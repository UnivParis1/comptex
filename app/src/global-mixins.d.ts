import Vue from "vue";
import conf from './conf';

declare module 'vue' {
  interface ComponentCustomProperties {
    default_attrs_title: Dictionary<string>
    conf: typeof conf
  }
}
