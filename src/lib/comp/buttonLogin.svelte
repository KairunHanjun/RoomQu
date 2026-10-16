<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

  /**
   * This component creates a button with a 3D, "pushable" effect.
   * It uses Svelte 5 Runes for props and is styled with Tailwind CSS.
   */

    let {
      class: extraClass = '',
      children,
      onclick: onClick,
    }=$props<{
        class?: string;
        children?: Snippet;
        onclick?: any;
    }>();
    let mergeClass1 = $derived(twMerge ("flex group bg-slate-200 text-indigo-600 font-bold px-6 py-2.5 rounded-full border-b-8 border-indigo-400 hover:border-indigo-500 active:border-b-2 active:translate-y-1 transition-all duration-150 ease-in-out focus:outline-none focus:ring-4 focus:ring-indigo-300 " + extraClass));
</script>

<button
  class={mergeClass1}
  onclick={onClick}
>
  <!-- The content of the button is passed in via a slot -->
  {@render children?.()}
</button>

<!--
  Alternative Style using Box Shadow (closer to the image):

  If you prefer a box-shadow that moves with the button, you can use this class list instead.
  It provides a slightly different but also very popular effect.

  class="
    bg-slate-200 text-indigo-600 font-bold
    text-2xl px-12 py-5 rounded-full
    shadow-[6px_6px_0px_theme(colors.indigo.400)]
    hover:shadow-[8px_8px_0px_theme(colors.indigo.500)]
    active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0px_theme(colors.indigo.500)]
    transition-all duration-150 ease-in-out
    focus:outline-none focus:ring-4 focus:ring-indigo-300
    {extraClass}
  "
-->
