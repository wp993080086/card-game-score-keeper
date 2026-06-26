const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'node_modules/@dcloudio/uni-h5-vite/dist/plugins/pagesJson.js')
let code = fs.readFileSync(file, 'utf8')
const search = "import.meta.globEager('./locale/*.json')"
const replace = "import.meta.glob('./locale/*.json', { eager: true })"

if (code.includes(search)) {
	code = code.replace(search, replace)
	fs.writeFileSync(file, code)
	console.log('✅ 已修复 globEager -> glob + eager')
} else {
	console.log('❌ 未找到 globEager 调用')
}
