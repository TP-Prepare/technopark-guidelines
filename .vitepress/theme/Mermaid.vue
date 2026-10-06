<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';

const props = defineProps<{ code: string }>();
const { isDark } = useData();
const svg = ref('');
const error = ref('');
const mounted = ref(false);
let counter = 0;
let seq = 0;
const uid = `mermaid-${Math.random().toString(36).slice(2)}`;

async function draw(): Promise<void> {
  const run = ++seq;
  try {
    // mermaid работает только с DOM, поэтому грузится на клиенте и только здесь.
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark.value ? 'dark' : 'default',
      securityLevel: 'strict',
    });
    const result = await mermaid.render(`${uid}-${counter++}`, decodeURIComponent(props.code));
    if (run !== seq) return;
    svg.value = result.svg;
    error.value = '';
  } catch (e) {
    if (run !== seq) return;
    error.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(async () => {
  mounted.value = true;
  await draw();
});
watch(isDark, () => {
  if (mounted.value) void draw();
});
</script>

<template>
  <pre v-if="error" class="mermaid-error">{{ error }}</pre>
  <div v-else class="mermaid-diagram" v-html="svg" />
</template>
