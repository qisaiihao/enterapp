import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

const readingFontReady = document.fonts.load("18px Huiwen-mincho").catch(() => {});
createApp(App).provide("readingFontReady", readingFontReady).mount("#app");
