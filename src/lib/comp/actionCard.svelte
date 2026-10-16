<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

  /**
   * Komponen kartu yang dapat diklik untuk aksi utama (Input Masalah, Input Absensi).
   * Menerima kelas CSS untuk warna latar belakang dan slot 'children' untuk ikon.
   */
  let {
    label,
    class: extraClass = '',
    children,
    onclick: handleClick,
    useSVG = true,
  } = $props<{
    label?: string;
    class?: string;
    children?: Snippet;
    onclick?: void | (() => void) | (() => {});
    useSVG?: boolean;
  }>();
  let extraClass1 = $derived(twMerge("p-6 rounded-3xl text-white font-bold text-2xl flex flex-col items-center justify-center gap-4 shadow-lg hover:shadow-xl active:translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 " + extraClass));
</script>

<button
  onclick={handleClick}
  class={extraClass1}
>
  <!-- Tempat untuk ikon SVG -->
  {#if useSVG}
    <div class="h-24">
    {#if children}
      {@render children()}
    {/if}
    </div>
  {/if}
  <!-- Label teks -->
  <span>{label}</span>
</button>
