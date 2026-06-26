// 如果根目录有`postcss.config.js`,Vite 会默认优先使用它;
// 所以不需要再配置`vite.config.ts`里的 postcss 配置对象;
// 依赖`autoprefixer`和`postcss-preset-env`插件
export default {
	plugins: {
		// 自动添加浏览器前缀（如 -webkit-、-moz-）
		autoprefixer: {},
		// 将现代CSS语法（如CSS Variables、Custom Selectors等）转换为兼容旧浏览器的代码
		// 不填写browsers,会自动读取 package.json 的 browserslist
		'postcss-preset-env': {
			// 启用CSS新特性转换（如CSS Grid、Flexbox等）
			// 可根据需求添加其他特性
			features: {
				'custom-properties': true, // 处理CSS变量
				'nesting-rules': true // 处理CSS嵌套
			}
		}
	}
}
