import { defineComponent } from 'vue'

export const dialogStub = defineComponent({
  props: { modelValue: Boolean },
  template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
})
