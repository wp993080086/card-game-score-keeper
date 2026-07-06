import { createSSRApp } from 'vue'
import App from './App.vue'
import uniPopup from '@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue'
import uniTransition from '@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue'

export function createApp() {
	const app = createSSRApp(App)
	app.component('UniPopup', uniPopup)
	app.component('UniTransition', uniTransition)
	return {
		app
	}
}
