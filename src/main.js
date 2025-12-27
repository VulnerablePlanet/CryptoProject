import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

// Install Pinia
app.use(createPinia())

// Install Router
app.use(router)

// Mount app
app.mount('#app')
