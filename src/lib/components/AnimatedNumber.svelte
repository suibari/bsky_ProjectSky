<script lang="ts">
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { formatScore } from "$lib/utils/format";

  let { value } = $props<{ value: number }>();

  // Use a store to handle the animation
  // Initialize with the prop value so it doesn't animate from 0 on mount
  const displayedValue = tweened(value, {
    duration: 1000,
    easing: cubicOut,
  });

  // Watch for changes in the prop 'value' and update the store
  $effect(() => {
    displayedValue.set(value);
  });
</script>

<span>{formatScore(Math.floor($displayedValue))}</span>
