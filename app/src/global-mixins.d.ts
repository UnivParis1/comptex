import Vue from "vue";
import conf from './conf';

declare module "vue/types/vue" {
  interface Vue {
    default_attrs_title: Dictionary<string>
    conf: typeof conf
  }
}
