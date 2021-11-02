import { h, hydrate } from 'preact';

declare const __PAGE__: any, __PROPS__: any;

if (typeof window !== 'undefined') hydrate(<__PAGE__ {...__PROPS__} />, document.getElementById('root')!);
