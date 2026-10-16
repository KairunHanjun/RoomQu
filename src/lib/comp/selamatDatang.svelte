<script lang="ts">
	import { twMerge } from "tailwind-merge";

    let {
    /**
     * Optional additional CSS classes to merge with the base styles.
     * @type {string}
     * @default ''
     */
    class: extraClass = '',

    /**
     * Optional addtional Style to merge with the base styles.
     * @type {string}
     * @default ''
    */
    style: extraStyle = '',

    /**
     * The width of the button (e.g., '150px', '10rem', 'auto').
     * @type {string}
     * @default '12rem'
     */
    text1Size = '4rem',

    /**
     * The height of the button (e.g., '50px', '3rem', 'auto').
     * @type {string}
     * @default '10rem'
     */
    text2Size = '2rem',

    /**
     * Text one bold?
     * @type {boolean}
     * @default false
    */
    text1Bold = false,

    /**
     * Text two bold?
     * @type {boolean}
     * @default false
    */
   text2Bold = false,

   /**
     * Text one say.....
     * @type {string}
     * @default ''
    */
    sayText1 = '',

    /**
     * What did text two said?
     * @type {string}
     * @default ''
    */
   text2Say = ''
  } = $props<{
    class?: string;
    style?: string;
    text1Size?: string;
    text2Size?: string;
    text1Bold?: boolean;
    text2Bold?: boolean;
    sayText1?: string;
    text2Say?: string;
  }>();
  const mergedClass = $derived(twMerge("flex-col w-fit h-fit p-4 m-2 justify-center-safe items-center-safe bg-transparent " + extraClass));
</script>

<div class={mergedClass}>
    <p class="text-center {text1Bold ? 'font-bold' : ''} text-white" style="font-size: {text1Size};"> {sayText1} </p>
    <p class="text-center {text2Bold ? 'font-bold' : ''} text-white" style="font-size: {text2Size};"> {text2Say} </p>
</div>
