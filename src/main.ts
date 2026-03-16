import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Aura from "@primeuix/themes/aura";
import { definePreset } from "@primeuix/themes";
import "primeicons/primeicons.css";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);
const pinia = createPinia();
const MyPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
        // TODO: Define light mode colors here, or rely on Aura's defaults
      },
      dark: {
        // TODO: Define dark mode colors here, or rely on Aura's defaults
      },
    },
  },
  components: {
    // TODO: Define component-specific overrides here
    // Tighten up padding and spacing for a more compact UI
  },
});

app.use(pinia);
app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
    options: {
      cssLayer: {
        name: "primevue",
        order: "theme, base, primevue, app",
      },
      darkModeSelector: '[data-theme="dark"]',
    },
  },
});
app.use(ConfirmationService);
app.use(ToastService);
app.mount("#app");
