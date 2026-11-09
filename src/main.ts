import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/literata';
import '@fontsource-variable/roboto';
import '@fontsource-variable/roboto-mono';
import App from './App.svelte';
import './app.css';

registerSW({ immediate: true });

export default mount(App, { target: document.getElementById('app')! });
