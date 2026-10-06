import DefaultTheme from 'vitepress/theme';
import { useRoute } from 'vitepress';
import type { Theme } from 'vitepress';
import mediumZoom from 'medium-zoom';
import type { Zoom } from 'medium-zoom';
import { nextTick, onMounted, watch } from 'vue';
import Mermaid from './Mermaid.vue';
import './custom.css';

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Mermaid', Mermaid);
  },
  setup() {
    const route = useRoute();
    let zoom: Zoom | undefined;
    const attach = () => {
      if (!zoom) return;
      zoom.detach();
      zoom.attach(...document.querySelectorAll<HTMLElement>('.vp-doc img'));
    };
    onMounted(() => {
      zoom = mediumZoom({ background: 'var(--vp-c-bg)' });
      attach();
    });
    watch(
      () => route.path,
      () => nextTick(attach),
    );
  },
};

export default theme;
